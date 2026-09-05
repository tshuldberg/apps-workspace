import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Phase 0 regression lock.
 *
 * react-hooks/rules-of-hooks must remain at 'error' (not 'warn'). Conditional
 * hook calls are silent bugs and this rule is the only authoring-time check
 * that catches them. Downgrading to 'warn' would hide real correctness
 * regressions behind a green lint gate. Hosted in the habits package rather
 * than packages/eslint-config because that package has no vitest harness.
 */

describe('@mylife/eslint-config rules-of-hooks snapshot', () => {
  const configPath = resolve(__dirname, '../../../../packages/eslint-config/index.js');
  const configSource = readFileSync(configPath, 'utf8');

  it('pins react-hooks/rules-of-hooks to error', () => {
    expect(configSource).toContain("'react-hooks/rules-of-hooks': 'error'");
  });

  it('does not downgrade react-hooks/rules-of-hooks to warn', () => {
    expect(configSource).not.toContain("'react-hooks/rules-of-hooks': 'warn'");
  });
});
