import { describe, expect, it } from 'vitest';
import {
  buildRecordingPath,
  shouldAutoStop,
  isFileSizeExceeded,
  insertTranscription,
  handleEmptyTranscription,
  handlePartialTranscription,
} from '../recorder';
import { processTranscriptionResult } from '../transcriber';
import { DEFAULT_RECORDING_CONFIG, MAX_AUDIO_SIZE_BYTES } from '../types';

describe('buildRecordingPath', () => {
  it('constructs correct file path from components', () => {
    const path = buildRecordingPath('/data', 'entry-1', 'rec-abc');
    expect(path).toBe('/data/jn_voice/entry-1/rec-abc.aac');
  });

  it('handles different base directories', () => {
    const path = buildRecordingPath('/Users/trey/Documents', 'e2', 'r3');
    expect(path).toBe('/Users/trey/Documents/jn_voice/e2/r3.aac');
  });
});

describe('shouldAutoStop', () => {
  it('returns false below max duration', () => {
    expect(shouldAutoStop(0)).toBe(false);
    expect(shouldAutoStop(300_000)).toBe(false);
    expect(shouldAutoStop(599_999)).toBe(false);
  });

  it('returns true at exactly max duration (10 minutes)', () => {
    expect(shouldAutoStop(DEFAULT_RECORDING_CONFIG.maxDurationMs)).toBe(true);
  });

  it('returns true above max duration', () => {
    expect(shouldAutoStop(700_000)).toBe(true);
  });
});

describe('isFileSizeExceeded', () => {
  it('returns false for small files', () => {
    expect(isFileSizeExceeded(0)).toBe(false);
    expect(isFileSizeExceeded(4_700_000)).toBe(false); // ~10 min AAC at 64kbps
  });

  it('returns false at exactly max size', () => {
    expect(isFileSizeExceeded(MAX_AUDIO_SIZE_BYTES)).toBe(false);
  });

  it('returns true above max size', () => {
    expect(isFileSizeExceeded(MAX_AUDIO_SIZE_BYTES + 1)).toBe(true);
  });
});

describe('insertTranscription', () => {
  it('appends text to empty body', () => {
    expect(insertTranscription('', 'Hello world')).toBe('Hello world');
  });

  it('appends as new paragraph to existing body', () => {
    const result = insertTranscription('Existing text.', 'New paragraph.');
    expect(result).toBe('Existing text.\n\nNew paragraph.');
  });

  it('inserts at cursor position in the middle', () => {
    // insertTranscription trims the input, so leading/trailing spaces are removed
    const result = insertTranscription('Hello world', 'beautiful', 5);
    expect(result).toBe('Hellobeautiful world');
  });

  it('appends when cursor is at end (treated as append)', () => {
    const result = insertTranscription('Hello', 'there', 5);
    expect(result).toBe('Hello\n\nthere');
  });

  it('returns original body when transcription is empty', () => {
    expect(insertTranscription('Existing text.', '')).toBe('Existing text.');
    expect(insertTranscription('Existing text.', '   ')).toBe('Existing text.');
  });

  it('handles multiple recordings appended', () => {
    let body = 'First paragraph.';
    body = insertTranscription(body, 'Second recording.');
    body = insertTranscription(body, 'Third recording.');
    expect(body).toBe('First paragraph.\n\nSecond recording.\n\nThird recording.');
  });
});

describe('handleEmptyTranscription', () => {
  it('returns placeholder text', () => {
    expect(handleEmptyTranscription()).toBe('[No speech detected]');
  });
});

describe('handlePartialTranscription', () => {
  it('appends incomplete marker to partial text', () => {
    expect(handlePartialTranscription('I was saying')).toBe(
      'I was saying [transcription incomplete]',
    );
  });
});

describe('processTranscriptionResult', () => {
  it('returns placeholder for null result', () => {
    expect(processTranscriptionResult(null)).toBe('[No speech detected]');
  });

  it('returns placeholder for empty text', () => {
    expect(processTranscriptionResult({ text: '', isPartial: false })).toBe(
      '[No speech detected]',
    );
  });

  it('returns trimmed text for complete result', () => {
    expect(processTranscriptionResult({ text: '  Hello world  ', isPartial: false })).toBe(
      'Hello world',
    );
  });

  it('appends incomplete marker for partial result', () => {
    expect(processTranscriptionResult({ text: 'I was', isPartial: true })).toBe(
      'I was [transcription incomplete]',
    );
  });
});
