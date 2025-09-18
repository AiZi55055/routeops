import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

export type LiveLoc = { id: string; lat: number; lng: number; ts?: number; updatedAt?: number };

export function useLiveLocations() {
  const [locs, setLocs] = useState<LiveLoc[]>([]);

  useEffect(() => {
    const r = ref(rtdb, '/locations');
    console.log('Listening on:', r.toString()); // should print your asia-southeast1 URL
    const off = onValue(
      r,
      (snap) => {
        const val = snap.val() || {};
        const arr: LiveLoc[] = Object.entries(val)
          .map(([id, v]: any) => ({
            id,
            lat: typeof v.lat === 'number' ? v.lat : NaN,
            lng: typeof v.lng === 'number' ? v.lng : NaN,
            ts: typeof v.ts === 'number' ? v.ts : undefined,
            updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : undefined,
          }))
          .filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
        setLocs(arr);
      },
      (err) => {
        console.error('RTDB listen error', err);
        setLocs([]);
      }
    );
    return () => off();
  }, []);

  return locs;
}
