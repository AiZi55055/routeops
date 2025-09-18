"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MessengerHome;
const LiveTracker_1 = __importDefault(require("./LiveTracker"));
const useMessengerId_1 = require("@/features/messenger/hooks/useMessengerId");
function MessengerHome() {
    const messengerId = (0, useMessengerId_1.useMessengerId)();
    if (!messengerId)
        return <div className="p-4">Please sign in…</div>;
    return (<main className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-3">Messenger</h1>
      <LiveTracker_1.default messengerId={messengerId}/>
    </main>);
}
//# sourceMappingURL=Home.js.map