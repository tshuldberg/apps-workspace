import { describe, expect, it } from 'vitest';

import { extractJson, validateBrainResult } from './schema.js';

describe('extractJson', () => {
  it('extracts a clean JSON object', () => {
    expect(extractJson('{"action":"none"}')).toBe('{"action":"none"}');
  });

  it('extracts JSON from surrounding prose', () => {
    expect(extractJson('Result follows: {"action":"chat"} thanks')).toBe(
      '{"action":"chat"}',
    );
  });

  it('tracks nested braces', () => {
    expect(extractJson('{"outer":{"inner":true}} trailing')).toBe(
      '{"outer":{"inner":true}}',
    );
  });

  it('ignores braces inside strings, including escaped quotes', () => {
    const value = '{"speak":"a } brace and \\\"{ quote","action":"chat"}';
    expect(extractJson(`${value} ignored`)).toBe(value);
  });

  it('returns null when the first object is unbalanced', () => {
    expect(extractJson('prefix {"action":"none"')).toBeNull();
    expect(extractJson('no object')).toBeNull();
  });
});

describe('validateBrainResult', () => {
  it('accepts a minimal none result and fills nullable fields', () => {
    expect(validateBrainResult({ action: 'none' })).toEqual({
      action: 'none',
      speak: null,
      prompt: null,
    });
  });

  it('accepts complete chat and prompt results', () => {
    expect(validateBrainResult({ action: 'chat', speak: 'Done', prompt: null })).toEqual({
      action: 'chat',
      speak: 'Done',
      prompt: null,
    });
    expect(
      validateBrainResult({ action: 'prompt', speak: 'Sending', prompt: 'Run tests' }),
    ).toEqual({ action: 'prompt', speak: 'Sending', prompt: 'Run tests' });
  });

  it('rejects unknown actions and wrongly typed fields', () => {
    expect(validateBrainResult({ action: 'sing' })).toBeNull();
    expect(validateBrainResult({ action: 'chat', speak: 42 })).toBeNull();
    expect(validateBrainResult(null)).toBeNull();
  });

  it('rejects prompt actions without a non-empty prompt', () => {
    expect(validateBrainResult({ action: 'prompt' })).toBeNull();
    expect(validateBrainResult({ action: 'prompt', prompt: '   ' })).toBeNull();
  });
});
