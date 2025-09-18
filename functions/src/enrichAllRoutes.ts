import * as admin from "firebase-admin";
if (admin.apps.length === 0) admin.initializeApp();

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import { requireRole } from "./authz";
import { enrichRoutePolylinesCore } from "./enrichRoute"; // <-- import core helper

const db = getFirestore();

type EnrichAllRequest = {
  routeIds?: string[];
  companyId?: string;
  limit?: number;
  updatedBefore?: number;
  routeConcurrency?: number;
  legConcurrency?: number;
  shortHopMeters?: number;
  force?: boolean;
};

type EnrichAllResponse = {
  routesProcessed: number;
  routesTotal?: number;
  cacheHits?: number;
  cacheMisses?: number;
};

const ENV = {
  REGION: "asia-southeast1",
  DEFAULT_ROUTE_CONC: toInt(process.env.ROUTE_CONCURRENCY, 3),
  DEFAULT_LEG_CONC: toInt(process.env.LEG_CONCURRENCY, 5),
  SHORT_HOP_METERS: toInt(process.env.SHORT_HOP_METERS, 20),
};

export const enrichAllRoutes = onCall(
  { region: ENV.REGION, cors: true, maxInstances: 10 },
  async (req): Promise<EnrichAllResponse> => {
    await requireRole(req, ["admin", "supervisor"]);

    const d = (req.data ?? {}) as EnrichAllRequest;
    const force = !!d.force;
    const routeConc = clamp(toInt(d.routeConcurrency, ENV.DEFAULT_ROUTE_CONC), 1, 10);
    const legConc = clamp(toInt(d.legConcurrency, ENV.DEFAULT_LEG_CONC), 1, 10);
    const shortHopMeters = clamp(toInt(d.shortHopMeters, ENV.SHORT_HOP_METERS), 0, 200);

    logger.info("[ENRICH:all] start", { force, routeConc, legConc, shortHopMeters });

    // Find candidate routes
    let q = db.collection("routes").orderBy("updatedAt", "asc");
    if (d.companyId) q = q.where("companyId", "==", d.companyId);
    if (d.updatedBefore) q = q.where("updatedAt", "<", new Date(d.updatedBefore));

    const snap = await q.limit(d.limit || 20).get();
    const routeIds = snap.docs.map((d) => d.id);
    if (!routeIds.length) {
      logger.info("[ENRICH:all] no routes found");
      return { routesProcessed: 0, routesTotal: 0, cacheHits: 0, cacheMisses: 0 };
    }

    logger.info("[ENRICH:all] candidate routes", { count: routeIds.length });

    let totalUpdated = 0;
    let cacheHits = 0;
    let cacheMisses = 0;

    const run = pLimit(routeConc);

    await Promise.all(
      routeIds.map((routeId) =>
        run(async () => {
          try {
            const res = await enrichRoutePolylinesCore({
              routeId,
              force,
              legConcurrency: legConc,
              shortHopMeters,
            });

            logger.info("[ENRICH] route done", {
              routeId,
              updated: res.updatedStops,
              cacheHits: res.cacheHits,
              cacheMisses: res.cacheMisses,
            });

            totalUpdated += res.updatedStops;
            cacheHits += res.cacheHits ?? 0;
            cacheMisses += res.cacheMisses ?? 0;
          } catch (e) {
            logger.error("[ENRICH] route failed", {
              routeId,
              err: (e as Error)?.message,
            });
          }
        })
      )
    );

    logger.info("[ENRICH:all] done", {
      routesProcessed: routeIds.length,
      totalUpdated,
      cacheHits,
      cacheMisses,
    });

    return {
      routesProcessed: routeIds.length,
      routesTotal: routeIds.length,
      cacheHits,
      cacheMisses,
    };
  }
);

/* ================= Helpers ================= */

function toInt(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
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
