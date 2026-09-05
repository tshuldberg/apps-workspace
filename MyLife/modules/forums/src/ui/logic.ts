import {
  FR_HUMAN_VERIFIED,
  FR_TEXT_TERTIARY,
  FR_TRUST_TIERS,
  FR_VOTE,
  type ForumTrustTier,
} from './tokens';

export function getVoteTone(
  direction: 'up' | 'down',
  userVote: 'up' | 'down' | null,
): string {
  if (direction === 'up') {
    return userVote === 'up' ? FR_VOTE.up : FR_TEXT_TERTIARY;
  }

  return userVote === 'down' ? FR_VOTE.down : FR_TEXT_TERTIARY;
}

export function getHumanVerifiedBadgeCopy(
  tier: ForumTrustTier,
): { label: string; color: string; glow: boolean } {
  switch (tier) {
    case 'mod':
      return { label: 'Mod', color: FR_TRUST_TIERS.mod, glow: false };
    case 'highly_trusted':
      return { label: 'Trusted', color: FR_TRUST_TIERS.highly_trusted, glow: true };
    case 'trusted':
      return { label: 'Trusted', color: FR_HUMAN_VERIFIED, glow: true };
    case 'new':
      return { label: 'Human', color: FR_TRUST_TIERS.new, glow: false };
    case 'unverified':
    default:
      return { label: 'Human', color: FR_TRUST_TIERS.unverified, glow: false };
  }
}

export function getCommunityTone(params: {
  humansOnly: boolean;
  communityType: string;
  federated?: boolean;
}) {
  if (params.humansOnly) {
    return 'humans_only' as const;
  }

  if (params.federated) {
    return 'federated' as const;
  }

  if (params.communityType === 'private') {
    return 'private' as const;
  }

  return 'public' as const;
}
