import { describe, expect, it } from 'vitest';
import { buildLanguageCourseLink } from '../integrations/words-bridge';

describe('buildLanguageCourseLink', () => {
  it('detects spanish from SPAN code', () => {
    const link = buildLanguageCourseLink({
      id: 'c1',
      name: 'Intro Spanish',
      code: 'SPAN 101',
    });
    expect(link.languageHint).toBe('spanish');
    expect(link.classId).toBe('c1');
  });

  it('detects from name keyword when code is non-language', () => {
    const link = buildLanguageCourseLink({
      id: 'c2',
      name: 'Conversational French',
      code: 'LANG 200',
    });
    expect(link.languageHint).toBe('french');
  });

  it('returns null hint for non-language classes', () => {
    const link = buildLanguageCourseLink({
      id: 'c3',
      name: 'Algorithms',
      code: 'CS 401',
    });
    expect(link.languageHint).toBeNull();
  });

  it('detects mandarin maps to chinese', () => {
    const link = buildLanguageCourseLink({
      id: 'c4',
      name: 'Mandarin Basics',
      code: null,
    });
    expect(link.languageHint).toBe('chinese');
  });

  it('handles null code gracefully', () => {
    const link = buildLanguageCourseLink({
      id: 'c5',
      name: 'Latin I',
      code: null,
    });
    expect(link.languageHint).toBe('latin');
  });
});
