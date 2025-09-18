// functions/src/optimizeRoutes.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();

// Secret name: GOOGLE_MAPS_API_KEY (set via Firebase CLI / Secret Manager)
const GOOGLE_MAPS_API_KEY = defineSecret("GOOGLE_MAPS_API_KEY");

type LatLng = { lat: number; lng: number };
type TW = { start: string; end: string };

type Job = {
    id: string;
    title: string;
    address: string;
    location: LatLng;
    timeWindow?: { start?: admin.firestore.Timestamp; end?: admin.firestore.Timestamp };
    timeWindows?: TW[]; // allow array; we normalize below
    priority?: number;
    status: "pending" | "assigned" | "in_progress" | "completed";
    companyId?: string | null;
};

type Messenger = {
    id: string;
    displayName?: string;
    vehicleType?: "bike" | "car" | "foot";
    startDepot?: LatLng;
    shift?: { start?: string; end?: string };
};

function haversine(from: LatLng, to: LatLng, avgKph = 30) {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const a = toRad(from.lat);
    const b = toRad(to.lat);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a) * Math.cos(b) * Math.sin(dLng / 2) ** 2;
    const dist = 2 * R * Math.asin(Math.sqrt(h));
    const sec = (dist / 1000 / avgKph) * 3600;
    return { distanceMeters: Math.round(dist), durationSec: Math.round(sec) };
}

async function travel(
    from: LatLng,
    to: LatLng,
    departMs: number,
    apiKey?: string
): Promise<{ distanceMeters: number; durationSec: number; polyline: string | null }> {
    // Fallback when key missing
    if (!apiKey) {
        const est = haversine(from, to, 30);
        return { ...est, polyline: null };
    }

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", `${from.lat},${from.lng}`);
    url.searchParams.set("destination", `${to.lat},${to.lng}`);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("departure_time", Math.floor(departMs / 1000).toString()); // traffic-aware
    url.searchParams.set("traffic_model", "best_guess");
    url.searchParams.set("key", apiKey);

    try {
        const res = await fetch(url.toString());
        const body: any = await res.json().catch(() => ({}));

        if (!res.ok || body.status && body.status !== "OK") {
            console.error("Directions API error", {
                http: res.status,
                status: body?.status,
                error_message: body?.error_message
            });
            const est = haversine(from, to, 30);
            return { ...est, polyline: null };
        }

        const leg = body.routes?.[0]?.legs?.[0];
        if (!leg) {
            const est = haversine(from, to, 30);
            return { ...est, polyline: null };
        }

        return {
            durationSec: leg.duration_in_traffic?.value ?? leg.duration.value,
            distanceMeters: leg.distance.value,
            polyline: body.routes?.[0]?.overview_polyline?.points ?? null,
        };
    } catch (err) {
        console.error("Directions fetch failed", err);
        const est = haversine(from, to, 30);
        return { ...est, polyline: null };
    }
}


function nextFeasible(arrivalMs: number, tws?: TW[]) {
    if (!tws || !tws.length) return { eta: arrivalMs, windowEnd: Number.MAX_SAFE_INTEGER };
    for (const tw of tws) {
        const s = Date.parse(tw.start);
        const e = Date.parse(tw.end);
        if (arrivalMs <= e) {
            const eta = Math.max(arrivalMs, s);
            if (eta <= e) return { eta, windowEnd: e };
        }
    }
    return null;
}

