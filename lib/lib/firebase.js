"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fb = exports.functions = exports.storage = exports.rtdb = exports.db = exports.auth = exports.app = void 0;
exports.signInGoogle = signInGoogle;
exports.signOutNow = signOutNow;
// src/lib/firebase.ts
const app_1 = require("firebase/app");
const auth_1 = require("firebase/auth");
const firestore_1 = require("firebase/firestore");
const database_1 = require("firebase/database");
const storage_1 = require("firebase/storage");
const functions_1 = require("firebase/functions");
// Match your .env values from earlier messages
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FB_API_KEY,
    authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FB_PROJECT_ID,
    databaseURL: import.meta.env.VITE_FB_DATABASE_URL,
    storageBucket: import.meta.env.VITE_FB_STORAGE, // <- you had VITE_FB_STORAGE
    appId: import.meta.env.VITE_FB_APP_ID,
    // Optional: add if you actually have them
    // messagingSenderId: import.meta.env.VITE_FB_MSG_SENDER_ID,
    // measurementId: import.meta.env.VITE_FB_MSID,
};
// ✅ export the app (with hot-reload safety)
exports.app = (0, app_1.getApps)().length ? (0, app_1.getApp)() : (0, app_1.initializeApp)(firebaseConfig);
// Singletons
exports.auth = (0, auth_1.getAuth)(exports.app);
exports.db = (0, firestore_1.getFirestore)(exports.app);
exports.rtdb = (0, database_1.getDatabase)(exports.app);
exports.storage = (0, storage_1.getStorage)(exports.app);
// Functions (region set where you deployed, e.g., us-central1)
exports.functions = (0, functions_1.getFunctions)(exports.app, "us-central1");
// Convenience auth helpers
const provider = new auth_1.GoogleAuthProvider();
async function signInGoogle() { await (0, auth_1.signInWithPopup)(exports.auth, provider); }
async function signOutNow() { await (0, auth_1.signOut)(exports.auth); }
// Optional grouped export
exports.fb = { app: exports.app, auth: exports.auth, db: exports.db, rtdb: exports.rtdb, storage: exports.storage, functions: exports.functions };
//# sourceMappingURL=firebase.js.map