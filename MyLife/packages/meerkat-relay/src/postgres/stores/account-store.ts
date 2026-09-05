/**
 * Plan 51 P1: PostgreSQL-backed AccountStore over migration 18's account.* schema.
 *
 * THE WALL: this store touches account.accounts / account.entitlements /
 * account.credential_issuance / account.epoch_signing_keys only. It never reads or
 * writes a serial, persona, or device identifier. The one-per-epoch quota is an
 * INSERT ... ON CONFLICT DO NOTHING whose rowCount reports already_issued.
 */

import type { QueryResult, QueryResultRow } from 'pg';
import {
  accountDay,
  canIssueCredential,
  type IssuanceEligibility,
  canRecordCredentialIssuance,
  isCredentialIssuanceReplay,
  accountSubjectTombstoneHash,
  carriedAntiAbuseFromRecord,
  type AccountAgeSource,
  type AccountAgeStatus,
  type AccountProvider,
  type AccountRecord,
  type AccountStore,
  type AccountStoreStats,
  type CarriedAntiAbuseState,
  type DeleteAccountInput,
  type EntitlementProduct,
  type EntitlementRail,
  type EntitlementRecord,
  type EntitlementStatus,
  type RecordEntitlementInput,
  type RecordIssuanceOutcome,
  type UpsertAccountInput,
} from '../../account-store';

/**
 * SQL fragment ranking an age-status column so a more restrictive determination
 * never regresses on a tombstone merge (mirrors the AGE_STATUS_RANK in the store
 * core): store_minor(3) > gate_outcome(2) > store_adult(1) > unknown(0).
 */
function AGE_STATUS_RANK_SQL(col: string): string {
  return `CASE ${col} WHEN 'store_minor' THEN 3 WHEN 'gate_outcome' THEN 2 WHEN 'store_adult' THEN 1 ELSE 0 END`;
}

interface TombstoneRow extends QueryResultRow {
  recreate_after: Date | string;
  age_status: string;
  age_source: string | null;
  parental_consent_state: string;
  renewal_flagged_at: Date | string | null;
  flag_reason_code: string | null;
  latest_issued_epoch: number | null;
}
import {
  PostgresStoreContext,
  toPostgresStoreUnavailableError,
} from '../store-context';

interface AccountRow extends QueryResultRow {
  latest_issued_request_hash: string | null;
  account_id: string;
  provider: string;
  provider_subject: string;
  relay_email: string | null;
  human_verified_at: Date | string | null;
  age_status: string;
  age_source: string | null;
  parental_consent_state: string;
  renewal_flagged_at: Date | string | null;
  flag_reason_code: string | null;
  latest_issued_epoch: number | null;
  created_day: Date | string;
}

interface EntitlementRow extends QueryResultRow {
  account_id: string;
  product: string;
  rail: string;
  status: string;
  valid_until: Date | string | null;
  updated_at: Date | string;
}

interface CountRow extends QueryResultRow {
  count: string;
}

const AGE_STATUSES = new Set<AccountAgeStatus>(['unknown', 'store_adult', 'store_minor', 'gate_outcome']);
const AGE_SOURCES = new Set<AccountAgeSource>(['apple_store', 'google_store', 'in_app_gate']);

function timestampIso(value: Date | string | null, field: string): string | undefined {
  if (value === null) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`PostgreSQL ${field} is invalid`);
  return parsed.toISOString();
}

function dayString(value: Date | string, field: string): string {
  if (typeof value === 'string') {
    // pg returns a `date` column as a YYYY-MM-DD string with the driver default.
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`PostgreSQL ${field} is invalid`);
  return parsed.toISOString().slice(0, 10);
}

