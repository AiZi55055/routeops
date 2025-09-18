// src/features/optimization/OptimizePage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  where,
  documentId,
} from "firebase/firestore";
import { auth, db, signInWithGoogle, signOutUser } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  runOptimize,
  seedMockJobs,
  runEnrichRoute,
} from "@/lib/functions";
import RoutesOverlayGoogle from "@/features/dashboard/RoutesOverlayGoogle";
import MessengerPin from "@/features/dashboard/MessengerPin";

/* ================= Types ================= */

type LatLng = { lat: number; lng: number };

type Travel = {
  distanceMeters?: number;
  durationSec?: number;
  polyline?: string | null;
  from?: LatLng;
  to?: LatLng;
};

type LegStatus = "planned" | "enroute" | "arrived" | "completed" | "skipped";

type Leg = {
  jobId: string;
  sequence: number;
  status: LegStatus;
  eta?: number;
  travel?: Travel;
};

type RouteDoc = {
  id?: string;
  messengerId?: string;
  date?: string;
  status?: string;
  legs?: Leg[];
  distanceMeters?: number;
  etaSeconds?: number;
};

const containerStyle = { width: "100%", height: "70vh" };
const BANGKOK: LatLng = { lat: 13.7563, lng: 100.5018 };

type Busy = "idle" | "opt" | "seed" | "enrich";

/* ================= Helpers ================= */

