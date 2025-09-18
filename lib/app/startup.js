"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStartupEffects = registerStartupEffects;
// src/app/startup.ts
const auth_1 = require("firebase/auth");
const firebase_1 = require("@/lib/firebase");
const ensureMessenger_1 = require("@/lib/ensureMessenger");
function registerStartupEffects() {
    (0, auth_1.onAuthStateChanged)(firebase_1.auth, async (user) => {
        if (user)
            await (0, ensureMessenger_1.ensureMessengerProfile)();
    });
}
//# sourceMappingURL=startup.js.map