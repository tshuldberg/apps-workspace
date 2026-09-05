export type PaymentEventOutcome =
  | 'applied'
  | 'duplicate'
  | 'ignored'
  | 'rejected'
  /**
   * A payout event whose journalist could not be resolved from either the
   * event's Connect account or its metadata. Recorded on nw_payment_events as
   * failure_reason = 'unattributed-payout' for operator review; never dropped,
   * never guessed at.
   */
  | 'unattributed';

const PAYMENT_EVENT_OUTCOMES: readonly PaymentEventOutcome[] = [
  'applied',
  'duplicate',
  'ignored',
  'rejected',
  'unattributed',
];

export interface ApplyPaymentEventInput {
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  /**
   * The event envelope's top-level Connect `account` field. Real Stripe
   * automatic payouts carry empty metadata, so this is the only attribution
   * signal a payout event has.
   */
  providerAccountRef?: string | null;
  /** Journalist resolved server-side from `providerAccountRef`. */
  resolvedJournalistProfileId?: string | null;
}

export interface PrivatePayoutAccount {
  journalistProfileId: string;
  onboardingState: 'none' | 'pending' | 'verified' | 'blocked';
  provider: string | null;
  providerAccountRef: string | null;
  statusReason: string | null;
}

export type SupportRateScope = 'supporter' | 'recipient';

export interface SupportCheckoutClaim {
  status: 'new' | 'replayed' | 'conflict' | 'rate-limited' | 'bad-request';
  /** The ORIGINAL provider checkout URL when this key already produced one. */
  checkoutUrl: string | null;
  /** Which velocity bucket refused a 'rate-limited' claim. */
  rateScope: SupportRateScope | null;
}

export interface SupportCheckoutClaimInput {
  idempotencyKey: string;
  supporterProfileId: string;
  journalistProfileId: string;
  amountCents: number;
}

export interface SupportLedgerRow {
  id: string;
  supporterProfileId: string | null;
  journalistProfileId: string;
  kind: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerRef: string | null;
  idempotencyKey: string;
  state: string;
  createdAt: string;
}

export interface SupportReconciliationRunRow {
  workerRef: string;
  startedAt: string;
  finishedAt: string;
  ledgerRows: number;
  pairCount: number;
  ok: boolean;
  mismatchCount: number;
  findings: string[];
}

export interface MyNewsPaymentsStore {
  applyPaymentEvent(input: ApplyPaymentEventInput): Promise<PaymentEventOutcome>;
  getProfileIdByUserId(userId: string): Promise<string | null>;
  getJournalistPayoutAccount(journalistProfileId: string): Promise<PrivatePayoutAccount | null>;
  getOwnedJournalistPayoutAccount(userId: string): Promise<PrivatePayoutAccount | null>;
  upsertPayoutAccount(input: PrivatePayoutAccount): Promise<void>;
  /** Resolves the journalist that owns a provider Connect account. */
  getJournalistProfileIdByAccountRef(
    provider: string,
    providerAccountRef: string,
  ): Promise<string | null>;
  /**
   * Atomically claims one confirmed checkout attempt: replays an existing key,
   * rejects a key reused for a different target/amount, and charges both
   * velocity buckets only for a genuinely new attempt.
   */
  claimSupportCheckout(input: SupportCheckoutClaimInput): Promise<SupportCheckoutClaim>;
  /** Records the provider URL so a retry of the same key replays it. */
  recordSupportCheckoutUrl(idempotencyKey: string, checkoutUrl: string): Promise<void>;
  listSupportLedgerRows(limit: number): Promise<SupportLedgerRow[]>;
  recordSupportReconciliationRun(run: SupportReconciliationRunRow): Promise<void>;
}

export interface InMemoryPaymentsState {
  events: ApplyPaymentEventInput[];
  eventOutcomes: Map<string, PaymentEventOutcome>;
  profilesByUserId: Map<string, string>;
  journalistOwners: Map<string, string>;
  payoutAccounts: Map<string, PrivatePayoutAccount>;
  checkoutAttempts: Map<string, SupportCheckoutClaimInput & { checkoutUrl: string | null }>;
  rateBuckets: Map<string, number>;
  ledgerRows: SupportLedgerRow[];
  reconciliationRuns: SupportReconciliationRunRow[];
}

