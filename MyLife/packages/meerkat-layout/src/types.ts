// @mylife/meerkat-layout types: the community composition document carried in
// the owner-signed cm_layout event (composition plan 2.2). Pure TypeScript,
// react-native-free, shared by apps/meerkat and apps/meerkat-web.

/**
 * Capabilities a community can declare ON (composition plan 2.3). This is the
 * closed set THIS build understands; the document schema deliberately accepts
 * any bounded slug so a NEWER build's capability degrades on an older client to
 * declared-but-unavailable (honest pending card), never to a rejected document.
 */
export type MkKnownCapabilityKey =
  | 'video'
  | 'live'
  | 'shortform'
  | 'store'
  | 'tiers'
  | 'embeds'
  | 'offline_download';

/**
 * One placed block in a layout. `type` keys into the app-side block registry;
 * `config` is validated against that block's own configSchema at resolve time,
 * never here (the codec carries it opaquely, exactly like the theme blob).
 * An unknown `type` renders the honest BlockPlaceholder, never an error.
 */
export interface MkBlockNode {
  type: string;
  config: Record<string, unknown>;
}

/**
 * A membership tier definition (composition plan 10.1). Definitions are data
 * only: the key lane, purchase flow, and entitlement live elsewhere. priceRef
 * is an opaque reference into the billing service's catalog, never an amount
 * (prices are founder-locked server-side).
 */
export interface MkTierDef {
  id: string;
  name: string;
  priceRef: string | null;
  perks: string[];
  channelIds: string[];
}

/** The composition document carried in the cm_layout blob. */
export interface MkLayoutDocument {
  /** Declared capabilities (bounded slugs; unknown = declared-but-unavailable). */
  capabilities: string[];
  /** Membership tier definitions (empty until monetization phases). */
  tiers: MkTierDef[];
  /** The community home surface, top to bottom. */
  home: MkBlockNode[];
  /** Per-channel block-stack overrides, keyed by channel id. */
  channels: Record<string, MkBlockNode[]>;
}
