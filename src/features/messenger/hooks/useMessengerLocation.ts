import { useEffect, useRef, useState } from 'react';
import { ref, set } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

type Options = {
  messengerId: string;
  enabled: boolean;
  intervalMs?: number;
};

export function useMessengerLocation({ messengerId, enabled, intervalMs = 5000 }: Options) {
  const watchIdRef = useRef<number | null>(null);
  const lastSendRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !messengerId) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    // kickstart with a single read (helps some desktops)
    navigator.geolocation.getCurrentPosition(
      (pos) => console.log('getCurrentPosition:', pos.coords),
      (e) => console.warn('getCurrentPosition error:', e.message),
      { enableHighAccuracy: false, maximumAge: 15000, timeout: 30000 }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        console.log('watchPosition:', pos.coords); // <-- verify in console
        const now = Date.now();
        if (now - lastSendRef.current < intervalMs) return;
        lastSendRef.current = now;

        const { latitude: lat, longitude: lng, heading, speed, accuracy } = pos.coords;
        set(ref(rtdb, `locations/${messengerId}`), {
          ts: now, lat, lng,
          heading: heading ?? null, speed: speed ?? null, accuracy: accuracy ?? null
        }).catch((e) => {
          console.error('RTDB write error:', e);
          setError(e.message);
        });
      },
      (e) => {
        console.warn('watchPosition error:', e.message);
        setError(e.message);
      },
      { enableHighAccuracy: false, maximumAge: 15000, timeout: 30000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, messengerId, intervalMs]);

  return { error };
}
