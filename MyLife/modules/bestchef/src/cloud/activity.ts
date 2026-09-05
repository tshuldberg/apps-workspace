/**
 * Profile activity aggregator.
 *
 * Reads from bc_profile_activity_v (defined in migration 005) to return
 * a unified ActivityEntry[] matching the are-blaze ActivitySection.Activity
 * shape for the profile and chef-profile screens.
 */

import { getBestChefClient, ok, err, type BestChefResult } from './client';

function from(table: string) {
  return getBestChefClient().from(table);
}

// ── Types ─────────────────────────────────────────────────────────────

export type ActivityKind =
  | 'rank_change'
  | 'reviewed_vote'
  | 'upvotes'
  | 'badge'
  | 'new_follower'
  | 'posted_recipe';

export interface ActivityEntry {
  /** Stable opaque id (composite source key). */
  id: string;
  kind: ActivityKind;
  /** SF Symbol or equivalent icon name (matches are-blaze ActivitySection). */
  icon: string;
  /** Hex accent colour for the icon tint circle. */
  tint: string;
  /** Legacy server-baked English copy; prefer rendering from kind+params. */
  title: string;
  subtitle: string;
  /** Localization params (plan 33 Phase 2.1); clients render via catalogs. */
  params: Record<string, unknown>;
  /** Formatted relative time, e.g. "2h" or "3d" (English fallback; screens
   * should localize from occurredAt via formatRelativeTime, Phase 3.3). */
  timeAgo: string;
  /** Raw ISO timestamp for locale-aware relative rendering. */
  occurredAt: string;
  /** Optional deep-link route within the app. */
  targetRoute?: string;
}

// ── View row shape returned by bc_profile_activity_v ──────────────────

interface ActivityViewRow {
  id: string;
  kind: ActivityKind;
  icon: string;
  tint: string;
  title: string;
  subtitle: string;
  params: Record<string, unknown> | null;
  occurred_at: string;
  target_route: string | null;
}

// ── Time formatting ───────────────────────────────────────────────────

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

// ── Main query ────────────────────────────────────────────────────────

export interface GetProfileActivityOptions {
  chefId: string;
  limit?: number;
}

/**
 * Fetch the unified activity timeline for a chef from bc_profile_activity_v.
 * Ordered by occurred_at descending (newest first).
 */
export async function getProfileActivity(
  options: GetProfileActivityOptions,
): Promise<BestChefResult<ActivityEntry[]>> {
  const { chefId, limit = 30 } = options;

  const { data, error: dbErr } = await from('bc_profile_activity_v')
    .select('id, kind, icon, tint, title, subtitle, params, occurred_at, target_route')
    .eq('chef_id', chefId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (dbErr) return err(dbErr.message);

  const entries: ActivityEntry[] = (data ?? []).map((row: ActivityViewRow) => ({
    id: row.id,
    kind: row.kind,
    icon: row.icon,
    tint: row.tint,
    title: row.title,
    subtitle: row.subtitle,
    params: row.params ?? {},
    timeAgo: formatTimeAgo(row.occurred_at),
    occurredAt: row.occurred_at,
    ...(row.target_route ? { targetRoute: row.target_route } : {}),
  }));

  return ok(entries);
}
