// Plan 42 NC-42 static gate: self-test coverage (WP-42E).
//
// Runs scripts/check-meerkat-transport-nc.mjs in both modes and asserts:
//   - --self-test exits 0 (every gate CATCHES its planted violation, so no gate
//     is vacuous), and
//   - the plain run exits 0 (the real tree currently upholds every NC invariant).
// This keeps the gate honest: a gate that stopped catching violations would fail
// the suite here, not just silently pass CI.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// packages/meerkat-relay/src/__tests__ -> repo root is four levels up.
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const script = resolve(repoRoot, 'scripts', 'check-meerkat-transport-nc.mjs');

function run(args: string[]): { code: number; output: string } {
  try {
    const output = execFileSync('node', [script, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    return { code: 0, output };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('NC-42 static transport gate', () => {
  it('the gate script exists', () => {
    expect(existsSync(script)).toBe(true);
  });

  it('--self-test proves every gate catches a planted violation', () => {
    const { code, output } = run(['--self-test']);
    expect(output).toContain('SELF-TEST OK   NC-42.1');
    expect(output).toContain('SELF-TEST OK   NC-42.7');
    expect(code).toBe(0);
  });

  it('the real tree upholds every NC-42 static invariant', () => {
    const { code, output } = run([]);
    expect(output).toContain('All NC-42 static invariants hold.');
    expect(code).toBe(0);
  });
});
