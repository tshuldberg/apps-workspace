import type {
  PayoutAccountSummary,
  SupportLedgerEntry,
  SupportReceipt,
} from '@mylife/mynews';
import type { MyNewsPaymentsRuntimeConfig } from './runtime-capabilities';

interface EdgeEnvelope<T> {
  data?: T;
  error?: string;
  detail?: string;
}

interface ReceiptRow {
  id: string;
  supporter_profile_id: string;
  journalist_profile_id: string;
  gross_cents: number;
  platform_fee_cents: number;
  journalist_net_cents: number;
  refunded_cents: number;
  currency: string;
  provider_ref: string;
  state: SupportReceipt['state'];
  created_at: string;
}

interface LedgerRow {
  id: string;
  supporter_profile_id: string | null;
  journalist_profile_id: string;
  kind: SupportLedgerEntry['kind'];
  amount_cents: number;
  currency: string;
  provider: string;
  provider_ref: string | null;
  idempotency_key: string;
  state: string;
  created_at: string;
}

interface PayoutRow {
  journalist_profile_id: string;
  onboarding_state: PayoutAccountSummary['state'];
  provider: string | null;
  status_reason: string | null;
  updated_at: string;
}

function headers(config: MyNewsPaymentsRuntimeConfig, accessToken: string): Record<string, string> {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function checkedJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as EdgeEnvelope<T> | T) : null;
  if (!response.ok) {
    const envelope = parsed as EdgeEnvelope<T> | null;
    throw new Error(envelope?.detail || envelope?.error || `Request failed with HTTP ${response.status}`);
  }
  return parsed as T;
}

