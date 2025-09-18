import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default icon paths (Vite/CRA bundlers)
const iconRetinaUrl =
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const iconUrl =
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl =
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

(L.Icon.Default as any).mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl
});

export {};
