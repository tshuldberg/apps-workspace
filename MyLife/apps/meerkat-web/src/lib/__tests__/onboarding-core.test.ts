// Plan 31 P5 (web): onboarding v2 choice list + suggested name. Pure; the copy is
// byte-lockstep with the mobile source (parity guard).

import { describe, expect, it } from 'vitest';
import { ONBOARDING_START_ROWS, suggestedDisplayName } from '../onboarding-core';

describe('web onboarding v2 choice list', () => {
  it('offers exactly the four Step-2 choices, in order', () => {
    expect(ONBOARDING_START_ROWS.map((r) => r.option)).toEqual(['create', 'join', 'add_friend', 'browse']);
  });

  it('includes the zero-commitment browse row', () => {
    const browse = ONBOARDING_START_ROWS.find((r) => r.option === 'browse');
    expect(browse?.title).toBe('Just look around');
  });
});

describe('web suggestedDisplayName', () => {
  it('keeps a non-empty current name', () => {
    expect(suggestedDisplayName('  Ada  ')).toBe('Ada');
  });

  it('falls back to a friendly default when empty', () => {
    expect(suggestedDisplayName('')).toBe('My Meerkat');
    expect(suggestedDisplayName('   ')).toBe('My Meerkat');
  });
});
