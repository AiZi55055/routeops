import { useEffect, useState } from 'react';
import { collection, getFirestore, onSnapshot, query, where } from 'firebase/firestore';

export type RouteDoc = {
  id: string;
  messengerId: string;
  date: string;
  status: 'planned'|'live'|'done';
  legs?: Array<{
    jobId: string;
    sequence: number;
    status: 'planned'|'enroute'|'arrived'|'completed'|'skipped';
    eta?: number;
    travel?: {
      distanceMeters?: number;
      durationSec?: number;
      polyline?: string | { points?: string } | null;
      from?: { lat:number; lng:number } | null;
      to?: { lat:number; lng:number } | null;
    }
  }>;
  distanceMeters?: number;
  etaSeconds?: number;
};

function todayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

export function useRoutesToday() {
  const [routes, setRoutes] = useState<RouteDoc[]>([]);
  const date = todayUTC();

  useEffect(() => {
    const qRef = query(collection(getFirestore(), 'routes'), where('date', '==', date));
    return onSnapshot(qRef, (snap) => {
      setRoutes(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });
  }, [date]);

  return { routes, date };
}
