"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AuthGate;
const react_1 = require("react");
const auth_1 = require("firebase/auth");
const firebase_1 = require("@/lib/firebase");
function AuthGate({ children }) {
    const [user, setUser] = (0, react_1.useState)(undefined);
    (0, react_1.useEffect)(() => (0, auth_1.onAuthStateChanged)(firebase_1.auth, setUser), []);
    if (user === undefined)
        return <div className="p-4">Loading…</div>;
    if (!user) {
        return (<div className="min-h-dvh grid place-items-center">
        <button onClick={firebase_1.signInGoogle} className="px-4 py-2 rounded bg-sky-500 text-black">
          Sign in with Google
        </button>
      </div>);
    }
    return (<>
      <div className="fixed top-2 right-2 text-xs opacity-70">
        {user.email} · <button onClick={firebase_1.signOutNow}>Sign out</button>
      </div>
      {children}
    </>);
}
//# sourceMappingURL=AuthGate.js.map