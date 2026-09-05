import { describe, it, expect } from 'vitest';
import {
  checkExifData,
  runAiDetectionHeuristics,
} from '../photo-verification';

// ── checkExifData ───────────────────────────────────────────────────

describe('checkExifData', () => {
  it('returns hasOriginalExif true for a normal camera URL', () => {
    const result = checkExifData('https://uploads.example.com/photo-12345.jpg');
    expect(result.hasOriginalExif).toBe(true);
  });

  it('returns hasOriginalExif false for stock image URLs', () => {
    const result = checkExifData('https://stock-photos.com/food/pasta.jpg');
    expect(result.hasOriginalExif).toBe(false);
  });

  it('returns hasOriginalExif false for generated image URLs', () => {
    const result = checkExifData('https://ai.example.com/generated/dish.png');
    expect(result.hasOriginalExif).toBe(false);
  });

  it('detects GPS data from URL containing "geo"', () => {
    const result = checkExifData('https://uploads.example.com/geo-tagged-photo.jpg');
    expect(result.hasGpsData).toBe(true);
  });

  it('detects GPS data from URL containing "location"', () => {
    const result = checkExifData('https://uploads.example.com/location/photo.jpg');
    expect(result.hasGpsData).toBe(true);
  });

  it('returns hasGpsData false for URLs without geo indicators', () => {
    const result = checkExifData('https://uploads.example.com/photo.jpg');
    expect(result.hasGpsData).toBe(false);
  });

  it('extracts cameraMake from URL with camera pattern', () => {
    const result = checkExifData('https://uploads.example.com/camera-nikon/photo.jpg');
    expect(result.cameraMake).toBe('nikon');
  });

  it('extracts cameraMake with underscore separator', () => {
    const result = checkExifData('https://uploads.example.com/camera_canon/photo.jpg');
    expect(result.cameraMake).toBe('canon');
  });

  it('returns cameraMake null when no camera pattern found', () => {
    const result = checkExifData('https://uploads.example.com/photo.jpg');
    expect(result.cameraMake).toBeNull();
  });

  it('detects edited images from "edited" in URL', () => {
    const result = checkExifData('https://uploads.example.com/edited/photo.jpg');
    expect(result.isEdited).toBe(true);
  });

  it('detects edited images from "photoshop" in URL', () => {
    const result = checkExifData('https://uploads.example.com/photoshop-export.jpg');
    expect(result.isEdited).toBe(true);
  });

  it('detects edited images from "filtered" in URL', () => {
    const result = checkExifData('https://uploads.example.com/filtered/photo.jpg');
    expect(result.isEdited).toBe(true);
  });

  it('returns isEdited false for unedited URLs', () => {
    const result = checkExifData('https://uploads.example.com/photo.jpg');
    expect(result.isEdited).toBe(false);
  });

  it('confidence is higher with more authentic signals', () => {
    const authentic = checkExifData(
      'https://uploads.example.com/geo/camera-sony/photo.jpg',
    );
    const basic = checkExifData('https://uploads.example.com/photo.jpg');
    expect(authentic.confidence).toBeGreaterThan(basic.confidence);
  });

  it('confidence decreases for edited images', () => {
    const unedited = checkExifData('https://uploads.example.com/photo.jpg');
    const edited = checkExifData('https://uploads.example.com/edited/photo.jpg');
    expect(edited.confidence).toBeLessThan(unedited.confidence);
  });

  it('confidence is clamped between 0 and 1', () => {
    // Stock + edited should not go below 0
    const worst = checkExifData('https://stock-photos.com/edited/filtered/photoshop.jpg');
    expect(worst.confidence).toBeGreaterThanOrEqual(0);
    expect(worst.confidence).toBeLessThanOrEqual(1);

    // All positive signals should not exceed 1
    const best = checkExifData(
      'https://uploads.example.com/geo/location/camera-nikon/photo.jpg',
    );
    expect(best.confidence).toBeGreaterThanOrEqual(0);
    expect(best.confidence).toBeLessThanOrEqual(1);
  });

  it('returns correct structure shape', () => {
    const result = checkExifData('https://example.com/photo.jpg');
    expect(result).toHaveProperty('hasOriginalExif');
    expect(result).toHaveProperty('hasGpsData');
    expect(result).toHaveProperty('cameraMake');
    expect(result).toHaveProperty('isEdited');
    expect(result).toHaveProperty('confidence');
    expect(typeof result.confidence).toBe('number');
  });
});

// ── runAiDetectionHeuristics ────────────────────────────────────────

describe('runAiDetectionHeuristics', () => {
  it('returns correct structure shape', () => {
    const result = runAiDetectionHeuristics('https://example.com/photo.jpg');
    expect(result).toHaveProperty('isLikelyAiGenerated');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('signals');
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('detects dalle keyword in URL', () => {
    const result = runAiDetectionHeuristics('https://example.com/dalle-output.png');
    expect(result.isLikelyAiGenerated).toBe(true);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('detects midjourney keyword in URL', () => {
    const result = runAiDetectionHeuristics('https://cdn.midjourney.com/image.png');
    expect(result.isLikelyAiGenerated).toBe(true);
  });

  it('detects stable-diffusion keyword in URL', () => {
    const result = runAiDetectionHeuristics(
      'https://example.com/stable-diffusion/output.png',
    );
    expect(result.isLikelyAiGenerated).toBe(true);
  });

  it('detects "generated" keyword in URL', () => {
    const result = runAiDetectionHeuristics('https://example.com/generated/food.png');
    expect(result.isLikelyAiGenerated).toBe(true);
  });

  it('detects ai-image keyword in URL', () => {
    const result = runAiDetectionHeuristics('https://example.com/ai-image-food.png');
    expect(result.isLikelyAiGenerated).toBe(true);
  });

  it('returns not AI-generated for normal photo URLs', () => {
    const result = runAiDetectionHeuristics('https://uploads.example.com/photo.jpg');
    expect(result.isLikelyAiGenerated).toBe(false);
    expect(result.signals).toHaveLength(0);
  });

  it('adds signal for common AI output dimensions', () => {
    const result = runAiDetectionHeuristics('https://example.com/1024x1024/image.png');
    expect(result.signals).toContain(
      'Resolution matches common AI output dimensions',
    );
  });

  it('adds signal for 512x512 dimensions', () => {
    const result = runAiDetectionHeuristics('https://example.com/512x512/image.png');
    expect(result.signals).toContain(
      'Resolution matches common AI output dimensions',
    );
  });

  it('higher confidence when AI keywords found', () => {
    const ai = runAiDetectionHeuristics('https://example.com/dalle/food.png');
    const normal = runAiDetectionHeuristics('https://uploads.example.com/photo.jpg');
    expect(ai.confidence).toBeGreaterThan(normal.confidence);
  });

  it('is case-insensitive for keyword detection', () => {
    const result = runAiDetectionHeuristics('https://example.com/DALLE-Output.png');
    expect(result.isLikelyAiGenerated).toBe(true);
  });

  it('can detect multiple AI signals in one URL', () => {
    const result = runAiDetectionHeuristics(
      'https://example.com/dalle/generated/1024x1024.png',
    );
    expect(result.signals.length).toBeGreaterThanOrEqual(2);
  });
});
