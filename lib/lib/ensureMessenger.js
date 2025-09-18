"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureMessengerProfile = ensureMessengerProfile;
// src/lib/ensureMessengerProfile.ts
const firebase_1 = require("@/lib/firebase");
const firestore_1 = require("firebase/firestore");
/**
 * Ensure a Firestore doc exists at /messengers/{auth.uid}.
 * We keep messengerId = auth.uid for now.
 */
async function ensureMessengerProfile() {
    const u = firebase_1.auth.currentUser;
    if (!u)
        return null;
    const ref = (0, firestore_1.doc)(firebase_1.db, 'messengers', u.uid);
    const snap = await (0, firestore_1.getDoc)(ref);
    if (!snap.exists()) {
        await (0, firestore_1.setDoc)(ref, {
            userId: u.uid,
            displayName: u.displayName ?? '',
            email: u.email ?? '',
            phone: u.phoneNumber ?? '',
            companyId: 'demo-company', // TODO: set real company later
            status: 'off', // updated to 'on' when Start Tracking
            createdAt: (0, firestore_1.serverTimestamp)(),
            metrics: { dayDistance: 0, dayCompleted: 0, dayPending: 0 },
        });
    }
    else {
        // keep profile fresh
        await (0, firestore_1.updateDoc)(ref, {
            displayName: u.displayName ?? snap.data()?.displayName ?? '',
            email: u.email ?? snap.data()?.email ?? '',
        });
    }
    return u.uid;
}
//# sourceMappingURL=ensureMessenger.js.map