import type { YearnIntroMessageCiphertext } from './yearnIntroMessage';

export const YEARN_INTRO_NOTE_MAX_LENGTH = 300;

export interface YearnIntroNoteState {
  characterCount: number;
  remaining: number;
  isAtLimit: boolean;
  counterLabel: string;
}

export interface YearnLikeSendPayload {
  profileId: string;
  intro: string | null;
  introCiphertext: YearnIntroMessageCiphertext | null;
}

export function countYearnIntroCharacters(value: string): number {
  return Array.from(value).length;
}

export function clampYearnIntroNoteDraft(value: string): string {
  const characters = Array.from(value);
  if (characters.length <= YEARN_INTRO_NOTE_MAX_LENGTH) return value;
  return characters.slice(0, YEARN_INTRO_NOTE_MAX_LENGTH).join('');
}

export function normalizeYearnIntroNote(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  if (!normalized) return null;

  if (countYearnIntroCharacters(normalized) > YEARN_INTRO_NOTE_MAX_LENGTH) {
    throw new Error(`Intro must be ${YEARN_INTRO_NOTE_MAX_LENGTH} characters or fewer.`);
  }

  return normalized;
}

export function getYearnIntroNoteState(value: string): YearnIntroNoteState {
  const characterCount = countYearnIntroCharacters(value);
  const remaining = Math.max(YEARN_INTRO_NOTE_MAX_LENGTH - characterCount, 0);

  return {
    characterCount,
    remaining,
    isAtLimit: remaining === 0,
    counterLabel: `${characterCount}/${YEARN_INTRO_NOTE_MAX_LENGTH}`,
  };
}

export function createYearnLikeSendPayload(
  profileId: string,
  introDraft: string,
): YearnLikeSendPayload {
  const intro = normalizeYearnIntroNote(introDraft);
  if (intro) {
    throw new Error('Plaintext intros are disabled. Send an encrypted intro envelope instead.');
  }

  return {
    profileId,
    intro: null,
    introCiphertext: null,
  };
}
