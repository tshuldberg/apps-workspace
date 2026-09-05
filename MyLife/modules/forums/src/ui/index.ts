// Web-safe UI barrel for @mylife/forums.
//
// Re-exports ONLY design tokens, typography, and pure logic helpers (no RN
// imports). Full component surface lives in `./index.native.ts`; Metro picks
// that on iOS/Android while web bundlers ignore `.native.ts` and read this
// file. See modules/budget/src/ui/index.ts for the documented pattern.

export {
  FR_FONT_REGULAR,
  FR_FONT_MEDIUM,
  FR_FONT_SEMIBOLD,
  FR_FONT_BOLD,
  FR_FONT_EXTRABOLD,
  FR_FONTS,
} from './typography';
export type { ForumsFontWeight } from './typography';

export {
  FR_ACCENT,
  FR_ACCENT_LIGHT,
  FR_ACCENT_GLOW,
  FR_HUMAN_VERIFIED,
  FR_VOTE,
  FR_PINNED,
  FR_TRUST_TIERS,
  FR_COMMUNITY_TYPES,
  FR_SURFACES,
  FR_TEXT,
  FR_TEXT_SECONDARY,
  FR_TEXT_TERTIARY,
  FR_TEXT_MUTED,
  FR_ON_ACCENT,
  FR_BORDER_HINT,
  FR_SUCCESS,
  FR_DANGER,
  FR_INFO,
  FR_GLASS,
  FR_GLASS_NAV,
  FR_TYPOGRAPHY,
  FR_PURPLE_GLOW_STYLE,
  FR_CARD_RADIUS,
  FR_PILL_RADIUS,
  FR_NO_BORDER,
} from './tokens';
export type { ForumTrustTier, ForumCommunityTone, ForumSurfaceKey } from './tokens';

export {
  getVoteTone,
  getHumanVerifiedBadgeCopy,
  getCommunityTone,
} from './logic';
