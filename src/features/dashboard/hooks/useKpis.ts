import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type Kpis = { completed: number; pending: number; activeMessengers: number };

export function useKpis(activeMessengers: number) {
  const [kpis, setKpis] = useState<Kpis>({ completed: 0, pending: 0, activeMessengers });

  useEffect(() => {
    const q = query(collection(db, 'jobs'), where('companyId', '==', 'demo-company'));
    const unsub = onSnapshot(q, (snap) => {
      let completed = 0, pending = 0;
      snap.forEach(d => {
        const s = d.get('status');
        if (s === 'completed') completed++;
        else if (s === 'pending' || s === 'assigned' || s === 'enroute') pending++;
      });
      setKpis({ completed, pending, activeMessengers });
    });
    return () => unsub();
  }, [activeMessengers]);

  return kpis;
}
