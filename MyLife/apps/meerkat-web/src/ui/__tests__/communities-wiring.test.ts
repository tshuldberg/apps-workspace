// Source locks for the Set-2 Communities hardening (PROMPT-003), web side.
// Pins the fail-honest wiring: a thrown create surfaces (the template path
// already did; the from-scratch path silently died), the photo file read is
// caught, "copied" is claimed only after the clipboard write resolves, and
// copy-forward busy state is per-design so one tap cannot make every row
// claim the in-flight verb.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(__dirname, '..', 'community');
const createDialog = readFileSync(join(dir, 'CreateCommunityDialog.tsx'), 'utf8');
const settings = readFileSync(join(dir, 'CommunitySettings.tsx'), 'utf8');
const layoutEditor = readFileSync(join(dir, 'LayoutEditorSection.tsx'), 'utf8');
const memberProfile = readFileSync(join(dir, 'MemberProfileView.tsx'), 'utf8');

describe('CreateCommunityDialog fails honest', () => {
  it('a thrown createCommunity renders the error instead of dying unhandled', () => {
    expect(createDialog).toMatch(/try \{\s*\n\s*signed = m\.createCommunity/u);
    expect(createDialog).toContain("'Could not create the community.'");
  });
});

describe('CommunitySettings photo picker fails honest', () => {
  it('a thrown file read surfaces instead of an idle-looking dead tap', () => {
    expect(settings).toContain("'Could not open your photos. Try again.'");
  });
});

describe('Layout editor template copy is claimed only after the write resolves', () => {
  it('awaits the clipboard write and renders the honest failure', () => {
    expect(layoutEditor).toMatch(/await navigator\.clipboard\.writeText\(buildLayoutDeepLink/u);
    expect(layoutEditor).toContain("'Could not copy the template.'");
  });
});

describe('Member profile copy-forward busy state is per-design', () => {
  it('only the tapped design row reads Copying', () => {
    expect(memberProfile).toContain('busyCanvasId === design.canvas.id');
    expect(memberProfile).toContain('if (busyCanvasId !== null) return;');
  });
});
