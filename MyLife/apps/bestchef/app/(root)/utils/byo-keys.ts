import * as SecureStore from 'expo-secure-store';

/**
 * BYO API key storage IDs.
 *
 * Public launch uses the server provider broker. These keys exist only for the
 * internal beta / power-user lane. They are stored in `expo-secure-store` and
 * never persisted to AsyncStorage or SQLite.
 */
export type ByoKeyId =
  | 'vision'
  | 'claude_vision'
  | 'usda'
  | 'gs1_endpoint'
  | 'gs1_key';

const KEY_PREFIX = 'bestchef.byo.';

const KEY_NAMES: Record<ByoKeyId, string> = {
  vision: `${KEY_PREFIX}vision`,
  claude_vision: `${KEY_PREFIX}claude_vision`,
  usda: `${KEY_PREFIX}usda`,
  gs1_endpoint: `${KEY_PREFIX}gs1_endpoint`,
  gs1_key: `${KEY_PREFIX}gs1_key`,
};

/**
 * Returns a masked preview of a stored key for display in inputs. Never echoes
 * a full key; always shows up to four leading and four trailing characters.
 */
export function maskKey(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '...';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export async function getByoKey(id: ByoKeyId): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(KEY_NAMES[id]);
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}

export async function setByoKey(id: ByoKeyId, value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) {
    await clearByoKey(id);
    return;
  }
  await SecureStore.setItemAsync(KEY_NAMES[id], trimmed);
}

export async function clearByoKey(id: ByoKeyId): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_NAMES[id]);
  } catch {
    // Best effort: deleting a missing key should never throw to callers.
  }
}

export async function loadAllByoKeys(): Promise<Record<ByoKeyId, string | null>> {
  const ids: ByoKeyId[] = ['vision', 'claude_vision', 'usda', 'gs1_endpoint', 'gs1_key'];
  const entries = await Promise.all(ids.map(async (id) => [id, await getByoKey(id)] as const));
  return Object.fromEntries(entries) as Record<ByoKeyId, string | null>;
}
