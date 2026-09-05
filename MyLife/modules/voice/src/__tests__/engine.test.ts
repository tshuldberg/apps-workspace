import { describe, it, expect } from 'vitest';
import {
  calculateWordCount,
  calculateReadingTime,
  extractKeywords,
  summarizeText,
  formatDuration,
} from '../engine/text';
import {
  mergeShortSegments,
  assignSpeakerLabels,
  isMultiSpeaker,
  getSpeakerBreakdown,
  processDiarization,
  getSpeakerColor,
  SPEAKER_COLORS,
  type RawSpeakerSegment,
} from '../engine/speaker';
import {
  normalizePhrase,
  phraseToRegex,
  hasVariableSlots,
  matchCommand,
  PRESET_TEMPLATES,
} from '../engine/commands';
import {
  isValidBcp47,
  getBaseLanguage,
  getLanguageColor,
  mergeAdjacentLanguageSegments,
  calculateLanguageBreakdown,
  isMultiLanguage,
  validateProfileLanguages,
  processLanguageDetection,
  MAX_PROFILE_LANGUAGES,
  type RawLanguageSegment,
} from '../engine/language';

// ── Text Engine Tests ────────────────────────────────────────────────

describe('calculateWordCount', () => {
  it('counts words in a normal sentence', () => {
    expect(calculateWordCount('Hello world')).toBe(2);
  });

  it('returns 0 for empty string', () => {
    expect(calculateWordCount('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(calculateWordCount('   ')).toBe(0);
  });

  it('handles multiple spaces between words', () => {
    expect(calculateWordCount('one   two   three')).toBe(3);
  });

  it('counts single word', () => {
    expect(calculateWordCount('hello')).toBe(1);
  });
});

describe('calculateReadingTime', () => {
  it('returns 0 for empty text', () => {
    expect(calculateReadingTime('')).toBe(0);
  });

  it('returns 1 minute minimum for short text', () => {
    expect(calculateReadingTime('Hello world')).toBe(1);
  });

  it('calculates time for longer text', () => {
    const words = Array(400).fill('word').join(' ');
    expect(calculateReadingTime(words)).toBe(2);
  });

  it('rounds up to nearest minute', () => {
    const words = Array(201).fill('word').join(' ');
    expect(calculateReadingTime(words)).toBe(2);
  });
});

describe('extractKeywords', () => {
  it('returns empty array for empty text', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('filters stop words', () => {
    const keywords = extractKeywords('the cat is on the mat and the dog');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('is');
    expect(keywords).not.toContain('on');
    expect(keywords).not.toContain('and');
  });

  it('returns top N keywords by frequency', () => {
    const text = 'apple banana apple cherry apple banana';
    const keywords = extractKeywords(text, 2);
    expect(keywords).toHaveLength(2);
    expect(keywords[0]).toBe('apple');
    expect(keywords[1]).toBe('banana');
  });

  it('filters short words (length <= 2)', () => {
    const keywords = extractKeywords('I am so be to do go');
    expect(keywords).toHaveLength(0);
  });

  it('handles punctuation in text', () => {
    const keywords = extractKeywords('Hello, world! Hello again.');
    expect(keywords).toContain('hello');
  });
});

describe('summarizeText', () => {
  it('returns empty string for empty input', () => {
    expect(summarizeText('')).toBe('');
  });

  it('returns first N sentences', () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
    const summary = summarizeText(text, 2);
    expect(summary).toBe('First sentence. Second sentence.');
  });

  it('returns all text if fewer sentences than requested', () => {
    const text = 'Only one sentence.';
    expect(summarizeText(text, 3)).toBe('Only one sentence.');
  });

  it('defaults to 3 sentences', () => {
    const text = 'One. Two. Three. Four. Five.';
    const summary = summarizeText(text);
    expect(summary).toBe('One. Two. Three.');
  });
});

describe('formatDuration', () => {
  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(83)).toBe('1m 23s');
  });

  it('formats exact minutes', () => {
    expect(formatDuration(120)).toBe('2m');
  });

  it('formats large durations', () => {
    expect(formatDuration(3661)).toBe('61m 1s');
  });

  it('handles negative values', () => {
    expect(formatDuration(-5)).toBe('0s');
  });
});

