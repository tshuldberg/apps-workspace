import { describe, expect, it } from 'vitest';
import {
  getBestChefSeedContentApproval,
  getBestChefSeedContentRenderDecision,
  hasApprovedBestChefSeedContent,
  normalizePublicMediaUrl,
} from '../public-data-policy';

describe('BestChef public seed content policy', () => {
  it('requires approved status and a revision before seed content can be launched', () => {
    expect(
      hasApprovedBestChefSeedContent({
        EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_APPROVAL_STATUS: 'approved',
      }),
    ).toBe(false);

    expect(
      getBestChefSeedContentApproval({
        EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_APPROVAL_STATUS: 'approved',
        EXPO_PUBLIC_BESTCHEF_APPROVED_SEED_CONTENT_REVISION: 'legal-product-2026-04-27',
      }),
    ).toMatchObject({
      status: 'approved',
      revision: 'legal-product-2026-04-27',
      rollbackMarker: null,
      approved: true,
    });
  });

  it('treats rollback markers as launch blockers', () => {
    expect(
      getBestChefSeedContentApproval({
        EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_APPROVAL_STATUS: 'approved',
        EXPO_PUBLIC_BESTCHEF_APPROVED_SEED_CONTENT_REVISION: 'seed-r1',
        EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_ROLLBACK_MARKER: 'rollback-2026-04-27',
      }).approved,
    ).toBe(false);
  });

  it('suppresses unapproved seed content in public launch mode', () => {
    expect(
      getBestChefSeedContentRenderDecision(
        {
          provenance: 'demo',
          approvalStatus: 'draft',
          approvalRevision: null,
          moderationStatus: 'approved',
        },
        { isPublicLaunch: true },
      ),
    ).toMatchObject({ action: 'suppress', reason: 'unapproved_seed' });
  });

  it('labels approved editorial seed content in public launch mode', () => {
    expect(
      getBestChefSeedContentRenderDecision(
        {
          provenance: 'editorial_seed',
          approvalStatus: 'approved',
          approvalRevision: 'seed-r1',
          editorialLabel: 'Editorial test kitchen',
          moderationStatus: 'approved',
        },
        { isPublicLaunch: true },
      ),
    ).toEqual({
      action: 'label',
      label: 'Editorial test kitchen',
      reason: 'approved_seed',
    });
  });

  it('normalizes public media URLs and rejects local device URIs', () => {
    expect(normalizePublicMediaUrl('https://cdn.bestchef.test/photo.jpg')).toBe(
      'https://cdn.bestchef.test/photo.jpg',
    );
    expect(normalizePublicMediaUrl('file:///var/mobile/photo.jpg')).toBeNull();
    expect(normalizePublicMediaUrl('content://media/external/photo/1')).toBeNull();
    expect(normalizePublicMediaUrl('http://cdn.bestchef.test/photo.jpg')).toBeNull();
  });
});
