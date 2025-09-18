"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MyRoute;
const react_1 = require("react");
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("../../lib/firebase");
const useLiveLocation_1 = require("../../hooks/useLiveLocation");
function MyRoute({ routeId }) {
    const [stops, setStops] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        if (!routeId)
            return;
        const q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, `routes/${routeId}/stops`), (0, firestore_1.orderBy)('sequence'));
        return (0, firestore_1.onSnapshot)(q, snap => setStops(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, [routeId]);
    (0, useLiveLocation_1.useLiveLocation)(routeId);
    const next = (0, react_1.useMemo)(() => stops.find(s => s.status === 'pending' || s.status === 'arrived'), [stops]);
    if (!next)
        return <div className="p-4">All done 🎉</div>;
    async function markArrived() {
        await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, `routes/${routeId}/stops/${next.id}`), { status: 'arrived', actualArrivalISO: new Date().toISOString() });
    }
    async function markComplete() {
        await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, `routes/${routeId}/stops/${next.id}`), { status: 'completed' });
    }
    return (<div className="p-4 space-y-4">
      <div className="text-xs text-slate-400">Next stop</div>
      <div className="bg-slate-800 p-4 rounded-lg">
        <div className="font-semibold">{next.kind.toUpperCase()}</div>
        <div className="text-slate-300">{next.address?.formatted ?? 'Address on file'}</div>
        <div className="text-slate-400 text-sm">Window {formatTW(next.timeWindow)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={markArrived} className="py-3 rounded bg-amber-500 text-black">Arrived</button>
        <button onClick={markComplete} className="py-3 rounded bg-emerald-500 text-black">Complete</button>
      </div>
    </div>);
}
function formatTW(tw) { return tw?.startISO && tw?.endISO ? `${tw.startISO.slice(11, 16)}–${tw.endISO.slice(11, 16)}` : '—'; }
//# sourceMappingURL=MyRoute.js.map