#!/usr/bin/env node
/**
 * Runtime health check for BestChef's scheduled workers and queue backlogs
 * (audit H14: no automated alerting on job health). Designed to run from any
 * scheduler (cron, GitHub Actions, a Supabase pg_cron webhook) on a fixed
 * interval and exit NONZERO when something needs a human, so the scheduler's
 * own failure notification is the alert channel. No external monitoring
 * service required.
 *
 * What it checks (all via one bc_job_health() call, service-role only):
 *   1. bc_job_health().healthy must be true. This already covers: every worker
 *      secret configured, pg_cron/pg_net installed, all seven cron jobs
 *      scheduled, action limits enabled, and the provider kill switch OFF.
 *   2. Queue-depth / backlog thresholds that healthy=true does NOT catch (a
 *      correctly-configured system can still fall behind):
 *        - pending_deletion_requests            GDPR deletion backlog
 *        - oldest_pending_deletion_requested_at  deletion age (SLA breach)
 *        - pending_vote_proof_moderation         vote-proof moderation queue
 *        - pending_media_screening               media screening queue
 *        - pending_push_fanout                   push outbox backlog
 *        - purgeable_media_rows                  media awaiting purge
 *        - expiring_playback_urls                signed URLs near expiry
 *      Thresholds are overridable via env (see THRESHOLDS below).
 *
 * Exit codes: 0 healthy, 1 unhealthy (config OR threshold breach), 2 could not
 * run (missing env / RPC error). All three are distinguishable so a scheduler
 * can treat "could not run" differently from "unhealthy" if it wants.
 *
 * Required env:
 *   SUPABASE_URL                Project URL, e.g. https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   Service-role key (bc_job_health is service-role only)
 *
 * Optional threshold overrides (integers; minutes for the age one):
 *   BESTCHEF_HEALTH_MAX_PENDING_DELETIONS          default 50
 *   BESTCHEF_HEALTH_MAX_DELETION_AGE_MINUTES       default 1440 (24h)
 *   BESTCHEF_HEALTH_MAX_PENDING_VOTE_PROOFS        default 200
 *   BESTCHEF_HEALTH_MAX_PENDING_MEDIA_SCREENING    default 200
 *   BESTCHEF_HEALTH_MAX_PENDING_PUSH               default 500
 *   BESTCHEF_HEALTH_MAX_PURGEABLE_MEDIA            default 1000
 *   BESTCHEF_HEALTH_MAX_EXPIRING_PLAYBACK_URLS     default 500
 *
 * Modes:
 *   node scripts/check-bestchef-health.mjs           # check, print summary, exit code
 *   node scripts/check-bestchef-health.mjs --json    # machine-readable JSON to stdout
 */

import { createClient } from '@supabase/supabase-js';

