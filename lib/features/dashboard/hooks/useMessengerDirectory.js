"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMessengerDirectory = useMessengerDirectory;
// src/features/dashboard/hooks/useMessengerDirectory.ts
const react_1 = require("react");
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("@/lib/firebase");
function useMessengerDirectory() {
    const [byId, setById] = (0, react_1.useState)({});
    (0, react_1.useEffect)(() => {
        // scope to your company; adjust when you add real company scoping
        const q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, 'messengers'), (0, firestore_1.where)('companyId', '==', 'demo-company'));
        const unsub = (0, firestore_1.onSnapshot)(q, (snap) => {
            const map = {};
            snap.forEach((d) => {
                map[d.id] = { id: d.id, ...d.data() };
            });
            setById(map);
        });
        return () => unsub();
    }, []);
    return byId;
}
//# sourceMappingURL=useMessengerDirectory.js.map