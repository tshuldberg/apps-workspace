/**
 * Plan 51 AC-4: private mesh use requires no account sign-in anywhere.
 *
 * Static import-graph guard: the ONLY modules allowed to import account-core are
 * the entitlement boundary, the settings/account UI, and the public-layer callers
 * that present the anonymous credential. Every other module (DMs, communities,
 * sync, database boot, share intake) must have zero dependency on the account
 * layer, so a fresh device can use the entire private mesh without an account.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_ROOT = join(__dirname, '..');

const ALLOWED_IMPORTERS = new Set([
  '(root)/_layout.tsx',
  '(root)/(tabs)/settings.tsx',
  '(root)/components/AccountSection.tsx',
  '(root)/components/PublishSheet.tsx',
  '(root)/persona/create.tsx',
  '(root)/upgrade.tsx',
  '(root)/data/public-publish.ts',
  '(root)/data/persona-core.ts',
  '(root)/data/account-core.ts',
]);

const IMPORT_PATTERN = /^\s*(?:import|export)[^'"]*from\s+['"][^'"]*account-core['"]/mu;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/u.test(entry)) out.push(full);
  }
  return out;
}

describe('AC-4 account-layer isolation (mobile)', () => {
  const files = walk(APP_ROOT);

  it('walks a meaningful file set (guard self-check)', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((file) => file.endsWith('dm-core.ts'))).toBe(true);
    expect(files.some((file) => file.endsWith('meerkat-db.ts'))).toBe(true);
  });

  it('only the entitlement boundary and public-layer callers import account-core', () => {
    for (const file of files) {
      const rel = relative(APP_ROOT, file);
      const source = readFileSync(file, 'utf8');
      if (IMPORT_PATTERN.test(source)) {
        expect(
          ALLOWED_IMPORTERS.has(rel),
          `${rel} imports account-core but is not an allowed account-layer surface (AC-4)`,
        ).toBe(true);
      }
    }
  });

  it('private mesh core modules have zero account dependency', () => {
    for (const name of ['dm-core.ts', 'meerkat-db.ts', 'sync-runner.ts', 'community-core.ts']) {
      const file = files.find((candidate) => candidate.endsWith(name));
      if (!file) continue; // module name drift is covered by the allowlist test above
      expect(IMPORT_PATTERN.test(readFileSync(file, 'utf8'))).toBe(false);
    }
  });
});
