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
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  addDoc,
} from "firebase/firestore";

import {
  db,
  isFirebaseConfigured,
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
  if (!isFirebaseConfigured) return false;
  try {
    const snapshot = await getDoc(doc(db, "user_roles", userId));
    return snapshot.exists() && snapshot.data().role === "admin";
  } catch {
    return false;
  }
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
 */
export async function fetchAdminWorkspace(): Promise<{
  data: AdminWorkspace | null;
  error: string | null;
}> {
  if (!isFirebaseConfigured) {
    return {
      data: null,
      error:
        "Firebase is not configured yet. Add the Firebase environment variables before loading the admin workspace.",
    };
  }

  try {
    const [
      applicationsSnapshot,
      teamsSnapshot,
      demosSnapshot,
      membersSnapshot,
      certificationsSnapshot,
    ] = await Promise.all([
      getDocs(
        query(
          collection(db, "applications"),
          orderBy("created_at", "desc"),
        ),
      ),

      getDocs(
        query(
          collection(db, "teams"),
          orderBy("formed_at", "desc"),
        ),
      ),

      getDocs(
        query(
          collection(db, "demos"),
          orderBy("created_at", "desc"),
        ),
      ),

      getDocs(
        query(
          collection(db, "users"),
          orderBy("created_at", "desc"),
        ),
      ),

      getDocs(
        query(
          collection(db, "certifications"),
          orderBy("issued_at", "desc"),
        ),
      ),
    ]);

    const applications = applicationsSnapshot.docs.map((entry) => ({
      id: entry.id,
      ...entry.data(),
    })) as Application[];

    const teams = teamsSnapshot.docs.map((entry) => ({
      id: entry.id,
      ...entry.data(),
    })) as Team[];

    const demos = demosSnapshot.docs.map((entry) => ({
      id: entry.id,
      ...entry.data(),
    })) as Demo[];

    const members = membersSnapshot.docs.map((entry) => ({
      id: entry.id,
      ...entry.data(),
    })) as Member[];

    const certifications = certificationsSnapshot.docs.map((entry) => ({
      id: entry.id,
      ...entry.data(),
    })) as Certification[];

    return {
      data: {
        applications,
        teams,
        demos,
        members,
        certifications,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load admin workspace",
    };
  }
}

/**
 * Reviews an application.
 */
export async function reviewApplication(
  id: string,
  status: ApplicationStatus,
  reviewerId: string,
): Promise<string | null> {
  if (!isFirebaseConfigured) {
    return "Firebase is not configured yet.";
  }

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
  if (!isFirebaseConfigured) {
    return "Firebase is not configured yet.";
  }

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