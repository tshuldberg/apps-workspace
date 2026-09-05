// Source locks for the Set-1 Feed + share-intake hardening (PROMPT-002).
// The freeze class from the unlock-screen session (navigating or presenting a
// second RN Modal while a visible Modal is mid-dismissal) also lived on the
// Feed: the filter sheet's "See connection status" navigated in the same commit
// that hid the sheet, and the why-sheet opened the filter sheet the same way.
// These locks pin the queued-and-flushed shape, plus the fail-honest wiring on
// the share/open/pinned/inbox screens (thrown awaits must surface, back
// affordances must have a fallback, "Copied" only after a real clipboard write).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '(root)');
const feed = readFileSync(join(root, '(tabs)', 'index.tsx'), 'utf8');
const whySheet = readFileSync(join(root, 'components', 'feed', 'WhySheet.tsx'), 'utf8');
const filterSheet = readFileSync(join(root, 'components', 'feed', 'FeedFilterSheet.tsx'), 'utf8');
const share = readFileSync(join(root, '(tabs)', 'share.tsx'), 'utf8');
const pinned = readFileSync(join(root, 'pinned', '[id].tsx'), 'utf8');
const inbox = readFileSync(join(root, 'share-inbox', 'index.tsx'), 'utf8');

describe('Feed cross-modal actions are queued, never same-commit', () => {
  it('openStatus queues instead of navigating while the filter sheet dismisses', () => {
    expect(feed).toContain("setPendingAction('open-status')");
    expect(feed).not.toMatch(/setFiltersOpen\(false\);\s*\n\s*router\.push/u);
  });

  it('the why-sheet -> filter-sheet handoff queues instead of cross-fading two Modals', () => {
    expect(feed).toContain("setPendingAction('open-filters')");
    expect(feed).not.toMatch(/setWhyItem\(null\);\s*\n\s*setFiltersOpen\(true\)/u);
  });

  it('both sheets flush the queued action from Modal onDismiss', () => {
    expect(feed.match(/onDismissed=\{flushPendingAction\}/gu)?.length).toBe(2);
    expect(whySheet).toContain('onDismiss={onDismissed}');
    expect(filterSheet).toContain('onDismiss={onDismissed}');
  });
});

describe('Share screen open-link flow fails honest', () => {
  it('routes Open link through the caught runOpenLinkFlow core', () => {
    expect(share).toContain('runOpenLinkFlow({');
    // The screen no longer runs the raw local -> discover -> remote sequence
    // whose thrown steps died as unhandled rejections.
    expect(share).not.toMatch(/await openFromStore\(parts\.contentId/u);
  });

  it('claims Copied only after the clipboard write succeeded, and says so on failure', () => {
    expect(share).toMatch(/try \{\s*\n\s*await Clipboard\.setStringAsync/u);
    // Review pass: a failed clipboard write renders "Could not copy", never a
    // silent dead tap (the web twin shows a notice on the same failure).
    expect(share).toContain("'Could not copy'");
  });
});

describe('Pinned detail fails honest and never dead-ends', () => {
  it('reopen catches a thrown store read and shows a busy state', () => {
    expect(pinned).toMatch(/catch \(err\)/u);
    expect(pinned).toContain("'Decrypting...'");
  });

  it('Close falls back when this screen is the only route', () => {
    expect(pinned).toContain('router.canGoBack()');
    expect(pinned).not.toContain('onPress={() => router.back()}');
  });

  it('claims Copied only after the clipboard write succeeded, and says so on failure', () => {
    expect(pinned).toMatch(/try \{\s*\n\s*await Clipboard\.setStringAsync/u);
    expect(pinned).toContain("'Could not copy'");
  });
});

describe('Share Inbox routes fail honest and never dead-end', () => {
  it('both route handlers surface a thrown step instead of a silent dead tap', () => {
    expect(inbox.match(/Could not send this item\./gu)?.length).toBe(2);
  });

  it('Back falls back when the inbox was deep-linked as the only route', () => {
    expect(inbox).toContain('router.canGoBack()');
    expect(inbox).not.toContain('onPress={() => router.back()}');
  });

  it('repairs a stale send target when its community or channel disappears', () => {
    expect(inbox).toMatch(/community\.channels\.some\(\(ch\) => ch\.id === target\.channelId\)/u);
  });
});
