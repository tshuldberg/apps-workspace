import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createHubTestDatabase } from '@mylife/db';
import { ensureAIPermissionTables } from '../permissions/schema';
import {
  getLLMConfig,
  setLLMConfig,
  clearLLMConfig,
  isLLMConfigured,
} from '../llm/config';
import { buildPrompt } from '../llm/prompt';
import { queryLLM, parseLLMResponse } from '../llm/query';
import {
  DEFAULT_MODELS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_OPENAI_REASONING_EFFORT,
  DEFAULT_OPENAI_VERBOSITY,
} from '../llm/types';
import type { LLMFetchFn } from '../llm/types';
import type { InsightCard, SummaryResult } from '../engine/types';
import type { CorrelationResult } from '../engine/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCorrelation(overrides?: Partial<CorrelationResult>): CorrelationResult {
  return {
    moduleA: 'habits',
    moduleB: 'workouts',
    metricA: 'completions',
    labelA: 'Habit Completion Rate',
    metricB: 'volume',
    labelB: 'Workout Volume',
    coefficient: 0.67,
    dataPoints: 90,
    strength: 'moderate',
    ...overrides,
  };
}

function makeInsight(overrides?: Partial<InsightCard>): InsightCard {
  return {
    title: 'Habits and Workouts are positively correlated',
    description: 'Moderate positive correlation (r=0.67, 90 days of data)',
    correlation: makeCorrelation(),
    modules: ['habits', 'workouts'],
    confidence: 'high',
    ...overrides,
  };
}

function makeSummary(): SummaryResult {
  return {
    totalModules: 2,
    modules: [
      { moduleId: 'habits', totalItems: 10, stats: { completedToday: 3, streak: 7 } },
      { moduleId: 'workouts', totalItems: 45, stats: { thisWeek: 3 } },
    ],
  };
}

