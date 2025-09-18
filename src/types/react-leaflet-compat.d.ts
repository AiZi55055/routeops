// src/types/react-leaflet-compat.d.ts

// Loosen react-leaflet component typings to "any" to avoid version/type mismatches during dev.
// This is a pragmatic shim while you align react, react-leaflet, leaflet, and TS versions.
// Remove/trim this once your deps are stable.

declare module 'react-leaflet' {
  export const MapContainer: any;
  export const TileLayer: any;
  export const Marker: any;
  export const Popup: any;
  export const Tooltip: any;

  export const Polyline: any;
  export const Polygon: any;
  export const Rectangle: any;
  export const Circle: any;
  export const CircleMarker: any;

  export const ImageOverlay: any;
  export const VideoOverlay: any;
  export const SVGOverlay: any;

  export const LayerGroup: any;
  export const FeatureGroup: any;
  export const LayersControl: any;
  export const Pane: any;

  export const WMSTileLayer: any;
  export const GeoJSON: any;

  export const AttributionControl: any;
  export const ScaleControl: any;
  export const ZoomControl: any;

  // Hooks
  export function useMap(): any;
  export function useMapEvent(type: any, handler: any): any;
  export function useMapEvents(handlers: any): any;
}
