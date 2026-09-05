import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the imports used by video-import
vi.mock('../index', () => ({
  detectPlatform: vi.fn(),
  fetchSocialMetadata: vi.fn(),
  extractRecipeFromText: vi.fn(),
}));

import { importRecipeFromVideo } from '../video-import';
import { detectPlatform, fetchSocialMetadata, extractRecipeFromText } from '../index';

const mockDetect = vi.mocked(detectPlatform);
const mockFetchMeta = vi.mocked(fetchSocialMetadata);
const mockExtract = vi.mocked(extractRecipeFromText);

describe('importRecipeFromVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error for unsupported URL', async () => {
    mockDetect.mockReturnValue(null);
    const result = await importRecipeFromVideo('https://example.com', 'key');
    expect(result.error).toContain('Unsupported URL');
    expect(result.parsed).toBeNull();
  });

  it('returns ParsedRecipe for YouTube URL with recipe in description', async () => {
    mockDetect.mockReturnValue('youtube');
    mockFetchMeta.mockResolvedValue({
      platform: 'youtube',
      title: 'Easy Pasta Recipe',
      author: 'Chef Bob',
      thumbnailUrl: 'https://img.youtube.com/thumb.jpg',
      captionText: 'Ingredients: 1 lb pasta, 2 cups sauce. Steps: 1. Boil water. 2. Cook pasta.',
      originalUrl: 'https://youtube.com/watch?v=abc',
    });
    mockExtract.mockResolvedValue({
      title: 'Easy Pasta',
      ingredients: ['1 lb pasta', '2 cups sauce'],
      steps: ['Boil water', 'Cook pasta'],
    });

    const result = await importRecipeFromVideo('https://youtube.com/watch?v=abc', 'key');
    expect(result.parsed).not.toBeNull();
    expect(result.parsed!.title).toBe('Easy Pasta');
    expect(result.platform).toBe('youtube');
    expect(result.thumbnailUrl).toBe('https://img.youtube.com/thumb.jpg');
    expect(result.author).toBe('Chef Bob');
  });

  it('returns null parsed for video without recipe content', async () => {
    mockDetect.mockReturnValue('youtube');
    mockFetchMeta.mockResolvedValue({
      platform: 'youtube',
      title: 'Music Video',
      author: 'Artist',
      thumbnailUrl: 'https://img.youtube.com/thumb.jpg',
      captionText: 'Check out my new music video! Like and subscribe.',
      originalUrl: 'https://youtube.com/watch?v=xyz',
    });
    mockExtract.mockResolvedValue(null);

    const result = await importRecipeFromVideo('https://youtube.com/watch?v=xyz', 'key');
    expect(result.parsed).toBeNull();
  });

  it('attaches source_url and thumbnail to result', async () => {
    mockDetect.mockReturnValue('tiktok');
    mockFetchMeta.mockResolvedValue({
      platform: 'tiktok',
      title: 'Quick Recipe',
      author: 'TikTokChef',
      thumbnailUrl: 'https://tiktok.com/thumb.jpg',
      captionText: 'This is a recipe with many ingredients and steps listed in the description below.',
      originalUrl: 'https://tiktok.com/@user/video/123',
    });
    mockExtract.mockResolvedValue({
      title: 'Quick Recipe',
      ingredients: ['salt', 'pepper'],
      steps: ['Season well'],
    });

    const result = await importRecipeFromVideo('https://tiktok.com/@user/video/123', 'key');
    expect(result.sourceUrl).toBe('https://tiktok.com/@user/video/123');
    expect(result.thumbnailUrl).toBe('https://tiktok.com/thumb.jpg');
  });

  it('handles fetch metadata failure gracefully', async () => {
    mockDetect.mockReturnValue('youtube');
    mockFetchMeta.mockRejectedValue(new Error('Network error'));

    const result = await importRecipeFromVideo('https://youtube.com/watch?v=abc', 'key');
    expect(result.error).toContain('Could not access');
    expect(result.parsed).toBeNull();
  });

  it('handles AI extraction timeout gracefully', async () => {
    mockDetect.mockReturnValue('youtube');
    mockFetchMeta.mockResolvedValue({
      platform: 'youtube',
      title: 'Recipe Video',
      author: 'Chef',
      thumbnailUrl: null,
      captionText: 'Here is a long recipe description with ingredients and steps and more text content.',
      originalUrl: 'https://youtube.com/watch?v=abc',
    });
    mockExtract.mockRejectedValue(new Error('Timeout'));

    const result = await importRecipeFromVideo('https://youtube.com/watch?v=abc', 'key');
    expect(result.error).toContain('Could not find a recipe');
    expect(result.parsed).toBeNull();
  });

  it('returns error for too-short descriptions', async () => {
    mockDetect.mockReturnValue('tiktok');
    mockFetchMeta.mockResolvedValue({
      platform: 'tiktok',
      title: null,
      author: null,
      thumbnailUrl: null,
      captionText: 'Short',
      originalUrl: 'https://tiktok.com/@u/v/1',
    });

    const result = await importRecipeFromVideo('https://tiktok.com/@u/v/1', 'key');
    expect(result.error).toContain('Not enough content');
  });
});
