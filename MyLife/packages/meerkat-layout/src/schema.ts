// Zod schema for MkLayoutDocument. This is the input-validation boundary for an
// UNTRUSTED layout blob (imported template, synced event): strict shapes,
// bounded strings, bounded collection sizes. Two deliberate forward-compat
// holes, both fail-SAFE downstream:
//   - block `type` is any bounded slug (an unknown type renders the honest
//     BlockPlaceholder in the app registry, never rejects the document);
//   - `capabilities` entries are any bounded slug (an unknown capability is
//     declared-but-unavailable, rendering the honest pending card).
// Everything else is closed: unknown document/tier/node keys are rejected so a
// hostile blob cannot smuggle payloads for a future parser (F8: type-exact
// validation is the security boundary).

import { z } from 'zod';

/** Slug form for block types, capability keys, tier ids, and channel ids. */
const SLUG_RE = /^[a-z][a-z0-9_-]{0,63}$/;
const SlugSchema = z.string().regex(SLUG_RE, 'Must be a lowercase slug (a-z, 0-9, _, -; max 64)');

/** Channel ids in descriptors are freer than slugs; bound them without reshaping. */
const ChannelIdSchema = z.string().min(1).max(128);

export const MAX_HOME_BLOCKS = 64;
export const MAX_CHANNEL_BLOCKS = 64;
export const MAX_CHANNEL_OVERRIDES = 256;
export const MAX_CAPABILITIES = 32;
export const MAX_TIERS = 32;
export const MAX_TIER_PERKS = 20;
export const MAX_TIER_CHANNELS = 64;

export const MkBlockNodeSchema = z
  .object({
    type: SlugSchema,
    // Opaque per-block config: validated against the block's own configSchema
    // by the app registry at resolve time. Bounded overall by the blob cap.
    config: z.record(z.unknown()),
  })
  .strict();

export const MkTierDefSchema = z
  .object({
    id: SlugSchema,
    name: z.string().min(1).max(80),
    priceRef: z.string().min(1).max(200).nullable(),
    perks: z.array(z.string().min(1).max(200)).max(MAX_TIER_PERKS),
    channelIds: z.array(ChannelIdSchema).max(MAX_TIER_CHANNELS),
  })
  .strict();

export const MkLayoutDocumentSchema = z
  .object({
    capabilities: z.array(SlugSchema).max(MAX_CAPABILITIES),
    tiers: z.array(MkTierDefSchema).max(MAX_TIERS),
    home: z.array(MkBlockNodeSchema).max(MAX_HOME_BLOCKS),
    channels: z.record(ChannelIdSchema, z.array(MkBlockNodeSchema).max(MAX_CHANNEL_BLOCKS)),
  })
  .strict()
  .superRefine((doc, ctx) => {
    if (Object.keys(doc.channels).length > MAX_CHANNEL_OVERRIDES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['channels'],
        message: `At most ${MAX_CHANNEL_OVERRIDES} channel overrides`,
      });
    }
    const tierIds = new Set<string>();
    for (const tier of doc.tiers) {
      if (tierIds.has(tier.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tiers'],
          message: `Duplicate tier id "${tier.id}"`,
        });
      }
      tierIds.add(tier.id);
    }
  });
