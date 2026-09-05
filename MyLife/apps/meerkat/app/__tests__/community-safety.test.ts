import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { ensureCommunityTables } from '../(root)/data/community-core';
import {
  blockCommunityPerson,
  clearCommunitySafetyAction,
  communityFileReportTarget,
  isChannelMuted,
  isCommunityContentReportHidden,
  isCommunityMuted,
  isCommunityPersonBlocked,
  listOwnerReviewItems,
  markSafetyActionReviewed,
  reconcileCommunityFileReportTargets,
  reportCommunityContent,
  setChannelMuted,
  setCommunityMuted,
} from '../(root)/data/community-safety';

let db: InMemoryTestDatabase;

beforeEach(() => {
  db = createInMemoryTestDatabase();
  ensureCommunityTables(db.adapter);
});

afterEach(() => {
  db.close();
});

describe('community-safety local-only actions', () => {
  it('records and clears community and channel mute state', () => {
    expect(isCommunityMuted(db.adapter, 'cm-a')).toBe(false);
    setCommunityMuted(db.adapter, 'cm-a', true, 'Book club');
    expect(isCommunityMuted(db.adapter, 'cm-a')).toBe(true);
    setCommunityMuted(db.adapter, 'cm-a', false, 'Book club');
    expect(isCommunityMuted(db.adapter, 'cm-a')).toBe(false);

    expect(isChannelMuted(db.adapter, 'cm-a', 'general')).toBe(false);
    setChannelMuted(db.adapter, 'cm-a', 'general', true, '#general');
    expect(isChannelMuted(db.adapter, 'cm-a', 'general')).toBe(true);
    expect(
      db.adapter.query<{ mute: number }>('SELECT mute FROM cm_read_state WHERE id = ?', ['cm-a:general'])[0]?.mute,
    ).toBe(1);
    setChannelMuted(db.adapter, 'cm-a', 'general', false, '#general');
    expect(isChannelMuted(db.adapter, 'cm-a', 'general')).toBe(false);
  });

  it('keeps blocks local and dismissible', () => {
    blockCommunityPerson(db.adapter, 'cm-a', 'device-b', 'Peer');
    expect(isCommunityPersonBlocked(db.adapter, 'cm-a', 'device-b')).toBe(true);
    clearCommunitySafetyAction(db.adapter, 'cm-a', 'person', 'device-b', 'block');
    expect(isCommunityPersonBlocked(db.adapter, 'cm-a', 'device-b')).toBe(false);
  });

  it('keeps reported content hidden through Reviewed; only Un-hide (dismissed) shows it', () => {
    const report = reportCommunityContent(db.adapter, {
      communityId: 'cm-a',
      channelId: 'general',
      targetKind: 'message',
      targetId: 'msg-1',
      targetAuthorDeviceId: 'device-b',
      targetLabel: 'Message from Peer',
      reason: 'Reported from test',
    });

    // Reported -> hidden and in the queue as 'active'.
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'message', 'msg-1')).toBe(true);
    expect(listOwnerReviewItems(db.adapter, 'cm-a').map((item) => item.id)).toEqual([report.id]);

    // Reviewed -> STAYS hidden and STAYS in the queue with status 'reviewed' (D.2 fix).
    markSafetyActionReviewed(db.adapter, report.id, 'reviewed', '2026-06-24T15:00:00.000Z');
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'message', 'msg-1')).toBe(true);
    const afterReviewed = listOwnerReviewItems(db.adapter, 'cm-a');
    expect(afterReviewed.map((item) => item.id)).toEqual([report.id]);
    expect(afterReviewed[0]?.status).toBe('reviewed');

    // Un-hide (dismissed) -> now shown and out of the queue.
    markSafetyActionReviewed(db.adapter, report.id, 'dismissed', '2026-06-24T16:00:00.000Z');
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'message', 'msg-1')).toBe(false);
    expect(listOwnerReviewItems(db.adapter, 'cm-a')).toEqual([]);
  });

  it('reports the same file from chat and the Files index through one canonical target id', () => {
    const channelId = 'general';
    const attachmentId = 'att-9';
    const canonical = communityFileReportTarget({ channelId, attachmentId });
    expect(canonical).toBe('general:att-9');

    // A report from the in-chat attachment card uses the canonical composite id.
    reportCommunityContent(db.adapter, {
      communityId: 'cm-a',
      channelId,
      targetKind: 'file',
      targetId: canonical,
      targetAuthorDeviceId: 'device-b',
      targetLabel: 'photo.jpg',
    });

    // The Files index, computing the same canonical id, sees it hidden.
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'file', canonical)).toBe(true);
  });

  it('reconciles legacy file report rows to the canonical channel-prefixed id', () => {
    // Simulate a legacy row where target_id was the bare attachment id.
    reportCommunityContent(db.adapter, {
      communityId: 'cm-a',
      channelId: 'general',
      targetKind: 'file',
      targetId: 'att-legacy',
      targetAuthorDeviceId: 'device-b',
      targetLabel: 'old.pdf',
    });
    // Pre-reconcile: only the bare id is hidden, not the canonical composite.
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'file', 'att-legacy')).toBe(true);
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'file', 'general:att-legacy')).toBe(false);

    const migrated = reconcileCommunityFileReportTargets(db.adapter);
    expect(migrated).toBe(1);

    // Post-reconcile: the canonical composite is hidden and stays in the queue.
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'file', 'general:att-legacy')).toBe(true);
    expect(listOwnerReviewItems(db.adapter, 'cm-a').map((item) => item.target_id)).toEqual(['general:att-legacy']);

    // Idempotent: a second pass migrates nothing.
    expect(reconcileCommunityFileReportTargets(db.adapter)).toBe(0);
  });

  it('reconciliation keeps content hidden when a legacy hidden row collides with a dismissed canonical row', () => {
    // Canonical (already un-hidden) row.
    const canonical = reportCommunityContent(db.adapter, {
      communityId: 'cm-a',
      channelId: 'general',
      targetKind: 'file',
      targetId: 'general:att-x',
      targetAuthorDeviceId: 'device-b',
      targetLabel: 'canonical',
    });
    markSafetyActionReviewed(db.adapter, canonical.id, 'dismissed');
    // Legacy row (still hidden) that reconciles to the SAME canonical id.
    reportCommunityContent(db.adapter, {
      communityId: 'cm-a',
      channelId: 'general',
      targetKind: 'file',
      targetId: 'att-x',
      targetAuthorDeviceId: 'device-b',
      targetLabel: 'legacy',
    });
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'file', 'general:att-x')).toBe(false);

    reconcileCommunityFileReportTargets(db.adapter);

    // The legacy 'active' state wins the merge: the canonical row is hidden again.
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'file', 'general:att-x')).toBe(true);
  });
});
