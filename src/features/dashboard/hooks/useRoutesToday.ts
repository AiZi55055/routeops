import { useEffect, useState } from 'react';
import { collection, getFirestore, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';

export type LatLng = { lat:number; lng:number };
export type Leg = {
  jobId: string;
  sequence: number;
  status: 'planned'|'enroute'|'arrived'|'completed'|'skipped';
  eta?: number;
  travel?: {
    distanceMeters?: number;
    durationSec?: number;
    polyline?: string | { points?: string } | null;
    from?: LatLng | null;
    to?: LatLng | null;
  };
};
export type RouteDoc = {
  id: string;
  messengerId: string;
  date: string; // 'YYYY-MM-DD'
  status: 'planned'|'live'|'done';
  legs?: Leg[];
};

function todayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

export function useRoutesToday(showRecent = false) {
  const [routes, setRoutes] = useState<RouteDoc[]>([]);
  const date = todayUTC();

  useEffect(() => {
    const db = getFirestore();
    const col = collection(db, 'routes');
    const q = showRecent
      ? query(col, orderBy('date','desc'), limit(50))
      : query(col, where('date','==', date));

    return onSnapshot(q, (snap) => {
      setRoutes(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    }, (err) => console.error('routes snapshot error:', err));
  }, [showRecent]);

  return { routes, date };
}