function mapAccount(row: AccountRow): AccountRecord {
  const ageStatus = row.age_status as AccountAgeStatus;
  if (!AGE_STATUSES.has(ageStatus)) throw new Error('PostgreSQL account age_status is invalid');
  const humanVerifiedAt = timestampIso(row.human_verified_at, 'account human_verified_at');
  const renewalFlaggedAt = timestampIso(row.renewal_flagged_at, 'account renewal_flagged_at');
  return {
    ...(row.latest_issued_request_hash ? { latestIssuedRequestHash: row.latest_issued_request_hash } : {}),
    accountId: row.account_id,
    provider: row.provider as AccountProvider,
    providerSubject: row.provider_subject,
    ...(row.relay_email ? { relayEmail: row.relay_email } : {}),
    ...(humanVerifiedAt ? { humanVerifiedAt } : {}),
    ageStatus,
    ...(row.latest_issued_epoch != null ? { latestIssuedEpoch: Number(row.latest_issued_epoch) } : {}),
    ...(row.age_source ? { ageSource: row.age_source as AccountAgeSource } : {}),
    parentalConsentState: row.parental_consent_state as AccountRecord['parentalConsentState'],
    ...(renewalFlaggedAt ? { renewalFlaggedAt } : {}),
    ...(row.flag_reason_code ? { flagReasonCode: row.flag_reason_code } : {}),
    createdDay: dayString(row.created_day, 'account created_day'),
  };
}

function mapTombstoneCarried(row: TombstoneRow): CarriedAntiAbuseState {
  const ageStatus = row.age_status as AccountAgeStatus;
  if (!AGE_STATUSES.has(ageStatus)) throw new Error('PostgreSQL tombstone age_status is invalid');
  const renewalFlaggedAt = timestampIso(row.renewal_flagged_at, 'tombstone renewal_flagged_at');
  return {
    ageStatus,
    ...(row.latest_issued_epoch != null ? { latestIssuedEpoch: Number(row.latest_issued_epoch) } : {}),
    ...(row.age_source ? { ageSource: row.age_source as AccountAgeSource } : {}),
    parentalConsentState: row.parental_consent_state as CarriedAntiAbuseState['parentalConsentState'],
    ...(renewalFlaggedAt ? { renewalFlaggedAt } : {}),
    ...(row.flag_reason_code ? { flagReasonCode: row.flag_reason_code } : {}),
  };
}

function mapEntitlement(row: EntitlementRow): EntitlementRecord {
  const updatedAt = timestampIso(row.updated_at, 'entitlement updated_at');
  const validUntil = timestampIso(row.valid_until, 'entitlement valid_until');
  return {
    accountId: row.account_id,
    product: row.product as EntitlementProduct,
    rail: row.rail as EntitlementRail,
    status: row.status as EntitlementStatus,
    ...(validUntil ? { validUntil } : {}),
    updatedAt: updatedAt ?? new Date(0).toISOString(),
  };
}

export class PostgresAccountStore implements AccountStore {
  constructor(
    private readonly context: PostgresStoreContext,
    private readonly subjectHashSecret?: string,
  ) {}

  private async query<Row extends QueryResultRow = QueryResultRow>(
    operation: string,
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.context.query<Row>(text, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError(operation, error);
    }
  }