// ── Speaker Engine Tests ─────────────────────────────────────────────

describe('Speaker Engine', () => {
  const twoSpeakerSegments: RawSpeakerSegment[] = [
    { speakerLabel: 'raw_0', startSeconds: 0, endSeconds: 10, text: 'Hello from speaker one', confidence: 0.9 },
    { speakerLabel: 'raw_1', startSeconds: 10, endSeconds: 20, text: 'Response from speaker two', confidence: 0.85 },
    { speakerLabel: 'raw_0', startSeconds: 20, endSeconds: 30, text: 'Back to speaker one', confidence: 0.88 },
  ];

  describe('assignSpeakerLabels', () => {
    it('assigns sequential labels to distinct speakers', () => {
      const labeled = assignSpeakerLabels(twoSpeakerSegments);
      expect(labeled[0].speakerLabel).toBe('Speaker 1');
      expect(labeled[1].speakerLabel).toBe('Speaker 2');
      expect(labeled[2].speakerLabel).toBe('Speaker 1');
    });

    it('handles single-speaker input', () => {
      const single: RawSpeakerSegment[] = [
        { speakerLabel: 'raw_0', startSeconds: 0, endSeconds: 30, text: 'Solo', confidence: 0.95 },
      ];
      const labeled = assignSpeakerLabels(single);
      expect(labeled[0].speakerLabel).toBe('Speaker 1');
    });
  });

  describe('mergeShortSegments', () => {
    it('preserves short segments from different speakers', () => {
      const segments: RawSpeakerSegment[] = [
        { speakerLabel: 'Speaker 1', startSeconds: 0, endSeconds: 10, text: 'Long segment', confidence: 0.9 },
        { speakerLabel: 'Speaker 2', startSeconds: 10, endSeconds: 10.5, text: 'um', confidence: 0.5 },
        { speakerLabel: 'Speaker 1', startSeconds: 10.5, endSeconds: 20, text: 'Continue', confidence: 0.9 },
      ];
      const merged = mergeShortSegments(segments);
      // Short segments from a different speaker must NOT be merged
      // to avoid corrupting speaker attribution
      expect(merged).toHaveLength(3);
      expect(merged[1].speakerLabel).toBe('Speaker 2');
    });

    it('merges adjacent segments with same speaker', () => {
      const segments: RawSpeakerSegment[] = [
        { speakerLabel: 'Speaker 1', startSeconds: 0, endSeconds: 10, text: 'Part 1', confidence: 0.9 },
        { speakerLabel: 'Speaker 1', startSeconds: 10, endSeconds: 20, text: 'Part 2', confidence: 0.85 },
      ];
      const merged = mergeShortSegments(segments);
      expect(merged).toHaveLength(1);
      expect(merged[0].text).toBe('Part 1 Part 2');
      expect(merged[0].endSeconds).toBe(20);
    });

    it('returns empty array for empty input', () => {
      expect(mergeShortSegments([])).toEqual([]);
    });

    it('returns single segment unchanged', () => {
      const single: RawSpeakerSegment[] = [
        { speakerLabel: 'Speaker 1', startSeconds: 0, endSeconds: 10, text: 'Solo', confidence: 0.9 },
      ];
      expect(mergeShortSegments(single)).toHaveLength(1);
    });
  });

  describe('isMultiSpeaker', () => {
    it('returns true for multiple speakers', () => {
      expect(isMultiSpeaker(twoSpeakerSegments)).toBe(true);
    });

    it('returns false for single speaker', () => {
      const single: RawSpeakerSegment[] = [
        { speakerLabel: 'Speaker 1', startSeconds: 0, endSeconds: 30, text: 'Solo', confidence: 0.9 },
      ];
      expect(isMultiSpeaker(single)).toBe(false);
    });
  });

  describe('getSpeakerBreakdown', () => {
    it('calculates breakdown by speaker', () => {
      const breakdown = getSpeakerBreakdown(twoSpeakerSegments);
      expect(breakdown).toHaveLength(2);
      expect(breakdown[0].speakerLabel).toBe('raw_0');
      expect(breakdown[0].totalSeconds).toBe(20);
      expect(breakdown[0].segmentCount).toBe(2);
      expect(breakdown[1].speakerLabel).toBe('raw_1');
      expect(breakdown[1].totalSeconds).toBe(10);
    });
  });

  describe('processDiarization', () => {
    it('labels and merges in one pass', () => {
      const result = processDiarization(twoSpeakerSegments);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].speakerLabel).toMatch(/^Speaker \d+$/);
    });

    it('returns empty for empty input', () => {
      expect(processDiarization([])).toEqual([]);
    });
  });

  describe('getSpeakerColor', () => {
    it('returns colors from the palette', () => {
      expect(getSpeakerColor(0)).toBe(SPEAKER_COLORS[0]);
      expect(getSpeakerColor(1)).toBe(SPEAKER_COLORS[1]);
    });

    it('wraps around for large indices', () => {
      expect(getSpeakerColor(10)).toBe(SPEAKER_COLORS[0]);
    });
  });
});

