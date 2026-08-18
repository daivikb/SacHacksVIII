/**
 * Firebase client initialization.
 *
 * This module is the single low-level entry point for Firebase.
 * Application code should import Firebase services from here rather than
 * initializing Firebase directly.
 *
 * Firebase configuration is intentionally allowed to be absent during
 * development while the application architecture is being migrated.
 */

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

/**
 * During the migration we do not have a Firebase project yet.
 *
 * Firebase's client SDK still needs an initialized app so that the rest
 * of the application can compile and be developed. These placeholder
 * values are deliberately non-secret and are replaced by the real
 * Firebase project configuration later.
 */
const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
);

const effectiveConfig = hasFirebaseConfig
  ? firebaseConfig
  : {
    apiKey: "development-placeholder",
    authDomain: "development-placeholder.firebaseapp.com",
    projectId: "development-placeholder",
    storageBucket: "development-placeholder.appspot.com",
    messagingSenderId: "development-placeholder",
    appId: "development-placeholder",
  };

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(effectiveConfig);

export const auth = getAuth(firebaseApp);

export const db = getFirestore(firebaseApp);

export const storage = getStorage(firebaseApp);

export const isFirebaseConfigured = hasFirebaseConfig;