  async upsertAccount(input: UpsertAccountInput): Promise<AccountRecord | null> {
    const subjectHash = accountSubjectTombstoneHash(input.provider, input.providerSubject, this.subjectHashSecret);
    return this.context.withAdvisoryTransactionLock('account-deleted-subject', subjectHash, async () => {
      // Read the tombstone (timer + carried anti-abuse flags) before touching it.
      const tombstone = await this.query<TombstoneRow>(
        'check account deletion tombstone',
        `SELECT recreate_after, age_status, age_source, parental_consent_state,
                renewal_flagged_at, flag_reason_code, latest_issued_epoch
         FROM account.deleted_subjects WHERE subject_hash = $1`,
        [subjectHash],
      );
      const marker = tombstone.rows[0];
      let carried: CarriedAntiAbuseState | null = null;
      if (marker) {
        if (new Date(marker.recreate_after).getTime() > input.nowMs) return null; // still blocked
        carried = mapTombstoneCarried(marker);
        await this.query(
          'expire account deletion tombstone',
          'DELETE FROM account.deleted_subjects WHERE subject_hash = $1',
          [subjectHash],
        );
      }

      // Insert-if-absent by (provider, subject). A FRESH account is seeded with the
      // carried anti-abuse flags (HIGH-1); ON CONFLICT leaves an existing account's
      // own flags untouched (it only fills a missing relay email / human_verified_at).
      const result = await this.query<AccountRow>(
        'upsert account',
        `INSERT INTO account.accounts
           (provider, provider_subject, relay_email, human_verified_at, created_day,
            age_status, age_source, parental_consent_state, renewal_flagged_at, flag_reason_code, latest_issued_epoch)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (provider, provider_subject) DO UPDATE SET
           relay_email = COALESCE(account.accounts.relay_email, EXCLUDED.relay_email),
           human_verified_at = COALESCE(account.accounts.human_verified_at, EXCLUDED.human_verified_at)
         RETURNING account_id, provider, provider_subject, relay_email, human_verified_at,
                   age_status, age_source, parental_consent_state, renewal_flagged_at,
                   flag_reason_code, latest_issued_epoch, latest_issued_request_hash, created_day`,
        [
          input.provider,
          input.providerSubject,
          input.relayEmail ?? null,
          new Date(input.nowMs).toISOString(),
          accountDay(input.nowMs),
          carried?.ageStatus ?? 'unknown',
          carried?.ageSource ?? null,
          carried?.parentalConsentState ?? 'not_required',
          carried?.renewalFlaggedAt ?? null,
          carried?.flagReasonCode ?? null,
          carried?.latestIssuedEpoch ?? null,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('PostgreSQL account upsert returned no row');
      return mapAccount(row);
    });
  }

  async getAccountById(accountId: string): Promise<AccountRecord | null> {
    const result = await this.query<AccountRow>(
      'get account by id',
      `SELECT account_id, provider, provider_subject, relay_email, human_verified_at,
              age_status, age_source, parental_consent_state, renewal_flagged_at,
              flag_reason_code, latest_issued_epoch, latest_issued_request_hash, created_day
       FROM account.accounts WHERE account_id = $1`,
      [accountId],
    );
    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }

  async getAccountByProviderSubject(provider: AccountProvider, providerSubject: string): Promise<AccountRecord | null> {
    const result = await this.query<AccountRow>(
      'get account by provider subject',
      `SELECT account_id, provider, provider_subject, relay_email, human_verified_at,
              age_status, age_source, parental_consent_state, renewal_flagged_at,
              flag_reason_code, latest_issued_epoch, latest_issued_request_hash, created_day
       FROM account.accounts WHERE provider = $1 AND provider_subject = $2`,
      [provider, providerSubject],
    );
    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }

  async setAgeStatus(accountId: string, status: AccountAgeStatus, source: AccountAgeSource): Promise<void> {
    if (!AGE_STATUSES.has(status) || !AGE_SOURCES.has(source)) throw new Error('Invalid age status/source');
    await this.query(
      'set age status',
      'UPDATE account.accounts SET age_status = $2, age_source = $3 WHERE account_id = $1',
      [accountId, status, source],
    );
  }

  async flagRenewal(accountId: string, reasonCode: string, nowMs: number): Promise<void> {
    await this.query(
      'flag renewal',
      `UPDATE account.accounts
       SET renewal_flagged_at = COALESCE(renewal_flagged_at, $2), flag_reason_code = $3
       WHERE account_id = $1`,
      [accountId, new Date(nowMs).toISOString(), reasonCode],
    );
  }

  async recordEntitlement(input: RecordEntitlementInput): Promise<void> {
    await this.query(
      'record entitlement',
      `INSERT INTO account.entitlements (account_id, product, rail, status, valid_until, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (account_id, product) DO UPDATE SET
         rail = EXCLUDED.rail, status = EXCLUDED.status,
         valid_until = EXCLUDED.valid_until, updated_at = EXCLUDED.updated_at`,
      [
        input.accountId,
        input.product,
        input.rail,
        input.status,
        input.validUntil ?? null,
        new Date(input.nowMs).toISOString(),
      ],
    );
  }

  async getEntitlements(accountId: string): Promise<EntitlementRecord[]> {
    const result = await this.query<EntitlementRow>(
      'get entitlements',
      `SELECT account_id, product, rail, status, valid_until, updated_at
       FROM account.entitlements WHERE account_id = $1`,
      [accountId],
    );
    return result.rows.map(mapEntitlement);
  }

  async recordIssuance(
    accountId: string, epoch: number, nowMs: number, expectedPreviousEpoch?: number | null, requestHash?: string, eligibility?: IssuanceEligibility,
  ): Promise<RecordIssuanceOutcome> {
    return this.context.withAdvisoryTransactionLock('account-issuance', accountId, async () => {
      // Row lock also serializes account deletion and carries the final epoch to its tombstone.
      const account = await this.query<AccountRow>(
        'lock issuance continuity',
        'SELECT * FROM account.accounts WHERE account_id = $1 FOR UPDATE',
        [accountId],
      );
      const row = account.rows[0];
      if (eligibility && !canIssueCredential(row ? mapAccount(row) : null, await this.getEntitlements(accountId),
        eligibility.now(), eligibility.blockMinorIssuance)) return 'already_issued';
      if (row && isCredentialIssuanceReplay({
        latestIssuedEpoch: row.latest_issued_epoch ?? undefined,
        latestIssuedRequestHash: row.latest_issued_request_hash ?? undefined,
      }, epoch, requestHash)) return 'recorded';
      if (!row || !canRecordCredentialIssuance(
        row.latest_issued_epoch == null ? undefined : Number(row.latest_issued_epoch), expectedPreviousEpoch, epoch,
      )) return 'already_issued';
      const result = await this.query(
        'record issuance',
        `INSERT INTO account.credential_issuance (account_id, epoch, issued_day)
         VALUES ($1, $2, $3) ON CONFLICT (account_id, epoch) DO NOTHING`,
        [accountId, epoch, accountDay(nowMs)],
      );
      if ((result.rowCount ?? 0) === 0) return 'already_issued';
      await this.query(
        'advance issuance continuity',
        'UPDATE account.accounts SET latest_issued_epoch = GREATEST(latest_issued_epoch, $2), latest_issued_request_hash = $3 WHERE account_id = $1',
        [accountId, epoch, requestHash ?? null],
      );
      return 'recorded';
    });
  }

  async putSealedEpochKey(epoch: number, sealedPrivateKey: string): Promise<void> {
    await this.query(
      'put sealed epoch key',
      `INSERT INTO account.epoch_signing_keys (epoch, sealed_private_key)
       VALUES ($1, $2)
       ON CONFLICT (epoch) DO NOTHING`,
      [epoch, sealedPrivateKey],
    );
  }

  async getSealedEpochKey(epoch: number): Promise<string | null> {
    const result = await this.query<{ sealed_private_key: string } & QueryResultRow>(
      'get sealed epoch key',
      'SELECT sealed_private_key FROM account.epoch_signing_keys WHERE epoch = $1',
      [epoch],
    );
    return result.rows[0]?.sealed_private_key ?? null;
  }

  async deleteAccount(input: DeleteAccountInput): Promise<void> {
    const subjectHash = accountSubjectTombstoneHash(input.provider, input.providerSubject, this.subjectHashSecret);
    await this.context.withAdvisoryTransactionLock('account-deleted-subject', subjectHash, async () => {
      // Matching the verified subject as well as the id keeps the tombstone bound
      // to the exact account the service reauthenticated. Child rows cascade.
      const deleted = await this.query<AccountRow>(
        'delete account',
        `DELETE FROM account.accounts
         WHERE account_id = $1 AND provider = $2 AND provider_subject = $3
         RETURNING account_id, provider, provider_subject, relay_email, human_verified_at,
                   age_status, age_source, parental_consent_state, renewal_flagged_at,
                   flag_reason_code, latest_issued_epoch, latest_issued_request_hash, created_day`,
        [input.accountId, input.provider, input.providerSubject],
      );
      const removed = deleted.rows[0];
      if (!removed) return;
      // Carry the deleted account's anti-abuse flags onto the tombstone so a
      // delete-and-recreate cannot launder a minor determination or renewal flag
      // (HIGH-1). GREATEST/most-restrictive merge on a re-deletion of a recreated
      // subject: never downgrade a prior minor status or drop a renewal flag.
      const carried = carriedAntiAbuseFromRecord(mapAccount(removed));
      await this.query(
        'record account deletion tombstone',
        `INSERT INTO account.deleted_subjects
           (subject_hash, recreate_after, age_status, age_source, parental_consent_state,
            renewal_flagged_at, flag_reason_code, latest_issued_epoch)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (subject_hash) DO UPDATE SET
           recreate_after = GREATEST(account.deleted_subjects.recreate_after, EXCLUDED.recreate_after),
           age_status = CASE
             WHEN ${AGE_STATUS_RANK_SQL('EXCLUDED.age_status')} >= ${AGE_STATUS_RANK_SQL('account.deleted_subjects.age_status')}
             THEN EXCLUDED.age_status ELSE account.deleted_subjects.age_status END,
           age_source = CASE
             WHEN ${AGE_STATUS_RANK_SQL('EXCLUDED.age_status')} >= ${AGE_STATUS_RANK_SQL('account.deleted_subjects.age_status')}
             THEN EXCLUDED.age_source ELSE account.deleted_subjects.age_source END,
           parental_consent_state = CASE
             WHEN account.deleted_subjects.parental_consent_state <> 'not_required'
             THEN account.deleted_subjects.parental_consent_state ELSE EXCLUDED.parental_consent_state END,
           renewal_flagged_at = LEAST(
             COALESCE(account.deleted_subjects.renewal_flagged_at, EXCLUDED.renewal_flagged_at),
             COALESCE(EXCLUDED.renewal_flagged_at, account.deleted_subjects.renewal_flagged_at)),
           latest_issued_epoch = GREATEST(account.deleted_subjects.latest_issued_epoch, EXCLUDED.latest_issued_epoch),
           flag_reason_code = COALESCE(account.deleted_subjects.flag_reason_code, EXCLUDED.flag_reason_code)`,
        [
          subjectHash,
          new Date(input.recreateAfterMs).toISOString(),
          carried.ageStatus,
          carried.ageSource ?? null,
          carried.parentalConsentState,
          carried.renewalFlaggedAt ?? null,
          carried.flagReasonCode ?? null,
          carried.latestIssuedEpoch ?? null,
        ],
      );
    });
  }

  async stats(): Promise<AccountStoreStats> {
    const [accounts, entitlements, issuances] = await Promise.all([
      this.query<CountRow>('count accounts', 'SELECT count(*)::text AS count FROM account.accounts'),
      this.query<CountRow>('count entitlements', 'SELECT count(*)::text AS count FROM account.entitlements'),
      this.query<CountRow>('count issuances', 'SELECT count(*)::text AS count FROM account.credential_issuance'),
    ]);
    return {
      accounts: Number(accounts.rows[0]?.count ?? 0),
      entitlements: Number(entitlements.rows[0]?.count ?? 0),
      issuances: Number(issuances.rows[0]?.count ?? 0),
    };
  }
}
