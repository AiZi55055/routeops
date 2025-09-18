import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@/lib/leafletIcons';

import RoutesLayer from '@/features/dashboard/RoutesLayer';
import LivePins from '@/features/dashboard/LivePins';
import Legend from '@/features/dashboard/Legend';

// If you already have a hook that streams today's routes, keep using it.
import { useRoutesToday } from '@/features/dashboard/useRoutesToday';

export default function DashboardPage() {
  const { routes, date } = useRoutesToday();

  const messengerIds = Array.from(new Set(routes.map(r => r.messengerId).filter(Boolean))) as string[];

  return (
    <div className="h-screen w-screen">
      <Legend />
      <div className="absolute z-[1000] top-2 right-2 bg-white/95 rounded shadow p-2 text-sm">
        <div className="font-semibold">Supervisor — {date}</div>
        <div className="opacity-70">{routes.length} routes • {messengerIds.length} messengers</div>
      </div>

      <MapContainer center={[14.5995, 120.9842]} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RoutesLayer routes={routes as any} />
        <LivePins messengerIds={messengerIds} />
      </MapContainer>
    </div>
  );
}
