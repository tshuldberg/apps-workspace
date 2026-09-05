/**
 * Meerkat Host config + security-preset mapping (Plan 20, Phase 4/5).
 *
 * The desktop host companion turns a user's own computer into their relay +
 * community node. This is the pure config core: a Zod-validated on-disk config
 * (~/.meerkat-host/config.json), a security preset -> clamped relay env mapping
 * (reuses the Phase 2 RELAY_* env vars, so resolveRelayLimits clamps them), and
 * connection-card generation from the running URLs (reuses the @mylife/sync
 * codec). Honesty: the preset NEVER sets a paid hosted-entitlement gate -- a
 * member-run relay ships OPEN by default (the slim bin omits hostedEntitlement).
 */

import { z } from 'zod';
import { encodeConnectionCard, type ConnectionCard } from '@mylife/sync';

export const HostConfigSchema = z.object({
  services: z.object({
    relay: z.boolean(),
    communityNode: z.boolean(),
    seeder: z.boolean(),
  }),
  exposure: z.enum(['tunnel', 'lan', 'domain']),
  securityPreset: z.enum(['private', 'open']),
  /** Writable folder for the community node's pieces/ + descriptors/ volume. */
  dataDir: z.string().optional(),
  /** BYO domain for the 'domain' exposure (Caddy TLS edge). */
  domain: z.string().optional(),
  /** Explicit RELAY_* env overrides layered on top of the preset (clamped by the relay). */
  caps: z.record(z.string()).optional(),
});

export type HostConfig = z.infer<typeof HostConfigSchema>;
export type SecurityPreset = HostConfig['securityPreset'];

export const DEFAULT_HOST_CONFIG: HostConfig = {
  services: { relay: true, communityNode: true, seeder: true },
  exposure: 'tunnel',
  securityPreset: 'private',
};

export type LoadHostConfigResult =
  | { ok: true; config: HostConfig }
  | { ok: false; reason: string };

export function loadHostConfig(json: string): LoadHostConfigResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'Config file is not valid JSON.' };
  }
  const r = HostConfigSchema.safeParse(parsed);
  return r.success ? { ok: true, config: r.data } : { ok: false, reason: r.error.message };
}

/**
 * Map a security preset to relay env caps. 'private' is sized for one community
 * (tighter per-IP budgets); 'open' raises the connection ceiling. All values go
 * through the relay's resolveRelayLimits clamp, so neither preset can configure
 * an amplifier or a self-DoS. Only RELAY_* keys are emitted -- never a paid gate.
 */
export function presetToRelayEnv(preset: SecurityPreset): Record<string, string> {
  if (preset === 'private') {
    return {
      RELAY_MAX_CONNECTIONS: '200',
      RELAY_MAX_PER_CLIENT: '8',
      RELAY_ENV_RATE: '150',
      RELAY_RENDEZVOUS_RATE: '20',
    };
  }
  return { RELAY_MAX_CONNECTIONS: '20000' };
}

/** Merge the preset env with any explicit per-cap overrides from the config. */
export function hostRelayEnv(config: HostConfig): Record<string, string> {
  const env = presetToRelayEnv(config.securityPreset);
  for (const [k, v] of Object.entries(config.caps ?? {})) {
    if (k.startsWith('RELAY_')) env[k] = v;
  }
  return env;
}

export interface HostConnectionCardInput {
  relayUrl: string;
  communityNodeUrl?: string;
  name?: string;
}

/**
 * Build the copyable/QR connection card members adopt. Throws if the relay URL
 * is not ws(s) (the card is never built from a bad address) -- the caller shows
 * the card only after the relay is verified reachable.
 */
export function buildHostConnectionCard(input: HostConnectionCardInput): string {
  const card: ConnectionCard = { v: 1, relay: input.relayUrl };
  if (input.communityNodeUrl) card.communityNode = input.communityNodeUrl;
  if (input.name) card.name = input.name;
  return encodeConnectionCard(card);
}
