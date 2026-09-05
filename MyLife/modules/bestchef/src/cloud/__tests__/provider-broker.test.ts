import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  callNutritionBroker,
  callProductIdentityBroker,
  callVisionBroker,
} from '../provider-broker';

interface InvokeStubResult {
  data: unknown;
  error: { name?: string; message?: string; context?: { status?: number } } | null;
}

function makeSupabase(invoke: (fn: string, args: { body: unknown }) => Promise<InvokeStubResult>) {
  return {
    functions: {
      invoke: vi.fn(async (fn: string, args: { body: unknown }) => invoke(fn, args)),
    },
  } as unknown as SupabaseClient;
}

describe('BestChef provider broker client', () => {
  it('returns ok with normalized envelope on a successful vision call', async () => {
    const supabase = makeSupabase(async (fn, args) => {
      expect(fn).toBe('bestchef-vision');
      expect(args.body).toMatchObject({ task: 'food_recognition', imageBase64: 'AAA' });
      return {
        data: {
          ok: true,
          provider: 'anthropic',
          source: 'claude-haiku',
          confidence: 0.83,
          data: { rawText: '{"candidates":[]}' },
        },
        error: null,
      };
    });

    const result = await callVisionBroker(supabase, {
      task: 'food_recognition',
      imageBase64: 'AAA',
      photoMime: 'image/jpeg',
    });

    expect(result).toEqual({
      ok: true,
      provider: 'anthropic',
      source: 'claude-haiku',
      confidence: 0.83,
      data: { rawText: '{"candidates":[]}' },
    });
  });

  it('classifies a 401 invocation as auth failure', async () => {
    const supabase = makeSupabase(async () => ({
      data: null,
      error: { message: 'Unauthorized', context: { status: 401 } },
    }));
    const result = await callVisionBroker(supabase, { task: 'expiration_ocr', imageBase64: 'a' });
    expect(result).toMatchObject({ ok: false, errorKind: 'auth' });
  });

  it('classifies a 429 invocation as rate_limit failure', async () => {
    const supabase = makeSupabase(async () => ({
      data: null,
      error: { message: 'Too many requests', context: { status: 429 } },
    }));
    const result = await callNutritionBroker(supabase, { source: 'usda_fdc', query: 'milk' });
    expect(result).toMatchObject({ ok: false, errorKind: 'rate_limit' });
  });

  it('classifies a 5xx invocation as provider_outage failure', async () => {
    const supabase = makeSupabase(async () => ({
      data: null,
      error: { message: 'Bad gateway', context: { status: 502 } },
    }));
    const result = await callProductIdentityBroker(supabase, {
      source: 'open_food_facts',
      barcode: '049000042566',
    });
    expect(result).toMatchObject({ ok: false, errorKind: 'provider_outage' });
  });

  it('classifies a 422 invocation as invalid_input failure', async () => {
    const supabase = makeSupabase(async () => ({
      data: null,
      error: { message: 'Bad input', context: { status: 422 } },
    }));
    const result = await callVisionBroker(supabase, { task: 'food_recognition' });
    expect(result).toMatchObject({ ok: false, errorKind: 'invalid_input' });
  });

  it('returns unknown when supabase invoke throws', async () => {
    const supabase = makeSupabase(async () => {
      throw new Error('network down');
    });
    const result = await callVisionBroker(supabase, { task: 'recipe_extract_text', text: 'hi' });
    expect(result).toMatchObject({ ok: false, errorKind: 'unknown', message: 'network down' });
  });

  it('returns unknown when broker envelope is missing', async () => {
    const supabase = makeSupabase(async () => ({ data: null, error: null }));
    const result = await callNutritionBroker(supabase, { source: 'open_food_facts', barcode: '0' });
    expect(result).toMatchObject({ ok: false, errorKind: 'unknown' });
  });

  it('forwards typed broker error envelopes', async () => {
    const supabase = makeSupabase(async () => ({
      data: {
        ok: false,
        provider: 'open_food_facts',
        error: { kind: 'rate_limit', message: 'OFF rate limited' },
      },
      error: null,
    }));
    const result = await callNutritionBroker(supabase, { source: 'open_food_facts', barcode: '049000042566' });
    expect(result).toEqual({
      ok: false,
      errorKind: 'rate_limit',
      message: 'OFF rate limited',
      provider: 'open_food_facts',
    });
  });

  it('passes nutrition request payload through to the bestchef-nutrition function', async () => {
    const supabase = makeSupabase(async (fn, args) => {
      expect(fn).toBe('bestchef-nutrition');
      expect(args.body).toEqual({ source: 'usda_fdc', query: 'milk', brand: 'Organic Valley' });
      return {
        data: {
          ok: true,
          provider: 'usda_fdc',
          source: 'usda_fdc',
          data: {
            candidates: [],
            status: { code: 'ok', message: 'no candidates' },
          },
        },
        error: null,
      };
    });

    const result = await callNutritionBroker(supabase, {
      source: 'usda_fdc',
      query: 'milk',
      brand: 'Organic Valley',
    });
    expect(result.ok).toBe(true);
  });

  it('routes product-identity payloads to bestchef-product-identity', async () => {
    const supabase = makeSupabase(async (fn, args) => {
      expect(fn).toBe('bestchef-product-identity');
      expect(args.body).toEqual({ source: 'gs1', barcode: '049000042566' });
      return {
        data: {
          ok: true,
          provider: 'gs1',
          source: 'gs1',
          data: {
            product: null,
            status: { code: 'not_configured', message: 'GS1 disabled' },
          },
        },
        error: null,
      };
    });
    const result = await callProductIdentityBroker(supabase, {
      source: 'gs1',
      barcode: '049000042566',
    });
    expect(result.ok).toBe(true);
  });

  it('does not invoke fetch directly on any path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const supabase = makeSupabase(async () => ({
      data: { ok: true, provider: 'p', source: 's', data: { rawText: '' } },
      error: null,
    }));
    await callVisionBroker(supabase, { task: 'food_recognition', imageBase64: 'a' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
