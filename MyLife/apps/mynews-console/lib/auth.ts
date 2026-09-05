import 'server-only';

import { redirect } from 'next/navigation';

import { readAccessTokenClaims } from './aal';
import { isModeratorEmail, parseModeratorAllowlist } from './allowlist';
import { moderatorEmailsRaw } from './env';
import {
  type ModeratorRole,
  type RoleLookup,
  actionMinRole,
  hasLevel,
  readRoleLookup,
  roleRank,
} from './roles';
import { createAdminClient } from './supabase-admin';
import { createSupabaseServerClient } from './supabase-server';

export function moderatorAllowlist(): string[] {
  return parseModeratorAllowlist(moderatorEmailsRaw());
}

/**
 * Everything an action needs to authorize itself: who, at what role, in a
 * session that has actually presented a second factor.
 */
export interface ModeratorContext {
  email: string;
  role: ModeratorRole;
  level: number;
  sessionId: string | null;
}

export type ModeratorSession =
  | { status: 'signed-out' }
  | { status: 'needs-mfa'; email: string }
  | { status: 'no-role'; email: string }
  /** The role table could not be read. Refuses access like 'no-role', but says
   *  something different, because an operator debugging an outage needs to know
   *  the difference between "you were stood down" and "we cannot tell". */
  | { status: 'role-unavailable'; email: string }
  | { status: 'ok'; context: ModeratorContext };

/**
 * Three independent gates, all of which must pass (plan 48 WP9):
 *
 *   1. Allowlist. MYNEWS_CONSOLE_MODERATOR_EMAILS still decides who may hold a
 *      console session at all. It was the only gate before; it is now the outer
 *      one. Kept deliberately: middleware enforces it with no database round
 *      trip, so a database that hands out a role row still cannot admit someone
 *      the operator never listed.
 *   2. MFA. The session's access token must carry aal2. No environment variable,
 *      header, or build flag turns this off; see README.md.
 *   3. Role. nw_moderator_roles must hold an ACTIVE role for this email. An
 *      allowlisted moderator with no role row can sign in and run nothing.
 *
 * Every page and every server action goes through this, so a middleware matcher
 * gap can never become an authorization gap.
 */
export async function getModeratorSession(): Promise<ModeratorSession> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  if (!email || !isModeratorEmail(email, moderatorAllowlist())) return { status: 'signed-out' };
  const normalized = email.trim().toLowerCase();

  // getUser() above verified this token against the auth server, so the aal claim
  // read from that same signed token cannot have been edited in the cookie.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const claims = readAccessTokenClaims(session?.access_token ?? null);
  if (claims.aal !== 'aal2') return { status: 'needs-mfa', email: normalized };

  const role = await fetchModeratorRole(normalized);
  if (role.status === 'unavailable') return { status: 'role-unavailable', email: normalized };
  if (role.role === null) return { status: 'no-role', email: normalized };

  return {
    status: 'ok',
    context: {
      email: normalized,
      role: role.role,
      level: roleRank(role.role),
      sessionId: claims.sessionId,
    },
  };
}

/**
 * The active role for one moderator email. Service-role read.
 *
 * Fails closed either way, but distinguishes the two failures: an unreadable role
 * table is 'unavailable', not "no role". Collapsing them would tell a moderator
 * during a database outage that their access had been revoked, which is both
 * false and the worst possible moment to be misinformed.
 */
export async function fetchModeratorRole(email: string): Promise<RoleLookup> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('nw_moderator_role', {
    p_ref: email.trim().toLowerCase(),
  });
  if (error) console.error(`mynews-console: nw_moderator_role failed: ${error.message}`);
  return readRoleLookup(data, error !== null);
}

/**
 * Page/action guard. Redirects for the three states a moderator can act on (sign
 * in, enrol a factor, ask an admin for a role) so no caller can forget them.
 */
export async function requireModerator(): Promise<ModeratorContext> {
  const session = await getModeratorSession();
  if (session.status === 'signed-out') redirect('/login');
  if (session.status === 'needs-mfa') redirect('/mfa');
  if (session.status === 'no-role') redirect('/no-role');
  if (session.status === 'role-unavailable') redirect('/no-role?unavailable=1');
  return session.context;
}

/**
 * Role gate for a server action. Returns a boolean instead of redirecting so the
 * action can send the moderator back to its own page with an error code. The RPC
 * re-checks the same level, so this is the UI's copy of the rule, not the rule.
 */
export function requireLevel(context: ModeratorContext, minimum: ModeratorRole): boolean {
  return hasLevel(context.role, minimum);
}

/** Whether this moderator may run a named console action. */
export function canRun(context: ModeratorContext, action: string): boolean {
  return hasLevel(context.role, actionMinRole(action));
}
