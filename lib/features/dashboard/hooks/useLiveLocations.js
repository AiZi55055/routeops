"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLiveLocations = useLiveLocations;
const react_1 = require("react");
const database_1 = require("firebase/database");
const firebase_1 = require("@/lib/firebase");
function useLiveLocations() {
    const [locs, setLocs] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        const r = (0, database_1.ref)(firebase_1.rtdb, 'locations'); // TODO: scope by company later
        return (0, database_1.onValue)(r, (snap) => {
            const v = snap.val() ?? {};
            const arr = Object.keys(v).map((id) => ({
                id,
                lat: v[id].lat,
                lng: v[id].lng,
                ts: v[id].ts
            }));
            setLocs(arr);
        });
    }, []);
    return locs;
}
//# sourceMappingURL=useLiveLocations.js.map