"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LiveTracker;
const react_1 = require("react");
const database_1 = require("firebase/database"); // ✅ from firebase/database
const firebase_1 = require("@/lib/firebase"); // ✅ our RTDB handle
const useMessengerLocation_1 = require("./hooks/useMessengerLocation");
function LiveTracker({ messengerId }) {
    const [on, setOn] = (0, react_1.useState)(false);
    const { error } = (0, useMessengerLocation_1.useMessengerLocation)({ messengerId, enabled: on });
    const simRef = (0, react_1.useRef)(null);
    async function testWrite() {
        try {
            // ✅ note both closing parentheses for set(ref(...), {...})
            await (0, database_1.set)((0, database_1.ref)(firebase_1.rtdb, `locations/${messengerId}`), {
                ts: Date.now(),
                lat: 55.755826,
                lng: 37.6173,
                speed: 0,
                accuracy: 50
            });
            alert('Test write OK. Check RTDB at locations/' + messengerId);
        }
        catch (e) {
            alert('Test write FAILED: ' + e.message);
            console.error(e);
        }
    }
    const startSimulator = () => {
        const path = [
            { lat: 13.7563, lng: 100.5018 },
            { lat: 13.7570, lng: 100.5025 },
            { lat: 13.7576, lng: 100.5032 },
            { lat: 13.7581, lng: 100.5040 }
        ];
        let i = 0;
        stopSimulator();
        simRef.current = window.setInterval(() => {
            const p = path[i % path.length];
            (0, database_1.set)((0, database_1.ref)(firebase_1.rtdb, `locations/${messengerId}`), {
                ts: Date.now(),
                lat: p.lat,
                lng: p.lng,
                speed: 3,
                accuracy: 30,
            }).catch(console.error);
            i++;
        }, 3000);
    };
    const stopSimulator = () => {
        if (simRef.current != null) {
            clearInterval(simRef.current);
            simRef.current = null;
        }
    };
    return (<div className="p-4 space-y-3">
      <h2 className="text-lg font-semibold">Live Tracking</h2>

      <button className={`w-full py-3 rounded ${on ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`} onClick={() => setOn(v => !v)}>
        {on ? 'Stop Tracking (GPS)' : 'Start Tracking (GPS)'}
      </button>

      <div className="flex gap-2">
        <button className="flex-1 py-2 rounded bg-indigo-600 text-white" onClick={testWrite}>
          Write Test Point
        </button>
        <button className="flex-1 py-2 rounded bg-blue-600 text-white" onClick={startSimulator}>
          Start Simulator
        </button>
        <button className="flex-1 py-2 rounded bg-slate-600 text-white" onClick={stopSimulator}>
          Stop Simulator
        </button>
      </div>

      {error && <p className="text-sm text-red-500">Location error: {error}</p>}
      <p className="text-xs opacity-70">Writes to <code>locations/{messengerId}</code> in RTDB.</p>
    </div>);
}
//# sourceMappingURL=LiveTracker.js.map