function normalizeToYYYYMMDD(
  input: string | undefined | null
): string | undefined {
  if (!input) return undefined;
  const s = input.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseIds(csv: string): string[] {
  return (csv || "").split(",").map((s) => s.trim()).filter(Boolean);
}

type MessengerDoc = {
  id: string;
  startDepot?: LatLng;
  returnToDepot?: boolean;
};

/* ================= Component ================= */

export default function OptimizePage() {
  // auth
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // inputs
  const [companyId, setCompanyId] = useState<string>("");
  const now = new Date();
  const defaultDmy = `${String(now.getUTCDate()).padStart(2, "0")}/${String(
    now.getUTCMonth() + 1
  ).padStart(2, "0")}/${now.getUTCFullYear()}`;
  const [dateInput, setDateInput] = useState<string>(defaultDmy);

  const [messengerIdsInput, setMessengerIdsInput] = useState<string>("");
  const messengerIds = useMemo(
    () => parseIds(messengerIdsInput),
    [messengerIdsInput]
  );

  // Phase-3 knobs
  const [chunkSize, setChunkSize] = useState<number>(2);
  const [chunkDelayMs, setChunkDelayMs] = useState<number>(800);
  const [shortHopMeters, setShortHopMeters] = useState<number>(20);
  const [serviceSec, setServiceSec] = useState<number>(120);

  // auto-pick jobs
  const [maxJobs, setMaxJobs] = useState<number>(50);
  const [autoJobSample, setAutoJobSample] = useState<number>(0);
  const [jobPreview, setJobPreview] = useState<string[] | null>(null);

  // windows handling
  const [ignoreWindows, setIgnoreWindows] = useState<boolean>(false);

  // seed
  const [seedCenterLat, setSeedCenterLat] = useState<number>(BANGKOK.lat);
  const [seedCenterLng, setSeedCenterLng] = useState<number>(BANGKOK.lng);
  const [seedRadius, setSeedRadius] = useState<number>(2500);
  const [seedCount, setSeedCount] = useState<number>(12);
  const [seedMessengerId, setSeedMessengerId] = useState<string>("");

  const [busy, setBusy] = useState<Busy>("idle");

  // selected route + live stops
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [route, setRoute] = useState<RouteDoc | null>(null);
  const [legsFromStops, setLegsFromStops] = useState<Leg[]>([]);

  // messenger depots
  const [messengers, setMessengers] = useState<MessengerDoc[]>([]);

  // subscribe route doc
  useEffect(() => {
    if (!selectedRouteId) return setRoute(null);
    const unsub = onSnapshot(doc(db, "routes", selectedRouteId), (snap) => {
      setRoute(
        snap.exists()
          ? ({ id: snap.id, ...(snap.data() as any) } as RouteDoc)
          : null
      );
    });
    return () => unsub();
  }, [selectedRouteId]);

  // subscribe stops -> build legsFromStops
  useEffect(() => {
    if (!selectedRouteId) {
      setLegsFromStops([]);
      return;
    }
    const qStops = query(
      collection(db, "routes", selectedRouteId, "stops"),
      orderBy("seq", "asc")
    );
    const unsub = onSnapshot(qStops, (snap) => {
      const stops = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
      const legs: Leg[] = stops.map((s: any) => ({
        jobId: s.jobId || s.id,
        sequence: Number(s.seq ?? 0),
        status: (s.status as LegStatus) || "planned",
        eta: s.etaSeconds ? Number(s.etaSeconds) : undefined,
        travel: s.travel
          ? {
              from: s.travel.from,
              to: s.travel.to,
              distanceMeters: s.travel.distanceMeters,
              durationSec: s.travel.durationSec,
              polyline: s.travel.polyline ?? null,
            }
          : undefined,
      }));
      setLegsFromStops(legs);
    });
    return () => unsub();
  }, [selectedRouteId]);

  // load messengers for depot markers
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!messengerIds.length) return alive && setMessengers([]);
      const chunks: string[][] = [];
      for (let i = 0; i < messengerIds.length; i += 10)
        chunks.push(messengerIds.slice(i, i + 10));
      const out: MessengerDoc[] = [];
      for (const ch of chunks) {
        const qs = await getDocs(
          query(collection(db, "messengers"), where(documentId(), "in", ch))
        );
        qs.forEach((d) => {
          const data = d.data() as any;
          out.push({
            id: d.id,
            startDepot: data?.startDepot,
            returnToDepot: data?.returnToDepot,
          });
        });
      }
      if (alive) setMessengers(out);
    })().catch((e) => {
      console.warn("[messengers load] failed", e);
      alive && setMessengers([]);
    });
    return () => {
      alive = false;
    };
  }, [messengerIds]);

  // maps
  const { isLoaded: mapReady } = useJsApiLoader({
    id: "google-maps-script",
    googleMapsApiKey: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || "",
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const onMapLoad = useCallback((m: google.maps.Map) => {
    mapRef.current = m;
  }, []);
  const mapCenter = useMemo<LatLng>(() => {
    for (const leg of legsFromStops) {
      if (leg?.travel?.from) return leg.travel.from;
      if (leg?.travel?.to) return leg.travel.to;
    }
    if (messengers[0]?.startDepot) return messengers[0].startDepot!;
    return { lat: seedCenterLat, lng: seedCenterLng };
  }, [legsFromStops, messengers, seedCenterLat, seedCenterLng]);

  const missingPolyline = legsFromStops.reduce(
    (acc, l) => acc + (l?.travel?.polyline ? 0 : 1),
    0
  );

  // auto-pick jobs
  async function autoPickJobIds(
    max: number,
    company?: string
  ): Promise<string[]> {
    try {
      const base = collection(db, "jobs");
      const qBase = company
        ? query(base, where("companyId", "==", company), fsLimit(max))
        : query(base, fsLimit(max));
      const snap = await getDocs(qBase);
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const picked = rows
        .filter((j: any) => j?.status !== "assigned" && !j?.assignedTo)
        .slice(0, max)
        .map((j: any) => j.id as string);
      setAutoJobSample(picked.length);
      return picked;
    } catch (e) {
      console.warn("[autoPickJobIds] failed → fallback", e);
      try {
        const snap = await getDocs(query(collection(db, "jobs"), fsLimit(max)));
        const picked = snap.docs.map((d) => d.id);
        setAutoJobSample(picked.length);
        return picked;
      } catch (e2) {
        console.warn("[autoPickJobIds] fallback failed", e2);
        setAutoJobSample(0);
        return [];
      }
    }
  }
  async function handlePreviewJobs() {
    const ids = await autoPickJobIds(
      maxJobs,
      (companyId || "").trim() || undefined
    );
    setJobPreview(ids);
    console.log("[auto-picked jobs]", ids);
    if (!ids.length)
      alert("No candidate jobs found. Clear Company ID or seed some jobs.");
  }

  // optimize
  const [optResult, setOptResult] = useState<any>(null);
  async function handleOptimize() {
    if (busy !== "idle") return;
    if (!auth.currentUser) return alert("Please sign in first.");
    setBusy("opt");
    setOptResult(null);
    try {
      const messengerIdsArr = messengerIds;
      if (!messengerIdsArr.length)
        return alert("Please enter at least one messenger ID.");
      const jobIdsArr =
        jobPreview && jobPreview.length
          ? jobPreview
          : await autoPickJobIds(maxJobs, (companyId || "").trim() || undefined);
      if (!jobIdsArr.length)
        return alert(
          "No candidate jobs found to assign (clear Company ID or seed some)."
        );

      const payload = {
        messengerIds: messengerIdsArr,
        jobIds: jobIdsArr,
        chunkSize,
        chunkDelayMs,
        shortHopMeters,
        serviceSecDefault: serviceSec,
        companyId: (companyId || "").trim() || undefined,
        date: normalizeToYYYYMMDD(dateInput),
        ignoreWindows,
      };
      console.log("[optimize payload]", payload);
      const data = await runOptimize(payload);
      console.log("[optimize result]", data);
      setOptResult({ ...data, jobsTried: jobIdsArr.length });

      if (messengerIdsArr.length && !selectedRouteId) {
        setSelectedRouteId(messengerIdsArr[0]);
      }
    } catch (e: any) {
      console.error("Optimize failed", e);
      alert(`Optimize failed: ${e?.message || e}`);
    } finally {
      setBusy("idle");
    }
  }

  // seed
  async function handleSeed() {
    if (busy !== "idle") return;
    if (!auth.currentUser) return alert("Please sign in first.");
    setBusy("seed");
    try {
      const lat = Number(seedCenterLat),
        lng = Number(seedCenterLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng))
        return alert("Seed center lat/lng invalid");
      const res = await seedMockJobs({
        messengerId: (seedMessengerId || messengerIds[0] || "").trim(),
        companyId: (companyId || "").trim() || undefined,
        count: Number(seedCount) || 12,
        center: { lat, lng },
        radiusMeters: Number(seedRadius) || 2500,
      });
      console.log("Seed result", res);
      alert(
        `Seeded ${res?.created ?? 0} jobs for ${
          res?.messengerId || "(unknown messenger)"
        }`
      );
    } catch (e: any) {
      console.error("Seed failed", e);
      alert(`Seed failed: ${e?.message || e}`);
    } finally {
      setBusy("idle");
    }
  }

  // enrich
  async function handleEnrich(force = false) {
    console.log("[ENRICH] clicked", { force, selectedRouteId, messengerIds });
    if (busy !== "idle") return alert("Busy… please wait");
    if (!auth.currentUser) return alert("Please sign in first.");

    const routeId =
      selectedRouteId || (messengerIds.length ? messengerIds[0] : "");
    if (!routeId)
      return alert(
        "No route selected and no messenger IDs provided. Enter messenger IDs or click Show."
      );

    setBusy("enrich");
    try {
      alert(`Enriching route ${routeId}… (force=${!!force})`);
      const res = await runEnrichRoute(routeId, force, 6, 0);
      console.log("[ENRICH] result", res);
      alert(
        `Enrich done for ${routeId}\n` +
          `updatedStops=${res?.updatedStops ?? 0}\n` +
          `cacheHits=${res?.cacheHits ?? 0}\n` +
          `cacheMisses=${res?.cacheMisses ?? 0}`
      );
      if (!selectedRouteId) setSelectedRouteId(routeId);
    } catch (e: any) {
      console.error("[ENRICH] failed", e);
      alert(`Enrich failed: ${e?.message || e}`);
    } finally {
      setBusy("enrich");
      setTimeout(() => setBusy("idle"), 50);
    }
  }

  /* ================= Render ================= */

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2>Optimize &amp; Seed</h2>

      {/* auth */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {!user ? (
          <button onClick={signInWithGoogle}>Sign in (Google)</button>
        ) : (
          <>
            <span style={{ fontSize: 12, opacity: 0.8 }}>
              signed in as <b>{user.email || user.uid}</b>
            </span>
            <button onClick={signOutUser}>Sign out</button>
          </>
        )}
      </div>

      {/* inputs */}
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr auto', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Company ID (optional)</label>
          <input value={companyId} onChange={(e) => setCompanyId(e.target.value)} style={{ width: '100%' }} placeholder="company_123" />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Date</label>
          <input value={dateInput} onChange={(e) => setDateInput(e.target.value)} style={{ width: '100%' }} placeholder="YYYY-MM-DD or DD/MM/YYYY" />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Messenger IDs (comma-separated)</label>
          <input
            value={messengerIdsInput}
            onChange={(e) => setMessengerIdsInput(e.target.value)}
            style={{ width: '100%' }}
            placeholder="m1, m2"
          />
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Route view: <b>{selectedRouteId || '(none)'}</b>
            {messengerIds.length > 0 && messengerIds.map((id) => (
              <button key={id} onClick={() => setSelectedRouteId(id)} style={{ marginLeft: 6 }}>
                Show {id}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Service time (sec)</label>
          <input value={serviceSec} onChange={(e) => setServiceSec(Number(e.target.value) || 120)} style={{ width: '100%' }} placeholder="120" />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Max jobs (auto-pick)</label>
          <input type="number" min={1} max={500} value={maxJobs} onChange={(e) => setMaxJobs(+e.target.value || 50)} style={{ width: '100%' }} />
        </div>

        <div>
          <div>
            <button onClick={handleOptimize} disabled={busy !== 'idle'} style={{ width: 200 }}>
              {busy === 'opt' ? 'Optimizing…' : 'Optimize'}
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <button onClick={handlePreviewJobs} disabled={busy !== 'idle'}>Preview jobs</button>
              <button onClick={() => setJobPreview(null)} disabled={!jobPreview}>Clear preview</button>
              <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
                <input type="checkbox" checked={ignoreWindows} onChange={(e) => setIgnoreWindows(e.target.checked)} />
                Ignore time windows
              </label>
            </div>
            {jobPreview && (
              <pre style={{ maxHeight: 120, overflow: 'auto', background: '#f7f7f7', padding: 6, fontSize: 12 }}>
                {jobPreview.join(', ')}
              </pre>
            )}
          </div>
          {autoJobSample > 0 && (
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              Auto-selected jobs last run: <b>{autoJobSample}</b>
            </div>
          )}
        </div>
      </div>

      {/* Phase-3 knobs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Chunk size</span>
          <input type="number" min={1} max={10} value={chunkSize} onChange={(e) => setChunkSize(+e.target.value)} style={{ padding: 8, width: 140 }} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Chunk delay (ms)</span>
          <input type="number" min={0} max={5000} value={chunkDelayMs} onChange={(e) => setChunkDelayMs(+e.target.value)} style={{ padding: 8, width: 160 }} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Short-hop meters</span>
          <input type="number" min={0} max={200} value={shortHopMeters} onChange={(e) => setShortHopMeters(+e.target.value)} style={{ padding: 8, width: 160 }} />
        </label>
      </div>

      {/* results */}
      {optResult ? (
        <pre style={{ background: '#0b0b0b', color: '#c5fbc5', padding: 12, borderRadius: 6, overflow: 'auto' }}>
          {JSON.stringify(optResult, null, 2)}
        </pre>
      ) : null}

      {/* route status */}
      {selectedRouteId ? (
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Showing route: <code>{selectedRouteId}</code> ({legsFromStops.length} stops, {missingPolyline} missing polyline)
        </div>
      ) : null}

      {/* seeding */}
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Seed center lat</label>
          <input value={seedCenterLat} onChange={(e) => setSeedCenterLat(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Seed center lng</label>
          <input value={seedCenterLng} onChange={(e) => setSeedCenterLng(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Seed radius (m)</label>
          <input value={seedRadius} onChange={(e) => setSeedRadius(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Seed count</label>
          <input value={seedCount} onChange={(e) => setSeedCount(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Use messenger (optional)</label>
          <input value={seedMessengerId} onChange={(e) => setSeedMessengerId(e.target.value)} style={{ width: '100%' }} placeholder="uid (defaults to first in list)" />
        </div>
        <div>
          <button onClick={handleSeed} disabled={busy !== 'idle'} style={{ width: 200 }}>
            {busy === 'seed' ? 'Seeding…' : 'Seed mock jobs'}
          </button>
        </div>
      </div>

      {/* map + tools */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 0 }}>
        {mapReady ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={12}
            options={{ streetViewControl: false }}
            onLoad={onMapLoad}
          >
            {/* depot markers */}
            {messengers.map((m) =>
              m.startDepot ? (
                <Marker
                  key={`md-${m.id}`}
                  position={m.startDepot}
                  title={`Depot: ${m.id}`}
                  label={{ text: 'M', fontSize: '12px' }}
                />
              ) : null
            )}

            {/* live pin + route overlay from stops */}
            <MessengerPin legs={legsFromStops} label={selectedRouteId?.slice(0, 4) || 'MSG'} />
            <RoutesOverlayGoogle legs={legsFromStops} />
          </GoogleMap>
        ) : (
          <div style={{ height: containerStyle.height, display: 'grid', placeItems: 'center' }}>Loading map…</div>
        )}

        <div style={{ width: 300, borderLeft: '1px solid #e5e5e5', padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Route Tools</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {messengerIds.map((id) => (
              <button key={`show-${id}`} onClick={() => setSelectedRouteId(id)}>Show {id}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>
            Selected route: <b>{selectedRouteId || '(none)'}</b> • First messenger: <b>{messengerIds[0] || '(none)'}</b>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => handleEnrich(false)} disabled={busy !== 'idle'}>
              {busy === 'enrich' ? 'Re-enriching…' : 'Re-enrich polylines'}
            </button>
            <button onClick={() => handleEnrich(true)} disabled={busy !== 'idle'}>
              {busy === 'enrich' ? 'Force re-enriching…' : 'Force re-enrich'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


  