export function newSupportIdempotencyKey(nowMs: number = Date.now()): string {
  return `support_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * One confirmed checkout attempt. The idempotency key is minted once, when the
 * reader confirms a specific journalist and amount, and is reused for every
 * retry of THAT confirmation. A fresh key per button press would dedupe
 * nothing: the server charges velocity and opens a provider session per new
 * key, and a double press would produce two checkouts.
 */
export interface SupportConfirmation {
  idempotencyKey: string;
  journalistProfileId: string;
  amountCents: number;
}

/**
 * Returns the existing confirmation when it still matches the target and
 * amount (so a retry replays the same key), and a freshly keyed one otherwise
 * (a changed journalist or amount is a different payment).
 */
export function nextSupportConfirmation(
  current: SupportConfirmation | null,
  input: { journalistProfileId: string; amountCents: number },
  mintKey: () => string = newSupportIdempotencyKey,
): SupportConfirmation {
  if (
    current &&
    current.journalistProfileId === input.journalistProfileId &&
    current.amountCents === input.amountCents
  ) {
    return current;
  }
  return {
    idempotencyKey: mintKey(),
    journalistProfileId: input.journalistProfileId,
    amountCents: input.amountCents,
  };
}

export async function createSupportCheckout(
  config: MyNewsPaymentsRuntimeConfig,
  accessToken: string,
  input: { journalistProfileId: string; amountCents: number; idempotencyKey: string },
  send: typeof fetch = fetch,
): Promise<string> {
  const envelope = await checkedJson<EdgeEnvelope<{ checkoutUrl: string }>>(
    await send(`${config.functionsUrl}/mynews-support`, {
      method: 'POST',
      headers: headers(config, accessToken),
      body: JSON.stringify({ action: 'create_checkout', ...input }),
    }),
  );
  const url = envelope.data?.checkoutUrl;
  if (!url || !url.startsWith('https://')) throw new Error('The payment provider returned no checkout URL.');
  return url;
}

export async function startPayoutOnboarding(
  config: MyNewsPaymentsRuntimeConfig,
  accessToken: string,
  send: typeof fetch = fetch,
): Promise<{ url: string | null; status: string }> {
  const envelope = await checkedJson<EdgeEnvelope<{ onboardingUrl?: string; status: string }>>(
    await send(`${config.functionsUrl}/mynews-support`, {
      method: 'POST',
      headers: headers(config, accessToken),
      body: JSON.stringify({ action: 'create_onboarding' }),
    }),
  );
  const url = envelope.data?.onboardingUrl ?? null;
  if (url && !url.startsWith('https://')) throw new Error('The payout provider returned an invalid URL.');
  return { url, status: envelope.data?.status ?? 'pending' };
}

export async function fetchSupportReceipts(
  config: MyNewsPaymentsRuntimeConfig,
  accessToken: string,
  supporterProfileId: string,
  send: typeof fetch = fetch,
): Promise<SupportReceipt[]> {
  const select = [
    'id',
    'supporter_profile_id',
    'journalist_profile_id',
    'gross_cents',
    'platform_fee_cents',
    'journalist_net_cents',
    'refunded_cents',
    'currency',
    'provider_ref',
    'state',
    'created_at',
  ].join(',');
  const rows = await checkedJson<ReceiptRow[]>(
    await send(
      `${config.baseUrl}/rest/v1/nw_support_receipts?select=${select}` +
        `&supporter_profile_id=eq.${encodeURIComponent(supporterProfileId)}` +
        '&order=created_at.desc&limit=100',
      { headers: headers(config, accessToken) },
    ),
  );
  return rows.map((row) => ({
    id: row.id,
    supporterProfileId: row.supporter_profile_id,
    journalistProfileId: row.journalist_profile_id,
    grossCents: row.gross_cents,
    platformFeeCents: row.platform_fee_cents,
    journalistNetCents: row.journalist_net_cents,
    refundedCents: row.refunded_cents,
    currency: row.currency,
    providerRef: row.provider_ref,
    state: row.state,
    createdAt: row.created_at,
  }));
}

export async function fetchJournalistLedger(
  config: MyNewsPaymentsRuntimeConfig,
  accessToken: string,
  journalistProfileId: string,
  send: typeof fetch = fetch,
): Promise<SupportLedgerEntry[]> {
  const select = [
    'id',
    'journalist_profile_id',
    'kind',
    'amount_cents',
    'currency',
    'provider',
    'provider_ref',
    'idempotency_key',
    'state',
    'created_at',
  ].join(',');
  const rows = await checkedJson<LedgerRow[]>(
    await send(
      `${config.baseUrl}/rest/v1/nw_support_ledger?select=${select}` +
        `&journalist_profile_id=eq.${encodeURIComponent(journalistProfileId)}` +
        '&order=created_at.desc&limit=500',
      { headers: headers(config, accessToken) },
    ),
  );
  return rows.map((row) => ({
    id: row.id,
    supporterProfileId: null,
    journalistProfileId: row.journalist_profile_id,
    kind: row.kind,
    amountCents: row.amount_cents,
    currency: row.currency,
    provider: row.provider,
    providerRef: row.provider_ref,
    idempotencyKey: row.idempotency_key,
    state: row.state,
    createdAt: row.created_at,
  }));
}

export async function fetchPayoutAccount(
  config: MyNewsPaymentsRuntimeConfig,
  accessToken: string,
  journalistProfileId: string,
  send: typeof fetch = fetch,
): Promise<PayoutAccountSummary> {
  const select = 'journalist_profile_id,onboarding_state,provider,status_reason,updated_at';
  const rows = await checkedJson<PayoutRow[]>(
    await send(
      `${config.baseUrl}/rest/v1/nw_payout_accounts?select=${select}` +
        `&journalist_profile_id=eq.${encodeURIComponent(journalistProfileId)}&limit=1`,
      { headers: headers(config, accessToken) },
    ),
  );
  const row = rows[0];
  if (!row) {
    return {
      journalistProfileId,
      state: 'none',
      provider: null,
      statusReason: null,
      updatedAt: new Date(0).toISOString(),
    };
  }
  return {
    journalistProfileId: row.journalist_profile_id,
    state: row.onboarding_state,
    provider: row.provider,
    statusReason: row.status_reason,
    updatedAt: row.updated_at,
  };
}
