"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMessengerLocation = useMessengerLocation;
const react_1 = require("react");
const database_1 = require("firebase/database");
const firebase_1 = require("@/lib/firebase");
function useMessengerLocation({ messengerId, enabled, intervalMs = 5000 }) {
    const watchIdRef = (0, react_1.useRef)(null);
    const lastSendRef = (0, react_1.useRef)(0);
    const [error, setError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        if (!enabled || !messengerId) {
            if (watchIdRef.current != null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            return;
        }
        // kickstart with a single read (helps some desktops)
        navigator.geolocation.getCurrentPosition((pos) => console.log('getCurrentPosition:', pos.coords), (e) => console.warn('getCurrentPosition error:', e.message), { enableHighAccuracy: false, maximumAge: 15000, timeout: 30000 });
        watchIdRef.current = navigator.geolocation.watchPosition((pos) => {
            console.log('watchPosition:', pos.coords); // <-- verify in console
            const now = Date.now();
            if (now - lastSendRef.current < intervalMs)
                return;
            lastSendRef.current = now;
            const { latitude: lat, longitude: lng, heading, speed, accuracy } = pos.coords;
            (0, database_1.set)((0, database_1.ref)(firebase_1.rtdb, `locations/${messengerId}`), {
                ts: now, lat, lng,
                heading: heading ?? null, speed: speed ?? null, accuracy: accuracy ?? null
            }).catch((e) => {
                console.error('RTDB write error:', e);
                setError(e.message);
            });
        }, (e) => {
            console.warn('watchPosition error:', e.message);
            setError(e.message);
        }, { enableHighAccuracy: false, maximumAge: 15000, timeout: 30000 });
        return () => {
            if (watchIdRef.current != null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [enabled, messengerId, intervalMs]);
    return { error };
}
//# sourceMappingURL=useMessengerLocation.js.map