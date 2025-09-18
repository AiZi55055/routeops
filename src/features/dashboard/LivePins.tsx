// src/features/dashboard/LivePins.tsx
import { getDatabase, onValue, ref } from 'firebase/database';
import { Marker, Popup } from 'react-leaflet';
import { useEffect, useState } from 'react';
import { rtdb } from '@/lib/firebase';
type LiveLoc = { lat: number; lng: number; updatedAt?: number };

export default function LivePins({ messengerIds }: { messengerIds: string[] }) {
    const [live, setLive] = useState<Record<string, LiveLoc>>({});

    useEffect(() => {
        const db = rtdb;
        const unsubs = messengerIds.map((id) =>
            onValue(ref(rtdb, `/locations/${id}`), (snap) => {
                const v = snap.val();
                if (v && typeof v.lat === 'number' && typeof v.lng === 'number') {
                    const ts = typeof v.updatedAt === 'number' ? v.updatedAt : (typeof v.ts === 'number' ? v.ts : undefined);
                    setLive((prev) => ({ ...prev, [id]: { lat: v.lat, lng: v.lng, updatedAt: ts } }));
                }
            })
        );
        return () => unsubs.forEach((u) => u());
    }, [messengerIds]);

    return (
        <>
            {Object.entries(live).map(([id, loc]) => (
                <Marker key={`live-${id}`} position={[loc.lat, loc.lng]}>
                    <Popup>
                        <div>
                            <div><strong>Messenger:</strong> {id}</div>
                            {loc.updatedAt ? <div>Updated: {new Date(loc.updatedAt).toLocaleTimeString()}</div> : null}
                        </div>
                    </Popup>
                </Marker>
            ))}
        </>
    );
}
