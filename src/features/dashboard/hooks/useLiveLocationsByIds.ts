// src/features/dashboard/hooks/useLiveLocationsByIds.ts
import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

export type LiveLoc = { id: string; lat: number; lng: number; ts?: number; updatedAt?: number };

export function useLiveLocationsByIds(messengerIds: string[]) {
  const [locs, setLocs] = useState<LiveLoc[]>([]);

  useEffect(() => {
    const unsubs = messengerIds.map((id) =>
      onValue(ref(rtdb, `/locations/${id}`), (snap) => {
        const v = snap.val();
        setLocs((prev) => {
          const other = prev.filter((p) => p.id !== id);
          if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number') return other;
          return [
            ...other,
            {
              id,
              lat: v.lat,
              lng: v.lng,
              ts: typeof v.ts === 'number' ? v.ts : undefined,
              updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : undefined,
            },
          ];
        });
      })
    );
    return () => unsubs.forEach((off) => off());
  }, [messengerIds.join('|')]); // stable dep

  return locs;
}
