/**
 * Pure row -> viewmodel helpers for queue pages. Everything here takes plain
 * rows and returns plain viewmodels so it is unit-testable; lib/queries.ts
 * keeps only the network calls.
 */

export interface ProofQueueSignals {
  crossUserHashReuse: boolean;
  language: string | null;
}

/**
 * bc_moderation_queue.metadata for vote proofs may carry
 * `cross_user_hash_reuse: true` (Phase 1.2 integrity floor) and, once Phase
 * 2.5 lands UGC language tagging, a `language` tag. Both are optional.
 */
export function extractProofSignals(metadata: unknown): ProofQueueSignals {
  const out: ProofQueueSignals = { crossUserHashReuse: false, language: null };
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const record = metadata as Record<string, unknown>;
    out.crossUserHashReuse = record['cross_user_hash_reuse'] === true;
    const language = record['language'];
    if (typeof language === 'string' && language.trim().length > 0) {
      out.language = language.trim();
    }
  }
  return out;
}

export function truncateLabel(value: string | null | undefined, max = 80): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Collect the distinct language tags present in a queue for the filter UI. */
export function collectLanguages(languages: Array<string | null>): string[] {
  return Array.from(new Set(languages.filter((l): l is string => !!l))).sort();
}

// ── Vote-proof queue assembly ─────────────────────────────────────────

export interface ModerationQueueRow {
  id: string;
  target_id: string;
  status: string;
  attempts: number;
  failure_reason: string | null;
  metadata: unknown;
  created_at: string;
}

export interface ProofJoinRow {
  id: string;
  vote_id: string;
  submission_id: string;
  content_hash: string;
  status: string;
  captured_at: string;
  social_profiles: { handle: string; display_name: string } | null;
  bc_media_assets: {
    id: string;
    storage_bucket: string | null;
    storage_key: string | null;
    media_kind: string;
  } | null;
  bc_submissions: { bc_dishes: { name: string } | null } | null;
}

export interface ProofQueueItem {
  queueId: string;
  proofId: string;
  queueStatus: string;
  attempts: number;
  failureReason: string | null;
  crossUserHashReuse: boolean;
  language: string | null;
  queuedAt: string;
  proof: {
    voteId: string;
    submissionId: string;
    contentHash: string;
    status: string;
    capturedAt: string;
    chefHandle: string | null;
    chefDisplayName: string | null;
    dishName: string | null;
    mediaAssetId: string | null;
    mediaKind: string | null;
    /**
     * null with a non-null mediaAssetId means URL SIGNING FAILED, not
     * "no evidence" — the page must render those states differently
     * (review finding: a moderator must never decide a proof blind
     * believing evidence does not exist).
     */
    evidenceUrl: string | null;
  } | null;
}

export function signedUrlKey(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

export function assembleProofQueueItems(
  queueRows: ModerationQueueRow[],
  proofsById: Map<string, ProofJoinRow>,
  signedByBucketKey: Map<string, string>,
): ProofQueueItem[] {
  return queueRows.map((row) => {
    const signals = extractProofSignals(row.metadata);
    const proof = proofsById.get(row.target_id) ?? null;
    const media = proof?.bc_media_assets ?? null;
    const evidenceUrl =
      media?.storage_bucket && media.storage_key
        ? (signedByBucketKey.get(signedUrlKey(media.storage_bucket, media.storage_key)) ?? null)
        : null;
    return {
      queueId: row.id,
      proofId: row.target_id,
      queueStatus: row.status,
      attempts: row.attempts,
      failureReason: row.failure_reason,
      crossUserHashReuse: signals.crossUserHashReuse,
      language: signals.language,
      queuedAt: row.created_at,
      proof: proof
        ? {
            voteId: proof.vote_id,
            submissionId: proof.submission_id,
            contentHash: proof.content_hash,
            status: proof.status,
            capturedAt: proof.captured_at,
            chefHandle: proof.social_profiles?.handle ?? null,
            chefDisplayName: proof.social_profiles?.display_name ?? null,
            dishName: proof.bc_submissions?.bc_dishes?.name ?? null,
            mediaAssetId: media?.id ?? null,
            mediaKind: media?.media_kind ?? null,
            evidenceUrl,
          }
        : null,
    };
  });
}

// ── Flag queue labels ─────────────────────────────────────────────────

export interface FlagSubmissionLabelRow {
  id: string;
  bc_dishes: { name: string } | null;
  social_profiles: { handle: string } | null;
}

export function flagLabelKey(targetType: string, targetId: string): string {
  return `${targetType}/${targetId}`;
}

export function buildFlagLabels(
  submissions: FlagSubmissionLabelRow[],
  comments: Array<{ id: string; body: string }>,
  profiles: Array<{ id: string; handle: string; display_name: string }>,
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const row of submissions) {
    labels.set(
      flagLabelKey('submission', row.id),
      `${row.bc_dishes?.name ?? 'unknown dish'} by @${row.social_profiles?.handle ?? '?'}`,
    );
  }
  for (const row of comments) {
    labels.set(flagLabelKey('comment', row.id), truncateLabel(row.body));
  }
  for (const row of profiles) {
    labels.set(flagLabelKey('profile', row.id), `@${row.handle} (${row.display_name})`);
  }
  return labels;
}