/** Create a mock fetch function that returns a canned response. */
function mockFetch(responseBody: unknown, status = 200): LLMFetchFn {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => responseBody,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LLM integration', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createHubTestDatabase();
    db = testDb.adapter;
    closeDb = testDb.close;
    ensureAIPermissionTables(db);
  });

  afterEach(() => {
    closeDb();
  });

  // -----------------------------------------------------------------------
  // Config CRUD
  // -----------------------------------------------------------------------

  describe('config', () => {
    it('returns null when no config exists', () => {
      expect(getLLMConfig(db)).toBeNull();
    });

    it('saves and retrieves a config', () => {
      setLLMConfig(db, 'claude', 'sk-test-key', true);

      const config = getLLMConfig(db);
      expect(config).not.toBeNull();
      expect(config!.provider).toBe('claude');
      expect(config!.apiKey).toBe('sk-test-key');
      expect(config!.consentGiven).toBe(true);
      expect(config!.consentGivenAt).not.toBeNull();
    });

    it('updates an existing config', () => {
      setLLMConfig(db, 'claude', 'sk-old-key', true);
      setLLMConfig(db, 'openai', 'sk-new-key', true);

      const config = getLLMConfig(db);
      expect(config!.provider).toBe('openai');
      expect(config!.apiKey).toBe('sk-new-key');
    });

    it('saves config without consent', () => {
      setLLMConfig(db, 'claude', 'sk-key', false);

      const config = getLLMConfig(db);
      expect(config!.consentGiven).toBe(false);
      expect(config!.consentGivenAt).toBeNull();
    });

    it('clears config completely', () => {
      setLLMConfig(db, 'claude', 'sk-test', true);
      clearLLMConfig(db);

      expect(getLLMConfig(db)).toBeNull();
    });

    it('clearLLMConfig is a no-op when no config exists', () => {
      clearLLMConfig(db);
      expect(getLLMConfig(db)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // isLLMConfigured
  // -----------------------------------------------------------------------

  describe('isLLMConfigured', () => {
    it('returns false when no config exists', () => {
      expect(isLLMConfigured(db)).toBe(false);
    });

    it('returns false when config exists but consent not given', () => {
      setLLMConfig(db, 'claude', 'sk-key', false);
      expect(isLLMConfigured(db)).toBe(false);
    });

    it('returns false when consent given but key is empty', () => {
      setLLMConfig(db, 'claude', '', true);
      expect(isLLMConfigured(db)).toBe(false);
    });

    it('returns true when config exists with consent and key', () => {
      setLLMConfig(db, 'claude', 'sk-valid-key', true);
      expect(isLLMConfigured(db)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // buildPrompt
  // -----------------------------------------------------------------------

  describe('buildPrompt', () => {
    it('includes module summaries in the prompt', () => {
      const prompt = buildPrompt([], makeSummary());
      expect(prompt).toContain('habits: 10 items');
      expect(prompt).toContain('workouts: 45 items');
    });

    it('includes statistical correlations in the prompt', () => {
      const insights = [makeInsight()];
      const prompt = buildPrompt(insights, makeSummary());
      expect(prompt).toContain('r=0.67');
      expect(prompt).toContain('90 data points');
    });

    it('uses a concise GPT-5.5 prompt without embedding the response schema', () => {
      const prompt = buildPrompt([], { totalModules: 0, modules: [] });
      expect(prompt).toContain('API enforces the output schema');
      expect(prompt).toContain('provide 1-5 actionable insights');
      expect(prompt).not.toContain('Return ONLY a JSON array');
      expect(prompt).not.toContain('- title:');
    });

    it('handles empty inputs gracefully', () => {
      const prompt = buildPrompt([], { totalModules: 0, modules: [] });
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain('personal analytics assistant');
    });
  });

  // -----------------------------------------------------------------------
  // parseLLMResponse
  // -----------------------------------------------------------------------

  describe('parseLLMResponse', () => {
    it('parses a valid JSON array response', () => {
      const text = JSON.stringify([
        {
          title: 'Exercise boosts mood',
          description: 'Your mood is 23% higher on workout days.',
          modules: ['workouts', 'mood'],
        },
      ]);

      const insights = parseLLMResponse(text);
      expect(insights).toHaveLength(1);
      expect(insights[0].title).toBe('Exercise boosts mood');
      expect(insights[0].source).toBe('llm');
      expect(insights[0].modules).toEqual(['workouts', 'mood']);
    });

    it('extracts JSON from markdown code blocks', () => {
      const text = '```json\n[{"title":"Test","description":"Desc","modules":["a"]}]\n```';
      const insights = parseLLMResponse(text);
      expect(insights).toHaveLength(1);
      expect(insights[0].title).toBe('Test');
    });

    it('parses the structured output insights envelope', () => {
      const text = JSON.stringify({
        insights: [
          {
            title: 'Exercise boosts mood',
            description: 'Your mood is 23% higher on workout days.',
            modules: ['workouts', 'mood'],
          },
        ],
      });
      const insights = parseLLMResponse(text);
      expect(insights).toHaveLength(1);
      expect(insights[0].modules).toEqual(['workouts', 'mood']);
    });

    it('extracts JSON from code blocks without json tag', () => {
      const text = '```\n[{"title":"Test","description":"Desc","modules":[]}]\n```';
      const insights = parseLLMResponse(text);
      expect(insights).toHaveLength(1);
    });

    it('handles JSON embedded in surrounding text', () => {
      const text = 'Here are the insights:\n[{"title":"A","description":"B","modules":[]}]\nHope that helps!';
      const insights = parseLLMResponse(text);
      expect(insights).toHaveLength(1);
    });

    it('returns empty array for non-JSON response', () => {
      expect(parseLLMResponse('This is not JSON at all.')).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      expect(parseLLMResponse('[{invalid json}]')).toEqual([]);
    });

    it('skips items missing title or description', () => {
      const text = JSON.stringify([
        { title: '', description: 'No title', modules: [] },
        { title: 'No desc', description: '', modules: [] },
        { title: 'Valid', description: 'Good insight', modules: ['a'] },
      ]);
      const insights = parseLLMResponse(text);
      expect(insights).toHaveLength(1);
      expect(insights[0].title).toBe('Valid');
    });

    it('handles non-string modules gracefully', () => {
      const text = JSON.stringify([
        { title: 'T', description: 'D', modules: ['a', 123, null, 'b'] },
      ]);
      const insights = parseLLMResponse(text);
      expect(insights[0].modules).toEqual(['a', 'b']);
    });

    it('handles missing modules field', () => {
      const text = JSON.stringify([{ title: 'T', description: 'D' }]);
      const insights = parseLLMResponse(text);
      expect(insights[0].modules).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // queryLLM
  // -----------------------------------------------------------------------

  describe('queryLLM', () => {
    it('calls Claude API with correct headers and body', async () => {
      let capturedUrl = '';
      let capturedOptions: Record<string, unknown> = {};

      const fetch: LLMFetchFn = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            content: [{ type: 'text', text: '[{"title":"T","description":"D","modules":[]}]' }],
            usage: { output_tokens: 50 },
          }),
        };
      };

      await queryLLM('test prompt', 'sk-ant-key', 'claude', fetch);

      expect(capturedUrl).toBe('https://api.anthropic.com/v1/messages');
      const headers = (capturedOptions as { headers: Record<string, string> }).headers;
      expect(headers['x-api-key']).toBe('sk-ant-key');
      expect(headers['anthropic-version']).toBe('2023-06-01');

      const body = JSON.parse((capturedOptions as { body: string }).body);
      expect(body.model).toBe(DEFAULT_MODELS.claude);
      expect(body.max_tokens).toBe(DEFAULT_MAX_TOKENS);
      expect(body.messages[0].content).toBe('test prompt');
    });

    it('calls OpenAI API with correct headers and body', async () => {
      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};
      let capturedBody: Record<string, unknown> = {};

      const fetch: LLMFetchFn = async (url, options) => {
        capturedUrl = url;
        capturedHeaders = options.headers;
        capturedBody = JSON.parse(options.body) as Record<string, unknown>;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            output: [
              {
                content: [
                  { type: 'output_text', text: '[{"title":"T","description":"D","modules":[]}]' },
                ],
              },
            ],
            usage: { output_tokens: 30 },
          }),
        };
      };

      const result = await queryLLM('test', 'sk-openai-key', 'openai', fetch);

      expect(capturedUrl).toBe('https://api.openai.com/v1/responses');
      expect(capturedHeaders['Authorization']).toBe('Bearer sk-openai-key');
      expect(capturedBody.model).toBe(DEFAULT_MODELS.openai);
      expect(capturedBody.input).toBe('test');
      expect(capturedBody.max_output_tokens).toBe(DEFAULT_MAX_TOKENS);
      expect(capturedBody.store).toBe(false);
      expect(capturedBody.text).toEqual({
        verbosity: DEFAULT_OPENAI_VERBOSITY,
        format: expect.objectContaining({
          type: 'json_schema',
          name: 'mylife_insights',
          strict: true,
        }),
      });
      expect(capturedBody.reasoning).toEqual({ effort: DEFAULT_OPENAI_REASONING_EFFORT });
      expect(result.tokensUsed).toBe(30);
      expect(result.provider).toBe('openai');
    });

    it('parses Claude response into insights', async () => {
      const claudeResponse = {
        content: [
          {
            type: 'text',
            text: '[{"title":"Sleep affects mood","description":"More sleep correlates with better mood.","modules":["health","mood"]}]',
          },
        ],
        usage: { output_tokens: 42 },
      };

      const result = await queryLLM('prompt', 'key', 'claude', mockFetch(claudeResponse));
      expect(result.insights).toHaveLength(1);
      expect(result.insights[0].title).toBe('Sleep affects mood');
      expect(result.insights[0].source).toBe('llm');
      expect(result.tokensUsed).toBe(42);
    });

    it('parses OpenAI response into insights', async () => {
      const openaiResponse = {
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: '[{"title":"Budget tip","description":"Spending drops on workout days.","modules":["budget","workouts"]}]',
              },
            ],
          },
        ],
        usage: { output_tokens: 25 },
      };

      const result = await queryLLM('prompt', 'key', 'openai', mockFetch(openaiResponse));
      expect(result.insights).toHaveLength(1);
      expect(result.insights[0].title).toBe('Budget tip');
      expect(result.tokensUsed).toBe(25);
    });

    it('throws on API error response', async () => {
      await expect(
        queryLLM('prompt', 'bad-key', 'claude', mockFetch({}, 401)),
      ).rejects.toThrow('LLM API error: 401');
    });

    it('uses custom model and maxTokens when provided', async () => {
      let capturedBody: Record<string, unknown> = {};

      const fetch: LLMFetchFn = async (_url, options) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            content: [{ type: 'text', text: '[]' }],
            usage: { output_tokens: 0 },
          }),
        };
      };

      await queryLLM('prompt', 'key', 'claude', fetch, {
        model: 'claude-opus-4-20250514',
        maxTokens: 2048,
      });

      expect(capturedBody.model).toBe('claude-opus-4-20250514');
      expect(capturedBody.max_tokens).toBe(2048);
    });

    it('uses OpenAI Responses API options when provided', async () => {
      let capturedBody: Record<string, unknown> = {};

      const fetch: LLMFetchFn = async (_url, options) => {
        capturedBody = JSON.parse(options.body) as Record<string, unknown>;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            output_text: '[]',
            usage: { output_tokens: 0 },
          }),
        };
      };

      await queryLLM('prompt', 'key', 'openai', fetch, {
        model: 'gpt-5.5',
        maxTokens: 2048,
        reasoningEffort: 'low',
        verbosity: 'medium',
        store: true,
      });

      expect(capturedBody.model).toBe('gpt-5.5');
      expect(capturedBody.max_output_tokens).toBe(2048);
      expect(capturedBody.input).toBe('prompt');
      expect(capturedBody.reasoning).toEqual({ effort: 'low' });
      expect(capturedBody.text).toEqual({
        verbosity: 'medium',
        format: expect.objectContaining({
          type: 'json_schema',
          name: 'mylife_insights',
          strict: true,
        }),
      });
      expect(capturedBody.store).toBe(true);
    });

    it('handles empty content from Claude gracefully', async () => {
      const result = await queryLLM(
        'prompt',
        'key',
        'claude',
        mockFetch({ content: [], usage: { output_tokens: 0 } }),
      );
      expect(result.insights).toEqual([]);
    });

    it('handles empty output from OpenAI gracefully', async () => {
      const result = await queryLLM(
        'prompt',
        'key',
        'openai',
        mockFetch({ output: [], usage: { output_tokens: 0 } }),
      );
      expect(result.insights).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------

  describe('constants', () => {
    it('DEFAULT_MODELS has entries for both providers', () => {
      expect(DEFAULT_MODELS.claude).toBeDefined();
      expect(DEFAULT_MODELS.openai).toBeDefined();
    });

    it('DEFAULT_MAX_TOKENS is 1024', () => {
      expect(DEFAULT_MAX_TOKENS).toBe(1024);
    });
  });
});
