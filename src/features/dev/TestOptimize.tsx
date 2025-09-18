import React, { useEffect, useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

function parseCsv(csv: string): string[] {
  return (csv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeRoles(claims: Record<string, any> | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!claims) return out;
  if (claims.admin === true || String(claims.admin).toLowerCase() === "true") out.add("admin");
  if (claims.supervisor === true || String(claims.supervisor).toLowerCase() === "true") out.add("supervisor");
  if (typeof claims.role === "string" && claims.role.trim()) out.add(claims.role.trim().toLowerCase());
  if (Array.isArray(claims.roles)) {
    for (const r of claims.roles) if (typeof r === "string" && r.trim()) out.add(r.trim().toLowerCase());
  }
  if (typeof claims.roles === "string" && claims.roles.trim()) {
    for (const r of claims.roles.split(/[,\s]+/)) {
      const s = r.trim().toLowerCase();
      if (s) out.add(s);
    }
  }
  return out;
}

export default function TestOptimize() {
  const fns = getFunctions(app, "asia-southeast1");
  const optimize = httpsCallable(fns, "optimizeRoutesV2");
  const enrichAll = httpsCallable(fns, "enrichAllRoutes");

  // Auth + claims
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Record<string, any> | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        setRefreshing(true);
        try {
          await u.getIdToken(true);
          const tr = await u.getIdTokenResult();
          setClaims(tr.claims || {});
          console.log("[claims]", tr.claims);
        } finally {
          setRefreshing(false);
        }
      } else {
        setClaims(null);
      }
    });
    return () => unsub();
  }, []);

  const roleSet = useMemo(() => normalizeRoles(claims), [claims]);
  const hasSupervisor = roleSet.has("supervisor") || roleSet.has("admin");

  // -------- Optimize tester --------
  const [messengerCsv, setMessengerCsv] = useState("m1,m2");
  const [jobCsv, setJobCsv] = useState("j1,j2,j3,j4");
  const messengerIds = useMemo(() => parseCsv(messengerCsv), [messengerCsv]);
  const jobIds = useMemo(() => parseCsv(jobCsv), [jobCsv]);

  const [chunkSize, setChunkSize] = useState(2);
  const [chunkDelayMs, setChunkDelayMs] = useState(800);
  const [shortHopMeters, setShortHopMeters] = useState(20);

  const [busyOpt, setBusyOpt] = useState(false);
  const [outOpt, setOutOpt] = useState<any>(null);

  async function runOptimize() {
    if (!user) return alert("Please sign in first.");
    if (!hasSupervisor) return alert("You need supervisor or admin role.");

    const payload = {
      messengerIds,
      jobIds,
      chunkSize,
      chunkDelayMs,
      shortHopMeters,
    };
    if (!messengerIds.length) return alert("Enter at least one Messenger ID.");
    if (!jobIds.length) return alert("Enter at least one Job ID.");

    setBusyOpt(true);
    setOutOpt(null);
    try {
      console.log("[optimize payload]", payload);
      const res: any = await optimize(payload);
      const data = res?.data ?? res;
      console.log("[optimize result]", data);
      setOutOpt(data);
    } catch (e: any) {
      const errInfo = { code: e?.code, message: e?.message, details: e?.details, stack: e?.stack };
      console.error("[optimize error]", errInfo);
      setOutOpt({ error: errInfo });
      alert(`Optimize failed: ${e?.message || e}`);
    } finally {
      setBusyOpt(false);
    }
  }

  // -------- Enrich All tester --------
  const [routeIdsCsv, setRouteIdsCsv] = useState(""); // optional whitelist
  const routeIds = useMemo(() => parseCsv(routeIdsCsv), [routeIdsCsv]);

  const [routeConcurrency, setRouteConcurrency] = useState(3);
  const [legConcurrency, setLegConcurrency] = useState(5);
  const [limit, setLimit] = useState(30);

  const [busyEnrich, setBusyEnrich] = useState(false);
  const [outEnrich, setOutEnrich] = useState<any>(null);

  async function runEnrichAll() {
    if (!user) return alert("Please sign in first.");
    if (!hasSupervisor) return alert("You need supervisor or admin role.");

    const payload: any = {
      routeConcurrency,
      legConcurrency,
      limit,
      shortHopMeters,
    };
    if (routeIds.length) payload.routeIds = routeIds;

    setBusyEnrich(true);
    setOutEnrich(null);
    try {
      console.log("[enrichAll payload]", payload);
      const res: any = await enrichAll(payload);
      const data = res?.data ?? res;
      console.log("[enrichAll result]", data);
      setOutEnrich(data);
    } catch (e: any) {
      const errInfo = { code: e?.code, message: e?.message, details: e?.details, stack: e?.stack };
      console.error("[enrichAll error]", errInfo);
      setOutEnrich({ error: errInfo });
      alert(`Enrich-all failed: ${e?.message || e}`);
    } finally {
      setBusyEnrich(false);
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 16, maxWidth: 820 }}>
      <h2>Dev tools</h2>

      <div style={{ fontSize: 13, color: "#555" }}>
        User: {authLoading ? "loading…" : user ? user.email : "signed out"}
        {refreshing && " (refreshing token…)"}
        {claims && (
          <span> • claims: {Object.keys(claims).length ? JSON.stringify(claims) : "(none)"} </span>
        )}
        {!!roleSet.size && <span> • derived roles: {Array.from(roleSet).join(", ")}</span>}
      </div>

      {/* Optimize panel */}
      <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Optimize tester</h3>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Messenger IDs (comma-separated)</span>
          <input value={messengerCsv} onChange={(e) => setMessengerCsv(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
          <span>Job IDs (comma-separated)</span>
          <input value={jobCsv} onChange={(e) => setJobCsv(e.target.value)} />
        </label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Chunk size</span>
            <input type="number" min={1} max={10} value={chunkSize} onChange={(e) => setChunkSize(+e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Chunk delay (ms)</span>
            <input
              type="number"
              min={0}
              max={5000}
              value={chunkDelayMs}
              onChange={(e) => setChunkDelayMs(+e.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Short-hop meters</span>
            <input
              type="number"
              min={0}
              max={200}
              value={shortHopMeters}
              onChange={(e) => setShortHopMeters(+e.target.value)}
            />
          </label>
        </div>
        <button
          onClick={runOptimize}
          disabled={busyOpt || !user || !hasSupervisor || refreshing}
          style={{ marginTop: 10 }}
        >
          {busyOpt ? "Running..." : "Run optimizeRoutesV2"}
        </button>

        {outOpt ? (
          <pre style={{ background: "#0b0b0b", color: "#c5fbc5", padding: 12, borderRadius: 6, overflow: "auto" }}>
            {JSON.stringify(outOpt, null, 2)}
          </pre>
        ) : null}
      </section>

      {/* Enrich all panel */}
      <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Enrich All Routes</h3>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Route IDs (optional, comma-separated whitelist)</span>
          <input value={routeIdsCsv} onChange={(e) => setRouteIdsCsv(e.target.value)} placeholder="route1, route2" />
        </label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Route concurrency</span>
            <input
              type="number"
              min={1}
              max={10}
              value={routeConcurrency}
              onChange={(e) => setRouteConcurrency(+e.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Leg concurrency</span>
            <input
              type="number"
              min={1}
              max={10}
              value={legConcurrency}
              onChange={(e) => setLegConcurrency(+e.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Limit (max routes)</span>
            <input type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(+e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Short-hop meters</span>
            <input
              type="number"
              min={0}
              max={200}
              value={shortHopMeters}
              onChange={(e) => setShortHopMeters(+e.target.value)}
            />
          </label>
        </div>
        <button
          onClick={runEnrichAll}
          disabled={busyEnrich || !user || !hasSupervisor || refreshing}
          style={{ marginTop: 10 }}
        >
          {busyEnrich ? "Enriching..." : "Run enrichAllRoutes"}
        </button>

        {outEnrich ? (
          <pre style={{ background: "#0b0b0b", color: "#c5fbc5", padding: 12, borderRadius: 6, overflow: "auto" }}>
            {JSON.stringify(outEnrich, null, 2)}
          </pre>
        ) : null}
      </section>
    </div>
  );
}
