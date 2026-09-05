import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import type { DatabaseAdapter } from '@mylife/db';
import type { LLMFetchFn } from '@mylife/intelligence';
import { ensureAIPermissionTables, setLLMConfig } from '@mylife/intelligence';
import { MANHATTAN_MODULE } from '../../definition';
import {
  extractEventFromShare,
  buildEventExtractionPrompt,
  parseExtractionInsights,
} from '../event-extraction';

function makeDb(): { adapter: DatabaseAdapter; close: () => void } {
  const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
  ensureAIPermissionTables(adapter);
  return { adapter, close };
}

// Builds a fetchFn that returns a single Claude-shaped insight whose
// description carries the stringified event JSON, mirroring how queryLLM
// parses the response (see parseLLMResponse in @mylife/intelligence).
function claudeInsightsFetch(insights: unknown[]): LLMFetchFn {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'text', text: JSON.stringify({ insights }) }],
      usage: { output_tokens: 42 },
    }),
  });
}

describe('extractEventFromShare', () => {
  it('returns null when AI is not configured (no consent)', async () => {
    const { adapter, close } = makeDb();
    const fetchFn: LLMFetchFn = async () => {
      throw new Error('fetch should never be called when AI is off');
    };
    const result = await extractEventFromShare(adapter, 'Jazz at Blue Note tonight', fetchFn);
    expect(result).toBeNull();
    close();
  });

  it('extracts a NormalizedEvent when configured and the insight description is a JSON event object', async () => {
    const { adapter, close } = makeDb();
    setLLMConfig(adapter, 'claude', 'sk-test', true);

    const eventJson = {
      title: 'Blue Note Jazz',
      venueName: 'Blue Note',
      address: '131 W 3rd St',
      startAt: '2026-07-01T20:00:00',
      category: 'Music',
      priceMin: 35,
      isFree: false,
    };
    const fetchFn = claudeInsightsFetch([
      { title: 'Blue Note Jazz', description: JSON.stringify(eventJson), modules: ['manhattan'] },
    ]);

    const result = await extractEventFromShare(adapter, 'Jazz at Blue Note', fetchFn);
    expect(result).toEqual({
      sourceId: 'share_intent',
      title: 'Blue Note Jazz',
      venueName: 'Blue Note',
      address: '131 W 3rd St',
      startAt: '2026-07-01T20:00:00',
      category: 'Music',
      priceMin: 35,
      isFree: false,
    });
    close();
  });

  it('falls back to a title-only event when the description is not JSON', async () => {
    const { adapter, close } = makeDb();
    setLLMConfig(adapter, 'claude', 'sk-test', true);

    const fetchFn = claudeInsightsFetch([
      { title: 'Comedy Cellar Late Show', description: 'just some prose, not json', modules: ['manhattan'] },
    ]);

    const result = await extractEventFromShare(adapter, 'comedy tonight', fetchFn);
    expect(result).toEqual({ sourceId: 'share_intent', title: 'Comedy Cellar Late Show' });
    close();
  });

  it('returns null on a thrown fetch', async () => {
    const { adapter, close } = makeDb();
    setLLMConfig(adapter, 'claude', 'sk-test', true);

    const fetchFn: LLMFetchFn = async () => {
      throw new Error('network down');
    };
    const result = await extractEventFromShare(adapter, 'anything', fetchFn);
    expect(result).toBeNull();
    close();
  });

  it('returns null on a malformed (non-ok) response', async () => {
    const { adapter, close } = makeDb();
    setLLMConfig(adapter, 'claude', 'sk-test', true);

    const fetchFn: LLMFetchFn = async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const result = await extractEventFromShare(adapter, 'anything', fetchFn);
    expect(result).toBeNull();
    close();
  });
});

describe('buildEventExtractionPrompt', () => {
  it('embeds the shared text and instructs ISO 8601 dates', () => {
    const prompt = buildEventExtractionPrompt('Show at Bowery Ballroom Fri 8pm');
    expect(prompt).toContain('Show at Bowery Ballroom Fri 8pm');
    expect(prompt).toContain('ISO 8601');
    expect(prompt).toContain('description');
  });
});

describe('parseExtractionInsights', () => {
  it('returns null for an empty insight list', () => {
    expect(parseExtractionInsights([])).toBeNull();
  });

  it('parses a JSON event object from the description', () => {
    const result = parseExtractionInsights([
      {
        title: 'Picnic in the Park',
        description: JSON.stringify({ title: 'Picnic in the Park', isFree: true, allDay: true }),
        modules: ['manhattan'],
        source: 'llm',
      },
    ]);
    expect(result).toEqual({
      sourceId: 'share_intent',
      title: 'Picnic in the Park',
      isFree: true,
      allDay: true,
    });
  });

  it('falls back to title when validation fails (missing title in JSON)', () => {
    const result = parseExtractionInsights([
      {
        title: 'Fallback Title',
        description: JSON.stringify({ venueName: 'Somewhere' }),
        modules: ['manhattan'],
        source: 'llm',
      },
    ]);
    expect(result).toEqual({ sourceId: 'share_intent', title: 'Fallback Title' });
  });

  it('returns null when description is not JSON and title is empty', () => {
    const result = parseExtractionInsights([
      { title: '   ', description: 'not json at all', modules: [], source: 'llm' },
    ]);
    expect(result).toBeNull();
  });
});
