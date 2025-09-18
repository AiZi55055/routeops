// src/lib/firebase.ts
// Firebase singletons (app, auth, db, rtdb, storage, functions) + helpers.
// - Keeps session with browserLocalPersistence
// - Exposes functions in region "asia-southeast1"
// - Robust Google Sign-In (popup with fallback to redirect)
// - Optional emulator wiring via VITE_USE_EMULATORS=true

import { initializeApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  browserPopupRedirectResolver,
  signOut,
  connectAuthEmulator,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";

/* ================= Config ================= */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
  databaseURL: import.meta.env.VITE_DATABASE_URL,
};

export const app = initializeApp(firebaseConfig);

/* ================= Services ================= */

export const auth = getAuth(app);
// keep user signed in across reloads
setPersistence(auth, browserLocalPersistence).catch((e) => {
  console.warn("Auth persistence failed:", e);
});

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-southeast1");

/* ================= Emulator wiring ================= */

const USE_EMUS =
  import.meta.env.VITE_USE_EMULATORS === "true" ||
  (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== "false");

if (USE_EMUS) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  } catch {}
  try {
    connectFirestoreEmulator(db, "localhost", 8080);
  } catch {}
  try {
    connectDatabaseEmulator(rtdb, "localhost", 9000);
  } catch {}
  try {
    connectFunctionsEmulator(functions, "localhost", 5001);
  } catch {}
  try {
    connectStorageEmulator(storage, "localhost", 9199);
  } catch {}
  console.log("[FB] emulators connected");
}

/* ================= Auth helpers ================= */

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function signInWithGoogle() {
  try {
    const cred = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    return cred.user;
  } catch {
    await signInWithRedirect(auth, googleProvider);
    return null;
  }
}

export async function handleRedirectResult() {
  try {
    const res = await getRedirectResult(auth);
    if (res?.user) {
      console.log("[Auth] redirect sign-in success:", res.user.uid);
    }
  } catch (e) {
    console.warn("[Auth] redirect sign-in failed:", e);
  }
}

export async function signOutUser() {
  await signOut(auth);
}

/* ================= Callable wrappers ================= */

// Optimizer
export const callOptimize = (data: any) =>
  httpsCallable(functions, "optimizeRoutesV2")(data);

// Enrich one route
export const callEnrichRoute = (data: { routeId: string; force?: boolean }) =>
  httpsCallable(functions, "enrichRoutePolylines")(data);

// Enrich all routes
export const callEnrichAll = (data: { limit?: number; force?: boolean }) =>
  httpsCallable(functions, "enrichAllRoutes")(data);

/* ================= Diagnostics ================= */

console.log(
  "[FB-INIT]",
  window.location.origin,
  "key suffix:",
  (firebaseConfig.apiKey || "").slice(-8)
);
console.log("FB key suffix", (import.meta.env.VITE_FB_API_KEY || "").slice(-8));
console.log("Maps key suffix", (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").slice(-8));
