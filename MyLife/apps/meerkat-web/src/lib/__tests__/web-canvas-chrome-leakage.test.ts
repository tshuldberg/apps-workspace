// Plan 56 C1 (7.3 + 7.4, WEB twin of canvas-chrome-leakage.test.ts): reserved
// chrome is structurally unreachable from member canvases, and canvases never
// leak outside community-scoped panes. The rail, sidebar chrome, Feed,
// Messages, DMs, and the connection status card never import a canvas
// component; the canvas renderer never references trust chrome or the network.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const srcDir = resolve(__dirname, '../..');

function read(relPath: string): string {
  return readFileSync(resolve(srcDir, relPath), 'utf8');
}

const CANVAS_IMPORT = /(canvas\/|\.\/)Canvas(Host|Surface)/;

const CANVAS_HOSTS = [
  'ui/channel/ChannelView.tsx',
  'ui/canvas/PagesView.tsx',
];

const CHROME = [
  'ui/community/CommunityRail.tsx',
  'ui/feed/FeedView.tsx',
  'ui/messages/MessagesView.tsx',
  'ui/sync/ConnectionStatusCard.tsx',
];

describe('canvas surfaces are scoped to community panes only (7.3)', () => {
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
  const surface = read('ui/canvas/CanvasSurface.tsx');
  const host = read('ui/canvas/CanvasHost.tsx');
  for (const forbidden of ['ConnectionStatusCard', 'VerifySheet', 'AudienceBadge']) {
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
