"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OptimizePage;
// src/pages/OptimizePage.tsx
const react_1 = require("react");
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("@/lib/firebase");
const functions_1 = require("firebase/functions");
const COMPANY_ID = "demo-company"; // adjust if you use multi-company
function OptimizePage() {
    const [messengers, setMessengers] = (0, react_1.useState)([]);
    const [selected, setSelected] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [result, setResult] = (0, react_1.useState)(null);
    const [date, setDate] = (0, react_1.useState)(() => new Date().toISOString().slice(0, 10));
    const [seeding, setSeeding] = (0, react_1.useState)(false);
    // Functions instance (match your deployed region)
    const functions = (0, react_1.useMemo)(() => (0, functions_1.getFunctions)(firebase_1.app, "us-central1"), []);
    (0, react_1.useEffect)(() => {
        const q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, "messengers"), (0, firestore_1.where)("companyId", "==", COMPANY_ID));
        return (0, firestore_1.onSnapshot)(q, (snap) => {
            const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setMessengers(arr);
        });
    }, []);
    const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    async function runOptimize() {
        setLoading(true);
        setResult(null);
        try {
            const call = (0, functions_1.httpsCallable)(functions, "optimizeRoutes");
            const res = await call({ companyId: COMPANY_ID, messengerIds: selected, date });
            setResult(res.data ?? res);
        }
        catch (e) {
            setResult({ error: e?.message ?? String(e) });
        }
        finally {
            setLoading(false);
        }
    }
    async function seedJobs() {
        if (selected.length !== 1) {
            alert("Select exactly 1 messenger to seed jobs for.");
            return;
        }
        setSeeding(true);
        setResult(null);
        try {
            const call = (0, functions_1.httpsCallable)(functions, "seedMock");
            const res = await call({ messengerId: selected[0], count: 12 });
            setResult(res.data ?? res);
        }
        catch (e) {
            setResult({ error: e?.message ?? String(e) });
        }
        finally {
            setSeeding(false);
        }
    }
    return (<main className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Optimize Routes (Select Messengers)</h1>

      <div className="flex items-center gap-3">
        <label className="text-sm">Date:</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-2 py-1"/>
      </div>

      <div className="space-y-2">
        {messengers.length === 0 && <div className="opacity-60">No messengers found.</div>}
        {messengers.map((m) => (<label key={m.id} className="flex items-center gap-2">
            <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)}/>
            <span>
              {m.displayName || m.email || m.id}{" "}
              {m.status === "on" ? "🟢" : "⚪️"}
            </span>
          </label>))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button className="w-full py-3 rounded bg-green-600 text-white disabled:bg-green-900" onClick={runOptimize} disabled={loading || selected.length === 0}>
          {loading ? "Optimizing…" : `Run for ${selected.length} messenger(s)`}
        </button>

        <button className="w-full py-3 rounded bg-indigo-600 text-white disabled:bg-indigo-900" onClick={seedJobs} disabled={seeding || selected.length !== 1} title="Seeds 12 mock jobs for the selected messenger (admin function)">
          {seeding ? "Seeding…" : "Seed 12 mock jobs"}
        </button>
      </div>

      {result && (<pre className="text-sm bg-black/5 p-3 rounded overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>)}
    </main>);
}
//# sourceMappingURL=OptimizePage.js.map