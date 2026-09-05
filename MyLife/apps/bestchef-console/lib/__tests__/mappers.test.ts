import { describe, expect, it } from 'vitest';

import {
  assembleProofQueueItems,
  buildFlagLabels,
  buildHealthRows,
  collectLanguages,
  extractProofSignals,
  signedUrlKey,
  truncateLabel,
  type ModerationQueueRow,
  type ProofJoinRow,
} from '../mappers';

describe('extractProofSignals', () => {
  it('reads cross_user_hash_reuse and language when present', () => {
    expect(
      extractProofSignals({ cross_user_hash_reuse: true, language: 'ja' }),
    ).toEqual({ crossUserHashReuse: true, language: 'ja' });
  });

  it('defaults when metadata is empty, null, or not an object', () => {
    const empty = { crossUserHashReuse: false, language: null };
    expect(extractProofSignals({})).toEqual(empty);
    expect(extractProofSignals(null)).toEqual(empty);
    expect(extractProofSignals('junk')).toEqual(empty);
    expect(extractProofSignals(['junk'])).toEqual(empty);
  });

  it('treats non-boolean reuse flags and blank languages as absent', () => {
    expect(
      extractProofSignals({ cross_user_hash_reuse: 'yes', language: '  ' }),
    ).toEqual({ crossUserHashReuse: false, language: null });
  });
});