export interface HealthCheckRow {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface JobHealthPayload {
  config_functions_base_url?: boolean;
  config_worker_secret?: boolean;
  config_media_purge_secret?: boolean;
  config_vote_proof_moderation_secret?: boolean;
  config_media_screening_secret?: boolean;
  config_url_resign_secret?: boolean;
  config_push_fanout_secret?: boolean;
  pg_cron_installed?: boolean;
  pg_net_installed?: boolean;
  rankings_job_scheduled?: boolean;
  deletion_job_scheduled?: boolean;
  media_purge_job_scheduled?: boolean;
  vote_proof_moderation_job_scheduled?: boolean;
  media_screening_job_scheduled?: boolean;
  action_usage_prune_job_scheduled?: boolean;
  url_resign_job_scheduled?: boolean;
  push_fanout_job_scheduled?: boolean;
  last_rankings_update?: string | null;
  pending_deletion_requests?: number;
  oldest_pending_deletion_requested_at?: string | null;
  purgeable_media_rows?: number;
  pending_vote_proof_moderation?: number;
  pending_media_screening?: number;
  action_limits_enabled_rows?: number;
  action_kill_switch?: boolean;
  expiring_playback_urls?: number;
  pending_push_fanout?: number;
  healthy?: boolean;
  checked_at?: string;
}

const RANKINGS_STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Flatten bc_job_health() jsonb into labeled pass/fail rows for the panel.
 * `now` is injectable for tests. Every job bc_job_health() reports gets its
 * own row here (audit M8): the aggregate `healthy` badge is correct on its
 * own but previously left media purge, the two moderation workers, and the
 * quota engine invisible to itemized triage. The quota-engine fields were
 * also silently dropped from bc_job_health() by drift across several
 * migrations and restored in 20260711000008_bestchef_job_health_quota_fields.sql;
 * see that migration's header for the full history.
 */
export function buildHealthRows(health: JobHealthPayload, now: Date): HealthCheckRow[] {
  const bool = (v: boolean | undefined) => v === true;
  const lastRankings = health.last_rankings_update ? new Date(health.last_rankings_update) : null;
  const rankingsFresh =
    lastRankings !== null &&
    !Number.isNaN(lastRankings.getTime()) &&
    now.getTime() - lastRankings.getTime() <= RANKINGS_STALE_MS;
  const pendingDeletions = health.pending_deletion_requests ?? 0;
  const purgeableMedia = health.purgeable_media_rows ?? 0;
  const pendingVoteProofs = health.pending_vote_proof_moderation ?? 0;
  const pendingMediaScreening = health.pending_media_screening ?? 0;
  const limitsRows = health.action_limits_enabled_rows ?? 0;
  const expiringPlaybackUrls = health.expiring_playback_urls ?? 0;
  const pendingPushFanout = health.pending_push_fanout ?? 0;

  return [
    {
      key: 'config',
      label: 'bc_job_config rows (functions URL + worker secrets)',
      ok:
        bool(health.config_functions_base_url) &&
        bool(health.config_worker_secret) &&
        bool(health.config_media_purge_secret) &&
        bool(health.config_vote_proof_moderation_secret) &&
        bool(health.config_media_screening_secret) &&
        bool(health.config_url_resign_secret) &&
        bool(health.config_push_fanout_secret),
      detail:
        `url=${bool(health.config_functions_base_url)}, deletion_secret=${bool(health.config_worker_secret)}, ` +
        `purge_secret=${bool(health.config_media_purge_secret)}, vote_proof_secret=${bool(
          health.config_vote_proof_moderation_secret,
        )}, media_screening_secret=${bool(health.config_media_screening_secret)}, ` +
        `url_resign_secret=${bool(health.config_url_resign_secret)}, ` +
        `push_fanout_secret=${bool(health.config_push_fanout_secret)}`,
    },
    {
      key: 'extensions',
      label: 'pg_cron + pg_net installed',
      ok: bool(health.pg_cron_installed) && bool(health.pg_net_installed),
      detail: `pg_cron=${bool(health.pg_cron_installed)}, pg_net=${bool(health.pg_net_installed)}`,
    },
    {
      key: 'job_rankings',
      label: 'Rankings refresh job scheduled',
      ok: bool(health.rankings_job_scheduled),
      detail: `scheduled=${bool(health.rankings_job_scheduled)}`,
    },
    {
      key: 'job_deletion',
      label: 'Account-deletion worker job scheduled',
      ok: bool(health.deletion_job_scheduled),
      detail: `scheduled=${bool(health.deletion_job_scheduled)}`,
    },
    {
      key: 'job_media_purge',
      label: 'Media-purge worker job scheduled',
      ok: bool(health.media_purge_job_scheduled),
      detail: `scheduled=${bool(health.media_purge_job_scheduled)}`,
    },
    {
      key: 'job_vote_proof_moderation',
      label: 'Vote-proof moderation worker job scheduled',
      ok: bool(health.vote_proof_moderation_job_scheduled),
      detail: `scheduled=${bool(health.vote_proof_moderation_job_scheduled)}`,
    },
    {
      key: 'job_media_screening',
      label: 'Media-screening worker job scheduled',
      ok: bool(health.media_screening_job_scheduled),
      detail: `scheduled=${bool(health.media_screening_job_scheduled)}`,
    },
    {
      key: 'job_action_usage_prune',
      label: 'Action-usage prune job scheduled',
      ok: bool(health.action_usage_prune_job_scheduled),
      detail: `scheduled=${bool(health.action_usage_prune_job_scheduled)}`,
    },
    {
      key: 'job_url_resign',
      label: 'Playback URL re-sign job scheduled',
      ok: bool(health.url_resign_job_scheduled),
      detail: `scheduled=${bool(health.url_resign_job_scheduled)}`,
    },
    {
      key: 'job_push_fanout',
      label: 'Push-fanout worker job scheduled',
      ok: bool(health.push_fanout_job_scheduled),
      detail: `scheduled=${bool(health.push_fanout_job_scheduled)}`,
    },
    {
      key: 'rankings_freshness',
      label: 'Rankings rebuilt within 24h',
      ok: rankingsFresh,
      detail: health.last_rankings_update ?? 'never',
    },
    {
      key: 'deletions',
      label: 'Account-deletion backlog',
      ok: pendingDeletions === 0,
      detail:
        pendingDeletions === 0
          ? 'no pending requests'
          : `${pendingDeletions} pending, oldest ${health.oldest_pending_deletion_requested_at ?? 'unknown'}`,
    },
    {
      key: 'media_purge_backlog',
      label: 'Media-purge backlog',
      ok: purgeableMedia === 0,
      detail: purgeableMedia === 0 ? 'no purgeable media' : `${purgeableMedia} purgeable rows`,
    },
    {
      key: 'vote_proof_moderation_backlog',
      label: 'Vote-proof moderation queue backlog',
      ok: pendingVoteProofs === 0,
      detail: pendingVoteProofs === 0 ? 'queue empty' : `${pendingVoteProofs} queued/failed`,
    },
    {
      key: 'media_screening_backlog',
      label: 'Media-screening queue backlog',
      ok: pendingMediaScreening === 0,
      detail: pendingMediaScreening === 0 ? 'queue empty' : `${pendingMediaScreening} queued`,
    },
    {
      key: 'quota_engine',
      label: 'Action-quota engine (limits rows enabled, kill switch off)',
      ok: limitsRows > 0 && health.action_kill_switch !== true,
      detail: `enabled_rows=${limitsRows}, kill_switch=${health.action_kill_switch === true}`,
    },
    {
      key: 'playback_url_expiry_backlog',
      label: 'Playback URLs expiring within 30 days',
      ok: expiringPlaybackUrls === 0,
      detail:
        expiringPlaybackUrls === 0
          ? 'none expiring soon'
          : `${expiringPlaybackUrls} expiring within 30 days`,
    },
    {
      key: 'push_fanout_backlog',
      label: 'Push-fanout queue backlog',
      ok: pendingPushFanout === 0,
      detail: pendingPushFanout === 0 ? 'queue empty' : `${pendingPushFanout} queued/failed`,
    },
  ];
}
