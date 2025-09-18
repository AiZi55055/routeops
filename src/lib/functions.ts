// src/lib/functions.ts
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

// Always use your region — singleton to avoid multiple inits
export const functions = getFunctions(app, "asia-southeast1");

/* ================= Types ================= */

export type LatLng = { lat: number; lng: number };

// -------- optimizeRoutesV2 --------
export type OptimizeRequest = {
  messengerIds: string[];
  jobIds: string[];
  companyId?: string;
  date?: string;
  serviceSecDefault?: number;
  shortHopMeters?: number;
  chunkSize?: number;
  chunkDelayMs?: number;
  tieNudgeSec?: number;
  ignoreWindows?: boolean;
  force?: boolean;
};
export type OptimizeResponse = {
  assigned: number;
  chunks: number;
  cacheHits: number;
  cacheMisses: number;
};

// -------- seedMockJobs --------
export type SeedMockRequest = {
  messengerId?: string;
  companyId?: string;
  count?: number;
  center: LatLng;
  radiusMeters?: number;
};
export type SeedMockResponse = {
  created: number;
  messengerId?: string;
};

// -------- enrichRoutePolylines --------
export type EnrichRouteRequest = {
  routeId: string;
  force?: boolean;
  legConcurrency?: number;
  shortHopMeters?: number;
};
export type EnrichRouteResponse = {
  updatedStops: number;
  cacheHits?: number;
  cacheMisses?: number;
};

// -------- enrichAllRoutes --------
export type EnrichAllRequest = {
  routeIds?: string[];
  companyId?: string;
  limit?: number;
  updatedBefore?: number;
  routeConcurrency?: number;
  legConcurrency?: number;
  shortHopMeters?: number;
  force?: boolean;
};
export type EnrichAllResponse = {
  routesProcessed: number;
  routesTotal?: number;
  cacheHits?: number;
  cacheMisses?: number;
};

/* ================= Callables ================= */

export async function runOptimize(
  payload: OptimizeRequest
): Promise<OptimizeResponse> {
  const fn = httpsCallable<OptimizeRequest, OptimizeResponse>(
    functions,
    "optimizeRoutesV2"
  );
  const res = await fn(payload);
  return res.data;
}

export async function seedMockJobs(
  payload: SeedMockRequest
): Promise<SeedMockResponse> {
  const fn = httpsCallable<SeedMockRequest, SeedMockResponse>(
    functions,
    "seedMockJobs"
  );
  const res = await fn(payload);
  return res.data;
}

export async function runEnrichRoute(
  routeId: string,
  force = false,
  legConcurrency?: number,
  shortHopMeters?: number
): Promise<EnrichRouteResponse> {
  const fn = httpsCallable<EnrichRouteRequest, EnrichRouteResponse>(
    functions,
    "enrichRoutePolylines"
  );
  const res = await fn({ routeId, force, legConcurrency, shortHopMeters });
  return res.data;
}

export async function runEnrichAll(
  payload: EnrichAllRequest
): Promise<EnrichAllResponse> {
  const fn = httpsCallable<EnrichAllRequest, EnrichAllResponse>(
    functions,
    "enrichAllRoutes"
  );
  const res = await fn(payload);
  return res.data;
}
