import { describe, it, expect } from 'vitest';
import { isPhotoAnalysisError } from '../ai/photo-log';
import { buildUserPrompt, FOOD_IDENTIFICATION_SYSTEM_PROMPT } from '../ai/prompts';

describe('AI photo logging', () => {
  describe('prompts', () => {
    it('system prompt mentions JSON array output', () => {
      expect(FOOD_IDENTIFICATION_SYSTEM_PROMPT).toContain('JSON array');
    });

    it('builds user prompt without context', () => {
      expect(buildUserPrompt()).toBe('Identify all foods in this photo.');
    });

    it('builds user prompt with context', () => {
      const prompt = buildUserPrompt('this is my lunch');
      expect(prompt).toContain('this is my lunch');
    });
  });

  describe('analyzePhotoForFoods', () => {
    it('returns no_api_key error when key is empty', async () => {
      const { analyzePhotoForFoods } = await import('../ai/photo-log');
      const result = await analyzePhotoForFoods('base64data', '');
      expect(isPhotoAnalysisError(result)).toBe(true);
      if (isPhotoAnalysisError(result)) {
        expect(result.type).toBe('no_api_key');
      }
    });

    it('returns invalid_image error for empty image', async () => {
      const { analyzePhotoForFoods } = await import('../ai/photo-log');
      const result = await analyzePhotoForFoods('', 'sk-test');
      expect(isPhotoAnalysisError(result)).toBe(true);
      if (isPhotoAnalysisError(result)) {
        expect(result.type).toBe('invalid_image');
      }
    });
  });

  describe('isPhotoAnalysisError', () => {
    it('returns true for error objects', () => {
      expect(isPhotoAnalysisError({ type: 'network', message: 'fail' })).toBe(true);
    });

    it('returns false for success results', () => {
      expect(isPhotoAnalysisError({ foods: [], rawResponse: '[]', imageUri: '' })).toBe(false);
    });
  });
});
