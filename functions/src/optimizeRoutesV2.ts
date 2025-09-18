// functions/src/optimizeRoutesV2.ts
import * as admin from "firebase-admin";
if (admin.apps.length === 0) admin.initializeApp();

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireRole } from "./authz";
import * as travel from "./travelCache";

const db = getFirestore();

/* ==================== Types ==================== */

type LatLng = { lat: number; lng: number };

type Job = {
  id: string;
  location: LatLng;
  priority?: number;
  serviceSec?: number;
  timeWindows?: { start: string; end: string }[];
  messengerHint?: string; // "m1,m2" or single id
};

type Messenger = {
  id: string;
  startDepot: LatLng;
  returnToDepot?: boolean;
  shift?: { start?: string; end?: string };
};

type OptimizeRequest = {
  messengerIds: string[];
  jobIds: string[];
  companyId?: string;
  date?: string;

  serviceSecDefault?: number;
  shortHopMeters?: number;
  tieNudgeSec?: number;

  chunkSize?: number;      // default 3
  chunkDelayMs?: number;   // default 800

  ignoreWindows?: boolean; // skip window feasibility checks
  force?: boolean;
};

type OptimizeResponse = {
  assigned: number;
  chunks: number;
  cacheHits: number;
  cacheMisses: number;
};

/* ==================== Config ==================== */

const ENV = {
  REGION: "asia-southeast1",
  DEFAULT_SERVICE_SEC: int(process.env.DEFAULT_SERVICE_SEC, 120),
  SHORT_HOP_METERS: int(process.env.SHORT_HOP_METERS, 20),
  CHUNK_SIZE: int(process.env.CHUNK_SIZE, 3),
  CHUNK_DELAY_MS: int(process.env.CHUNK_DELAY_MS, 800),
  TIE_NUDGE_SEC: int(process.env.TIE_NUDGE_SEC, 60),
};

/* ==================== Entry ==================== */

export const optimizeRoutesV2 = onCall(
  { region: ENV.REGION, cors: true, maxInstances: 10 },
  async (req): Promise<OptimizeResponse> => {
    try {
      await requireRole(req, ["admin", "supervisor"]);

      const d = (req.data ?? {}) as OptimizeRequest;
      if (!Array.isArray(d.messengerIds) || !Array.isArray(d.jobIds)) {
        throw new HttpsError("invalid-argument", "messengerIds and jobIds are required arrays");
      }

      const cfg = {
        serviceSecDefault: num(d.serviceSecDefault, ENV.DEFAULT_SERVICE_SEC),
        shortHopMeters: clamp(num(d.shortHopMeters, ENV.SHORT_HOP_METERS), 0, 200),
        tieNudgeSec: clamp(num(d.tieNudgeSec, ENV.TIE_NUDGE_SEC), 0, 600),
        chunkSize: clamp(num(d.chunkSize, ENV.CHUNK_SIZE), 1, 10),
        chunkDelayMs: clamp(num(d.chunkDelayMs, ENV.CHUNK_DELAY_MS), 0, 5000),
        ignoreWindows: !!d.ignoreWindows,
      };

      logger.info("[OPTIMIZE] start", {
        uid: req.auth?.uid,
        messengerCount: d.messengerIds.length,
        jobCount: d.jobIds.length,
        cfg,
      });

      const [messengersAll, jobsAll] = await Promise.all([
        loadMessengers(d.messengerIds),
        loadJobs(d.jobIds),
      ]);

      const messengers = messengersAll.filter((m) => isLatLng(m?.startDepot));
      const jobs = jobsAll.filter((j) => isLatLng(j?.location));

      if (!messengers.length || !jobs.length) {
        logger.warn("[OPTIMIZE] invalid docs filtered", {
          msIn: messengersAll.length, msValid: messengers.length,
          jobsIn: jobsAll.length, jobsValid: jobs.length,
        });
        return { assigned: 0, chunks: 1, cacheHits: 0, cacheMisses: 0 };
      }

      // sort jobs by priority & earliest window
      jobs.sort((a, b) => {
        const pr = (b.priority ?? 0) - (a.priority ?? 0);
        if (pr) return pr;
        const aw = firstWindowStart(a) ?? Number.MAX_SAFE_INTEGER;
        const bw = firstWindowStart(b) ?? Number.MAX_SAFE_INTEGER;
        return aw - bw;
      });

      // chunk messengers
      const chunks: Messenger[][] = [];
      for (let i = 0; i < messengers.length; i += cfg.chunkSize) {
        chunks.push(messengers.slice(i, i + cfg.chunkSize));
      }
      const chunksCount = chunks.length;

      const assignedJobIds = new Set<string>();
      let assignedTotal = 0;
      let cacheHits = 0;
      let cacheMisses = 0;

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];

        const res = await assignJobsBestInsertion({
          messengers: chunk,
          jobs,
          alreadyAssigned: assignedJobIds,
          shortHopMeters: cfg.shortHopMeters,
          tieNudgeSec: cfg.tieNudgeSec,
          serviceSecDefault: cfg.serviceSecDefault,
          ignoreWindows: cfg.ignoreWindows,
        });

        for (const id of res.assignedIds) assignedJobIds.add(id);
        assignedTotal += res.assigned;
        cacheHits += res.cacheHits;
        cacheMisses += res.cacheMisses;

        logger.info("[ASSIGN] chunk complete", {
          chunk: ci + 1,
          of: chunksCount,
          assignedInChunk: res.assigned,
          assignedTotal,
          cacheHits,
          cacheMisses,
        });

        if (ci < chunksCount - 1 && cfg.chunkDelayMs > 0) {
          await sleep(cfg.chunkDelayMs);
        }
      }

      logger.info("[OPTIMIZE] done", {
        assigned: assignedTotal,
        chunks: chunksCount,
        cacheHits,
        cacheMisses,
      });

      return { assigned: assignedTotal, chunks: chunksCount, cacheHits, cacheMisses };
    } catch (err: any) {
      logger.error("[OPTIMIZE] unhandled error", {
        message: err?.message,
        code: err?.code,
        stack: err?.stack,
      });
      if (err?.name === "HttpsError" || err instanceof HttpsError) throw err;
      throw new HttpsError("internal", "Optimizer failed unexpectedly. See logs.");
    }
  }
);

