// src/app/startup.ts
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ensureMessengerProfile } from '@/lib/ensureMessenger';

export function registerStartupEffects() {
  onAuthStateChanged(auth, async (user) => {
    if (user) await ensureMessengerProfile();
  });
}
