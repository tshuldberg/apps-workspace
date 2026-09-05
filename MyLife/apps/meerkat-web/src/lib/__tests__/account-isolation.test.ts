/**
 * Plan 51 AC-4: private mesh use requires no account sign-in anywhere (web twin
 * of the mobile guard). Only the settings/account UI and the public-layer callers
 * may import lib/account.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname, '..', '..');

const ALLOWED_IMPORTERS = new Set([
  'lib/account.ts',
  'lib/public-publish.ts',
  'lib/persona-core.ts',
  'ui/settings/AccountSection.tsx',
  'ui/settings/AppUnlockSection.tsx',
  'ui/settings/PublicPersonaSection.tsx',
  'ui/publish/PublishSheet.tsx',
]);

const IMPORT_PATTERN = /^\s*(?:import|export)[^'"]*from\s+['"][^'"]*(?:lib\/account|\.\.?\/account)['"]/mu;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/u.test(entry)) out.push(full);
  }
  return out;
}

describe('AC-4 account-layer isolation (web)', () => {
  const files = walk(SRC_ROOT);

  it('walks a meaningful file set (guard self-check)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('only the account/public-layer surfaces import lib/account', () => {
    for (const file of files) {
      const rel = relative(SRC_ROOT, file).replace(/\\/gu, '/');
      const source = readFileSync(file, 'utf8');
      if (IMPORT_PATTERN.test(source)) {
        expect(
          ALLOWED_IMPORTERS.has(rel),
          `${rel} imports lib/account but is not an allowed account-layer surface (AC-4)`,
        ).toBe(true);
      }
    }
  });
});
