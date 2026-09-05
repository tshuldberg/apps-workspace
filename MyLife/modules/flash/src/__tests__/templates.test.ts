import { describe, it, expect } from 'vitest';
import {
  renderCardContent,
  extractPlaceholders,
  validateTemplateInput,
  sanitizeFieldName,
  buildFieldDefaults,
} from '../templates/engine';

describe('templates engine', () => {
  describe('renderCardContent', () => {
    it('replaces single placeholder', () => {
      expect(renderCardContent('{{Front}}', { Front: 'Hello' })).toBe('Hello');
    });
    it('replaces multiple placeholders', () => {
      expect(renderCardContent('{{Front}} - {{Back}}', { Front: 'A', Back: 'B' })).toBe('A - B');
    });
    it('handles missing fields as empty string', () => {
      expect(renderCardContent('{{Missing}}', {})).toBe('');
    });
    it('replaces all occurrences of same placeholder', () => {
      expect(renderCardContent('{{Front}} and {{Front}}', { Front: 'X' })).toBe('X and X');
    });
    it('preserves text without placeholders', () => {
      expect(renderCardContent('No placeholders here', {})).toBe('No placeholders here');
    });
    it('handles empty format', () => {
      expect(renderCardContent('', { Front: 'X' })).toBe('');
    });
  });

  describe('extractPlaceholders', () => {
    it('extracts unique placeholder names', () => {
      expect(extractPlaceholders('{{Front}} and {{Back}}')).toEqual(['Front', 'Back']);
    });
    it('deduplicates repeated names', () => {
      expect(extractPlaceholders('{{A}} {{A}} {{B}}')).toEqual(['A', 'B']);
    });
    it('returns empty for no placeholders', () => {
      expect(extractPlaceholders('no placeholders')).toEqual([]);
    });
  });

  describe('validateTemplateInput', () => {
    it('returns null for valid input', () => {
      expect(validateTemplateInput({
        name: 'Test',
        frontFormat: '{{Front}}',
        backFormat: '{{Back}}',
        fields: [{ name: 'Front' }, { name: 'Back' }],
      })).toBeNull();
    });
    it('rejects empty name', () => {
      expect(validateTemplateInput({
        name: '',
        frontFormat: '{{F}}',
        backFormat: '{{B}}',
        fields: [{ name: 'F' }, { name: 'B' }],
      })).toBeTruthy();
    });
    it('rejects fewer than 2 fields', () => {
      expect(validateTemplateInput({
        name: 'Test',
        frontFormat: '{{F}}',
        backFormat: '{{B}}',
        fields: [{ name: 'F' }],
      })).toBeTruthy();
    });
    it('rejects duplicate field names', () => {
      expect(validateTemplateInput({
        name: 'Test',
        frontFormat: '{{F}}',
        backFormat: '{{F}}',
        fields: [{ name: 'Front' }, { name: 'front' }],
      })).toContain('Duplicate');
    });
    it('rejects fields with {{ in name', () => {
      expect(validateTemplateInput({
        name: 'Test',
        frontFormat: '{{F}}',
        backFormat: '{{B}}',
        fields: [{ name: '{{bad}}' }, { name: 'ok' }],
      })).toBeTruthy();
    });
  });

  describe('sanitizeFieldName', () => {
    it('strips special characters', () => {
      expect(sanitizeFieldName('hello@world!')).toBe('helloworld');
    });
    it('keeps alphanumeric, spaces, hyphens, underscores', () => {
      expect(sanitizeFieldName('Field Name_1-test')).toBe('Field Name_1-test');
    });
  });

  describe('buildFieldDefaults', () => {
    it('creates empty record for all fields', () => {
      expect(buildFieldDefaults([{ name: 'A' }, { name: 'B' }])).toEqual({ A: '', B: '' });
    });
  });
});
