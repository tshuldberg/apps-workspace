import { describe, expect, it } from 'vitest';
import {
  getHumanVerifiedBadgeCopy,
  getVoteTone,
} from '../ui/logic';
import {
  FR_TEXT_TERTIARY,
  FR_TRUST_TIERS,
  FR_VOTE,
} from '../ui/tokens';

describe('forums shared UI helpers', () => {
  it('maps vote state to the correct active and inactive colors', () => {
    expect(getVoteTone('up', 'up')).toBe(FR_VOTE.up);
    expect(getVoteTone('down', 'down')).toBe(FR_VOTE.down);
    expect(getVoteTone('up', null)).toBe(FR_TEXT_TERTIARY);
    expect(getVoteTone('down', 'up')).toBe(FR_TEXT_TERTIARY);
  });

  it('maps human verification tiers to the expected labels and tones', () => {
    expect(getHumanVerifiedBadgeCopy('unverified')).toEqual({
      label: 'Human',
      color: FR_TRUST_TIERS.unverified,
      glow: false,
    });

    expect(getHumanVerifiedBadgeCopy('trusted')).toEqual({
      label: 'Trusted',
      color: FR_TRUST_TIERS.trusted,
      glow: true,
    });

    expect(getHumanVerifiedBadgeCopy('mod')).toEqual({
      label: 'Mod',
      color: FR_TRUST_TIERS.mod,
      glow: false,
    });
  });
});
