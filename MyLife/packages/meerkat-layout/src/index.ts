// @mylife/meerkat-layout: the single, react-native-free source of truth for the
// Meerkat community composition document (composition plan 2.2), shared by
// apps/meerkat (Expo) and apps/meerkat-web (Vite). Pure TypeScript: schema,
// codec (blob + deep link), and canonical bytes. The owner-signed cm_layout
// event in @mylife/sync carries the blob opaquely, exactly like the theme blob.

export type {
  MkBlockNode,
  MkKnownCapabilityKey,
  MkLayoutDocument,
  MkTierDef,
} from './types';

export {
  MAX_CAPABILITIES,
  MAX_CHANNEL_BLOCKS,
  MAX_CHANNEL_OVERRIDES,
  MAX_HOME_BLOCKS,
  MAX_TIERS,
  MAX_TIER_CHANNELS,
  MAX_TIER_PERKS,
  MkBlockNodeSchema,
  MkLayoutDocumentSchema,
  MkTierDefSchema,
} from './schema';

export {
  LAYOUT_BLOB_PREFIX,
  LAYOUT_DEEP_LINK_PREFIX,
  MAX_LAYOUT_BLOB_BYTES,
  buildLayoutDeepLink,
  canonicalLayoutBytes,
  decodeLayoutBlob,
  encodeLayoutBlob,
  extractLayoutBlob,
  layoutDecodeErrorMessage,
  type LayoutDecodeError,
  type LayoutDecodeErrorCode,
  type LayoutDecodeResult,
} from './codec';
