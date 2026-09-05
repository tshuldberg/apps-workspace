import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { ensureSyncSchema } from '../schema';
import {
  communityFileReportTarget,
  isCommunityContentReportHidden,
  listOwnerReviewItems,
  markSafetyActionReviewed,
  reconcileCommunityFileReportTargets,
  reportCommunityContent,
} from '../community-safety';

let db: InMemoryTestDatabase;

beforeEach(() => {
  db = createInMemoryTestDatabase();
  ensureSyncSchema(db.adapter);
});

afterEach(() => {
  db.close();
});

describe('web community-safety hide-vs-review (twin)', () => {
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

    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'message', 'msg-1')).toBe(true);
    expect(listOwnerReviewItems(db.adapter, 'cm-a').map((item) => item.id)).toEqual([report.id]);

    markSafetyActionReviewed(db.adapter, report.id, 'reviewed', '2026-06-24T15:00:00.000Z');
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'message', 'msg-1')).toBe(true);
    const afterReviewed = listOwnerReviewItems(db.adapter, 'cm-a');
    expect(afterReviewed.map((item) => item.id)).toEqual([report.id]);
    expect(afterReviewed[0]?.status).toBe('reviewed');

    markSafetyActionReviewed(db.adapter, report.id, 'dismissed', '2026-06-24T16:00:00.000Z');
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'message', 'msg-1')).toBe(false);
    expect(listOwnerReviewItems(db.adapter, 'cm-a')).toEqual([]);
  });

  it('reports the same file from chat and the Files index through one canonical target id', () => {
    const canonical = communityFileReportTarget({ channelId: 'general', attachmentId: 'att-9' });
    expect(canonical).toBe('general:att-9');
    reportCommunityContent(db.adapter, {
      communityId: 'cm-a',
      channelId: 'general',
      targetKind: 'file',
      targetId: canonical,
      targetAuthorDeviceId: 'device-b',
      targetLabel: 'photo.jpg',
    });
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'file', canonical)).toBe(true);
  });

  it('reconciles legacy file report rows to the canonical channel-prefixed id', () => {
    reportCommunityContent(db.adapter, {
      communityId: 'cm-a',
      channelId: 'general',
      targetKind: 'file',
      targetId: 'att-legacy',
      targetAuthorDeviceId: 'device-b',
      targetLabel: 'old.pdf',
    });
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'file', 'general:att-legacy')).toBe(false);
    expect(reconcileCommunityFileReportTargets(db.adapter)).toBe(1);
    expect(isCommunityContentReportHidden(db.adapter, 'cm-a', 'file', 'general:att-legacy')).toBe(true);
    expect(reconcileCommunityFileReportTargets(db.adapter)).toBe(0);
  });
});