const RATE_CAPACITY: Record<SupportRateScope, number> = { supporter: 10, recipient: 60 };

export function createInMemoryMyNewsPaymentsStore(seed?: {
  profiles?: Array<{ userId: string; profileId: string }>;
  journalists?: Array<{ userId: string; profileId: string }>;
  payoutAccounts?: PrivatePayoutAccount[];
  ledgerRows?: SupportLedgerRow[];
  /** Pre-drained velocity buckets, e.g. { 'supporter:<id>': 0 }. */
  rateBuckets?: Record<string, number>;
}): { store: MyNewsPaymentsStore; state: InMemoryPaymentsState } {
  const state: InMemoryPaymentsState = {
    events: [],
    eventOutcomes: new Map(),
    profilesByUserId: new Map(seed?.profiles?.map((row) => [row.userId, row.profileId])),
    journalistOwners: new Map(seed?.journalists?.map((row) => [row.profileId, row.userId])),
    payoutAccounts: new Map(
      seed?.payoutAccounts?.map((account) => [account.journalistProfileId, { ...account }]),
    ),
    checkoutAttempts: new Map(),
    rateBuckets: new Map(Object.entries(seed?.rateBuckets ?? {})),
    ledgerRows: (seed?.ledgerRows ?? []).map((row) => ({ ...row })),
    reconciliationRuns: [],
  };

  function take(scope: SupportRateScope, subjectId: string): boolean {
    const key = `${scope}:${subjectId}`;
    const remaining = state.rateBuckets.get(key) ?? RATE_CAPACITY[scope];
    if (remaining < 1) {
      state.rateBuckets.set(key, 0);
      return false;
    }
    state.rateBuckets.set(key, remaining - 1);
    return true;
  }

  const store: MyNewsPaymentsStore = {
    async applyPaymentEvent(input) {
      const key = `${input.provider}:${input.providerEventId}`;
      if (state.eventOutcomes.has(key)) return 'duplicate';
      state.events.push(structuredClone(input));
      const outcome: PaymentEventOutcome = 'applied';
      state.eventOutcomes.set(key, outcome);
      return outcome;
    },
    async getProfileIdByUserId(userId) {
      return state.profilesByUserId.get(userId) ?? null;
    },
    async getJournalistPayoutAccount(journalistProfileId) {
      const account = state.payoutAccounts.get(journalistProfileId);
      return account ? { ...account } : null;
    },
    async getOwnedJournalistPayoutAccount(userId) {
      const profileId = [...state.journalistOwners.entries()].find(([, owner]) => owner === userId)?.[0];
      if (!profileId) return null;
      const account = state.payoutAccounts.get(profileId);
      return account ? { ...account } : null;
    },
    async upsertPayoutAccount(input) {
      state.payoutAccounts.set(input.journalistProfileId, { ...input });
    },
    async getJournalistProfileIdByAccountRef(provider, providerAccountRef) {
      for (const account of state.payoutAccounts.values()) {
        if (
          account.provider?.toLowerCase() === provider.toLowerCase() &&
          account.providerAccountRef === providerAccountRef
        ) {
          return account.journalistProfileId;
        }
      }
      return null;
    },
    async claimSupportCheckout(input) {
      const existing = state.checkoutAttempts.get(input.idempotencyKey);
      if (existing) {
        const same =
          existing.supporterProfileId === input.supporterProfileId &&
          existing.journalistProfileId === input.journalistProfileId &&
          existing.amountCents === input.amountCents;
        return same
          ? { status: 'replayed', checkoutUrl: existing.checkoutUrl, rateScope: null }
          : { status: 'conflict', checkoutUrl: null, rateScope: null };
      }
      if (!take('supporter', input.supporterProfileId)) {
        return { status: 'rate-limited', checkoutUrl: null, rateScope: 'supporter' };
      }
      if (!take('recipient', input.journalistProfileId)) {
        return { status: 'rate-limited', checkoutUrl: null, rateScope: 'recipient' };
      }
      state.checkoutAttempts.set(input.idempotencyKey, { ...input, checkoutUrl: null });
      return { status: 'new', checkoutUrl: null, rateScope: null };
    },
    async recordSupportCheckoutUrl(idempotencyKey, checkoutUrl) {
      const attempt = state.checkoutAttempts.get(idempotencyKey);
      if (attempt && attempt.checkoutUrl === null) attempt.checkoutUrl = checkoutUrl;
    },
    async listSupportLedgerRows(limit) {
      return state.ledgerRows.slice(0, limit).map((row) => ({ ...row }));
    },
    async recordSupportReconciliationRun(run) {
      state.reconciliationRuns.push({ ...run, findings: [...run.findings] });
    },
  };

  return { store, state };
}

