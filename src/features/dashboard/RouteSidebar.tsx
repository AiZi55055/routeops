import React from "react";

type LatLng = { lat: number; lng: number };
type Travel = {
  distanceMeters?: number;
  durationSec?: number;
  polyline?: string | null;
  from?: LatLng;
  to?: LatLng;
};
type LegStatus = "planned" | "enroute" | "arrived" | "completed" | "skipped";
type Leg = {
  jobId: string;
  sequence: number;   // 0-based in your data; we'll show 1-based
  status: LegStatus;
  eta?: number;       // epoch ms (optional, if you later write these)
  travel?: Travel;
};

function fmtEta(eta?: number) {
  if (!eta) return "—";
  try {
    const d = new Date(eta);
    return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

export default function RouteSidebar({
  legs,
  onPan,
}: {
  legs: Leg[];
  onPan?: (center: LatLng) => void;
}) {
  return (
    <div style={{ width: 300, borderLeft: "1px solid #e5e5e5", display: "flex", flexDirection: "column", height: "70vh" }}>
      <div style={{ padding: 12, borderBottom: "1px solid #e5e5e5", fontWeight: 600 }}>
        Route Stops ({legs.length})
      </div>
      <div style={{ overflow: "auto", padding: 8, display: "grid", gap: 6 }}>
        {legs.length === 0 ? (
          <div style={{ opacity: 0.6, padding: 8 }}>No stops yet.</div>
        ) : (
          legs.map((leg, idx) => {
            const seq = (typeof leg.sequence === "number" ? leg.sequence : idx) + 1;
            const to = leg.travel?.to;
            return (
              <button
                key={leg.jobId + ":" + idx}
                onClick={() => to && onPan?.(to)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #eee",
                  background: "#fff",
                  cursor: to ? "pointer" : "default",
                }}
                title={to ? "Pan to stop" : ""}
              >
                <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      display: "inline-grid",
                      placeItems: "center",
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: "1px solid #ddd",
                      fontSize: 12,
                    }}
                  >
                    {seq}
                  </span>
                  <span>Job: {leg.jobId}</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                  ETA: {fmtEta(leg.eta)} • Status: {leg.status || "planned"}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
