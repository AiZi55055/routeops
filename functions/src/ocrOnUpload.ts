// functions/src/ocrOnUpload.ts
import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();

/**
 * On upload to proofs/{routeId}/{jobId}/{filename}, attach a stub OCR text.
 * Swap this for Vision API integration later.
 */
export const ocrOnUpload = onObjectFinalized(
  { region: "asia-southeast1" },
  async (event) => {
    const name = event.data.name || "";
    if (!name.startsWith("proofs/")) return;

    const parts = name.split("/");
    if (parts.length < 3) return;
    const routeId = parts[1];
    const jobId = parts[2];

    const stopRef = db.collection("routes").doc(routeId).collection("stops").doc(jobId);
    await stopRef.set(
      { ocrText: `OCR_STUB: processed ${name} at ${new Date().toISOString()}` },
      { merge: true }
    );
  }
);