interface StoreConfig {
  url: string;
  serviceRoleKey: string;
}

function requiredConfig(env: (key: string) => string | undefined): StoreConfig {
  const url = env('SUPABASE_URL')?.trim().replace(/\/+$/, '');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
  }
  return { url, serviceRoleKey };
}

class PostgrestMyNewsPaymentsStore implements MyNewsPaymentsStore {
  constructor(
    private readonly config: StoreConfig,
    private readonly send: typeof fetch,
  ) {}

  async applyPaymentEvent(input: ApplyPaymentEventInput): Promise<PaymentEventOutcome> {
    const result = await this.json<PaymentEventOutcome>('/rest/v1/rpc/nw_apply_payment_event', {
      method: 'POST',
      body: JSON.stringify({
        p_provider: input.provider,
        p_provider_event_id: input.providerEventId,
        p_event_type: input.eventType,
        p_payload: input.payload,
        p_occurred_at: input.occurredAt,
        p_provider_account_ref: input.providerAccountRef ?? null,
        p_resolved_journalist_profile_id: input.resolvedJournalistProfileId ?? null,
      }),
    });
    if (!PAYMENT_EVENT_OUTCOMES.includes(result)) {
      throw new Error(`nw_apply_payment_event returned an unknown outcome: ${String(result)}`);
    }
    return result;
  }

  async getJournalistProfileIdByAccountRef(
    provider: string,
    providerAccountRef: string,
  ): Promise<string | null> {
    const rows = await this.json<Array<{ journalist_profile_id: string }>>(
      '/rest/v1/nw_payout_accounts?select=journalist_profile_id' +
        `&provider=eq.${encodeURIComponent(provider.toLowerCase())}` +
        `&provider_account_ref=eq.${encodeURIComponent(providerAccountRef)}&limit=1`,
    );
    return rows[0]?.journalist_profile_id ?? null;
  }

  async claimSupportCheckout(input: SupportCheckoutClaimInput): Promise<SupportCheckoutClaim> {
    const rows = await this.json<
      Array<{ status: string; checkout_url: string | null; rate_scope: string | null }>
    >('/rest/v1/rpc/nw_begin_support_checkout', {
      method: 'POST',
      body: JSON.stringify({
        p_idempotency_key: input.idempotencyKey,
        p_supporter_profile_id: input.supporterProfileId,
        p_journalist_profile_id: input.journalistProfileId,
        p_amount_cents: input.amountCents,
      }),
    });
    const row = rows[0];
    if (!row) throw new Error('nw_begin_support_checkout returned no row');
    const status = row.status as SupportCheckoutClaim['status'];
    if (!['new', 'replayed', 'conflict', 'rate-limited', 'bad-request'].includes(status)) {
      throw new Error(`nw_begin_support_checkout returned an unknown status: ${row.status}`);
    }
    const rateScope =
      row.rate_scope === 'supporter' || row.rate_scope === 'recipient' ? row.rate_scope : null;
    return { status, checkoutUrl: row.checkout_url ?? null, rateScope };
  }

  async recordSupportCheckoutUrl(idempotencyKey: string, checkoutUrl: string): Promise<void> {
    const result = await this.json<string>('/rest/v1/rpc/nw_record_support_checkout_url', {
      method: 'POST',
      body: JSON.stringify({
        p_idempotency_key: idempotencyKey,
        p_checkout_url: checkoutUrl,
      }),
    });
    if (result !== 'recorded' && result !== 'already-recorded') {
      throw new Error(`nw_record_support_checkout_url returned ${String(result)}`);
    }
  }