// ── Command Engine Tests ─────────────────────────────────────────────

describe('Command Engine', () => {
  describe('normalizePhrase', () => {
    it('lowercases and trims', () => {
      expect(normalizePhrase('  Hello World  ')).toBe('hello world');
    });

    it('strips special characters', () => {
      expect(normalizePhrase('Hello, World!')).toBe('hello world');
    });

    it('collapses multiple spaces', () => {
      expect(normalizePhrase('hello   world')).toBe('hello world');
    });
  });

  describe('hasVariableSlots', () => {
    it('detects slots in phrase', () => {
      expect(hasVariableSlots('Add [item] to list')).toBe(true);
    });

    it('returns false for no slots', () => {
      expect(hasVariableSlots('Start fasting')).toBe(false);
    });
  });

  describe('phraseToRegex', () => {
    it('creates regex with named capture groups for slots', () => {
      const regex = phraseToRegex('Add expense [amount]');
      const match = regex.exec('add expense 50');
      expect(match).not.toBeNull();
      expect(match!.groups!.amount).toBe('50');
    });

    it('matches exact phrases without slots', () => {
      const regex = phraseToRegex('Start fasting');
      expect(regex.test('start fasting')).toBe(true);
      expect(regex.test('start fasting now')).toBe(false);
    });
  });

  describe('matchCommand', () => {
    const commands = [
      { id: 'c1', phrase: 'Start fasting', action: 'start_fast', moduleTarget: 'fast', params: null, priority: 0, isEnabled: true },
      { id: 'c2', phrase: 'End my fast', action: 'end_fast', moduleTarget: 'fast', params: null, priority: 0, isEnabled: true },
      { id: 'c3', phrase: 'Add expense [amount]', action: 'add_expense', moduleTarget: 'budget', params: null, priority: 0, isEnabled: true },
      { id: 'c4', phrase: 'Start fasting', action: 'start_fast_v2', moduleTarget: 'fast', params: null, priority: 5, isEnabled: true },
      { id: 'c5', phrase: 'Disabled command', action: 'noop', moduleTarget: null, params: null, priority: 0, isEnabled: false },
    ];

    it('exact phrase match returns correct command', () => {
      const result = matchCommand('start fasting', commands);
      expect(result).not.toBeNull();
      expect(result!.action).toBe('start_fast_v2'); // Higher priority wins
    });

    it('case-insensitive matching works', () => {
      const result = matchCommand('END MY FAST', commands);
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('c2');
    });

    it('priority field breaks ties', () => {
      const result = matchCommand('start fasting', commands);
      expect(result).not.toBeNull();
      expect(result!.commandId).toBe('c4'); // priority 5 > priority 0
    });

    it('disabled commands are excluded', () => {
      const result = matchCommand('disabled command', commands);
      expect(result).toBeNull();
    });

    it('variable slot extraction works', () => {
      const result = matchCommand('add expense 50', commands);
      expect(result).not.toBeNull();
      expect(result!.extractedSlots.amount).toBe('50');
      expect(result!.confidence).toBe(0.9);
    });

    it('no match returns null', () => {
      const result = matchCommand('something random', commands);
      expect(result).toBeNull();
    });

    it('empty phrase returns null', () => {
      const result = matchCommand('', commands);
      expect(result).toBeNull();
    });

    it('empty command list returns null', () => {
      const result = matchCommand('start fasting', []);
      expect(result).toBeNull();
    });
  });

  describe('PRESET_TEMPLATES', () => {
    it('has 10 preset templates', () => {
      expect(PRESET_TEMPLATES).toHaveLength(10);
    });

    it('each template has required fields', () => {
      for (const t of PRESET_TEMPLATES) {
        expect(t.phrase).toBeTruthy();
        expect(t.action).toBeTruthy();
        expect(t.moduleTarget).toBeTruthy();
      }
    });
  });
});

