// functions/src/index.ts
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

setGlobalOptions({ region: "asia-southeast1" });

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Optional: connect to emulators if running locally
if (process.env.FUNCTIONS_EMULATOR === "true") {
  const firestorePort = process.env.FIRESTORE_EMULATOR_HOST?.split(":")[1] || "8080";
  const authPort = process.env.FIREBASE_AUTH_EMULATOR_PORT || "9099";
  const rtdbPort = process.env.FIREBASE_DATABASE_EMULATOR_PORT || "9000";
  const storagePort = process.env.FIREBASE_STORAGE_EMULATOR_PORT || "9199";

  console.log("[INDEX] Using local emulators:", {
    firestorePort,
    authPort,
    rtdbPort,
    storagePort,
  });

  // Firestore emulator
  process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${firestorePort}`;
  // Auth emulator
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${authPort}`;
  // RTDB emulator
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = `127.0.0.1:${rtdbPort}`;
  // Storage emulator
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = `127.0.0.1:${storagePort}`;
}

/* ================== Exports ================== */

export { optimizeRoutesV2 } from "./optimizeRoutesV2";
export { enrichRoutePolylines } from "./enrichRoute";
export { enrichAllRoutes } from "./enrichAllRoutes";

export { seedMockJobs } from "./seedMock";
export { optimizeRoutes } from "./optimizeRoutes";
// export { ocrOnUpload } from "./ocrOnUpload"; // <- add this back if needed
export { devSetRole } from "./devSetRole";
export { setClaimOnce } from "./util/setClaimOnce";

export { allowlistAuthBlock } from './authBlock';