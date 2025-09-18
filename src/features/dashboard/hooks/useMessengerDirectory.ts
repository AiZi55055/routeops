// src/features/dashboard/hooks/useMessengerDirectory.ts
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type MessengerInfo = {
  id: string;
  displayName?: string;
  email?: string;
  status?: string;
};

export function useMessengerDirectory() {
  const [byId, setById] = useState<Record<string, MessengerInfo>>({});

  useEffect(() => {
    // scope to your company; adjust when you add real company scoping
    const q = query(collection(db, 'messengers'), where('companyId', '==', 'demo-company'));
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, MessengerInfo> = {};
      snap.forEach((d) => {
        map[d.id] = { id: d.id, ...(d.data() as any) };
      });
      setById(map);
    });
    return () => unsub();
  }, []);

  return byId;
}