/* ==================== Core logic ==================== */

type AssignOpts = {
  messengers: Messenger[];
  jobs: Job[];
  alreadyAssigned: Set<string>;
  shortHopMeters: number;
  tieNudgeSec: number;
  serviceSecDefault: number;
  ignoreWindows: boolean;
};

async function assignJobsBestInsertion(opts: AssignOpts): Promise<{
  assigned: number;
  assignedIds: string[];
  cacheHits: number;
  cacheMisses: number;
}> {
  const {
    messengers,
    jobs,
    alreadyAssigned,
    shortHopMeters,
    tieNudgeSec,
    serviceSecDefault,
    ignoreWindows,
  } = opts;

  const routes: Record<string, { seq: { jobId: string; loc: LatLng; service: number }[] }> = {};
  for (const m of messengers) routes[m.id] = { seq: [] };

  let assigned = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  const newlyAssigned: string[] = [];

  for (const job of jobs) {
    if (alreadyAssigned.has(job.id)) continue;

    const svc = Number.isFinite(job.serviceSec) ? job.serviceSec! : serviceSecDefault;
    const hintList = (job.messengerHint || "")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    let best: { m: Messenger; pos: number; delta: number } | null = null;

    for (const m of messengers) {
      const seq = routes[m.id].seq;
      const positions = seq.length + 1;

      for (let pos = 0; pos < positions; pos++) {
        const before = pos === 0 ? m.startDepot : seq[pos - 1].loc;
        const after = pos < seq.length ? seq[pos].loc : null;

        const r1 = await getTravelSecondsWithHit(before, job.location, shortHopMeters);
        cacheHits += r1.cacheHit ? 1 : 0;
        cacheMisses += r1.cacheHit ? 0 : 1;

        let secAfter = 0;
        if (after) {
          const r2 = await getTravelSecondsWithHit(job.location, after, shortHopMeters);
          cacheHits += r2.cacheHit ? 1 : 0;
          cacheMisses += r2.cacheHit ? 0 : 1;
          secAfter = r2.seconds;
        }

        let secRemoved = 0;
        if (after) {
          const r0 = await getTravelSecondsWithHit(before, after, shortHopMeters);
          cacheHits += r0.cacheHit ? 1 : 0;
          cacheMisses += r0.cacheHit ? 0 : 1;
          secRemoved = r0.seconds;
        }

        let delta = r1.seconds + secAfter + svc - secRemoved;

        if (!ignoreWindows && job.timeWindows?.length) {
          const now = Date.now();
          const earliest = Math.min(...job.timeWindows.map((w) => Date.parse(w.start)).filter(Number.isFinite));
          const latest = Math.max(...job.timeWindows.map((w) => Date.parse(w.end)).filter(Number.isFinite));
          if (Number.isFinite(earliest) && Number.isFinite(latest) && latest < now - 5 * 60 * 1000) {
            continue;
          }
        }

        if (!best || delta < best.delta - 1) {
          best = { m, pos, delta };
        } else if (Math.abs(delta - (best?.delta ?? Infinity)) <= tieNudgeSec) {
          const prefer = hintList.includes(m.id) && !hintList.includes(best!.m.id);
          if (prefer) best = { m, pos, delta };
        }
      }
    }

    if (best) {
      const seq = routes[best.m.id].seq;
      seq.splice(best.pos, 0, {
        jobId: job.id,
        loc: job.location,
        service: svc,
      });
      newlyAssigned.push(job.id);
      assigned++;
    }
  }

  // persist
  const batch = db.batch();
  for (const m of messengers) {
    const route = routes[m.id];
    if (!route.seq.length) continue;

    const routeRef = db.collection("routes").doc(m.id);
    batch.set(
      routeRef,
      {
        messengerId: m.id,
        status: "assigned",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    route.seq.forEach((s, i) => {
      const stopRef = routeRef.collection("stops").doc(s.jobId);
      batch.set(
        stopRef,
        {
          jobId: s.jobId,
          seq: i,
          location: s.loc,
          status: "planned",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const assignRef = db.collection("assignments").doc(`${m.id}_${s.jobId}`);
      batch.set(
        assignRef,
        {
          messengerId: m.id,
          jobId: s.jobId,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      batch.set(
        db.collection("jobs").doc(s.jobId),
        {
          status: "assigned",
          assignedTo: m.id,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    // return-to-depot
    if (m.returnToDepot && isLatLng(m.startDepot)) {
      const depotStopRef = routeRef.collection("stops").doc("returnDepot");
      batch.set(
        depotStopRef,
        {
          jobId: "returnDepot",
          seq: route.seq.length,
          location: m.startDepot,
          status: "planned",
          isDepot: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }
  await batch.commit();

  return { assigned, assignedIds: newlyAssigned, cacheHits, cacheMisses };
}

/* ==================== Travel & math ==================== */

async function getTravelSecondsWithHit(
  from: LatLng,
  to: LatLng,
  shortHopMeters: number
): Promise<{ seconds: number; cacheHit: boolean }> {
  if (!isLatLng(from) || !isLatLng(to)) return { seconds: 0, cacheHit: false };

  const crow = haversineMeters(from, to);
  if (crow <= (Number.isFinite(shortHopMeters) ? shortHopMeters : 20)) {
    return { seconds: 0, cacheHit: true };
  }

  try {
    const fn = (travel as any)?.getTravelSeconds;
    if (typeof fn === "function") {
      const r = await fn(from, to, { shortHopMeters });
      if (r && typeof r === "object" && typeof r.seconds === "number") {
        return { seconds: r.seconds, cacheHit: !!r.cacheHit };
      }
      if (typeof r === "number") {
        return { seconds: r, cacheHit: false };
      }
    }
  } catch {}

  const speedMps = 30000 / 3600;
  return { seconds: Math.max(1, Math.round(crow / speedMps)), cacheHit: false };
}

function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* ==================== Loaders & utils ==================== */

async function loadMessengers(ids: string[]): Promise<Messenger[]> {
  const out: Messenger[] = [];
  for (const id of ids) {
    const snap = await db.collection("messengers").doc(id).get();
    if (snap.exists) out.push({ id, ...(snap.data() as any) });
  }
  return out;
}

async function loadJobs(ids: string[]): Promise<Job[]> {
  const out: Job[] = [];
  for (const id of ids) {
    const snap = await db.collection("jobs").doc(id).get();
    if (snap.exists) out.push({ id, ...(snap.data() as any) });
  }
  return out;
}

function firstWindowStart(j: Job): number | undefined {
  if (!j.timeWindows?.length) return undefined;
  const ts = j.timeWindows
    .map((w) => Date.parse(w.start))
    .filter((n) => Number.isFinite(n));
  if (!ts.length) return undefined;
  return Math.min(...ts);
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

function int(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function num(v: any, d: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}
function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