export const optimizeRoutes = onCall(
    { region: "asia-southeast1", timeoutSeconds: 540, secrets: [GOOGLE_MAPS_API_KEY] },
    async (req) => {
        try {
            if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
            const { messengerIds = [], date, companyId } = (req.data || {}) as {
                messengerIds: string[];
                date?: string;
                companyId?: string;
            };
            if (!messengerIds.length) {
                throw new HttpsError("invalid-argument", "messengerIds required");
            }

            const apiKey = GOOGLE_MAPS_API_KEY.value();
            const forDate = date ?? new Date().toISOString().slice(0, 10);

            // Load messengers
            const msDocs = await db.getAll(...messengerIds.map((id) => db.doc(`messengers/${id}`)));
            const messengers: Messenger[] = msDocs
                .filter((d) => d.exists)
                .map((d) => ({ id: d.id, ...(d.data() as any) }));

            if (!messengers.length) throw new HttpsError("not-found", "No messengers found");

            // Load pending jobs (optionally scoped by company)
            let jRef = db.collection("jobs").where("status", "==", "pending");
            if (companyId) jRef = jRef.where("companyId", "==", companyId);
            const jSnap = await jRef.get();
            const jobs: Job[] = jSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

            if (!jobs.length) {
                return { ok: true, message: "No pending jobs", assignedCount: 0 };
            }

            // Normalize to array TWs; coerce Timestamp → ISO strings
            for (const j of jobs) {
                if (!j.timeWindows?.length && (j.timeWindow?.start || j.timeWindow?.end)) {
                    const start = j.timeWindow?.start ? (j.timeWindow.start as any).toDate().toISOString() : `${forDate}T00:00:00Z`;
                    const end = j.timeWindow?.end ? (j.timeWindow.end as any).toDate().toISOString() : `${forDate}T23:59:59Z`;
                    j.timeWindows = [{ start, end }];
                } else if (j.timeWindows?.length) {
                    j.timeWindows.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
                }

            }

            // Sort by priority then earliest window end
            jobs.sort((a, b) => {
                const pa = (a.priority ?? 5) - (b.priority ?? 5);
                if (pa !== 0) return pa;
                const ae = a.timeWindows?.length
                    ? Math.min(...a.timeWindows.map((t) => Date.parse(t.end)))
                    : Number.MAX_SAFE_INTEGER;
                const be = b.timeWindows?.length
                    ? Math.min(...b.timeWindows.map((t) => Date.parse(t.end)))
                    : Number.MAX_SAFE_INTEGER;
                return ae - be;
            });

            // Initialize per-messenger route state
            const routes = new Map<
                string,
                { legs: any[]; cursorTime: number; cursorPos: LatLng; totalDist: number; totalDur: number; shiftEnd: number }
            >();

            for (const m of messengers) {
                const start = m.shift?.start ? Date.parse(m.shift.start) : Date.now();
                const end = m.shift?.end ? Date.parse(m.shift.end) : start + 12 * 3600 * 1000;
                const depot = m.startDepot ?? { lat: 13.7563, lng: 100.5018 };
                if (!m.startDepot) console.warn(`Messenger ${m.id} missing startDepot; using fallback`, depot);
                routes.set(m.id, { legs: [], cursorTime: start, cursorPos: depot, totalDist: 0, totalDur: 0, shiftEnd: end });
            }


            // Greedy assignment with time windows
            const unassigned = new Set(jobs.map((j) => j.id));
            const assigned: string[] = [];

            for (const job of jobs) {
                let best:
                    | {
                        mId: string;
                        startService: number;
                        endService: number;
                        travel: { distanceMeters: number; durationSec: number; polyline: string | null; from: LatLng; to: LatLng };
                    }
                    | null = null;

                for (const m of messengers) {
                    const r = routes.get(m.id)!;
                    const t = await travel(r.cursorPos, job.location, r.cursorTime, apiKey);
                    const arrivalMs = r.cursorTime + t.durationSec * 1000;
                    const feas = nextFeasible(arrivalMs, job.timeWindows);
                    if (!feas) continue;
                    if (feas.eta > r.shiftEnd) continue; // after shift

                    if (!best || feas.eta < best.startService) {
                        best = {
                            mId: m.id,
                            startService: feas.eta,
                            endService: feas.eta + 2 * 60 * 1000, // assume 2 min service time
                            travel: { ...t, from: r.cursorPos, to: job.location },
                        };
                    }
                }

                if (!best) continue;

                const r = routes.get(best.mId)!;
                const sequence = r.legs.length + 1;
                r.legs.push({
                    jobId: job.id,
                    sequence,
                    status: "planned",
                    eta: best.startService,
                    travel: best.travel,
                });
                r.cursorTime = best.endService;
                r.cursorPos = job.location;
                r.totalDist += best.travel.distanceMeters;
                r.totalDur += best.travel.durationSec;
                assigned.push(job.id);
                unassigned.delete(job.id);
            }

            // Write routes + stops + assignments and flip jobs → assigned
            const batch = db.batch();
            const createdRoutes: string[] = [];

            for (const m of messengers) {
                const r = routes.get(m.id)!;
                if (!r.legs.length) continue;

                const routeRef = db.collection("routes").doc();
                createdRoutes.push(routeRef.id);

                batch.set(routeRef, {
                    messengerId: m.id,
                    date: forDate,
                    status: "planned",
                    legs: r.legs.map((leg: any) => ({
                        jobId: leg.jobId,
                        sequence: leg.sequence,
                        status: leg.status,
                        eta: leg.eta, // number or ISO, either is fine for drawing
                        travel: {
                            distanceMeters: leg.travel.distanceMeters,
                            durationSec: leg.travel.durationSec,
                            polyline: leg.travel.polyline ?? null,
                            from: leg.travel.from,   // ✅ keep
                            to: leg.travel.to,       // ✅ keep
                        },
                    })),
                    distanceMeters: Math.round(r.totalDist),
                    etaSeconds: Math.round(r.totalDur),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    companyId: companyId ?? null,
                });

                // stops subcollection + assignments + flip job status
                for (const leg of r.legs) {
                    const stopRef = routeRef.collection("stops").doc(leg.jobId);
                    batch.set(stopRef, {
                        jobId: leg.jobId,
                        sequence: leg.sequence,
                        status: "planned",
                        eta: leg.eta,
                        arrivedAtISO: null,
                        completedAtISO: null,
                        proofPhotoUrl: null,
                        ocrText: null,
                    });

                    const assignRef = db.collection("assignments").doc(`${m.id}_${leg.jobId}`);
                    batch.set(assignRef, {
                        messengerId: m.id,
                        jobId: leg.jobId,
                        routeId: routeRef.id,
                        orderIndex: leg.sequence,
                        status: "assigned",
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    batch.update(db.collection("jobs").doc(leg.jobId), {
                        status: "assigned",
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }

            await batch.commit();

            return {
                ok: true,
                date: forDate,
                routesCreated: createdRoutes.length,
                routeIds: createdRoutes,
                assignedCount: assigned.length,
                unassignedCount: jobs.length - assigned.length,
            };
        } catch (e: any) {
            console.error("optimizeRoutes failed", e);
            if (e instanceof HttpsError) throw e;
            throw new HttpsError("internal", e?.message ?? "internal");
        }
    }
);