function intEnv(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function thresholds() {
  return {
    pendingDeletions: intEnv('BESTCHEF_HEALTH_MAX_PENDING_DELETIONS', 50),
    deletionAgeMinutes: intEnv('BESTCHEF_HEALTH_MAX_DELETION_AGE_MINUTES', 1440),
    pendingVoteProofs: intEnv('BESTCHEF_HEALTH_MAX_PENDING_VOTE_PROOFS', 200),
    pendingMediaScreening: intEnv('BESTCHEF_HEALTH_MAX_PENDING_MEDIA_SCREENING', 200),
    pendingPush: intEnv('BESTCHEF_HEALTH_MAX_PENDING_PUSH', 500),
    purgeableMedia: intEnv('BESTCHEF_HEALTH_MAX_PURGEABLE_MEDIA', 1000),
    expiringPlaybackUrls: intEnv('BESTCHEF_HEALTH_MAX_EXPIRING_PLAYBACK_URLS', 500),
  };
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function num(value) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function ageMinutes(iso) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

// The config-level fields bc_job_health() folds into healthy=false. Surfaced
// individually so the alert says WHICH check failed, not just "unhealthy".
const CONFIG_CHECKS = [
  ['config_functions_base_url', 'functions base URL not configured'],
  ['config_worker_secret', 'account-deletion worker secret missing'],
  ['config_media_purge_secret', 'media-purge worker secret missing'],
  ['config_vote_proof_moderation_secret', 'vote-proof moderation worker secret missing'],
  ['config_media_screening_secret', 'media-screening worker secret missing'],
  ['config_url_resign_secret', 'url-resign worker secret missing'],
  ['config_push_fanout_secret', 'push-fanout worker secret missing'],
  ['pg_cron_installed', 'pg_cron extension not installed'],
  ['pg_net_installed', 'pg_net extension not installed'],
  ['rankings_job_scheduled', 'rankings refresh job not scheduled'],
  ['deletion_job_scheduled', 'account-deletion job not scheduled'],
  ['media_purge_job_scheduled', 'media-purge job not scheduled'],
  ['vote_proof_moderation_job_scheduled', 'vote-proof moderation job not scheduled'],
  ['media_screening_job_scheduled', 'media-screening job not scheduled'],
  ['action_usage_prune_job_scheduled', 'action-usage prune job not scheduled'],
  ['url_resign_job_scheduled', 'url-resign job not scheduled'],
  ['push_fanout_job_scheduled', 'push-fanout job not scheduled'],
];

function evaluate(health, limits) {
  const problems = [];

  // Config problems (healthy=false is the union of these).
  for (const [key, label] of CONFIG_CHECKS) {
    if (health[key] === false) problems.push(`CONFIG: ${label}`);
  }
  if (health.action_limits_enabled_rows !== undefined && num(health.action_limits_enabled_rows) === 0) {
    problems.push('CONFIG: no action rate limits enabled (bc_action_limits empty)');
  }
  if (health.action_kill_switch === true) {
    problems.push('CONFIG: provider kill switch is ON (all provider calls blocked)');
  }

  // Backlog / queue-depth thresholds (not covered by healthy=false).
  const backlog = [
    ['pending_deletion_requests', limits.pendingDeletions, 'deletion requests pending'],
    ['pending_vote_proof_moderation', limits.pendingVoteProofs, 'vote proofs awaiting moderation'],
    ['pending_media_screening', limits.pendingMediaScreening, 'media assets awaiting screening'],
    ['pending_push_fanout', limits.pendingPush, 'push notifications in outbox'],
    ['purgeable_media_rows', limits.purgeableMedia, 'media rows awaiting purge'],
    ['expiring_playback_urls', limits.expiringPlaybackUrls, 'playback URLs expiring within 30 days'],
  ];
  for (const [key, limit, label] of backlog) {
    const value = num(health[key]);
    if (value > limit) problems.push(`BACKLOG: ${value} ${label} (threshold ${limit})`);
  }

  const oldest = ageMinutes(health.oldest_pending_deletion_requested_at);
  if (oldest > limits.deletionAgeMinutes) {
    problems.push(
      `BACKLOG: oldest pending deletion is ${oldest} min old (threshold ${limits.deletionAgeMinutes} min)`,
    );
  }

  return problems;
}

async function main() {
  const json = process.argv.includes('--json');
  const limits = thresholds();

  let health;
  try {
    const url = requireEnv('SUPABASE_URL');
    const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc('bc_job_health');
    if (error) throw new Error(`bc_job_health() call failed: ${error.message}`);
    health = data ?? {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (json) {
      console.log(JSON.stringify({ ok: false, reason: 'could_not_run', error: message }, null, 2));
    } else {
      console.error(`bestchef-health: could not run: ${message}`);
    }
    process.exitCode = 2;
    return;
  }

  const problems = evaluate(health, limits);
  const ok = problems.length === 0;

  if (json) {
    console.log(JSON.stringify({ ok, problems, health, checked_at: new Date().toISOString() }, null, 2));
  } else if (ok) {
    console.log('bestchef-health: OK (all workers configured, queues within thresholds)');
  } else {
    console.error(`bestchef-health: UNHEALTHY (${problems.length} issue${problems.length > 1 ? 's' : ''}):`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('\nFull bc_job_health() payload:');
    console.error(JSON.stringify(health, null, 2));
  }

  process.exitCode = ok ? 0 : 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 2;
});