// ── Language Engine Tests ────────────────────────────────────────────

describe('Language Engine', () => {
  describe('isValidBcp47', () => {
    it('validates correct codes', () => {
      expect(isValidBcp47('en-US')).toBe(true);
      expect(isValidBcp47('es-MX')).toBe(true);
      expect(isValidBcp47('zh-CN')).toBe(true);
    });

    it('validates base codes without region', () => {
      expect(isValidBcp47('en')).toBe(true);
      expect(isValidBcp47('es')).toBe(true);
    });

    it('rejects invalid codes', () => {
      expect(isValidBcp47('')).toBe(false);
      expect(isValidBcp47('english')).toBe(false);
      expect(isValidBcp47('e')).toBe(false);
      expect(isValidBcp47('en-us')).toBe(false); // region must be uppercase
    });
  });

  describe('getBaseLanguage', () => {
    it('extracts base from BCP 47', () => {
      expect(getBaseLanguage('en-US')).toBe('en');
      expect(getBaseLanguage('zh-CN')).toBe('zh');
    });

    it('returns base code as-is', () => {
      expect(getBaseLanguage('en')).toBe('en');
    });
  });

  describe('getLanguageColor', () => {
    it('returns correct colors for known languages', () => {
      expect(getLanguageColor('en-US')).toBe('#60A5FA');
      expect(getLanguageColor('es-MX')).toBe('#F97316');
    });

    it('returns gray fallback for unknown languages', () => {
      expect(getLanguageColor('xx-XX')).toBe('#9CA3AF');
    });
  });

  describe('mergeAdjacentLanguageSegments', () => {
    it('merges adjacent segments with same base language', () => {
      const segments: RawLanguageSegment[] = [
        { language: 'en-US', startSeconds: 0, endSeconds: 10, text: 'Hello', confidence: 0.9 },
        { language: 'en-GB', startSeconds: 10, endSeconds: 20, text: 'World', confidence: 0.85 },
      ];
      const merged = mergeAdjacentLanguageSegments(segments);
      expect(merged).toHaveLength(1);
      expect(merged[0].text).toBe('Hello World');
      expect(merged[0].endSeconds).toBe(20);
    });

    it('keeps separate segments for different languages', () => {
      const segments: RawLanguageSegment[] = [
        { language: 'en-US', startSeconds: 0, endSeconds: 10, text: 'Hello', confidence: 0.9 },
        { language: 'es-MX', startSeconds: 10, endSeconds: 20, text: 'Hola', confidence: 0.85 },
      ];
      const merged = mergeAdjacentLanguageSegments(segments);
      expect(merged).toHaveLength(2);
    });

    it('returns empty for empty input', () => {
      expect(mergeAdjacentLanguageSegments([])).toEqual([]);
    });

    it('returns single segment unchanged', () => {
      const segments: RawLanguageSegment[] = [
        { language: 'en-US', startSeconds: 0, endSeconds: 10, text: 'Solo', confidence: 0.9 },
      ];
      expect(mergeAdjacentLanguageSegments(segments)).toHaveLength(1);
    });
  });

  describe('calculateLanguageBreakdown', () => {
    it('calculates percentages correctly', () => {
      const segments: RawLanguageSegment[] = [
        { language: 'en-US', startSeconds: 0, endSeconds: 65, text: 'English', confidence: 0.9 },
        { language: 'es-MX', startSeconds: 65, endSeconds: 100, text: 'Spanish', confidence: 0.85 },
      ];
      const breakdown = calculateLanguageBreakdown(segments);
      expect(breakdown).toHaveLength(2);
      expect(breakdown[0].language).toBe('en');
      expect(breakdown[0].percentage).toBe(65);
      expect(breakdown[1].language).toBe('es');
      expect(breakdown[1].percentage).toBe(35);
    });

    it('handles single language (100%)', () => {
      const segments: RawLanguageSegment[] = [
        { language: 'en-US', startSeconds: 0, endSeconds: 30, text: 'All English', confidence: 0.95 },
      ];
      const breakdown = calculateLanguageBreakdown(segments);
      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].percentage).toBe(100);
    });

    it('returns empty for empty input', () => {
      expect(calculateLanguageBreakdown([])).toEqual([]);
    });
  });

  describe('isMultiLanguage', () => {
    it('returns true for multiple languages', () => {
      const segments: RawLanguageSegment[] = [
        { language: 'en-US', startSeconds: 0, endSeconds: 10, text: 'Hi', confidence: 0.9 },
        { language: 'es-MX', startSeconds: 10, endSeconds: 20, text: 'Hola', confidence: 0.85 },
      ];
      expect(isMultiLanguage(segments)).toBe(true);
    });

    it('returns false for single language', () => {
      const segments: RawLanguageSegment[] = [
        { language: 'en-US', startSeconds: 0, endSeconds: 10, text: 'Hi', confidence: 0.9 },
        { language: 'en-GB', startSeconds: 10, endSeconds: 20, text: 'Hello', confidence: 0.85 },
      ];
      expect(isMultiLanguage(segments)).toBe(false); // Same base language
    });
  });

  describe('validateProfileLanguages', () => {
    it('returns null for valid profiles', () => {
      expect(validateProfileLanguages(['en-US', 'es-MX'])).toBeNull();
    });

    it('rejects empty array', () => {
      expect(validateProfileLanguages([])).toBe('At least one language is required');
    });

    it('rejects more than max languages', () => {
      const tooMany = Array.from({ length: MAX_PROFILE_LANGUAGES + 1 }, (_, i) => `en-U${i}`);
      expect(validateProfileLanguages(tooMany)).toContain('Maximum');
    });

    it('rejects invalid BCP 47 codes', () => {
      expect(validateProfileLanguages(['english'])).toContain('Invalid');
    });
  });

  describe('processLanguageDetection', () => {
    it('merges adjacent same-language segments', () => {
      const segments: RawLanguageSegment[] = [
        { language: 'en-US', startSeconds: 0, endSeconds: 10, text: 'Part 1', confidence: 0.9 },
        { language: 'en-US', startSeconds: 10, endSeconds: 20, text: 'Part 2', confidence: 0.85 },
        { language: 'es-MX', startSeconds: 20, endSeconds: 30, text: 'Spanish', confidence: 0.88 },
      ];
      const result = processLanguageDetection(segments);
      expect(result).toHaveLength(2);
    });

    it('returns empty for empty input', () => {
      expect(processLanguageDetection([])).toEqual([]);
    });
  });
});
