"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMessengerId = useMessengerId;
const react_1 = require("react");
const firebase_1 = require("@/lib/firebase");
function useMessengerId() {
    const [id, setId] = (0, react_1.useState)(firebase_1.auth.currentUser?.uid ?? null);
    (0, react_1.useEffect)(() => {
        return firebase_1.auth.onAuthStateChanged(u => setId(u?.uid ?? null));
    }, []);
    return id; // null when not signed in
}
//# sourceMappingURL=useMessengerId.js.map