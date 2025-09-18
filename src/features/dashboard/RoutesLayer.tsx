import { Polyline as RLPolyline, CircleMarker, Popup } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import polyline from '@mapbox/polyline';

type LatLng = { lat: number; lng: number };
type Leg = {
  jobId: string;
  sequence?: number;
  status: 'planned'|'enroute'|'arrived'|'completed'|'skipped';
  eta?: number;
  travel?: {
    polyline?: string | { points?: string } | null;
    from?: LatLng | null;
    to?: LatLng | null;
  };
};
type RouteDoc = { id: string; messengerId?: string; legs?: Leg[] };

function statusColor(s: string) {
  switch (s) {
    case 'planned': return '#9ca3af';
    case 'enroute': return '#3b82f6';
    case 'arrived': return '#f59e0b';
    case 'completed': return '#10b981';
    case 'skipped': return '#ef4444';
    default: return '#6b7280';
  }
}

function polyString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val || null;
  if (typeof val === 'object' && val !== null && 'points' in (val as any)) {
    const s = (val as { points?: string }).points;
    return s || null;
  }
  return null;
}

export default function RoutesLayer({ routes }: { routes: RouteDoc[] }) {
  const segments: { pts: LatLngExpression[]; color: string; key: string }[] = [];
  const stops: Array<{ pos: LatLng; status: Leg['status']; eta?: number; routeId: string; jobId: string; seq?: number }> = [];

  for (const r of routes) {
    for (const leg of r.legs ?? []) {
      const color = statusColor(leg.status);

      // collect stop marker position
      const to = leg.travel?.to;
      if (to && typeof to.lat === 'number' && typeof to.lng === 'number') {
        stops.push({ pos: to, status: leg.status, eta: leg.eta, routeId: r.id, jobId: leg.jobId, seq: leg.sequence });
      }

      // prefer encoded polyline
      const enc = polyString(leg.travel?.polyline);
      if (enc) {
        const pts = polyline.decode(enc).map(([lat, lng]) => [lat, lng]) as LatLngExpression[];
        if (pts.length >= 2) {
          segments.push({ pts, color, key: `${r.id}-${leg.jobId}-enc` });
          continue;
        }
      }

      // fallback straight segment
      const from = leg.travel?.from;
      if (
        from && to &&
        typeof from.lat === 'number' && typeof from.lng === 'number'
      ) {
        segments.push({
          pts: [[from.lat, from.lng], [to.lat, to.lng]],
          color,
          key: `${r.id}-${leg.jobId}-ft`
        });
      }
    }
  }

  return (
    <>
      {segments.map(s => (
        <RLPolyline key={s.key} positions={s.pts} pathOptions={{ color: s.color }} />
      ))}

      {stops.map((s, i) => (
        <CircleMarker
          key={`stop-${s.routeId}-${s.jobId}-${i}`}
          center={[s.pos.lat, s.pos.lng]}
          radius={6}
          pathOptions={{ color: statusColor(s.status), weight: 2 }}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <div><strong>Job:</strong> {s.jobId}</div>
              {typeof s.seq === 'number' ? <div><strong>#</strong> {s.seq}</div> : null}
              <div><strong>Status:</strong> {s.status}</div>
              {s.eta ? <div><strong>ETA:</strong> {new Date(s.eta).toLocaleTimeString()}</div> : null}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
