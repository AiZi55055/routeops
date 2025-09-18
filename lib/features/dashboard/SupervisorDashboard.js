"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SupervisorDashboard;
const react_leaflet_1 = require("react-leaflet");
const leaflet_1 = __importDefault(require("leaflet"));
const useLiveLocations_1 = require("@/features/dashboard/hooks/useLiveLocations");
const useMessengerDirectory_1 = require("@/features/dashboard/hooks/useMessengerDirectory");
const icon = leaflet_1.default.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
function SupervisorDashboard() {
    const locs = (0, useLiveLocations_1.useLiveLocations)(); // reads RTDB /locations/*
    const directory = (0, useMessengerDirectory_1.useMessengerDirectory)(); // reads FS /messengers/*
    const center = locs.length ? [locs[0].lat, locs[0].lng] : [13.7563, 100.5018];
    return (<main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 16 }}>Supervisor Dashboard</h1>
      <div style={{ height: '70vh', width: '100%', border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
        <react_leaflet_1.MapContainer key="dashboard-map" center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <react_leaflet_1.TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors"/>
          {locs.map(m => {
            const info = directory[m.id];
            return (<react_leaflet_1.Marker key={m.id} position={[m.lat, m.lng]} icon={icon}>
                <react_leaflet_1.Popup>
                  <div style={{ fontSize: 12, lineHeight: 1.35 }}>
                    <div><b>{info?.displayName || info?.email || m.id}</b></div>
                    <div>Last: {new Date(m.ts).toLocaleTimeString()}</div>
                  </div>
                </react_leaflet_1.Popup>
              </react_leaflet_1.Marker>);
        })}
        </react_leaflet_1.MapContainer>
      </div>
    </main>);
}
//# sourceMappingURL=SupervisorDashboard.js.map