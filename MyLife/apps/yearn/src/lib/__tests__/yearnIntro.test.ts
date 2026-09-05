import { describe, expect, it } from 'vitest';
import {
  YEARN_INTRO_NOTE_MAX_LENGTH,
  clampYearnIntroNoteDraft,
  countYearnIntroCharacters,
  createYearnLikeSendPayload,
  getYearnIntroNoteState,
  normalizeYearnIntroNote,
} from '../yearnIntro';

describe('yearnIntro', () => {
  it('normalizes empty and whitespace-only intro notes to null', () => {
    expect(normalizeYearnIntroNote(null)).toBeNull();
    expect(normalizeYearnIntroNote(undefined)).toBeNull();
    expect(normalizeYearnIntroNote('   ')).toBeNull();
  });

  it('trims intro notes without changing the middle of the message', () => {
    expect(normalizeYearnIntroNote('  Loved your bookstore prompt.\nTea sometime?  '))
      .toBe('Loved your bookstore prompt.\nTea sometime?');
  });

  it('enforces the 300-character intro note limit before sending', () => {
    expect(normalizeYearnIntroNote('a'.repeat(YEARN_INTRO_NOTE_MAX_LENGTH)))
      .toBe('a'.repeat(YEARN_INTRO_NOTE_MAX_LENGTH));
    expect(() => normalizeYearnIntroNote('a'.repeat(YEARN_INTRO_NOTE_MAX_LENGTH + 1)))
      .toThrow('Intro must be 300 characters or fewer.');
  });

  it('counts and clamps pasted drafts by characters', () => {
    expect(countYearnIntroCharacters('hi')).toBe(2);
    expect(clampYearnIntroNoteDraft('a'.repeat(305))).toHaveLength(300);
    expect(getYearnIntroNoteState('a'.repeat(300))).toEqual({
      characterCount: 300,
      remaining: 0,
      isAtLimit: true,
      counterLabel: '300/300',
    });
  });

  it('builds only no-intro deck like payloads on the plaintext-safe path', () => {
    expect(createYearnLikeSendPayload(
      '11111111-1111-1111-1111-111111111111',
      '',
    )).toEqual({
      profileId: '11111111-1111-1111-1111-111111111111',
      intro: null,
      introCiphertext: null,
    });

    expect(() => createYearnLikeSendPayload(
      '11111111-1111-1111-1111-111111111111',
      '  Your climbing photo made me smile.  ',
    )).toThrow('Plaintext intros are disabled. Send an encrypted intro envelope instead.');
  });
});
