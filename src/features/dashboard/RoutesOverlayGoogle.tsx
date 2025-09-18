// src/features/dashboard/RoutesOverlayGoogle.tsx
import React, { Fragment, useMemo } from "react";
import { Marker, Polyline } from "@react-google-maps/api";

type LatLng = { lat: number; lng: number };
type Travel = {
  distanceMeters?: number;
  durationSec?: number;
  polyline?: string | null;
  from?: LatLng;
  to?: LatLng;
};
type Leg = {
  jobId: string;
  sequence: number;
  travel?: Travel;
};

function decodePolyline(str: string): LatLng[] {
  // simple polyline decode (if you already have one, keep yours)
  let index = 0, lat = 0, lng = 0, points: LatLng[] = [];
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export default function RoutesOverlayGoogle({ legs }: { legs: Leg[] }) {
  // build markers & polylines from legs
  const items = useMemo(() => {
    const markers: Array<{ pos: LatLng; seq: number; jobId: string }> = [];
    const polylines: LatLng[][] = [];

    const sorted = [...(legs || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    for (const leg of sorted) {
      const seq = (leg.sequence ?? 0) + 1;
      const to = leg.travel?.to;
      if (to) {
        markers.push({ pos: to, seq, jobId: leg.jobId });
      }
      const pl = leg.travel?.polyline;
      if (pl) {
        try { polylines.push(decodePolyline(pl)); } catch {}
      } else if (leg.travel?.from && leg.travel?.to) {
        // dashed straight-line fallback — keep it thin
        polylines.push([leg.travel.from, leg.travel.to]);
      }
    }
    return { markers, polylines };
  }, [legs]);

  return (
    <Fragment>
      {items.polylines.map((path, i) => (
        <Polyline
          key={"pl-" + i}
          path={path}
          options={{
            strokeOpacity: 0.9,
            strokeWeight: 3,
            // leave color default (Google style) so it blends; dashed if it's just two points
            icons: path.length === 2 ? [{
              icon: { path: "M 0,-1 0,1", scale: 3, strokeOpacity: 1 },
              offset: "0",
              repeat: "12px",
            }] : undefined,
          }}
        />
      ))}

      {items.markers.map((m, i) => (
        <Marker
          key={"mk-" + i + "-" + m.jobId}
          position={m.pos}
          label={{ text: String(m.seq), fontSize: "12px" }} // <— sequence label
          title={`#${m.seq} • ${m.jobId}`}
        />
      ))}
    </Fragment>
  );
}
