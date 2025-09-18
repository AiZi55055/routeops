import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { useLiveLocations } from '@/features/dashboard/hooks/useLiveLocations';
import { useMessengerDirectory } from '@/features/dashboard/hooks/useMessengerDirectory';

const containerStyle = { width: '100%', height: '70vh' };

export default function SupervisorDashboardGoogle() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: apiKey });
  const locs = useLiveLocations();
  const directory = useMessengerDirectory();

  const center = locs.length ? { lat: locs[0].lat, lng: locs[0].lng } : { lat: 13.7563, lng: 100.5018 };

  if (!isLoaded) return <div style={{ padding: 16 }}>Loading Google Map…</div>;

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 16 }}>Supervisor Dashboard (Google)</h1>
      <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
        <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={13}>
          {locs.map(m => {
            const info = directory[m.id];
            return (
              <MarkerF
                key={m.id}
                position={{ lat: m.lat, lng: m.lng }}
                title={(info?.displayName || info?.email || m.id) + (m.ts ? ` — ${new Date(m.ts).toLocaleTimeString()}` : '')}
              />
            );
          })}
          {/* Add Google traffic layer if you want:
              <TrafficLayer />
          */}
        </GoogleMap>
      </div>
    </main>
  );
}
