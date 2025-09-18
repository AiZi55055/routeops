"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callSeedMock = callSeedMock;
exports.callOptimize = callOptimize;
const firebase_1 = require("@/lib/firebase");
const functions_1 = require("firebase/functions");
const fns = (0, functions_1.getFunctions)(firebase_1.app, "us-central1"); // use your region
async function callSeedMock(messengerId, count = 12) {
    const fn = (0, functions_1.httpsCallable)(fns, "seedMock");
    const res = await fn({ messengerId, count });
    return res.data ?? res;
}
async function callOptimize(messengerIds, date) {
    const fn = (0, functions_1.httpsCallable)(fns, "optimizeRoutes");
    const res = await fn({ messengerIds, date, companyId: "demo-company" });
    return res.data ?? res;
}
//# sourceMappingURL=functions.js.map