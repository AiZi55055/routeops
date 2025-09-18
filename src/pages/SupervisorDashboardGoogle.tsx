// src/pages/SupervisorDashboardGoogle.tsx
import { useMemo, useState } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { useLiveLocationsByIds } from '@/features/dashboard/hooks/useLiveLocationsByIds';

const containerStyle = { width: '100%', height: '70vh' };
const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 };

export default function SupervisorDashboardGoogle() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: apiKey });

  // TEMP: enter one or more UIDs to watch (comma-separated)
  const [uidsText, setUidsText] = useState<string>('OT6d78GuYranAY5pekPAF36dram1'); // <-- put your UID here
  const ids = useMemo(
    () => uidsText.split(',').map(s => s.trim()).filter(Boolean),
    [uidsText]
  );

  const locs = useLiveLocationsByIds(ids);
  const center = useMemo(
    () => (locs[0] ? { lat: locs[0].lat, lng: locs[0].lng } : DEFAULT_CENTER),
    [locs]
  );

  if (!isLoaded) return <div style={{ padding: 16 }}>Loading Google Map…</div>;

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Supervisor Dashboard (Google)</h1>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <label>UIDs (comma-separated):{' '}
          <input
            value={uidsText}
            onChange={(e) => setUidsText(e.target.value)}
            style={{ width: 520 }}
            placeholder="uid1, uid2, uid3"
          />
        </label>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          Watching {ids.length} uid(s) • Live: {locs.length}
        </span>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
        <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={12} options={{ streetViewControl: false }}>
          {locs.map((m) => (
            <MarkerF
              key={m.id}
              position={{ lat: m.lat, lng: m.lng }}
              title={`${m.id} — ${new Date(m.updatedAt ?? m.ts ?? 0).toLocaleTimeString()}`}
            />
          ))}
        </GoogleMap>
      </div>

      <div style={{ marginTop: 8, fontSize: 12 }}>
        Live: {locs.length}{' '}
        {locs[0] && `• first ${locs[0].id} @ ${locs[0].lat.toFixed(5)}, ${locs[0].lng.toFixed(5)}`}
      </div>
    </main>
  );
}
