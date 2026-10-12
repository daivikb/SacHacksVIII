/**
 * Admin workspace data access layer.
 *
 * This module contains the application-facing admin operations.
 * It communicates with Firestore rather than exposing Firebase SDK
 * operations to React components.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  addDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/integrations/firebase/client";

import {
  signIn,
  signOut,
  type LoginValues,
} from "@/services/auth.service";

/**
 * These types intentionally remain flexible during the migration.
 *
 * The old versions were generated from Supabase's database schema.
 * Firestore does not generate equivalent relational table types, and
 * we should not guess fields that the admin UI may depend on.
 *
 * Once we inspect the admin components, these can be tightened into
 * explicit application models.
 */

export type Application = {
  id: string;
  [key: string]: unknown;
};

export type Team = {
  id: string;
  [key: string]: unknown;
};

export type Demo = {
  id: string;
  [key: string]: unknown;
};

export type Member = {
  id: string;
  [key: string]: unknown;
};

export type Certification = {
  id: string;
  [key: string]: unknown;
};

export interface AdminWorkspace {
  applications: Application[];
  teams: Team[];
  demos: Demo[];
  members: Member[];
  certifications: Certification[];
}

export type ApplicationStatus = "approved" | "rejected";


/**
 * Checks whether a user is an admin.
 *
 * Firestore structure:
 *
 * users/{userId}
 *   admin: true
 *
 * Only an explicit `true` counts; a missing field, `false`, or any other
 * value means "not an admin". The flag is granted from the Firebase console
 * (or the Admin SDK) — firestore.rules stop users from setting it on
 * themselves. This client-side check only controls the UI; the rules are
 * what actually protect the data.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const snapshot = await getDoc(doc(db, "users", userId));
    return snapshot.exists() && snapshot.data().admin === true;
  } catch {
    return false;
  }
}

/**
 * Signs in through the admin dialog: a normal Firebase email sign-in,
 * followed by a check of the account's `admin` flag. Non-admin accounts
 * are signed straight back out so they don't land in a half-logged-in state.
 */
export async function signInAsAdmin(values: LoginValues): Promise<string | null> {
  const error = await signIn(values);
  if (error) return error;

  const uid = auth.currentUser?.uid;
  if (uid && (await isAdmin(uid))) return null;

  await signOut();
  return "This account doesn't have admin access.";
}

/** Firestore Timestamp (or anything else) -> millis, for newest-first sorting. */
function toMillis(value: unknown): number {
  const ts = value as { toMillis?: () => number } | null | undefined;
  return typeof ts?.toMillis === "function" ? ts.toMillis() : 0;
}

/**
 * Reads a whole collection, newest first.
 *
 * Sorting happens here rather than with a Firestore `orderBy`, because
 * `orderBy` silently drops every document that is missing the sort field.
 */
async function readCollection<T extends { id: string }>(
  name: string,
  sortField: string,
): Promise<T[]> {
  const snapshot = await getDocs(collection(db, name));
  const rows = snapshot.docs.map((entry) => ({
    id: entry.id,
    ...entry.data(),
  })) as unknown as (T & Record<string, unknown>)[];
  return rows.sort((x, y) => toMillis(y[sortField]) - toMillis(x[sortField]));
}

/**
 * Fetches all datasets displayed by the admin workspace.
 *
 * Firestore collections replace the old Supabase tables:
 *
 * users (applications are the `application` field on each user)
 * teams
 * demos
 * users
 * certifications
 *
 * Each collection is read independently, so one that is empty, missing or
 * denied by Security Rules does not hide the others. `error` describes
 * whatever could not be loaded; `data` always holds what could.
 */
export async function fetchAdminWorkspace(): Promise<{
  data: AdminWorkspace;
  error: string | null;
}> {
  const sources = [
    ["teams", "formed_at"],
    ["demos", "created_at"],
    ["users", "created_at"],
    ["certifications", "issued_at"],
  ] as const;

  const results = await Promise.allSettled(
    sources.map(([name, sortField]) =>
      readCollection<{ id: string }>(name, sortField),
    ),
  );

  const rows = results.map((r) => (r.status === "fulfilled" ? r.value : []));
  const failed = sources
    .filter((_, i) => results[i].status === "rejected")
    .map(([name]) => name);

  let error: string | null = null;
  if (failed.length) {
    const denied = results.some(
      (r) =>
        r.status === "rejected" &&
        (r.reason as { code?: string } | null)?.code === "permission-denied",
    );
    if (denied && !auth.currentUser) {
      error =
        "Firestore refused the request because no Firebase account is signed in. " +
        "Log in with an account whose users document has admin: true to see participants.";
    } else if (denied) {
      error = `This account isn't allowed to read: ${failed.join(", ")}. Check that its users document has admin: true and that firestore.rules are deployed.`;
    } else {
      error = `Unable to load: ${failed.join(", ")}.`;
    }
  }

  const members = rows[2] as Member[];

  // Applications are stored on the applicant's user document. Each one is
  // flattened into its own row, keyed by the applicant's uid, with the
  // account's email so the roster can match it to the member.
  const applications = members
    .filter((m) => m.application && typeof m.application === "object")
    .map((m): Application => ({
      ...(m.application as Record<string, unknown>),
      id: m.id,
      user_id: m.id,
      email: m.email,
    }))
    .sort((x, y) => toMillis(y.created_at) - toMillis(x.created_at));

  return {
    data: {
      applications,
      teams: rows[0] as Team[],
      demos: rows[1] as Demo[],
      members,
      certifications: rows[3] as Certification[],
    },
    error,
  };
}

/**
 * Reviews an application.
 */
export async function reviewApplication(
  id: string,
  status: ApplicationStatus,
  reviewerId: string,
): Promise<string | null> {
  try {
    // `id` is the applicant's uid; the application is a field on their user doc.
    await updateDoc(doc(db, "users", id), {
      "application.status": status,
      "application.reviewed_by": reviewerId,
      "application.reviewed_at": serverTimestamp(),
    });

    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Unable to review application";
  }
}

/**
 * Issues a certification to a user.
 */
export async function issueCertification(
  userId: string,
  issuedBy: string,
  title: string,
): Promise<string | null> {
  try {
    const certificateCode = `HRX-${crypto
      .randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;

    await addDoc(collection(db, "certifications"), {
      user_id: userId,
      issued_by: issuedBy,
      title,
      certificate_code: certificateCode,
      issued_at: serverTimestamp(),
    });

    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Unable to issue certification";
  }
}