// functions/src/enrichRoute.ts
import * as admin from "firebase-admin";
if (admin.apps.length === 0) admin.initializeApp();

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireRole } from "./authz";

const db = getFirestore();

/* ================= Types ================= */

type LatLng = { lat: number; lng: number };

type StopDoc = {
  jobId: string;
  seq: number;
  location?: LatLng;
  travel?: {
    from?: LatLng;
    to?: LatLng;
    distanceMeters?: number;
    durationSec?: number;
    polyline?: string | null;
  };
};

export type EnrichRouteRequest = {
  routeId: string;
  /** Overwrite existing travel if present */
  force?: boolean;
  /** Parallel legs per route (1–10). Default 5. */
  legConcurrency?: number;
  /** Treat hops under N meters as 0 sec (no API call). Default 20. */
  shortHopMeters?: number;
};

export type EnrichRouteResponse = {
  updatedStops: number;
  cacheHits: number;    // reused to count “no work needed” or short-hop skips
  cacheMisses: number;  // new computations (API or fallback)
};

type DirectionsJSON = {
  routes?: Array<{
    overview_polyline?: { points?: string };
    legs?: Array<{
      distance?: { value?: number };
      duration?: { value?: number };
    }>;
  }>;
};

/* ================ Config ================= */

const ENV = {
  REGION: "asia-southeast1",
  DEFAULT_LEG_CONC: toInt(process.env.LEG_CONCURRENCY, 5),
  SHORT_HOP_METERS: toInt(process.env.SHORT_HOP_METERS, 20),
  MAPS_KEY: process.env.GOOGLE_MAPS_API_KEY || "", // server key
};

/* =============== Core (exported for other functions) =============== */

