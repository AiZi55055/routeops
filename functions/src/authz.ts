// functions/src/authz.ts
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

/**
 * We support both:
 *   - calling with the whole request:  requireRole(req, ["admin","supervisor"])
 *   - calling with just auth:          requireRole(req.auth, ["admin","supervisor"])
 *   - calling with a single role:      requireRole(req, "admin")
 */

export type AuthLike = { uid?: string; token?: Record<string, any> } | null | undefined;
type RequestLike = { auth?: AuthLike } | AuthLike | null | undefined;

/* ===========================
   Public guards (preferred)
   =========================== */

// Overloads allow (auth, role) | (auth, roles[]) | (req, role) | (req, roles[])
export async function ensureRole(reqOrAuth: RequestLike, role: string): Promise<void>;
export async function ensureRole(reqOrAuth: RequestLike, roles: string[]): Promise<void>;
export async function ensureRole(reqOrAuth: RequestLike, roleOrRoles: string | string[]): Promise<void> {
  const auth = getAuthFrom(reqOrAuth);
  assertSignedIn(auth);
  const ok = Array.isArray(roleOrRoles)
    ? roleOrRoles.some((r) => hasRole(auth.token, r))
    : hasRole(auth.token, roleOrRoles);
  if (!ok) {
    logCaller(auth);
    const needed = Array.isArray(roleOrRoles) ? `[${roleOrRoles.join(", ")}]` : roleOrRoles;
    throw new HttpsError("permission-denied", `${needed} role required.`);
  }
}

export async function ensureAnyRole(reqOrAuth: RequestLike, roles: string[]): Promise<void> {
  return ensureRole(reqOrAuth, roles);
}

export async function ensureSupervisor(reqOrAuth: RequestLike): Promise<void> {
  const auth = getAuthFrom(reqOrAuth);
  assertSignedIn(auth);
  if (isSupervisor(auth) || isAdmin(auth)) return;
  logCaller(auth);
  throw new HttpsError("permission-denied", "Supervisor or admin required.");
}

export async function ensureAdmin(reqOrAuth: RequestLike): Promise<void> {
  const auth = getAuthFrom(reqOrAuth);
  assertSignedIn(auth);
  if (isAdmin(auth)) return;
  logCaller(auth);
  throw new HttpsError("permission-denied", "Admin required.");
}

/* ===========================
   Compatibility aliases
   =========================== */

// Legacy signature used in your project: requireRole(req, ["admin","supervisor"])
export const requireRole = ensureRole;
export const requireAnyRole = ensureAnyRole;

/* ===========================
   Convenience boolean checks
   =========================== */

export function isSupervisor(reqOrAuth: RequestLike): boolean {
  const auth = getAuthFrom(reqOrAuth);
  const t = auth?.token ?? {};
  return truthy(t.supervisor) || hasRole(t, "supervisor");
}

export function isAdmin(reqOrAuth: RequestLike): boolean {
  const auth = getAuthFrom(reqOrAuth);
  const t = auth?.token ?? {};
  return truthy(t.admin) || hasRole(t, "admin");
}

/* ===========================
   Internals
   =========================== */

function getAuthFrom(reqOrAuth: RequestLike): AuthLike {
  if (!reqOrAuth) return null;
  // If it's a callable request-like object with .auth
  if (typeof reqOrAuth === "object" && "auth" in (reqOrAuth as any)) {
    return (reqOrAuth as any).auth ?? null;
  }
  // Otherwise assume it's already an AuthLike
  return reqOrAuth as AuthLike;
}

function assertSignedIn(auth: AuthLike): asserts auth is { uid: string; token: Record<string, any> } {
  if (!auth?.uid || !auth.token) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
}

function truthy(v: any): boolean {
  return v === true || (typeof v === "string" && v.toLowerCase() === "true");
}

function lc(x: any): string {
  return typeof x === "string" ? x.toLowerCase() : "";
}

/** Build a normalized set of roles from common custom-claim shapes. */
function getRoleSet(token: Record<string, any> | undefined | null): Set<string> {
  const roles = new Set<string>();
  if (!token) return roles;

  // boolean flags as roles
  if (truthy(token.admin)) roles.add("admin");
  if (truthy(token.supervisor)) roles.add("supervisor");

  // array form: roles: ["admin","supervisor"] or role: ["admin"]
  const arr =
    (Array.isArray(token.roles) && token.roles) ||
    (Array.isArray(token.role) && token.role) ||
    null;
  if (arr) for (const r of arr) { const s = lc(r); if (s) roles.add(s); }

  // string form: role: "admin" or roles: "admin,supervisor"
  const roleStr =
    (typeof token.role === "string" && token.role) ||
    (typeof token.roles === "string" && token.roles) ||
    "";
  if (roleStr) {
    for (const r of roleStr.split(/[,\s]+/)) {
      const s = lc(r);
      if (s) roles.add(s);
    }
  }

  return roles;
}

function hasRole(token: Record<string, any> | undefined | null, role: string): boolean {
  const want = lc(role);
  if (!want) return false;
  return getRoleSet(token).has(want);
}

/** Minimal diagnostic to see what the function received (safe to keep) */
function logCaller(auth: AuthLike) {
  try {
    const t = auth?.token ?? {};
    logger.info("[AUTHZ] deny", {
      uid: auth?.uid ?? null,
      claimKeys: Object.keys(t),
      supervisor: t.supervisor ?? null,
      admin: t.admin ?? null,
      roles: t.roles ?? null,
      role: t.role ?? null,
    });
  } catch {
    // best-effort only
  }
}
