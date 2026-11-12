// GET /api/resume?url=<resume link>  (Vercel function)
//
// Fetches one applicant's résumé on behalf of the admin dashboard's
// "Download resumes" button. Browsers can't read Google Drive / Dropbox files
// from another origin (no CORS headers), so the file is fetched here and
// passed straight through.
//
// SECURITY
//   · Admins only. The caller sends their Firebase ID token; we read their own
//     users/{uid} doc from Firestore's REST API *with that token*. Firestore
//     verifies the token (signature, expiry, project) and the security rules
//     let a user read only their own doc, so `admin == true` there can't be
//     faked. The project id is pinned from env, never taken from the token.
//   · Not an open proxy: only https links on Google Drive/Docs and Dropbox are
//     fetched, and every redirect hop is checked against the same allowlist.
//   · Responses are capped below Vercel's 4.5 MB response limit.
//
// Env: VITE_FIREBASE_PROJECT_ID (already set for the site build).

const MAX_BYTES = 4_000_000;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 20_000;

const ALLOWED_HOSTS = [
  /^drive\.google\.com$/,
  /^docs\.google\.com$/,
  /^drive\.usercontent\.google\.com$/,
  /^[a-z0-9-]+\.googleusercontent\.com$/,
  /^(www\.)?dropbox\.com$/,
  /^([a-z0-9-]+\.)?dropboxusercontent\.com$/,
];

const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/png": "png",
  "image/jpeg": "jpg",
  "text/plain": "txt",
};

function fail(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function allowed(url: URL): boolean {
  return url.protocol === "https:" && ALLOWED_HOSTS.some((re) => re.test(url.hostname));
}

/** Share/view links → direct-download links, or the reason the link can't be fetched. */
function directLink(raw: string): URL | string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Not a valid link";
  }
  if (!allowed(url)) return "Only Google Drive, Google Docs and Dropbox links can be downloaded automatically";

  const host = url.hostname.replace(/^www\./, "");
  if (host === "drive.google.com") {
    if (url.pathname.includes("/folders/")) return "Link is a Drive folder, not a file";
    const id = url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? url.searchParams.get("id");
    if (!id) return "Couldn't find a file id in the Drive link";
    return new URL(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`);
  }
  if (host === "docs.google.com") {
    const m = url.pathname.match(/^\/(document|presentation)\/d\/([\w-]+)/);
    if (!m) return "Unsupported Google Docs link";
    return new URL(`https://docs.google.com/${m[1]}/d/${m[2]}/export?format=pdf`);
  }
  if (host === "dropbox.com") {
    if (url.pathname.startsWith("/home") || url.pathname.includes("/fo/")) return "Link is a Dropbox folder, not a file";
    url.searchParams.delete("dl");
    url.searchParams.set("dl", "1");
    return url;
  }
  return url;
}

function payload(token: string): { user_id?: string } | null {
  try {
    const part = token.split(".")[1];
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

async function isAdmin(token: string): Promise<boolean> {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const uid = payload(token)?.user_id;
  if (!projectId || !uid || !/^[\w-]+$/.test(uid)) return false;
  // Firestore rejects a forged/expired token or one for another project, so the
  // unverified uid above is only trusted once this read succeeds.
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
      `/databases/(default)/documents/users/${encodeURIComponent(uid)}?mask.fieldPaths=admin`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return false;
  const doc = (await res.json()) as { fields?: { admin?: { booleanValue?: boolean } } };
  return doc.fields?.admin?.booleanValue === true;
}

function extension(type: string, disposition: string): string {
  const fromName = disposition.match(/filename\*?=(?:UTF-8'')?"?[^";]*\.([a-z0-9]{2,5})"?/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  return EXT_BY_TYPE[type] ?? "pdf";
}

export async function GET(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return fail(401, "Sign in required");
  if (!(await isAdmin(token))) return fail(403, "Admins only");

  const target = directLink(new URL(request.url).searchParams.get("url") ?? "");
  if (typeof target === "string") return fail(422, target);

  let url = target;
  let res: Response | null = null;
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      res = await fetch(url, { redirect: "manual", signal });
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !location) break;
      const next = new URL(location, url);
      if (!allowed(next)) return fail(422, `Link redirected to an unsupported site (${next.hostname})`);
      url = next;
      res = null;
    }
  } catch {
    return fail(504, "The file host didn't respond");
  }
  if (!res) return fail(422, "Too many redirects");
  if (res.status === 404) return fail(422, "File not found (deleted or wrong link)");
  if (!res.ok) return fail(422, `File host answered ${res.status} — probably not shared publicly`);

  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  // Drive/Dropbox answer with an HTML sign-in or preview page when the file isn't public.
  if (type === "text/html") return fail(422, "Not shared publicly (got a sign-in/preview page)");
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return fail(422, "File is larger than 4 MB");

  const body = new Uint8Array(await res.arrayBuffer());
  if (body.byteLength > MAX_BYTES) return fail(422, "File is larger than 4 MB");
  if (body.byteLength === 0) return fail(422, "File is empty");

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "x-resume-ext": extension(type, res.headers.get("content-disposition") ?? ""),
      "cache-control": "no-store",
    },
  });
}