export async function enrichRoutePolylinesCore(params: {
  routeId: string;
  force?: boolean;
  legConcurrency?: number;
  shortHopMeters?: number;
}): Promise<EnrichRouteResponse> {
  const routeId = (params.routeId || "").trim();
  if (!routeId) throw new HttpsError("invalid-argument", "routeId required");

  const force = !!params.force;
  const legConc = clamp(toInt(params.legConcurrency, ENV.DEFAULT_LEG_CONC), 1, 10);
  const shortHopMeters = clamp(toInt(params.shortHopMeters, ENV.SHORT_HOP_METERS), 0, 200);

  logger.info("[ENRICH:route] start", { routeId, force, legConc, shortHopMeters });

  // 1) Load ordered stops
  const snap = await db
    .collection("routes")
    .doc(routeId)
    .collection("stops")
    .orderBy("seq", "asc")
    .get();

  const stops: StopDoc[] = [];
  snap.forEach((doc) => {
    const data = doc.data() as any;
    stops.push({
      jobId: data?.jobId || doc.id,
      seq: data?.seq ?? 0,
      location: data?.location,
      travel: data?.travel,
    });
  });

  if (stops.length < 2) {
    logger.warn("[ENRICH:route] not enough stops", { routeId, count: stops.length });
    return { updatedStops: 0, cacheHits: 0, cacheMisses: 0 };
  }

  // 2) Build legs (prev -> curr). We do NOT add depot for seq:0.
  const legs: Array<{ prev: StopDoc; curr: StopDoc }> = [];
  for (let i = 1; i < stops.length; i++) {
    legs.push({ prev: stops[i - 1], curr: stops[i] });
  }

  // 3) Process with concurrency
  let updated = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  const run = pLimit(legConc);
  await Promise.all(
    legs.map(({ prev, curr }) =>
      run(async () => {
        const from = prev.location;
        const to = curr.location;
        if (!isLatLng(from) || !isLatLng(to)) return;

        // If we already have a travel polyline and not forcing, count as "hit"
        if (
          !force &&
          curr.travel?.polyline &&
          isLatLng(curr.travel?.from) &&
          isLatLng(curr.travel?.to)
        ) {
          cacheHits += 1;
          return;
        }

        // Short hop? write minimal travel, skip API
        const crow = haversineMeters(from!, to!);
        if (crow <= shortHopMeters) {
          await writeTravel(routeId, curr.jobId, {
            from,
            to,
            distanceMeters: Math.round(crow),
            durationSec: 0,
            polyline: null,
          });
          updated += 1;
          cacheHits += 1;
          return;
        }

        // Directions call
        try {
          const r = await directionsOverviewPolyline(from!, to!, ENV.MAPS_KEY);
          if (r) {
            await writeTravel(routeId, curr.jobId, {
              from,
              to,
              distanceMeters: r.distanceMeters,
              durationSec: r.durationSec,
              polyline: r.polyline || null,
            });
            updated += 1;
            cacheMisses += 1; // a "miss" = new compute
          } else {
            // Fallback: straight line with coarse duration
            await writeTravel(routeId, curr.jobId, {
              from,
              to,
              distanceMeters: Math.round(crow),
              durationSec: estimateSecByCrow(crow),
              polyline: null,
            });
            updated += 1;
            cacheMisses += 1;
          }
        } catch (e) {
          logger.warn("[ENRICH:route] DIR FAIL → straight fallback", {
            routeId,
            jobId: curr.jobId,
            err: (e as Error)?.message,
          });
          await writeTravel(routeId, curr.jobId, {
            from,
            to,
            distanceMeters: Math.round(crow),
            durationSec: estimateSecByCrow(crow),
            polyline: null,
          });
          updated += 1;
          cacheMisses += 1;
        }
      })
    )
  );

  // Touch route summary
  await db.collection("routes").doc(routeId).set(
    { updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  logger.info("[ENRICH:route] done", { routeId, updated, cacheHits, cacheMisses });
  return { updatedStops: updated, cacheHits, cacheMisses };
}

/* =============== onCall wrapper (for clients) =============== */

export const enrichRoutePolylines = onCall(
  { region: ENV.REGION, cors: true, maxInstances: 10 },
  async (req): Promise<EnrichRouteResponse> => {
    await requireRole(req, ["admin", "supervisor"]);

    const d = (req.data ?? {}) as EnrichRouteRequest;
    const routeId = (d.routeId || "").trim();
    if (!routeId) throw new HttpsError("invalid-argument", "routeId required");

    return enrichRoutePolylinesCore({
      routeId,
      force: !!d.force,
      legConcurrency: clamp(toInt(d.legConcurrency, ENV.DEFAULT_LEG_CONC), 1, 10),
      shortHopMeters: clamp(toInt(d.shortHopMeters, ENV.SHORT_HOP_METERS), 0, 200),
    });
  }
);

/* =============== Helpers =============== */

function toInt(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}
function isLatLng(x: any): x is LatLng {
  return (
    x &&
    typeof x.lat === "number" &&
    Number.isFinite(x.lat) &&
    typeof x.lng === "number" &&
    Number.isFinite(x.lng)
  );
}

function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat),
    la2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
function estimateSecByCrow(meters: number) {
  const speedMps = 30000 / 3600; // 30 km/h
  return Math.max(1, Math.round(meters / speedMps));
}

// Write travel onto the stop doc
async function writeTravel(
  routeId: string,
  jobId: string,
  t: {
    from: LatLng;
    to: LatLng;
    distanceMeters?: number;
    durationSec?: number;
    polyline?: string | null;
  }
) {
  const stopRef = db.collection("routes").doc(routeId).collection("stops").doc(jobId);
  await stopRef.set(
    {
      travel: t,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

// Minimal concurrency limiter
function pLimit(concurrency: number) {
  const queue: Array<() => void> = [];
  let active = 0;
  const next = () => {
    active--;
    if (queue.length) queue.shift()!();
  };
  const run = async <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const start = () => {
        active++;
        fn()
          .then((v) => {
            resolve(v);
            next();
          })
          .catch((e) => {
            reject(e);
            next();
          });
      };
      if (active < concurrency) start();
      else queue.push(start);
    });
  return <T>(fn: () => Promise<T>) => run(fn);
}

/** Call Google Directions (server-side) and return overview polyline + meters/sec. */
async function directionsOverviewPolyline(
  from: LatLng,
  to: LatLng,
  key: string
): Promise<{ polyline: string | null; distanceMeters: number; durationSec: number } | null> {
  if (!key) {
    logger.warn("[ENRICH:route] Missing GOOGLE_MAPS_API_KEY; returning null");
    return null;
  }

  const params = new URLSearchParams({
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    mode: "driving",
    key,
  });

  const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    logger.warn("[ENRICH:route] DIR FAIL", { status: res.status, body: txt.slice(0, 200) });
    return null;
  }

  const j = (await res.json().catch(() => null)) as DirectionsJSON | null;
  const route = j?.routes?.[0];
  const leg = route?.legs?.[0];
  if (!route || !leg) return null;

  const polyline: string | null = route.overview_polyline?.points ?? null;
  const distanceMeters = Number(leg.distance?.value) || 0;
  const durationSec = Number(leg.duration?.value) || 0;

  return { polyline, distanceMeters, durationSec };
}
