import { describe, it, expect } from 'vitest';
import { parseShareIntent, shareIntentAdapter } from '../share-intent';

describe('parseShareIntent', () => {
  it('parses a url-only payload into a candidate', () => {
    const candidate = parseShareIntent({ url: 'https://example.com/rooftop-party' });
    expect(candidate).not.toBeNull();
    expect(candidate!.sourceUrl).toBe('https://example.com/rooftop-party');
    expect(candidate!.rawText).toBe('https://example.com/rooftop-party');
  });

  it('parses a text-only payload and lifts date and venue', () => {
    const candidate = parseShareIntent({
      text: 'Rooftop Listening Party at The Standard\nJuly 4th 8pm',
    });
    expect(candidate).not.toBeNull();
    expect(candidate!.title).toContain('Rooftop Listening Party');
    expect(candidate!.startAt).toBeTruthy();
    expect(candidate!.venueName).toBe('The Standard');
  });

  it('returns null for an empty payload', () => {
    expect(parseShareIntent({})).toBeNull();
  });
});

describe('shareIntentAdapter', () => {
  it('is an available tier1 push source that does not query', async () => {
    expect(shareIntentAdapter.id).toBe('share_intent');
    expect(shareIntentAdapter.displayName).toBe('Shared link');
    expect(shareIntentAdapter.tier).toBe('tier1');
    expect(shareIntentAdapter.coverage.ingestKinds).toEqual(['share']);
    expect(shareIntentAdapter.isAvailable()).toBe(true);
    expect(
      await shareIntentAdapter.fetchEvents({}, async () => {
        throw new Error('should not fetch');
      }),
    ).toEqual([]);
  });
});
