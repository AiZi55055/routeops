// functions/src/seedMock.ts
import * as admin from "firebase-admin";
if (admin.apps.length === 0) admin.initializeApp();

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireRole } from "./authz";

type LatLng = { lat: number; lng: number };

type SeedRequest = {
  messengerId?: string;
  companyId?: string;
  count?: number;
  center: LatLng;
  radiusMeters?: number;
};

type SeedResponse = {
  created: number;
  messengerId?: string;
};

const db = getFirestore();
const ENV = {
  REGION: "asia-southeast1",
};

export const seedMockJobs = onCall({ region: ENV.REGION, cors: true }, async (req): Promise<SeedResponse> => {
  await requireRole(req, ["admin", "supervisor"]);

  const { messengerId, companyId, center, radiusMeters, count } = (req.data ?? {}) as SeedRequest;
  if (!center || typeof center.lat !== "number" || typeof center.lng !== "number") {
    throw new HttpsError("invalid-argument", "center.lat/lng required");
  }
  const N = Math.max(1, Math.min(Number(count ?? 12), 200));
  const R = Math.max(100, Math.min(Number(radiusMeters ?? 2500), 10000));

  // time window: now → +6h
  const now = new Date();
  const start = now.toISOString();
  const end = new Date(now.getTime() + 6 * 3600 * 1000).toISOString();

  let created = 0;
  const batch = db.batch();
  for (let i = 0; i < N; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const dist = Math.random() * R;
    const dLat = (dist * Math.cos(angle)) / 111320; // ~m per deg
    const dLng = (dist * Math.sin(angle)) / (111320 * Math.cos((center.lat * Math.PI) / 180));
    const loc: LatLng = { lat: center.lat + dLat, lng: center.lng + dLng };

    const docRef = db.collection("jobs").doc();
    batch.set(docRef, {
      title: `Mock Job #${i + 1}`,
      address: "TBD",
      location: loc,
      priority: 1,
      status: "pending",
      companyId: companyId ?? null,
      messengerHint: messengerId ?? null,
      timeWindows: [{ start, end }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    created++;
  }

  await batch.commit();
  logger.info("[SEED] created jobs", { created, companyId, messengerId });
  return { created, messengerId };
});
