/**
 * LLM API query layer.
 *
 * Calls Claude or OpenAI API with a constructed prompt.
 * The fetchFn is injected so it can be mocked in tests and
 * swapped between environments (fetch, node-fetch, expo, etc.).
 */

import type {
  LLMProvider,
  LLMInsight,
  LLMQueryOptions,
  LLMQueryResult,
  LLMFetchFn,
  LLMReasoningEffort,
} from './types';
import {
  DEFAULT_MODELS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_OPENAI_REASONING_EFFORT,
  DEFAULT_OPENAI_VERBOSITY,
} from './types';

/** API endpoints per provider. */
const API_URLS: Record<LLMProvider, string> = {
  claude: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/responses',
};

const OPENAI_INSIGHTS_TEXT_FORMAT = {
  type: 'json_schema',
  name: 'mylife_insights',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      insights: {
        type: 'array',
        minItems: 0,
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            modules: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['title', 'description', 'modules'],
        },
      },
    },
    required: ['insights'],
  },
} as const;

/**
 * Query an LLM API with a prompt and parse the response into LLMInsights.
 *
 * @param prompt - The constructed prompt from buildPrompt()
 * @param apiKey - User's API key
 * @param provider - 'claude' or 'openai'
 * @param fetchFn - Injected fetch function (for testability)
 * @param options - Optional model and token overrides
 */
export async function queryLLM(
  prompt: string,
  apiKey: string,
  provider: LLMProvider,
  fetchFn: LLMFetchFn,
  options?: LLMQueryOptions,
): Promise<LLMQueryResult> {
  const model = options?.model ?? DEFAULT_MODELS[provider];
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;

  const url = API_URLS[provider];
  const { headers, body } = buildRequest(provider, apiKey, model, maxTokens, prompt, options);

  const response = await fetchFn(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status}`);
  }

  const data = await response.json();
  const { text, tokensUsed } = extractResponse(provider, data);
  const insights = parseLLMResponse(text);

  return { insights, tokensUsed, provider };
}

/**
 * Build provider-specific request headers and body.
 */
export function buildRequest(
  provider: LLMProvider,
  apiKey: string,
  model: string,
  maxTokens: number,
  prompt: string,
  options?: LLMQueryOptions,
): { headers: Record<string, string>; body: Record<string, unknown> } {
  if (provider === 'claude') {
    return {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: {
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      },
    };
  }

  const body: Record<string, unknown> = {
    model,
    input: prompt,
    max_output_tokens: maxTokens,
    store: options?.store ?? false,
  };

  const verbosity = options?.verbosity ?? (model.startsWith('gpt-5') ? DEFAULT_OPENAI_VERBOSITY : undefined);
  const text: Record<string, unknown> = { format: OPENAI_INSIGHTS_TEXT_FORMAT };
  if (verbosity) {
    text.verbosity = verbosity;
  }
  body.text = text;

  const reasoningEffort = getOpenAIReasoningEffort(model, options?.reasoningEffort);
  if (reasoningEffort) {
    body.reasoning = { effort: reasoningEffort };
  }

  // OpenAI Responses API
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body,
  };
}

/**
 * Extract text content and token usage from provider-specific response shapes.
 */
function extractResponse(
  provider: LLMProvider,
  data: unknown,
): { text: string; tokensUsed: number } {
  const obj = data as Record<string, unknown>;

  if (provider === 'claude') {
    const content = obj.content as { type: string; text: string }[] | undefined;
    const text = content?.find((c) => c.type === 'text')?.text ?? '';
    const usage = obj.usage as { output_tokens?: number } | undefined;
    return { text, tokensUsed: usage?.output_tokens ?? 0 };
  }

  // OpenAI Responses API
  const outputText = typeof obj.output_text === 'string' ? obj.output_text : undefined;
  if (outputText !== undefined) {
    const usage = obj.usage as { output_tokens?: number; completion_tokens?: number } | undefined;
    return { text: outputText, tokensUsed: usage?.output_tokens ?? usage?.completion_tokens ?? 0 };
  }

  const output = obj.output as
    | {
        content?: {
          text?: string;
        }[];
      }[]
    | undefined;
  const responseText = output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((content): content is string => typeof content === 'string')
    .join('\n') ?? '';
  const responseUsage = obj.usage as { output_tokens?: number; completion_tokens?: number } | undefined;
  if (output !== undefined) {
    return { text: responseText, tokensUsed: responseUsage?.output_tokens ?? responseUsage?.completion_tokens ?? 0 };
  }

  // Legacy Chat Completions fallback for persisted fixtures or older mocks.
  const choices = obj.choices as { message?: { content?: string } }[] | undefined;
  const text = choices?.[0]?.message?.content ?? '';
  const usage = obj.usage as { completion_tokens?: number } | undefined;
  return { text, tokensUsed: usage?.completion_tokens ?? 0 };
}

/**
 * Parse LLM response text into structured LLMInsight objects.
 *
 * Extracts JSON array from the response, handling cases where the
 * LLM wraps the JSON in markdown code blocks.
 */
export function parseLLMResponse(text: string): LLMInsight[] {
  // Strip markdown code blocks if present
  let cleaned = text.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  try {
    return normalizeParsedInsights(JSON.parse(cleaned));
  } catch {
    // Fall through to the legacy array extraction path below.
  }

  // Try to find a JSON array in older free-form text responses.
  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');
  if (arrayStart === -1 || arrayEnd === -1 || arrayEnd <= arrayStart) {
    return [];
  }

  const jsonStr = cleaned.slice(arrayStart, arrayEnd + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return [];
  }

  return normalizeParsedInsights(parsed);
}

function getOpenAIReasoningEffort(
  model: string,
  requestedEffort?: LLMReasoningEffort,
): LLMReasoningEffort | undefined {
  const normalizedModel = model.toLowerCase();
  if (requestedEffort) {
    return supportsOpenAIReasoning(normalizedModel) ? requestedEffort : undefined;
  }
  return normalizedModel.startsWith('gpt-5.5') ? DEFAULT_OPENAI_REASONING_EFFORT : undefined;
}

function supportsOpenAIReasoning(normalizedModel: string): boolean {
  return normalizedModel.startsWith('gpt-5') || /^o\d/.test(normalizedModel);
}

function normalizeParsedInsights(parsed: unknown): LLMInsight[] {
  if (!Array.isArray(parsed) && typeof parsed === 'object' && parsed !== null) {
    const maybeObject = parsed as { insights?: unknown };
    parsed = maybeObject.insights;
  }

  if (!Array.isArray(parsed)) return [];

  // Validate and normalize each insight
  const insights: LLMInsight[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;

    const title = typeof obj.title === 'string' ? obj.title : '';
    const description = typeof obj.description === 'string' ? obj.description : '';
    const modules = Array.isArray(obj.modules)
      ? (obj.modules as unknown[]).filter((m): m is string => typeof m === 'string')
      : [];

    if (title && description) {
      insights.push({ title, description, modules, source: 'llm' });
    }
  }

  return insights;
}