  async listSupportLedgerRows(limit: number): Promise<SupportLedgerRow[]> {
    const select = [
      'id',
      'supporter_profile_id',
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
    const rows = await this.json<
      Array<{
        id: string;
        supporter_profile_id: string | null;
        journalist_profile_id: string;
        kind: string;
        amount_cents: number;
        currency: string;
        provider: string;
        provider_ref: string | null;
        idempotency_key: string;
        state: string;
        created_at: string;
      }>
    >(
      `/rest/v1/nw_support_ledger?select=${select}&order=created_at.desc&limit=${Math.trunc(limit)}`,
    );
    return rows.map((row) => ({
      id: row.id,
      supporterProfileId: row.supporter_profile_id,
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

  async recordSupportReconciliationRun(run: SupportReconciliationRunRow): Promise<void> {
    await this.json<unknown>(
      '/rest/v1/nw_support_reconciliation_runs',
      {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          worker_ref: run.workerRef,
          started_at: run.startedAt,
          finished_at: run.finishedAt,
          ledger_rows: run.ledgerRows,
          pair_count: run.pairCount,
          ok: run.ok,
          mismatch_count: run.mismatchCount,
          findings: run.findings,
        }),
      },
      [200, 201, 204],
    );
  }

  async getProfileIdByUserId(userId: string): Promise<string | null> {
    const rows = await this.json<Array<{ id: string }>>(
      `/rest/v1/nw_profiles?select=id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );
    return rows[0]?.id ?? null;
  }

  async getJournalistPayoutAccount(
    journalistProfileId: string,
  ): Promise<PrivatePayoutAccount | null> {
    const rows = await this.json<Array<{
      journalist_profile_id: string;
      onboarding_state: PrivatePayoutAccount['onboardingState'];
      provider: string | null;
      provider_account_ref: string | null;
      status_reason: string | null;
    }>>(
      '/rest/v1/nw_payout_accounts?' +
        'select=journalist_profile_id,onboarding_state,provider,provider_account_ref,status_reason' +
        `&journalist_profile_id=eq.${encodeURIComponent(journalistProfileId)}&limit=1`,
    );
    return rows[0] ? this.mapPayoutAccount(rows[0]) : null;
  }

  async getOwnedJournalistPayoutAccount(userId: string): Promise<PrivatePayoutAccount | null> {
    const profileId = await this.getProfileIdByUserId(userId);
    if (!profileId) return null;
    const journalists = await this.json<Array<{ profile_id: string }>>(
      `/rest/v1/nw_journalists?select=profile_id&profile_id=eq.${encodeURIComponent(profileId)}&limit=1`,
    );
    if (!journalists[0]) return null;
    return (
      (await this.getJournalistPayoutAccount(profileId)) ?? {
        journalistProfileId: profileId,
        onboardingState: 'none',
        provider: null,
        providerAccountRef: null,
        statusReason: null,
      }
    );
  }

  async upsertPayoutAccount(input: PrivatePayoutAccount): Promise<void> {
    await this.json<unknown>('/rest/v1/nw_payout_accounts?on_conflict=journalist_profile_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        journalist_profile_id: input.journalistProfileId,
        onboarding_state: input.onboardingState,
        provider: input.provider,
        provider_account_ref: input.providerAccountRef,
        status_reason: input.statusReason,
        updated_at: new Date().toISOString(),
      }),
    }, [200, 201, 204]);
  }

  private mapPayoutAccount(row: {
    journalist_profile_id: string;
    onboarding_state: PrivatePayoutAccount['onboardingState'];
    provider: string | null;
    provider_account_ref: string | null;
    status_reason: string | null;
  }): PrivatePayoutAccount {
    return {
      journalistProfileId: row.journalist_profile_id,
      onboardingState: row.onboarding_state,
      provider: row.provider,
      providerAccountRef: row.provider_account_ref,
      statusReason: row.status_reason,
    };
  }

  private async json<T>(
    path: string,
    init: RequestInit = {},
    okStatuses: readonly number[] = [200, 201],
  ): Promise<T> {
    const response = await this.send(`${this.config.url}${path}`, {
      ...init,
      headers: {
        apikey: this.config.serviceRoleKey,
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (!okStatuses.includes(response.status)) {
      const body = await response.text().catch(() => '');
      throw new Error(`MyNews payments store failed with HTTP ${response.status}${body ? `: ${body}` : ''}`);
    }
    const body = await response.text();
    return (body ? JSON.parse(body) : null) as T;
  }
}

export function createPostgrestMyNewsPaymentsStore(
  env: (key: string) => string | undefined,
  send: typeof fetch,
): MyNewsPaymentsStore {
  return new PostgrestMyNewsPaymentsStore(requiredConfig(env), send);
}

