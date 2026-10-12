/**
 * Authentication + profile access layer.
 *
 * Everything that talks to Firebase Authentication or the user's
 * Firestore profile lives here.
 */

import { z } from "zod";
import { adminLogout } from "@/services/admin.service";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateEmail as firebaseUpdateEmail,
  updatePassword as firebaseUpdatePassword,
} from "firebase/auth";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "@/integrations/firebase/client";

export const signUpSchema = z
  .object({
    email: z.string().trim().email("Please enter a valid email").max(255),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be under 72 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/** Full registration: the account plus the details organisers review. */
export const registerSchema = z
  .object({
    full_name: z.string().trim().min(1, "Enter your full name").max(100, "Keep this under 100 characters"),
    username: z.string().trim().max(40, "Keep this under 40 characters").optional(),
    institution: z.string().trim().min(1, "Enter your school or organisation").max(120, "Keep this under 120 characters"),
    email: z.string().trim().email("Please enter a valid email").max(255),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be under 72 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email or username").max(255),
  password: z.string().min(1, "Please enter your password"),
});

export const forgotSchema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
});

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .max(100, "Keep this under 100 characters")
    .optional(),

  username: z
    .string()
    .trim()
    .max(40, "Keep this under 40 characters")
    .optional(),
});

export type SignUpValues = z.infer<typeof signUpSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type LoginValues = z.infer<typeof loginSchema>;
export type ForgotValues = z.infer<typeof forgotSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
}

/**
 * Creates a Firebase Authentication account and an initial Firestore profile.
 */
export async function signUp(values: SignUpValues): Promise<string | null> {
  try {
    console.log("1. Starting signup");

    const credential = await createUserWithEmailAndPassword(
      auth,
      values.email.trim(),
      values.password,
    );

    adminLogout();
    console.log("2. Auth user created:", credential.user.uid);
    console.log("3. Firestore project:", db.app.options.projectId);

    const userRef = doc(db, "users", credential.user.uid);

    console.log("4. Attempting Firestore write");

    await setDoc(userRef, {
      user_uid: credential.user.uid,
      email: credential.user.email ?? values.email.trim(),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    console.log("5. Firestore write completed");

    const snapshot = await getDoc(userRef);
    console.log("6. Document exists:", snapshot.exists());

    return null;
  } catch (error) {
    const e = error as { code?: string; message?: string };
    console.error("SIGNUP DEBUG ERROR:", e.code, e.message, error);
    return e.message ?? "Unable to create your account";
  }
}

/**
 * Creates an account together with everything the admin roster displays.
 *
 * Firestore structure:
 *
 * users/{uid}         full_name, username, email
 * applications/{uid}  full_name, email, institution, status: "pending"
 *
 * The admin workspace matches the two by email, so both store the same one.
 */
export async function register(values: RegisterValues): Promise<string | null> {
  let uid: string;
  let email: string;

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      values.email.trim(),
      values.password,
    );
    uid = credential.user.uid;
    email = credential.user.email ?? values.email.trim();
    adminLogout();
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Unable to create your account";
  }

  try {
    await setDoc(doc(db, "users", uid), {
      user_uid: uid,
      email,
      full_name: values.full_name,
      username: values.username || null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    await setDoc(doc(db, "applications", uid), {
      user_id: uid,
      email,
      full_name: values.full_name,
      institution: values.institution,
      status: "pending",
      created_at: serverTimestamp(),
    });

    return null;
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    return `Your account was created, but we couldn't save your details${detail}. Log in and try again from your account page.`;
  }
}

/**
 * Signs in with an email address.
 *
 * Username authentication previously depended on a Supabase Edge Function.
 * We intentionally do not perform a client-side username -> email lookup
 * because that would create an email-enumeration/privacy problem.
 *
 * Username login will be implemented later through a Firebase backend
 * function once the Firebase project and Functions layer exist.
 */
export async function signIn(values: LoginValues): Promise<string | null> {
  const identifier = values.email.trim();

  if (!identifier.includes("@")) {
    return "Username login is not available yet. Please sign in with your email address.";
  }

  try {
    await signInWithEmailAndPassword(
      auth,
      identifier,
      values.password,
    );
    // A participant session replaces any admin session left open in this tab.
    adminLogout();

    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Invalid login credentials";
  }
}

/**
 * Signs in with Google using Firebase Authentication.
 */
export async function signInWithGoogle(): Promise<string | null> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    adminLogout();

    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);

    // Create the profile only on first Google sign-in
    if (!snapshot.exists()) {
      await setDoc(userRef, {
        user_uid: user.uid,
        email: user.email,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    }

    return null;
  } catch (error) {
    console.error("Google sign-in failed:", error);
    return error instanceof Error
      ? error.message
      : "Unable to sign in with Google";
  }
}

/**
 * Sends a Firebase password-reset email.
 */
export async function sendPasswordReset(
  values: ForgotValues,
): Promise<string | null> {
  try {
    await sendPasswordResetEmail(auth, values.email.trim(), {
      url: `${window.location.origin}/account`,
    });

    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Unable to send password reset email";
  }
}

/**
 * Signs out the current Firebase user.
 */
export async function signOut(): Promise<void> {
  adminLogout();
  await firebaseSignOut(auth);
}

/**
 * Retrieves the application profile stored in Firestore.
 */
export async function fetchProfile(
  userId: string,
): Promise<Profile | null> {
  try {
    const snapshot = await getDoc(doc(db, "users", userId));

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();

    return {
      id: snapshot.id,
      email: typeof data.email === "string" ? data.email : null,
      full_name:
        typeof data.full_name === "string" ? data.full_name : null,
      username:
        typeof data.username === "string" ? data.username : null,
    };
  } catch {
    return null;
  }
}

/**
 * Updates the application profile in Firestore.
 */
export async function updateProfile(
  userId: string,
  values: ProfileValues,
): Promise<string | null> {
  try {
    await setDoc(
      doc(db, "users", userId),
      {
        full_name: values.full_name || null,
        username: values.username || null,
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );

    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Unable to update your profile";
  }
}

/**
 * Updates the password for the currently authenticated Firebase user.
 *
 * Firebase may require recent authentication before allowing this
 * operation. The caller can surface Firebase's reauthentication error
 * and we can add a reauthentication flow when the account UI requires it.
 */
export async function updatePassword(
  password: string,
): Promise<string | null> {
  if (!auth.currentUser) {
    return "You must be signed in to change your password.";
  }

  try {
    await firebaseUpdatePassword(auth.currentUser, password);
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Unable to update your password";
  }
}

/**
 * Updates the email address for the currently authenticated Firebase user.
 */
export async function updateEmail(
  email: string,
): Promise<string | null> {
  if (!auth.currentUser) {
    return "You must be signed in to change your email.";
  }

  try {
    await firebaseUpdateEmail(auth.currentUser, email.trim());

    await setDoc(
      doc(db, "users", auth.currentUser.uid),
      {
        email: email.trim(),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );

    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Unable to update your email";
  }
}