import { isHostedRelayTarget } from '@mylife/sync';

const ENTITLEMENT_TOKEN_STORAGE_KEY = 'meerkat_hosted_entitlement_token';
const APP_UNLOCK_STATE_STORAGE_KEY = 'meerkat_app_unlock_state';
const appUnlockListeners = new Set<() => void>();

function envString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const HOSTED_RELAY_URL = envString(import.meta.env.VITE_MEERKAT_HOSTED_RELAY_URL);
export const HOSTED_API_URL = envString(import.meta.env.VITE_MEERKAT_HOSTED_API_URL);
export const STORAGE_OPERATOR_PUBLIC_KEY = envString(
  import.meta.env.VITE_MEERKAT_STORAGE_OPERATOR_PUBLIC_KEY,
);
export const HOSTED_COMMUNITY_NODE_URL = envString(import.meta.env.VITE_MEERKAT_HOSTED_COMMUNITY_NODE_URL);

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function isFirstPartyHostedRelay(
  relayUrl: string,
  hostedRelayUrl: string = HOSTED_RELAY_URL,
): boolean {
  return isHostedRelayTarget(relayUrl, hostedRelayUrl);
}

export function relayRequiresHostedPayment(relayUrl: string): boolean {
  return isFirstPartyHostedRelay(relayUrl);
}

function normalizeHttpOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export function isFirstPartyHostedHttpUrl(targetUrl: string): boolean {
  const hostedOrigin = normalizeHttpOrigin(HOSTED_COMMUNITY_NODE_URL || HOSTED_API_URL);
  const targetOrigin = normalizeHttpOrigin(targetUrl);
  return hostedOrigin.length > 0 && hostedOrigin === targetOrigin;
}

export function getCachedHostedEntitlementToken(): string | null {
  return storage()?.getItem(ENTITLEMENT_TOKEN_STORAGE_KEY) ?? null;
}

export function setCachedHostedEntitlementToken(token: string): void {
  storage()?.setItem(ENTITLEMENT_TOKEN_STORAGE_KEY, token);
}

export function clearCachedHostedEntitlementToken(): void {
  storage()?.removeItem(ENTITLEMENT_TOKEN_STORAGE_KEY);
}

export async function fetchHostedEntitlementToken(
  authToken: string,
  apiUrl: string = HOSTED_API_URL,
): Promise<string> {
  const base = apiUrl.trim().replace(/\/+$/u, '');
  if (!base) throw new Error('Hosted API URL is not configured.');
  const response = await fetch(`${base}/api/entitlements/meerkat`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (response.status === 402) throw new Error('Payment is required for the hosted Meerkat relay.');
  if (!response.ok) throw new Error(`Hosted entitlement request failed with ${response.status}.`);
  const body = await response.json() as { token?: unknown };
  if (typeof body.token !== 'string' || body.token.trim().length === 0) {
    throw new Error('Hosted entitlement response did not include a token.');
  }
  setCachedHostedEntitlementToken(body.token);
  return body.token;
}

// ---------------------------------------------------------------------------
// One-time app unlock (Plan 22 Part 1 web rail + cross-rail Link)
// ---------------------------------------------------------------------------

export interface AppUnlockState {
  unlocked: boolean;
  purchaseDate: string | null;
  grant?: string | null;
}

function apiBase(apiUrl: string): string {
  const base = apiUrl.trim().replace(/\/+$/u, '');
  if (!base) throw new Error('Hosted API URL is not configured.');
  return base;
}

/** Cache the derived unlock locally (device-local; never synced). The cache keeps the
 *  UI responsive offline, but a fresh device still restores against the account. */
export function getCachedAppUnlock(): AppUnlockState | null {
  const raw = storage()?.getItem(APP_UNLOCK_STATE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppUnlockState;
    return typeof parsed?.unlocked === 'boolean' ? parsed : null;
  } catch {
    return null;
  }
}

export function setCachedAppUnlock(state: AppUnlockState): void {
  const target = storage();
  const serialized = JSON.stringify(state);
  // Skip only the redundant storage WRITE; listeners always fire. A re-validate
  // that produced a byte-identical state (e.g. Restore purchase confirming the
  // cached unlock) previously fired NO listeners, so the shell never adopted
  // the fresh server answer and stayed locked while Settings said unlocked.
  if (target?.getItem(APP_UNLOCK_STATE_STORAGE_KEY) !== serialized) {
    target?.setItem(APP_UNLOCK_STATE_STORAGE_KEY, serialized);
  }
  for (const listener of appUnlockListeners) listener();
}

export function clearCachedAppUnlock(): void {
  storage()?.removeItem(APP_UNLOCK_STATE_STORAGE_KEY);
  for (const listener of appUnlockListeners) listener();
}

export function subscribeCachedAppUnlock(listener: () => void): () => void {
  appUnlockListeners.add(listener);
  return () => {
    appUnlockListeners.delete(listener);
  };
}

/** Start a one-time Stripe Checkout for the $4.99 app unlock; returns the redirect URL. */
export async function startAppUnlockCheckout(
  authToken: string,
  successUrl: string,
  cancelUrl: string,
  apiUrl: string = HOSTED_API_URL,
): Promise<string> {
  const response = await fetch(`${apiBase(apiUrl)}/api/billing/app-checkout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ successUrl, cancelUrl }),
  });
  if (!response.ok) throw new Error(`App-unlock checkout failed with ${response.status}.`);
  const body = (await response.json()) as { url?: unknown };
  if (typeof body.url !== 'string' || body.url.length === 0) throw new Error('Checkout did not return a URL.');
  return body.url;
}

/** Restore the unlock for the signed-in account (re-derives from the real purchase row). */
export async function fetchAppUnlockState(
  authToken: string,
  apiUrl: string = HOSTED_API_URL,
  grant?: string | null,
): Promise<AppUnlockState> {
  const query = grant ? `?grant=${encodeURIComponent(grant)}` : '';
  const response = await fetch(`${apiBase(apiUrl)}/api/entitlements/meerkat-app${query}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!response.ok) throw new Error(`App-unlock restore failed with ${response.status}.`);
  const state = (await response.json()) as AppUnlockState;
  setCachedAppUnlock(state);
  return state;
}

/** Redeem a cross-rail Link code (no auth: the single-use code IS the capability). */
export async function redeemAppUnlockLink(
  code: string,
  authToken: string,
  apiUrl: string = HOSTED_API_URL,
): Promise<AppUnlockState> {
  const response = await fetch(
    `${apiBase(apiUrl)}/api/entitlements/meerkat-app?link=${encodeURIComponent(code)}`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  if (!response.ok) throw new Error(`Link redeem failed with ${response.status}.`);
  const state = (await response.json()) as AppUnlockState;
  if (state.unlocked && typeof state.grant === 'string' && state.grant.length > 0) {
    setCachedAppUnlock(state);
  }
  return state;
}

/** Mint a single-use Link code for THIS (web/Stripe) purchase to unlock the other rail. */
export async function mintAppUnlockLink(
  authToken: string,
  apiUrl: string = HOSTED_API_URL,
): Promise<{ code: string; expiresAt: string }> {
  const response = await fetch(`${apiBase(apiUrl)}/api/link/meerkat-app`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rail: 'stripe' }),
  });
  if (response.status === 402) throw new Error('No active purchase to link on this account yet.');
  if (!response.ok) throw new Error(`Link mint failed with ${response.status}.`);
  return (await response.json()) as { code: string; expiresAt: string };
}
