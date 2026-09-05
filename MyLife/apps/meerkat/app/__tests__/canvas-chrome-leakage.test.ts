// Plan 56 C1 (7.3 + 7.4): reserved chrome is structurally unreachable from
// member canvases, and canvases never leak outside community route subtrees.
//
// Lint-style guards in the community-theme-leakage style:
//   - the ONLY screens that mount CanvasHost/CanvasSurface are community
//     route subtrees (channel, page, pages). The tab bar, the Feed, Messages,
//     DM threads, and Me NEVER import a canvas component, so member content
//     can never share pixels with app chrome, the connection status card, or
//     verification indicators (7.3);
//   - the canvas renderer never imports the trust-indicator components
//     (ConnectionStatusCard, VerifySheet, AudienceBadge) or the chrome
//     typography token (MK_MONO), so a decoration cannot counterfeit a trust
//     surface even by composition (7.4);
//   - the canvas renderer and host never touch the network.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(__dirname, '../(root)');

function read(relPath: string): string {
  return readFileSync(resolve(rootDir, relPath), 'utf8');
}

const CANVAS_IMPORT = /components\/canvas\//;

// Community route subtrees: the only canvas mount points.
const CANVAS_HOSTS = [
  '(tabs)/channel/[communityId]/[channelId].tsx',
  '(tabs)/community/[communityId]/page/[canvasId].tsx',
];

// App chrome + non-community surfaces: NEVER import a canvas component.
const CHROME = [
  '(tabs)/_layout.tsx', // the tab bar
  '(tabs)/index.tsx', // the Feed
  '(tabs)/messages.tsx',
  '(tabs)/dm/[conversationId].tsx',
  '(tabs)/me.tsx',
  '(tabs)/settings.tsx',
  'components/ConnectionStatusCard.tsx',
];

describe('canvas surfaces are scoped to community routes only (7.3)', () => {
  for (const file of CANVAS_HOSTS) {
    it(`${file} mounts the canvas host`, () => {
      expect(CANVAS_IMPORT.test(read(file))).toBe(true);
    });
  }
  for (const file of CHROME) {
    it(`${file} never imports a canvas component`, () => {
      expect(CANVAS_IMPORT.test(read(file))).toBe(false);
    });
  }
});

describe('the canvas renderer cannot reach trust chrome (7.4)', () => {
  const surface = read('components/canvas/CanvasSurface.tsx');
  const host = read('components/canvas/CanvasHost.tsx');
  for (const forbidden of ['ConnectionStatusCard', 'VerifySheet', 'AudienceBadge', 'MK_MONO']) {
    it(`canvas components never reference ${forbidden}`, () => {
      expect(surface.includes(forbidden)).toBe(false);
      expect(host.includes(forbidden)).toBe(false);
    });
  }
  it('canvas components never touch the network', () => {
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket']) {
      expect(surface.includes(forbidden), forbidden).toBe(false);
      expect(host.includes(forbidden), forbidden).toBe(false);
    }
  });
});
