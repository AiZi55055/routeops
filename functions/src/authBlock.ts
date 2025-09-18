import { beforeUserCreated } from 'firebase-functions/v2/identity';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';

/**
 * Auth Blocking Function (beforeCreate)
 * Allows signup only for emails/domains present in an allowlist.
 *
 * Sources for allowlist (in priority order):
 * 1) Secret param: AUTH_ALLOW_EMAILS (comma-separated list of exact emails)
 * 2) Secret param: AUTH_ALLOW_DOMAINS (comma-separated domains like "example.com")
 * 3) Env vars: EMAIL_ALLOWLIST / DOMAIN_ALLOWLIST (comma-separated)
 * 4) Hardcoded fallback array (kept minimal/empty by default)
 *
 * Region: asia-southeast1
 */

const AUTH_ALLOW_EMAILS = defineSecret('AUTH_ALLOW_EMAILS'); // e.g. "a@acme.com,b@acme.com"
const AUTH_ALLOW_DOMAINS = defineSecret('AUTH_ALLOW_DOMAINS'); // e.g. "acme.com,partner.org"

// Hardcoded fallback (keep empty unless you really want to bake-in values)
const HARDCODED_EMAILS: string[] = [];
const HARDCODED_DOMAINS: string[] = [];

/** Parses a CSV string into a trimmed, lowercased, de-duped array */
function parseCsvList(input?: string | null): string[] {
  if (!input) return [];
  return Array.from(
    new Set(
      input
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function makeAllowlist(params: { emailsFromSecret?: string; domainsFromSecret?: string }) {
  const emailsFromSecret = parseCsvList(params.emailsFromSecret);
  const domainsFromSecret = parseCsvList(params.domainsFromSecret);
  const emailsFromEnv = parseCsvList(process.env.EMAIL_ALLOWLIST || process.env.AUTH_ALLOW_EMAILS);
  const domainsFromEnv = parseCsvList(process.env.DOMAIN_ALLOWLIST || process.env.AUTH_ALLOW_DOMAINS);

  const emails = Array.from(new Set([...HARDCODED_EMAILS, ...emailsFromEnv, ...emailsFromSecret]));
  const domains = Array.from(new Set([...HARDCODED_DOMAINS, ...domainsFromEnv, ...domainsFromSecret]));

  return { emails, domains };
}

function isEmailAllowed(email: string, allow: { emails: string[]; domains: string[] }) {
  const em = email.toLowerCase();
  const domain = em.split('@')[1] || '';
  if (allow.emails.includes(em)) return true;
  if (allow.domains.includes(domain)) return true;
  return false;
}

export const allowlistAuthBlock = beforeUserCreated(
  {
    region: 'asia-southeast1',
    secrets: [AUTH_ALLOW_EMAILS, AUTH_ALLOW_DOMAINS],
  },
  async (event) => {
    const email = event.data?.email || '';
    const uid = event.data?.uid || 'unknown';

    const allow = makeAllowlist({
      emailsFromSecret: AUTH_ALLOW_EMAILS.value(),
      domainsFromSecret: AUTH_ALLOW_DOMAINS.value(),
    });

    const isAllowed = email ? isEmailAllowed(email, allow) : false;

    logger.info('[AUTH_BLOCK]', {
      tag: 'AUTH_BLOCK',
      action: 'beforeCreate',
      region: 'asia-southeast1',
      uid,
      emailPresent: Boolean(email),
      allowedBy:
        isAllowed && allow.emails.includes(email.toLowerCase())
          ? 'email'
          : isAllowed
          ? 'domain'
          : 'none',
      allowEmailCount: allow.emails.length,
      allowDomainCount: allow.domains.length,
    });

    if (!isAllowed) {
      const error = new Error(
        'Signup is restricted. Please use an approved work email or contact the administrator for access.',
      );
      (error as any).code = 'permission-denied';
      throw error;
    }

    return;
  },
);