describe('truncateLabel', () => {
  it('passes short strings through trimmed', () => {
    expect(truncateLabel('  carbonara  ')).toBe('carbonara');
  });

  it('truncates long strings with an ellipsis inside the budget', () => {
    const long = 'x'.repeat(200);
    const out = truncateLabel(long, 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns empty string for null/undefined', () => {
    expect(truncateLabel(null)).toBe('');
    expect(truncateLabel(undefined)).toBe('');
  });
});

describe('assembleProofQueueItems', () => {
  const queueRow: ModerationQueueRow = {
    id: 'q1',
    target_id: 'p1',
    status: 'queued',
    attempts: 0,
    failure_reason: null,
    metadata: { cross_user_hash_reuse: true, language: 'ja' },
    created_at: '2026-07-03T00:00:00Z',
  };
  const proofRow: ProofJoinRow = {
    id: 'p1',
    vote_id: 'v1',
    submission_id: 's1',
    content_hash: 'abc123',
    status: 'pending',
    captured_at: '2026-07-02T00:00:00Z',
    social_profiles: { handle: 'tom', display_name: 'Tom' },
    bc_media_assets: {
      id: 'm1',
      storage_bucket: 'bestchef-vote-proofs',
      storage_key: 'proofs/p1.jpg',
      media_kind: 'image',
    },
    bc_submissions: { bc_dishes: { name: 'ramen' } },
  };

  it('joins queue rows to proofs and resolves signed evidence URLs by bucket/key', () => {
    const signed = new Map([
      [signedUrlKey('bestchef-vote-proofs', 'proofs/p1.jpg'), 'https://signed.example/p1'],
    ]);
    const [item] = assembleProofQueueItems([queueRow], new Map([['p1', proofRow]]), signed);
    expect(item.crossUserHashReuse).toBe(true);
    expect(item.language).toBe('ja');
    expect(item.proof?.dishName).toBe('ramen');
    expect(item.proof?.chefHandle).toBe('tom');
    expect(item.proof?.evidenceUrl).toBe('https://signed.example/p1');
  });

  it('keeps mediaAssetId with a null evidenceUrl when signing failed (distinguishable states)', () => {
    const [item] = assembleProofQueueItems([queueRow], new Map([['p1', proofRow]]), new Map());
    expect(item.proof?.mediaAssetId).toBe('m1');
    expect(item.proof?.evidenceUrl).toBeNull();
  });

  it('returns proof:null when the proof row is gone (vote deleted)', () => {
    const [item] = assembleProofQueueItems([queueRow], new Map(), new Map());
    expect(item.proof).toBeNull();
    expect(item.proofId).toBe('p1');
  });

  it('reports null mediaAssetId when the proof has no media asset', () => {
    const noMedia: ProofJoinRow = { ...proofRow, bc_media_assets: null };
    const [item] = assembleProofQueueItems([queueRow], new Map([['p1', noMedia]]), new Map());
    expect(item.proof?.mediaAssetId).toBeNull();
    expect(item.proof?.evidenceUrl).toBeNull();
  });
});

describe('buildFlagLabels', () => {
  it('labels submissions as dish by @handle', () => {
    const labels = buildFlagLabels(
      [{ id: 's1', bc_dishes: { name: 'ramen' }, social_profiles: { handle: 'tom' } }],
      [],
      [],
    );
    expect(labels.get('submission/s1')).toBe('ramen by @tom');
  });

  it('labels comments by truncated body and profiles by handle + name', () => {
    const labels = buildFlagLabels(
      [],
      [{ id: 'c1', body: 'x'.repeat(200) }],
      [{ id: 'pr1', handle: 'tom', display_name: 'Tom' }],
    );
    expect(labels.get('comment/c1')?.length).toBeLessThanOrEqual(80);
    expect(labels.get('profile/pr1')).toBe('@tom (Tom)');
  });

  it('falls back to placeholders for missing joins', () => {
    const labels = buildFlagLabels(
      [{ id: 's1', bc_dishes: null, social_profiles: null }],
      [],
      [],
    );
    expect(labels.get('submission/s1')).toBe('unknown dish by @?');
  });
});

describe('collectLanguages', () => {
  it('dedupes, drops nulls, and sorts', () => {
    expect(collectLanguages(['ja', null, 'de', 'ja', null])).toEqual(['de', 'ja']);
  });

  it('returns empty for an untagged queue (pre Phase 2.5)', () => {
    expect(collectLanguages([null, null])).toEqual([]);
  });
});

describe('buildHealthRows', () => {
  const now = new Date('2026-07-03T12:00:00Z');
  const healthy = {
    config_functions_base_url: true,
    config_worker_secret: true,
    config_media_purge_secret: true,
    config_vote_proof_moderation_secret: true,
    config_media_screening_secret: true,
    config_url_resign_secret: true,
    config_push_fanout_secret: true,
    pg_cron_installed: true,
    pg_net_installed: true,
    rankings_job_scheduled: true,
    deletion_job_scheduled: true,
    media_purge_job_scheduled: true,
    vote_proof_moderation_job_scheduled: true,
    media_screening_job_scheduled: true,
    action_usage_prune_job_scheduled: true,
    url_resign_job_scheduled: true,
    push_fanout_job_scheduled: true,
    last_rankings_update: '2026-07-03T06:00:00Z',
    pending_deletion_requests: 0,
    oldest_pending_deletion_requested_at: null,
    purgeable_media_rows: 0,
    pending_vote_proof_moderation: 0,
    pending_media_screening: 0,
    action_limits_enabled_rows: 8,
    action_kill_switch: false,
    expiring_playback_urls: 0,
    pending_push_fanout: 0,
    healthy: true,
  };

  it('marks every row ok for a healthy payload', () => {
    const rows = buildHealthRows(healthy, now);
    expect(rows).toHaveLength(18);
    expect(rows.every((r) => r.ok)).toBe(true);
  });

  it('itemizes every job bc_job_health() reports, including media purge, moderation workers, quota-engine prune, and URL re-sign', () => {
    const rows = buildHealthRows(healthy, now);
    const keys = rows.map((r) => r.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'job_rankings',
        'job_deletion',
        'job_media_purge',
        'job_vote_proof_moderation',
        'job_media_screening',
        'job_action_usage_prune',
        'job_url_resign',
        'job_push_fanout',
        'media_purge_backlog',
        'vote_proof_moderation_backlog',
        'media_screening_backlog',
        'quota_engine',
        'playback_url_expiry_backlog',
        'push_fanout_backlog',
      ]),
    );
  });

  it('flags stale rankings beyond 24h and never-run rankings', () => {
    const stale = buildHealthRows(
      { ...healthy, last_rankings_update: '2026-07-01T00:00:00Z' },
      now,
    );
    expect(stale.find((r) => r.key === 'rankings_freshness')?.ok).toBe(false);

    const never = buildHealthRows({ ...healthy, last_rankings_update: null }, now);
    expect(never.find((r) => r.key === 'rankings_freshness')?.ok).toBe(false);
    expect(never.find((r) => r.key === 'rankings_freshness')?.detail).toBe('never');
  });

  it('flags a deletion backlog with its oldest age', () => {
    const rows = buildHealthRows(
      {
        ...healthy,
        pending_deletion_requests: 3,
        oldest_pending_deletion_requested_at: '2026-07-02T00:00:00Z',
      },
      now,
    );
    const row = rows.find((r) => r.key === 'deletions');
    expect(row?.ok).toBe(false);
    expect(row?.detail).toContain('3 pending');
    expect(row?.detail).toContain('2026-07-02');
  });

  it('flags a media-purge backlog', () => {
    const rows = buildHealthRows({ ...healthy, purgeable_media_rows: 5 }, now);
    const row = rows.find((r) => r.key === 'media_purge_backlog');
    expect(row?.ok).toBe(false);
    expect(row?.detail).toContain('5 purgeable');
  });

  it('flags moderation-worker backlogs individually', () => {
    const voteProofBacklog = buildHealthRows(
      { ...healthy, pending_vote_proof_moderation: 2 },
      now,
    ).find((r) => r.key === 'vote_proof_moderation_backlog');
    expect(voteProofBacklog?.ok).toBe(false);
    expect(voteProofBacklog?.detail).toContain('2 queued');

    const mediaScreeningBacklog = buildHealthRows(
      { ...healthy, pending_media_screening: 4 },
      now,
    ).find((r) => r.key === 'media_screening_backlog');
    expect(mediaScreeningBacklog?.ok).toBe(false);
    expect(mediaScreeningBacklog?.detail).toContain('4 queued');
  });

  it('flags each unscheduled job independently rather than only in an aggregate row', () => {
    const rows = buildHealthRows({ ...healthy, media_purge_job_scheduled: false }, now);
    expect(rows.find((r) => r.key === 'job_media_purge')?.ok).toBe(false);
    expect(rows.find((r) => r.key === 'job_rankings')?.ok).toBe(true);
    expect(rows.find((r) => r.key === 'job_deletion')?.ok).toBe(true);
  });

  it('flags the quota engine when limits are empty or the kill switch is on', () => {
    expect(
      buildHealthRows({ ...healthy, action_limits_enabled_rows: 0 }, now).find(
        (r) => r.key === 'quota_engine',
      )?.ok,
    ).toBe(false);
    expect(
      buildHealthRows({ ...healthy, action_kill_switch: true }, now).find(
        (r) => r.key === 'quota_engine',
      )?.ok,
    ).toBe(false);
  });

  it('flags the action-usage prune job independently when unscheduled', () => {
    const rows = buildHealthRows({ ...healthy, action_usage_prune_job_scheduled: false }, now);
    expect(rows.find((r) => r.key === 'job_action_usage_prune')?.ok).toBe(false);
    expect(rows.find((r) => r.key === 'job_media_screening')?.ok).toBe(true);
  });

  it('flags the URL re-sign job independently when unscheduled', () => {
    const rows = buildHealthRows({ ...healthy, url_resign_job_scheduled: false }, now);
    expect(rows.find((r) => r.key === 'job_url_resign')?.ok).toBe(false);
    expect(rows.find((r) => r.key === 'job_media_screening')?.ok).toBe(true);
  });

  it('flags a playback-URL expiry backlog', () => {
    const rows = buildHealthRows({ ...healthy, expiring_playback_urls: 7 }, now);
    const row = rows.find((r) => r.key === 'playback_url_expiry_backlog');
    expect(row?.ok).toBe(false);
    expect(row?.detail).toContain('7 expiring');
  });

  it('flags the push-fanout job independently when unscheduled', () => {
    const rows = buildHealthRows({ ...healthy, push_fanout_job_scheduled: false }, now);
    expect(rows.find((r) => r.key === 'job_push_fanout')?.ok).toBe(false);
    expect(rows.find((r) => r.key === 'job_url_resign')?.ok).toBe(true);
  });

  it('flags a push-fanout queue backlog', () => {
    const rows = buildHealthRows({ ...healthy, pending_push_fanout: 9 }, now);
    const row = rows.find((r) => r.key === 'push_fanout_backlog');
    expect(row?.ok).toBe(false);
    expect(row?.detail).toContain('9 queued');
  });

  it('flags a missing push-fanout secret in the config row', () => {
    const rows = buildHealthRows({ ...healthy, config_push_fanout_secret: false }, now);
    expect(rows.find((r) => r.key === 'config')?.ok).toBe(false);
  });

  it('handles a missing-field payload without throwing (infra rows fail, empty backlog stays ok)', () => {
    const rows = buildHealthRows({}, now);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    for (const key of [
      'config',
      'extensions',
      'job_rankings',
      'job_deletion',
      'job_media_purge',
      'job_vote_proof_moderation',
      'job_media_screening',
      'job_action_usage_prune',
      'job_url_resign',
      'job_push_fanout',
      'rankings_freshness',
      'quota_engine',
    ]) {
      expect(byKey.get(key)?.ok).toBe(false);
    }
    // Missing backlog counts coalesce to zero, which is ok.
    for (const key of [
      'deletions',
      'media_purge_backlog',
      'vote_proof_moderation_backlog',
      'media_screening_backlog',
      'playback_url_expiry_backlog',
      'push_fanout_backlog',
    ]) {
      expect(byKey.get(key)?.ok).toBe(true);
    }
  });
});
