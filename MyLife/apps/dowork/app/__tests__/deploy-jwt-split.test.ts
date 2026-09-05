// BK-1 deploy JWT-split contract.
//
// The auth invariant (supabase/functions/_shared/broker.ts decodes the JWT sub
// WITHOUT verifying its signature and trusts the Supabase Edge gateway to have
// verified it first) means user-facing functions MUST keep gateway JWT
// verification on, while machine-caller functions (gated by their own shared
// secret, never a user JWT) MUST turn it off. This test locks that split into
// both declarative surfaces so a future function cannot be added without a
// deploy classification:
//   - supabase/config.toml            [functions.<name>] verify_jwt = <bool>
//   - apps/dowork/scripts/deploy-functions.sh  USER_FACING / MACHINE_CALLERS
//
// vitest runs with cwd = apps/dowork, so the repo root is ../..

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(process.cwd(), '..', '..');
const configToml = readFileSync(join(repoRoot, 'supabase', 'config.toml'), 'utf8');
const deployScript = readFileSync(
  join(process.cwd(), 'scripts', 'deploy-functions.sh'),
  'utf8',
);

const USER_FACING = [
  'dowork-upload-finalize',
  'dowork-delete-account',
  'dowork-redeem-invite',
  'dowork-playback-url',
] as const;

const MACHINE_CALLERS = ['dowork-rc-webhook', 'dowork-notify'] as const;

// Parse `[functions.<name>] ... verify_jwt = <bool>` blocks out of config.toml.
function parseVerifyJwt(toml: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const lines = toml.split('\n');
  let current: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const header = line.match(/^\[functions\.([a-z0-9-]+)\]$/);
    if (header) {
      current = header[1] ?? null;
      continue;
    }
    if (line.startsWith('[')) {
      current = null;
      continue;
    }
    if (!current) continue;
    const kv = line.match(/^verify_jwt\s*=\s*(true|false)\b/);
    if (kv) {
      out[current] = kv[1] === 'true';
    }
  }
  return out;
}

// Read the bash array body between `NAME=(` and the closing `)`.
function parseBashArray(script: string, name: string): string[] {
  const start = script.indexOf(`${name}=(`);
  if (start === -1) return [];
  const end = script.indexOf(')', start);
  if (end === -1) return [];
  const body = script.slice(start + `${name}=(`.length, end);
  return body
    .split('\n')
    .map((entry) => entry.replace(/#.*$/, '').trim())
    .filter((entry) => entry.length > 0);
}

const verifyJwt = parseVerifyJwt(configToml);
const scriptUserFacing = parseBashArray(deployScript, 'USER_FACING');
const scriptMachineCallers = parseBashArray(deployScript, 'MACHINE_CALLERS');

describe('BK-1 config.toml verify_jwt split', () => {
  it.each(USER_FACING)('%s keeps gateway JWT verification on', (fn) => {
    expect(verifyJwt[fn]).toBe(true);
  });

  it.each(MACHINE_CALLERS)('%s disables gateway JWT verification (secret-gated)', (fn) => {
    expect(verifyJwt[fn]).toBe(false);
  });
});

describe('BK-1 deploy-functions.sh classification', () => {
  it('lists exactly the four user-facing functions', () => {
    expect([...scriptUserFacing].sort()).toEqual([...USER_FACING].sort());
  });

  it('lists exactly the two machine-caller functions', () => {
    expect([...scriptMachineCallers].sort()).toEqual([...MACHINE_CALLERS].sort());
  });

  it('deploys machine-callers with --no-verify-jwt and user-facing without it', () => {
    const userFacingStart = deployScript.indexOf('for fn in "${USER_FACING[@]}"');
    const machineStart = deployScript.indexOf('for fn in "${MACHINE_CALLERS[@]}"');
    expect(userFacingStart).toBeGreaterThan(-1);
    expect(machineStart).toBeGreaterThan(userFacingStart);

    // The user-facing loop must NOT pass --no-verify-jwt.
    const userFacingLoop = deployScript.slice(userFacingStart, machineStart);
    expect(userFacingLoop).not.toContain('--no-verify-jwt');

    // The machine-caller loop MUST pass --no-verify-jwt.
    const machineLoop = deployScript.slice(machineStart);
    expect(machineLoop).toContain('--no-verify-jwt');
  });
});

describe('BK-1 every dowork edge function is classified', () => {
  const functionsDir = join(repoRoot, 'supabase', 'functions');
  const doworkFns = readdirSync(functionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('dowork-'))
    .map((entry) => entry.name);
  const declared = new Set<string>([...USER_FACING, ...MACHINE_CALLERS]);

  it('discovers the expected set of dowork functions on disk', () => {
    expect(doworkFns.length).toBeGreaterThan(0);
  });

  it.each(doworkFns.map((fn) => [fn] as const))(
    '%s is covered by config.toml and the deploy script',
    (fn) => {
      // Guards a future function added without a deploy classification.
      expect(declared.has(fn), `${fn} missing from USER_FACING/MACHINE_CALLERS`).toBe(true);
      expect(
        Object.prototype.hasOwnProperty.call(verifyJwt, fn),
        `${fn} missing a [functions.${fn}] verify_jwt entry in config.toml`,
      ).toBe(true);
    },
  );
});
