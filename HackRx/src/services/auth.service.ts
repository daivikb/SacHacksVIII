/**
 * Authentication + profile access layer.
 *
 * Everything that talks to Firebase Authentication or the user's
 * Firestore profile lives here.
 */

import { z } from "zod";

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

import { auth, db, isFirebaseConfigured } from "@/integrations/firebase/client";

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
 * Returns a friendly error if Firebase has not been configured yet.
 */
function configurationError(): string | null {
  if (!isFirebaseConfigured) {
    return "Firebase is not configured yet. Add the Firebase environment variables before using authentication.";
  }

  return null;
}

/**
 * Creates a Firebase Authentication account and an initial Firestore profile.
 */
export async function signUp(values: SignUpValues): Promise<string | null> {
  const configError = configurationError();
  if (configError) return configError;

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      values.email.trim(),
      values.password,
    );

    await setDoc(doc(db, "users", credential.user.uid), {
      email: credential.user.email ?? values.email.trim(),
      full_name: null,
      username: null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Unable to create your account";
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
  const configError = configurationError();
  if (configError) return configError;

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
  const configError = configurationError();
  if (configError) return configError;

  try {
    const provider = new GoogleAuthProvider();

    await signInWithPopup(auth, provider);

    return null;
  } catch (error) {
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
  const configError = configurationError();
  if (configError) return configError;

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
  if (!isFirebaseConfigured) return;

  await firebaseSignOut(auth);
}

/**
 * Retrieves the application profile stored in Firestore.
 */
export async function fetchProfile(
  userId: string,
): Promise<Profile | null> {
  if (!isFirebaseConfigured) return null;

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
  const configError = configurationError();
  if (configError) return configError;

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
  const configError = configurationError();
  if (configError) return configError;

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
  const configError = configurationError();
  if (configError) return configError;

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