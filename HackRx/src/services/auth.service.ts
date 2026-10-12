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

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "@/integrations/firebase/client";

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

/** Answer options for the participant registration form. */
export const AGE_RANGES = ["Under 18", "18–20", "21–24", "25–29", "30+"];
export const GENDER_SELF_DESCRIBE = "Prefer to self-describe";
export const GENDERS = ["Male", "Female", "Non-binary", GENDER_SELF_DESCRIBE, "Prefer not to say"];
export const ETHNICITIES = [
  "Asian",
  "Black / African American",
  "Hispanic / Latino",
  "White",
  "Middle Eastern / North African",
  "Native American / Alaska Native",
  "Native Hawaiian / Pacific Islander",
  "Other",
  "Prefer not to say",
];
export const INSTITUTION_OTHER = "Other (please specify)";
export const INSTITUTIONS = [
  "UC Davis",
  "Sacramento State",
  "Community College",
  INSTITUTION_OTHER,
  "Not currently a student",
];
export const ACADEMIC_STANDINGS = [
  "High School",
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "Graduate / Professional Student",
  "Medical Student",
  "Recent Graduate / Working Professional",
];
export const HIGH_SCHOOL = "High School";
export const HACKATHON_EXPERIENCE = [
  "Yes",
  "No, I've attended 1–2",
  "No, I've attended 3 or more",
];
export const INTEREST_AREAS = [
  "AI / Machine Learning",
  "Software / Web Development",
  "Data Science",
  "UI/UX Design",
  "Hardware / Engineering",
  "Healthcare / Medicine",
  "Biotechnology / Biomedical Research",
  "Business / Entrepreneurship",
  "Other",
];
export const MAX_MOTIVATIONS = 3;
export const MOTIVATIONS = [
  "Building a project",
  "Learning new skills",
  "Networking / Meeting people",
  "Exploring healthcare innovation",
  "Competing for prizes",
  "Finding internship / Career opportunities",
  "Having fun with friends",
];
export const TEAM_STATUSES = [
  "Yes, I have a team",
  "Yes, but we're looking for more teammates",
  "No, I'd like help finding a team",
  "No, I prefer working solo",
];
export const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
export const DIETARY_OTHER = "Other (please specify)";
export const DIETARY_OPTIONS = [
  "None",
  "Vegetarian",
  "Vegan",
  "Halal",
  "Kosher",
  "Gluten-free",
  "Nut allergy",
  DIETARY_OTHER,
];
export const REFERRAL_SOURCES = [
  "Instagram / Social Media",
  "Email from SacHacks",
  "University email / Newsletter",
  "Friends / Word of mouth",
  "Student club / Organization",
  "Professor / Faculty",
  "Flyers / Campus promotion",
  "Previous SacHacks event",
  "Online search",
  "Luma",
  "Other",
];

export const CODE_OF_CONDUCT_URL =
  "https://github.com/SacHacksHackathon/sachacks-policies/blob/main/code-of-conduct.md";

/** Resume upload limits. */
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"];

export function validateResume(file: File | null): string | null {
  if (!file) return "Please upload your résumé";
  const name = file.name.toLowerCase();
  if (!RESUME_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "Upload a PDF or Word document";
  }
  if (file.size > RESUME_MAX_BYTES) return "Keep your résumé under 5 MB";
  return null;
}

