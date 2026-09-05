// Plan 32 T4.1 / TC-3 / NC-2 (the Signal rule): the feed render surface performs
// ZERO receiver-side URL fetches and never renders untrusted markup. This is a
// static guard: no file under src/ui/feed may reference a network primitive
// (fetch / XMLHttpRequest / WebSocket / EventSource) or dangerouslySetInnerHTML.
// Media + avatars + any card render only local, hash-verified bytes via <img src=
// {dataUri}>. (The real drain/probe live behind provider methods the feed calls by
// name; they are NOT raw fetch calls and NOT receiver-side URL fetches.)

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const FEED_DIR = fileURLToPath(new URL('../../ui/feed/', import.meta.url));
const FORBIDDEN = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bnew\s+WebSocket\b/,
  /\bEventSource\b/,
  // Require the JSX prop form so an honest "never dangerouslySetInnerHTML" comment
  // is not a false positive; a real injection would be `dangerouslySetInnerHTML=`.
  /dangerouslySetInnerHTML\s*=/,
];

function feedFiles(): string[] {
  return readdirSync(FEED_DIR).filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'));
}

describe('feed render components never fetch or inject markup (TC-3 / NC-2)', () => {
  it('has feed source files to scan', () => {
    expect(feedFiles().length).toBeGreaterThan(0);
  });

  for (const name of feedFiles()) {
    it(`${name} imports no network primitive and no dangerouslySetInnerHTML`, () => {
      const source = readFileSync(new URL(name, `file://${FEED_DIR}`), 'utf8');
      for (const pattern of FORBIDDEN) {
        expect(pattern.test(source), `${name} must not match ${pattern}`).toBe(false);
      }
    });
  }
});
