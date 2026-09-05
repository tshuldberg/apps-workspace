/**
 * Host service-spec builder (Plan 20, Phase 4.3 + 5.4 + 6.1). Pure + fail-closed.
 *
 * Maps a validated HostConfig to the concrete ServiceSpec[] the HostSupervisor
 * spawns: the REAL bin/* entrypoints (relay, community node, seeder) with the
 * right env. Honest wiring only:
 *   - relay gets `hostRelayEnv(config)` (the security-preset RELAY_* caps, which
 *     the relay's `resolveRelayLimits` clamps to a safe window -- so neither preset
 *     can configure an amplifier or a self-DoS) and NEVER a paid entitlement gate.
 *   - communityNode + seeder each get a WRITABLE DATA_DIR under ~/.meerkat-host/
 *     (a distinct subdir per service so their on-disk shapes never collide). If a
 *     DATA_DIR cannot be created/written this returns { ok:false } -- fail closed,
 *     never a spec that would spawn a node that silently loses data.
 *   - when a relay runs alongside the community node, the community node's
 *     NOTIFY_RELAY_URL points at THIS host's own local relay, so a real change
 *     parks ONE content-free notify ping there for polling subscribers.
 *
 * The bind HOST follows the exposure: a tunnel/domain edge reaches the services on
 * loopback (127.0.0.1) while the tunnel/Caddy is the only public path; a LAN rung
 * must bind 0.0.0.0 to be dialable by same-network peers. The control panel itself
 * (server.ts) is always 127.0.0.1-only, independent of this.
 *
 * `runner` decouples "which bin file" from "how it is launched": the default runs
 * the source .mjs via `node --import tsx <bin>` (the bins import TS from ../src);
 * packaging (the SEA build) injects a runner that points at the compiled bins.
 * Pure: all fs is behind an injectable `ensureWritableDir` probe.
 */

import { accessSync, constants, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hostRelayEnv, type HostConfig } from './host-config';
import type { HostServiceName, ServiceSpec } from './process-supervisor';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The real bin/* entrypoints, unchanged, that each service spawns. */
const BIN_FILES: Record<HostServiceName, string> = {
  relay: 'meerkat-relay-server.mjs',
  communityNode: 'meerkat-community-node.mjs',
  seeder: 'meerkat-node.mjs',
};

/** Default location of the compiled/source bin/ directory (../bin from host/). */
export const DEFAULT_BIN_DIR = join(HERE, '..', 'bin');

/** Default writable root for the host companion's on-disk state. */
export const DEFAULT_HOST_DATA_DIR = join(homedir(), '.meerkat-host');

/** Distinct default ports so all three services coexist on one machine. */
export const DEFAULT_RELAY_PORT = 8787;
export const DEFAULT_COMMUNITY_NODE_PORT = 8890;
export const DEFAULT_SEEDER_PORT = 8889;

/** How a bin is launched: the executable + a fixed arg prefix before the bin path. */
export interface ServiceRunner {
  bin: string;
  argsPrefix: string[];
}

/**
 * Default runner: the current node executable with the tsx loader, so the source
 * `bin/*.mjs` (which import `../src/*.ts`) run without a build step. Packaging
 * swaps this for a runner that targets the compiled bins.
 */
export const DEFAULT_SERVICE_RUNNER: ServiceRunner = {
  bin: process.execPath,
  argsPrefix: ['--import', 'tsx'],
};

/** True when `dir` exists (created if needed) and is writable. Never throws. */
export type EnsureWritableDir = (dir: string) => boolean;

const realEnsureWritableDir: EnsureWritableDir = (dir) => {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

export interface BuildServiceSpecsDeps {
  /** Directory holding the bin/* entrypoints. Default {@link DEFAULT_BIN_DIR}. */
  binDir?: string;
  /** Writable root for community/seeder DATA_DIR. Default config.dataDir or {@link DEFAULT_HOST_DATA_DIR}. */
  dataDir?: string;
  /** How each bin is launched. Default {@link DEFAULT_SERVICE_RUNNER}. */
  runner?: ServiceRunner;
  /** Injected writable-dir probe (real fs by default) so the builder stays pure/testable. */
  ensureWritableDir?: EnsureWritableDir;
  relayPort?: number;
  communityNodePort?: number;
  seederPort?: number;
}

export type BuildServiceSpecsResult =
  | { ok: true; specs: ServiceSpec[] }
  | { ok: false; reason: string };

/**
 * Build the ServiceSpec[] for the enabled services. Fail-closed: if a required
 * DATA_DIR is not writable, returns { ok:false } rather than a spec that would
 * spawn a data-losing node. The relay's URL for NOTIFY_RELAY_URL is the local
 * loopback relay (127.0.0.1), never a fabricated public address.
 */
export function buildServiceSpecs(
  config: HostConfig,
  deps: BuildServiceSpecsDeps = {},
): BuildServiceSpecsResult {
  const binDir = deps.binDir ?? DEFAULT_BIN_DIR;
  const runner = deps.runner ?? DEFAULT_SERVICE_RUNNER;
  const ensureWritableDir = deps.ensureWritableDir ?? realEnsureWritableDir;
  const baseDataDir = deps.dataDir ?? config.dataDir ?? DEFAULT_HOST_DATA_DIR;
  const relayPort = deps.relayPort ?? DEFAULT_RELAY_PORT;
  const communityNodePort = deps.communityNodePort ?? DEFAULT_COMMUNITY_NODE_PORT;
  const seederPort = deps.seederPort ?? DEFAULT_SEEDER_PORT;

  // A tunnel/Caddy edge reaches the services on loopback (they stay private, the
  // edge is the only public path). A LAN rung must bind 0.0.0.0 to be dialable.
  const bindHost = config.exposure === 'lan' ? '0.0.0.0' : '127.0.0.1';

  const specOf = (name: HostServiceName, env: Record<string, string>): ServiceSpec => ({
    name,
    bin: runner.bin,
    args: [...runner.argsPrefix, join(binDir, BIN_FILES[name])],
    env,
  });

  const specs: ServiceSpec[] = [];

  if (config.services.relay) {
    specs.push(
      specOf('relay', {
        ...hostRelayEnv(config),
        PORT: String(relayPort),
        HOST: bindHost,
      }),
    );
  }

  // The community node parks notify pings on THIS host's own relay when present.
  const localRelayUrl = `ws://127.0.0.1:${relayPort}`;

  if (config.services.communityNode) {
    const dir = join(baseDataDir, 'community');
    if (!ensureWritableDir(dir)) {
      return { ok: false, reason: `community node DATA_DIR is not writable: ${dir}` };
    }
    const env: Record<string, string> = {
      PORT: String(communityNodePort),
      HOST: bindHost,
      DATA_DIR: dir,
    };
    if (config.services.relay) env.NOTIFY_RELAY_URL = localRelayUrl;
    specs.push(specOf('communityNode', env));
  }

  if (config.services.seeder) {
    const dir = join(baseDataDir, 'seed');
    if (!ensureWritableDir(dir)) {
      return { ok: false, reason: `seeder DATA_DIR is not writable: ${dir}` };
    }
    specs.push(
      specOf('seeder', {
        PORT: String(seederPort),
        HOST: bindHost,
        DATA_DIR: dir,
      }),
    );
  }

  return { ok: true, specs };
}
