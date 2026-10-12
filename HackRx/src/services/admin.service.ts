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


const ADMIN_EMAIL = "test123@sachacks";
const ADMIN_PASSWORD = "test123";
const ADMIN_FLAG = "hackrx_admin_session";

export function adminLogin(email: string, password: string): boolean {
  const ok =
    email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD;
  if (ok) sessionStorage.setItem(ADMIN_FLAG, "1");
  return ok;
}

export function isHardcodedAdmin(): boolean {
  return sessionStorage.getItem(ADMIN_FLAG) === "1";
}

export function adminLogout(): void {
  sessionStorage.removeItem(ADMIN_FLAG);
}

/**
 * Checks whether a user has an admin role.
 *
 * Firestore structure:
 *
 * user_roles/{userId}
 *   role: "admin"
 *
 * Authorization must ultimately also be enforced by Firestore Security
 * Rules or trusted backend code. This client-side check is only for
 * controlling the UI.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const snapshot = await getDoc(doc(db, "user_roles", userId));
    return snapshot.exists() && snapshot.data().role === "admin";
  } catch {
    return false;
  }
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
 * applications
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
    ["applications", "created_at"],
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
        "Log in with a Firebase account that has the admin role to see participants.";
    } else if (denied) {
      error = `This account isn't allowed to read: ${failed.join(", ")}. Check its admin role and the Firestore rules.`;
    } else {
      error = `Unable to load: ${failed.join(", ")}.`;
    }
  }

  return {
    data: {
      applications: rows[0] as Application[],
      teams: rows[1] as Team[],
      demos: rows[2] as Demo[],
      members: rows[3] as Member[],
      certifications: rows[4] as Certification[],
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
    await updateDoc(doc(db, "applications", id), {
      status,
      reviewed_by: reviewerId,
      reviewed_at: serverTimestamp(),
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