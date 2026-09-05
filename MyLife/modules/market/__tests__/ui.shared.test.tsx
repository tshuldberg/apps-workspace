import { describe, expect, it } from 'vitest';
import {
  getConditionMeta,
  getVerificationMeta,
} from '../src/ui/logic';
import {
  MK_CONDITION,
  MK_TIER,
} from '../src/ui/tokens';

describe('market shared UI mappings', () => {
  it('maps condition pills to the expected market palette', () => {
    expect(getConditionMeta('like_new')).toMatchObject({
      tone: 'likeNew',
      color: MK_CONDITION.likeNew,
      label: 'Like New',
    });

    expect(getConditionMeta('poor')).toMatchObject({
      tone: 'poor',
      color: MK_CONDITION.poor,
      label: 'Poor',
    });
  });

  it('maps verification tiers to the expected market badge metadata', () => {
    expect(getVerificationMeta('trusted')).toMatchObject({
      tone: 'trusted',
      color: MK_TIER.trusted,
      label: 'Trusted',
      icon: 'verified',
    });

    expect(getVerificationMeta('top_seller')).toMatchObject({
      tone: 'topSeller',
      color: MK_TIER.topSeller,
      label: 'Top Seller',
      icon: 'crown',
    });
  });
});
