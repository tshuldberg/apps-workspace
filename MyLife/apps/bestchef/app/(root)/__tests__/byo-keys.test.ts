import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory mock of expo-secure-store. The byo-keys helper is a thin wrapper
// over SecureStore; we verify the round-trip and the masking helper.
const store = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

const importHelper = async () => await import('../utils/byo-keys');

describe('byo-keys helper', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    store.clear();
  });

  it('round-trips a BYO key through secure storage', async () => {
    const { getByoKey, setByoKey } = await importHelper();
    await setByoKey('vision', 'sk-abcd-1234567890');
    const stored = await getByoKey('vision');
    expect(stored).toBe('sk-abcd-1234567890');
  });

  it('returns null for an unset key', async () => {
    const { getByoKey } = await importHelper();
    expect(await getByoKey('claude_vision')).toBeNull();
  });

  it('clears a key from secure storage on clearByoKey', async () => {
    const { clearByoKey, getByoKey, setByoKey } = await importHelper();
    await setByoKey('usda', 'usda-key');
    expect(await getByoKey('usda')).toBe('usda-key');
    await clearByoKey('usda');
    expect(await getByoKey('usda')).toBeNull();
  });

  it('treats an empty value as a clear', async () => {
    const { getByoKey, setByoKey } = await importHelper();
    await setByoKey('gs1_key', 'real-key');
    expect(await getByoKey('gs1_key')).toBe('real-key');
    await setByoKey('gs1_key', '   ');
    expect(await getByoKey('gs1_key')).toBeNull();
  });

  it('loadAllByoKeys returns every known key id', async () => {
    const { loadAllByoKeys, setByoKey } = await importHelper();
    await setByoKey('vision', 'v');
    await setByoKey('claude_vision', 'cv');
    await setByoKey('usda', 'u');
    const all = await loadAllByoKeys();
    expect(all).toEqual({
      vision: 'v',
      claude_vision: 'cv',
      usda: 'u',
      gs1_endpoint: null,
      gs1_key: null,
    });
  });

  it('maskKey masks long values and hides short ones', async () => {
    const { maskKey } = await importHelper();
    expect(maskKey('sk-1234567890abcdef')).toBe('sk-1...cdef');
    expect(maskKey('short')).toBe('...');
    expect(maskKey('')).toBe('');
    expect(maskKey(null)).toBe('');
    expect(maskKey(undefined)).toBe('');
  });
});
