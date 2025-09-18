import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
if (admin.apps.length === 0) admin.initializeApp();

export const devSetRole = onCall({ region: "asia-southeast1" }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const { role = "supervisor", admin: makeAdmin = true } = (req.data || {}) as {
    role?: "supervisor" | "admin";
    admin?: boolean;
  };
  await admin.auth().setCustomUserClaims(req.auth.uid, {
    role,
    admin: makeAdmin ? true : undefined,
  });
  return { ok: true, message: `Role set: ${role}${makeAdmin ? " + admin" : ""}` };
});
