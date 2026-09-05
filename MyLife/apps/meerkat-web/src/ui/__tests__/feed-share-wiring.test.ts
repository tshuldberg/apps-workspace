// Source locks for the Set-1 Feed + share-intake hardening (web twins of
// apps/meerkat feed-share-wiring.test.ts). There is no React DOM harness in
// this app, so screen wiring that has no pure seam is pinned at the source
// level: the heart tap resolves through the SHARED chat-kit-core rule (no
// surface drift on add-vs-remove), a share tap in a browser with neither the
// share sheet nor the clipboard says so, thrown route/stage steps surface as
// errors instead of unhandled rejections, and the inbox only offers
// destinations that can actually succeed.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ui = join(__dirname, '..');
const feedView = readFileSync(join(ui, 'feed', 'FeedView.tsx'), 'utf8');
const shareInbox = readFileSync(join(ui, 'inbox', 'ShareInbox.tsx'), 'utf8');

describe('FeedView heart + share honesty', () => {
  it('resolves the heart tap through the shared chat-kit-core rule', () => {
    expect(feedView).toMatch(/import \{ resolveReactionTap \} from '\.\.\/\.\.\/lib\/chat-kit-core'/u);
    expect(feedView).toContain('resolveReactionTap(item.reactions ?? null, HEART_EMOJI)');
  });

  it('says sharing is unavailable instead of a dead tap when the browser has no share path', () => {
    expect(feedView).toContain('Sharing is not available in this browser.');
  });
});

describe('ShareInbox fail-honest routing', () => {
  it('surfaces a thrown stage, pick, drain, route, or DM step as an error', () => {
    expect(shareInbox).toContain('Could not stage these files.');
    expect(shareInbox).toContain('Could not read the picked files.');
    // The boot-time Web Share Target drain is caught too (review pass): a thrown
    // cache read must not leave the staged list unrendered with no feedback.
    expect(shareInbox).toContain('Could not read the shared items.');
    expect(shareInbox).toContain('Could not route this item.');
    expect(shareInbox).toContain('Could not send this item.');
  });

  it('offers only destinations that can succeed and repairs a stale selection', () => {
    // channel/files need a community; dm needs an eligible friend.
    expect(shareInbox).toMatch(/d === 'dm' \? canDm : communities\.length > 0/u);
    // The route-or-notice branch keys on what is actually offered.
    expect(shareInbox).toContain('rowDestinations.length === 0 ?');
    expect(shareInbox).toContain('rowDestinations.includes(destination)');
  });
});
