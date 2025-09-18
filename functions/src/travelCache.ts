// functions/src/travelCache.ts
import * as admin from 'firebase-admin';
const db = admin.firestore();

export type LatLng = { lat: number; lng: number };
function round6(n: number) { return Math.round(n * 1e6) / 1e6; }
function bucket15min(ms: number) { return Math.floor(ms / (15*60*1000)); }
function cacheKey(a: LatLng, b: LatLng, ms: number) {
  const k = `${round6(a.lat)},${round6(a.lng)}|${round6(b.lat)},${round6(b.lng)}|${bucket15min(ms)}`;
  // simple hash
  let h = 0; for (let i=0;i<k.length;i++) { h = (h*31 + k.charCodeAt(i))|0; }
  return `tc_${Math.abs(h)}`;
}

export async function getTravelFromCache(a: LatLng, b: LatLng, ms: number) {
  const id = cacheKey(a, b, ms);
  const doc = await db.collection('travelCache').doc(id).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  // TTL 1 day
  if (Date.now() - (d.updatedAt?.toMillis?.() ?? 0) > 24*3600*1000) return null;
  return { distanceMeters: d.distanceMeters, durationSec: d.durationSec, polyline: d.polyline ?? null };
}

export async function writeTravelToCache(a: LatLng, b: LatLng, ms: number, t: {distanceMeters:number;durationSec:number;polyline:string|null;}) {
  const id = cacheKey(a, b, ms);
  await db.collection('travelCache').doc(id).set({
    from: a, to: b, bucket: bucket15min(ms),
    distanceMeters: t.distanceMeters, durationSec: t.durationSec, polyline: t.polyline ?? null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}
