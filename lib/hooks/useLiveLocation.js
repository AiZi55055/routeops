"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLiveLocation = useLiveLocation;
const react_1 = require("react");
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("../lib/firebase");
function useLiveLocation(routeId) {
    const lastSent = (0, react_1.useRef)(0);
    (0, react_1.useEffect)(() => {
        if (!routeId || !('geolocation' in navigator))
            return;
        const id = navigator.geolocation.watchPosition(async (pos) => {
            const now = Date.now();
            if (now - lastSent.current < 10000)
                return; // 10s throttle
            lastSent.current = now;
            const { latitude: lat, longitude: lng, accuracy, speed } = pos.coords;
            await (0, firestore_1.addDoc)((0, firestore_1.collection)(firebase_1.db, `routes/${routeId}/telemetry`), {
                ts: (0, firestore_1.serverTimestamp)(), lat, lng, speedKph: speed ? speed * 3.6 : null, accuracy
            });
        }, console.error, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
        return () => navigator.geolocation.clearWatch(id);
    }, [routeId]);
}
//# sourceMappingURL=useLiveLocation.js.map