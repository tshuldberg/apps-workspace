import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { buildRequest } from '../query';
import { DEFAULT_OPENAI_REASONING_EFFORT, DEFAULT_OPENAI_VERBOSITY } from '../types';
import type { LLMProvider, LLMQueryOptions } from '../types';

interface BuildRequestCase {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  maxTokens: number;
  prompt: string;
  options?: LLMQueryOptions;
}

describe('buildRequest function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const claude = buildRequest('claude', 'sk-ant', 'claude-sonnet-4-5-20250514', 512, 'hello');
    expect(claude.headers).toEqual({
      'Content-Type': 'application/json',
      'x-api-key': 'sk-ant',
      'anthropic-version': '2023-06-01',
    });
    expect(claude.body).toEqual({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: 'hello' }],
    });

    const openai = buildRequest('openai', 'sk-openai', 'gpt-5.5', 1024, 'find insights', {
      reasoningEffort: 'low',
      verbosity: 'medium',
    });
    expect(openai.headers).toEqual({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk-openai',
    });
    expect(openai.body).toEqual({
      model: 'gpt-5.5',
      input: 'find insights',
      max_output_tokens: 1024,
      store: false,
      text: {
        verbosity: 'medium',
        format: expect.objectContaining({
          type: 'json_schema',
          name: 'mylife_insights',
          strict: true,
        }),
      },
      reasoning: { effort: 'low' },
    });

    const openaiDefault = buildRequest('openai', 'sk-openai', 'gpt-5.5', 1024, 'find insights');
    expect(openaiDefault.body.text).toEqual({
      verbosity: DEFAULT_OPENAI_VERBOSITY,
      format: expect.objectContaining({
        type: 'json_schema',
        name: 'mylife_insights',
        strict: true,
      }),
    });
    expect(openaiDefault.body.reasoning).toEqual({ effort: DEFAULT_OPENAI_REASONING_EFFORT });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'buildRequest fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        const provider: LLMProvider = randomInt(rng, 0, 1) === 0 ? 'claude' : 'openai';
        const maxTokens = randomInt(rng, 1, 4096);
        const prompt = `prompt-${randomInt(rng, 0, 1000000)}`;
        const model = provider === 'openai'
          ? (randomInt(rng, 0, 1) === 0 ? 'gpt-5.5' : 'gpt-4o')
          : 'claude-sonnet-4-5-20250514';
        const options = provider === 'openai'
          ? {
              store: randomInt(rng, 0, 1) === 1,
              reasoningEffort: 'low' as const,
              verbosity: 'low' as const,
            }
          : undefined;
        return { provider, apiKey: 'sk-test', model, maxTokens, prompt, options };
      },
      assertCase: async (input: BuildRequestCase) => {
        const result = buildRequest(
          input.provider,
          input.apiKey,
          input.model,
          input.maxTokens,
          input.prompt,
          input.options,
        );

        expect(result.headers['Content-Type']).toBe('application/json');
        expect(result.body.model).toBe(input.model);

        if (input.provider === 'openai') {
          expect(result.headers.Authorization).toBe(`Bearer ${input.apiKey}`);
          expect(result.body.input).toBe(input.prompt);
          expect(result.body.max_output_tokens).toBe(input.maxTokens);
          expect(result.body).not.toHaveProperty('messages');
          expect(result.body).not.toHaveProperty('max_tokens');
        } else {
          expect(result.headers['x-api-key']).toBe(input.apiKey);
          expect(result.body.max_tokens).toBe(input.maxTokens);
          expect(result.body).not.toHaveProperty('input');
          expect(result.body).not.toHaveProperty('max_output_tokens');
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'buildRequest',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => 'x'.repeat(size),
      run: async (prompt) => {
        buildRequest('openai', 'sk-test', 'gpt-5.5', 1024, prompt, { reasoningEffort: 'low' });
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'buildRequest',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => 'analytics prompt '.repeat(1000),
      run: async (prompt) => {
        buildRequest('openai', 'sk-test', 'gpt-5.5', 1024, prompt, {
          reasoningEffort: 'low',
          verbosity: 'low',
        });
      },
    });
  });
});