/** Full registration: the account plus the details organisers review. */
export const registerSchema = z
  .object({
    full_name: z.string().trim().min(1, "Enter your full name").max(100, "Keep this under 100 characters"),
    email: z.string().trim().email("Please enter a valid email").max(255),
    phone: z
      .string()
      .trim()
      .max(30, "Keep this under 30 characters")
      .regex(/^[0-9+()\-.\s]*$/, "Enter a valid phone number"),
    age_range: z.string().refine((v) => AGE_RANGES.includes(v), "Select your age range"),
    gender: z.string(),
    gender_self: z.string().trim().max(60, "Keep this under 60 characters"),
    ethnicity: z.array(z.string()),
    institution: z.string().refine((v) => INSTITUTIONS.includes(v), "Select your school or institution"),
    institution_other: z.string().trim().max(120, "Keep this under 120 characters"),
    academic_standing: z
      .string()
      .refine((v) => ACADEMIC_STANDINGS.includes(v), "Select your academic standing"),
    high_school_case: z.string().trim().max(2000, "Keep this under 2000 characters"),
    major: z.string().trim().min(1, "Enter your major or field of study (N/A if not applicable)").max(120, "Keep this under 120 characters"),
    first_hackathon: z
      .string()
      .refine((v) => HACKATHON_EXPERIENCE.includes(v), "Select your hackathon experience"),
    interests: z.array(z.string()).min(1, "Select at least one area"),
    motivations: z
      .array(z.string())
      .min(1, "Select at least one option")
      .max(MAX_MOTIVATIONS, `Select up to ${MAX_MOTIVATIONS}`),
    github: z
      .string()
      .trim()
      .max(200, "Keep this under 200 characters")
      .regex(/^(https:\/\/(www\.)?github\.com\/[A-Za-z0-9-]+\/?)?$/, "Enter a link such as https://github.com/username"),
    code_of_conduct: z.boolean().refine((v) => v, "You must agree to the Code of Conduct"),
    signature: z.string().trim().min(1, "Type your full name to agree").max(100, "Keep this under 100 characters"),
    team_status: z.string().refine((v) => TEAM_STATUSES.includes(v), "Select your team status"),
    tshirt_size: z.string().refine((v) => TSHIRT_SIZES.includes(v), "Select your T-shirt size"),
    dietary: z.array(z.string()),
    dietary_other: z.string().trim().max(120, "Keep this under 120 characters"),
    referral_source: z
      .string()
      .refine((v) => REFERRAL_SOURCES.includes(v), "Select how you heard about SacHacks"),
    goals: z.string().trim().max(2000, "Keep this under 2000 characters"),
    additional_info: z.string().trim().max(2000, "Keep this under 2000 characters"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be under 72 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.academic_standing !== HIGH_SCHOOL || v.high_school_case.length > 0, {
    message: "High school applicants must complete this statement",
    path: ["high_school_case"],
  })
  .refine((v) => !v.dietary.includes(DIETARY_OTHER) || v.dietary_other.length > 0, {
    message: "Please specify your dietary restriction",
    path: ["dietary_other"],
  })
  .refine((v) => v.institution !== INSTITUTION_OTHER || v.institution_other.length > 0, {
    message: "Tell us which school or institution",
    path: ["institution_other"],
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
 * users/{uid}         full_name, email
 * applications/{uid}  every answer on the application form, status: "pending"
 *
 * Storage structure:
 *
 * resumes/{uid}/{file name}
 *
 * The admin workspace matches the two documents by email, so both store the
 * same one.
 */
export async function register(
  values: RegisterValues,
  resume: File,
): Promise<string | null> {
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
    const resumeRef = ref(storage, `resumes/${uid}/${resume.name}`);
    await uploadBytes(resumeRef, resume, { contentType: resume.type || undefined });
    const resumeUrl = await getDownloadURL(resumeRef);

    await setDoc(doc(db, "users", uid), {
      user_uid: uid,
      email,
      full_name: values.full_name,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    await setDoc(doc(db, "applications", uid), {
      user_id: uid,
      email,
      full_name: values.full_name,
      phone: values.phone || null,
      age_range: values.age_range,
      gender:
        values.gender === GENDER_SELF_DESCRIBE
          ? values.gender_self || "Self-described"
          : values.gender || null,
      ethnicity: values.ethnicity,
      institution:
        values.institution === INSTITUTION_OTHER
          ? values.institution_other
          : values.institution,
      academic_standing: values.academic_standing,
      high_school_case:
        values.academic_standing === HIGH_SCHOOL ? values.high_school_case : null,
      major: values.major,
      first_hackathon: values.first_hackathon,
      interests: values.interests,
      motivations: values.motivations,
      resume_url: resumeUrl,
      resume_name: resume.name,
      github: values.github || null,
      code_of_conduct_agreed: values.code_of_conduct,
      consent_signature: values.signature,
      team_status: values.team_status,
      tshirt_size: values.tshirt_size,
      dietary: values.dietary.map((d) =>
        d === DIETARY_OTHER ? values.dietary_other : d,
      ),
      referral_source: values.referral_source,
      goals: values.goals || null,
      additional_info: values.additional_info || null,
      status: "pending",
      created_at: serverTimestamp(),
    });

    return null;
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    return `Your account was created, but we couldn't save your application${detail}. Please contact the organisers.`;
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