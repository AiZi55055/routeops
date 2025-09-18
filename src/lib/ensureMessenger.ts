// src/lib/ensureMessengerProfile.ts
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

/**
 * Ensure a Firestore doc exists at /messengers/{auth.uid}.
 * We keep messengerId = auth.uid for now.
 */
export async function ensureMessengerProfile() {
  const u = auth.currentUser;
  if (!u) return null;

  const ref = doc(db, 'messengers', u.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      userId: u.uid,
      displayName: u.displayName ?? '',
      email: u.email ?? '',
      phone: u.phoneNumber ?? '',
      companyId: 'demo-company',       // TODO: set real company later
      status: 'off',                   // updated to 'on' when Start Tracking
      createdAt: serverTimestamp(),
      metrics: { dayDistance: 0, dayCompleted: 0, dayPending: 0 },
    });
  } else {
    // keep profile fresh
    await updateDoc(ref, {
      displayName: u.displayName ?? snap.data()?.displayName ?? '',
      email: u.email ?? snap.data()?.email ?? '',
    });
  }
  return u.uid;
}
