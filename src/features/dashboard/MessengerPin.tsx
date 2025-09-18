// src/features/dashboard/MessengerPin.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { MarkerF } from '@react-google-maps/api';
import { doc, getDoc } from 'firebase/firestore';
import { db, rtdb } from '../../lib/firebase';         // ← use your singletons
import { onValue, ref as rtdbRef } from 'firebase/database';

type LatLng = google.maps.LatLngLiteral;
type Leg = { sequence: number; travel?: { from?: LatLng; to?: LatLng } };
type Props = { messengerId?: string | null; legs?: Leg[] | null; label?: string };

export default function MessengerPin({ messengerId, legs, label }: Props) {
  const [livePos, setLivePos] = useState<LatLng | null>(null);
  const [depot, setDepot] = useState<LatLng | null>(null);

  const firstFrom = useMemo<LatLng | null>(() => {
    const sorted = [...(legs || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    for (const l of sorted) {
      if (l?.travel?.from) return l.travel.from!;
    }
    return null;
  }, [legs]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!messengerId) return;
      try {
        const snap = await getDoc(doc(db, 'messengers', messengerId));
        if (active && snap.exists()) {
          const data = snap.data() as any;
          const sd = data?.startDepot;
          if (sd && typeof sd.lat === 'number' && typeof sd.lng === 'number') {
            setDepot({ lat: sd.lat, lng: sd.lng });
          }
        }
      } catch (e) {
        console.warn('load startDepot error', e);
      }
    })();
    return () => { active = false; };
  }, [messengerId]);

  useEffect(() => {
    if (!messengerId) return;
    const ref = rtdbRef(rtdb, `locations/${messengerId}`);
    const unsubscribe = onValue(ref, (snap) => {
      const v = snap.val();
      if (v && typeof v.lat === 'number' && typeof v.lng === 'number') {
        setLivePos({ lat: v.lat, lng: v.lng });
      }
    });
    return () => unsubscribe();
  }, [messengerId]);

  const pos = livePos || depot || firstFrom;
  if (!pos) return null;

  return (
    <MarkerF
      position={pos}
      icon={{
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 5.5,
        fillOpacity: 1,
        fillColor: livePos ? '#10b981' : '#2563eb',
        strokeWeight: 1.5,
        strokeColor: '#0f172a',
      }}
      label={label ? { text: label, color: '#111827', fontSize: '12px', fontWeight: '700' } : undefined}
      title={livePos ? 'Messenger (live)' : 'Messenger (start)'}
    />
  );
}
