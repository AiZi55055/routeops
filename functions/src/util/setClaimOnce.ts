import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const setClaimOnce = onCall(
  { region: "asia-southeast1", secrets: ["SUPER_SET_SECRET"] },
  async (req) => {
    const secret = process.env.SUPER_SET_SECRET;
    if (!secret || req.data?.secret !== secret) {
      throw new HttpsError("permission-denied", "nope");
    }
    const uid = req.data?.uid;
    if (!uid) throw new HttpsError("invalid-argument", "uid required");
    await admin.auth().setCustomUserClaims(uid, { supervisor: true });
    return { ok: true };
  }
);
