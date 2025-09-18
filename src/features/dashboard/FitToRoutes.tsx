import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';

type Props = { segments: LatLngExpression[][] };

export default function FitToRoutes({ segments }: Props) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = [];
    for (const seg of segments) {
      for (const p of seg) {
        const [lat, lng] = p as [number, number];
        if (typeof lat === 'number' && typeof lng === 'number') pts.push([lat, lng]);
      }
    }
    if (pts.length > 0) {
      const bounds: LatLngBoundsExpression = pts as any;
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, segments]);
  return null;
}
