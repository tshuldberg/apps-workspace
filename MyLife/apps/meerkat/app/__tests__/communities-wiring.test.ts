// Source locks for the Set-2 Communities hardening (PROMPT-003).
// The freeze class (navigating or presenting a second RN Modal while a visible
// Modal is mid-dismissal) lived on the Communities surface too: the create/join
// sheet handed off to the QR scanner and the invite preview in the same commit,
// the scanner handed off to the preview the same way, and the invite preview
// navigated to the joined community in the commit that hid itself. These locks
// pin the queued-and-flushed shape, plus fail-honest wiring (thrown awaits
// surface, back affordances have fallbacks, busy state is per-action).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '(root)');
const list = readFileSync(join(root, '(tabs)', 'communities.tsx'), 'utf8');
const home = readFileSync(join(root, '(tabs)', 'community', '[communityId].tsx'), 'utf8');
const settings = readFileSync(join(root, '(tabs)', 'community', '[communityId]', 'settings.tsx'), 'utf8');
const member = readFileSync(join(root, '(tabs)', 'community', '[communityId]', 'member', '[deviceId].tsx'), 'utf8');
const layoutEditor = readFileSync(join(root, '(tabs)', 'community', '[communityId]', 'layout-editor.tsx'), 'utf8');
const pages = readFileSync(join(root, '(tabs)', 'community', '[communityId]', 'pages.tsx'), 'utf8');
const page = readFileSync(join(root, '(tabs)', 'community', '[communityId]', 'page', '[canvasId].tsx'), 'utf8');
const previewSheet = readFileSync(join(root, 'components', 'InvitePreviewSheet.tsx'), 'utf8');
const onboardingGate = readFileSync(join(root, 'components', 'OnboardingGate.tsx'), 'utf8');
const inviteShare = readFileSync(join(root, 'components', 'InviteShareSheet.tsx'), 'utf8');

describe('Communities list cross-modal handoffs are queued, never same-commit', () => {
  it('the sheet -> scanner handoff queues instead of cross-fading two Modals', () => {
    expect(list).toContain("setPendingAction({ kind: 'scan' })");
    expect(list).not.toMatch(/setSheet\('closed'\);\s*setScanning\(true\)/u);
  });

  it('the sheet -> invite-preview and scanner -> invite-preview handoffs queue', () => {
    expect(list.match(/setPendingAction\(\{ kind: 'preview'/gu)?.length).toBe(2);
    expect(list).not.toMatch(/setScanning\(false\);\s*setPendingInvite/u);
  });

  it('both dismissing Modals flush the queued action from onDismiss', () => {
    expect(list.match(/onDismiss=\{flushPendingAction\}/gu)?.length).toBe(2);
  });

  it('the scanner Modal stays mounted and toggles visible', () => {
    expect(list).toContain('<Modal visible={scanning}');
  });
});

describe('Create-community failure surfaces INSIDE the open sheet (Set 8)', () => {
  it('the catch routes to createError (rendered in the sheet), never to the list-level notice behind the backdrop', () => {
    expect(list).toMatch(/catch \(err\) \{\s*setCreateError\(/u);
    expect(list).toContain('{createError ? <Text style={styles.createErrorText}>{createError}</Text> : null}');
  });

  it('the error clears on retype and on close so a stale failure never lingers', () => {
    expect(list).toContain("onChangeText={(v) => { setNewName(v); setCreateError(null); }}");
    expect(list).toMatch(/setJoinLink\(''\);\s*setCreateError\(null\);/u);
  });
});

describe('Invite preview navigates only after its Modal dismissed', () => {
  it('the join success path queues the destination instead of pushing in the close commit', () => {
    expect(previewSheet).toContain('onNavigate(result.firstChannelId');
    // The one router.push lives in the wrapper flush, not the join handler.
    expect(previewSheet.match(/router\.push/gu)?.length).toBe(1);
    expect(previewSheet).toContain('onDismiss={flushPendingNav}');
  });

  it('a host can override the queue, and OnboardingGate does (its own Modal unmounts the sheet in the join commit)', () => {
    // Without the override, the queued post-join push dies with the wrapper
    // when the gate Modal hides (Android unmounts Modal children immediately),
    // or fires mid-teardown of the gate on iOS (the freeze class).
    expect(previewSheet).toContain('onNavigate={onNavigate ?? setPendingNav}');
    expect(onboardingGate).toContain("onNavigate={(href) => setPendingNav({ kind: 'push', href })}");
  });
});

describe('Community home fails safe and never dead-ends', () => {
  it('a thrown banner read falls back to no banner, never an unhandled rejection', () => {
    expect(home).toMatch(/resolveCommunityBannerImage\(id\)[\s\S]{0,220}\.catch\(/u);
  });

  it('Back falls back when the screen is the only route', () => {
    expect(home).toContain('router.canGoBack()');
    expect(home).not.toContain('onBack={() => router.back()}');
  });
});

describe('Community settings fail honest', () => {
  it('Back falls back to the community home when deep-linked', () => {
    expect(settings).toContain('router.canGoBack()');
    expect(settings).not.toContain('onBack={() => router.back()}');
  });

  it('a thrown photo picker surfaces instead of an idle-looking dead tap', () => {
    expect(settings).toContain("'Could not open your photos. Try again.'");
  });

  it('block/unblock is single-flight and reports a mid-loop failure', () => {
    expect(settings).toContain('blockingKey');
    expect(settings).toContain('devices were ${next ? \'blocked\' : \'unblocked\'}');
  });

  it('the publish/invite/history sheets stay mounted and toggle visible', () => {
    expect(settings).toContain('visible={showPublish}');
    expect(settings).toContain('visible={showInvite}');
    expect(settings).toContain('visible={showHistory}');
    expect(settings).not.toMatch(/\{showPublish \? \(\s*<PublishSheet/u);
  });
});

describe('Member profile copy-forward busy state is per-design', () => {
  it('only the tapped design row reads Copying', () => {
    expect(member).toContain('busyCanvasId === design.canvas.id');
    expect(member).toContain('if (busyCanvasId !== null) return;');
  });

  it('Back falls back when the screen is the only route', () => {
    expect(member).toContain('router.canGoBack()');
    expect(member).not.toContain('onPress={() => router.back()}');
  });
});

describe('Layout editor, pages, and page never dead-end and copy honestly', () => {
  it('layout editor claims Copied only after the clipboard write resolves', () => {
    expect(layoutEditor).toMatch(/await Clipboard\.setStringAsync\(buildLayoutDeepLink/u);
    expect(layoutEditor).toContain("'Could not copy the template.'");
  });

  it('all three screens have a Back fallback', () => {
    for (const src of [layoutEditor, pages, page]) {
      expect(src).toContain('router.canGoBack()');
      expect(src).not.toContain('onPress={() => router.back()}');
    }
  });
});

describe('Invite share sheet copy/share fail honest', () => {
  it('claims Copied only after the clipboard write succeeded, and says so on failure', () => {
    expect(inviteShare).toMatch(/try \{\s*\n\s*await Clipboard\.setStringAsync/u);
    expect(inviteShare).toContain("'Could not copy'");
  });

  it('a rejected share sheet renders a notice instead of dying unhandled', () => {
    expect(inviteShare).toContain('Could not open the share sheet.');
  });
});
