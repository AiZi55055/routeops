import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import { registerStartupEffects } from '@/app/startup';

// IMPORTANT: include Leaflet CSS once
import 'leaflet/dist/leaflet.css';

// IMPORTANT: keep StrictMode OFF while using Leaflet in dev
registerStartupEffects();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <RouterProvider router={router} />
);
