"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = UploadJobs;
const react_1 = require("react");
const papaparse_1 = __importDefault(require("papaparse"));
const XLSX = __importStar(require("xlsx"));
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("@/lib/firebase");
const auth_1 = require("firebase/auth");
const functions_1 = require("@/lib/functions");
function UploadJobs() {
    const [rows, setRows] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [msg, setMsg] = (0, react_1.useState)(null);
    function parseFile(file) {
        const isCsv = file.name.toLowerCase().endsWith('.csv');
        if (isCsv) {
            papaparse_1.default.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (res) => setRows(res.data)
            });
        }
        else {
            const reader = new FileReader();
            reader.onload = (e) => {
                const wb = XLSX.read(e.target?.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws);
                setRows(json);
            };
            reader.readAsArrayBuffer(file);
        }
    }
    async function save() {
        setLoading(true);
        setMsg(null);
        const batch = rows.slice(0, 500); // MVP limit
        for (const r of batch) {
            await (0, firestore_1.addDoc)((0, firestore_1.collection)(firebase_1.db, 'jobs'), {
                companyId: 'demo-company',
                type: r.type ?? 'dropoff',
                priority: Number(r.priority) || 0,
                serviceTimeMinutes: Number(r.serviceTimeMin) || 5,
                address: { line: r.address, lat: Number(r.lat) || null, lng: Number(r.lng) || null },
                timeWindow: r.start && r.end ? { start: r.start, end: r.end } : null,
                contact: { name: r.contact || '', phone: r.phone || '' },
                status: 'pending',
                date: (0, firestore_1.serverTimestamp)() // replace with actual delivery date later
            });
        }
        setLoading(false);
        setMsg(`Imported ${batch.length} jobs.`);
        setRows([]);
    }
    return (<main className="p-4 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">Upload Jobs</h1>

    <button onClick={async () => {
            const uid = (0, auth_1.getAuth)().currentUser?.uid;
            if (!uid)
                return alert("Sign in first");
            try {
                const out = await (0, functions_1.callSeedMock)(uid, 12);
                console.log(out);
                alert(`Seeded ${out.created} jobs for ${out.date}`);
            }
            catch (e) {
                console.error(e);
                alert(e?.message ?? "Failed");
            }
        }}>
  Seed 12 mock jobs
    </button>
      <input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}/>

      {rows.length > 0 && (<>
          <div className="text-sm opacity-80">Preview ({rows.length} rows)</div>
          
          <div className="max-h-64 overflow-auto border border-white/10 rounded">
            <table className="w-full text-sm">
              <thead><tr>
                <th className="p-2 text-left">type</th>
                <th className="p-2 text-left">address</th>
                <th className="p-2 text-left">lat</th>
                <th className="p-2 text-left">lng</th>
                <th className="p-2 text-left">start</th>
                <th className="p-2 text-left">end</th>
              </tr></thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (<tr key={i} className="odd:bg-white/5">
                    <td className="p-2">{r.type}</td>
                    <td className="p-2">{r.address}</td>
                    <td className="p-2">{r.lat}</td>
                    <td className="p-2">{r.lng}</td>
                    <td className="p-2">{r.start}</td>
                    <td className="p-2">{r.end}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>

          <button className="px-4 py-2 rounded bg-green-600 text-white" onClick={save} disabled={loading}>
            {loading ? 'Saving…' : 'Save to Firestore'}
          </button>
        </>)}

      {msg && <p className="text-sm text-emerald-400">{msg}</p>}

      <div className="text-xs opacity-60">
        CSV headers supported: type,address,lat,lng,contact,phone,start,end,serviceTimeMin,priority
      </div>
    </main>);
}
//# sourceMappingURL=UploadJobs.js.map