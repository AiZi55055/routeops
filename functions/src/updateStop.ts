// functions/src/updateStop.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { requireRole } from './authz';
const db = admin.firestore();

export const updateStop = onCall({ region: 'asia-southeast1' }, async (req) => {
  requireRole(req, ['admin','supervisor']);
  const { routeId, jobId, patch } = req.data || {};
  if (!routeId || !jobId || typeof patch !== 'object') throw new HttpsError('invalid-argument','routeId/jobId/patch required');

  const ref = db.doc(`routes/${routeId}/stops/${jobId}`);
  await ref.set({ ...patch, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});