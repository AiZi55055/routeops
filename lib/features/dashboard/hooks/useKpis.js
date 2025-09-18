"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useKpis = useKpis;
const react_1 = require("react");
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("@/lib/firebase");
function useKpis(activeMessengers) {
    const [kpis, setKpis] = (0, react_1.useState)({ completed: 0, pending: 0, activeMessengers });
    (0, react_1.useEffect)(() => {
        const q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, 'jobs'), (0, firestore_1.where)('companyId', '==', 'demo-company'));
        const unsub = (0, firestore_1.onSnapshot)(q, (snap) => {
            let completed = 0, pending = 0;
            snap.forEach(d => {
                const s = d.get('status');
                if (s === 'completed')
                    completed++;
                else if (s === 'pending' || s === 'assigned' || s === 'enroute')
                    pending++;
            });
            setKpis({ completed, pending, activeMessengers });
        });
        return () => unsub();
    }, [activeMessengers]);
    return kpis;
}
//# sourceMappingURL=useKpis.js.map