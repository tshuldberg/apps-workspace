import { randomBytes as nodeRandomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bytesToHex,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createPersonaClaim,
  extractPersonaPrivateKeyHex,
  generatePublicPersona,
  humanityServiceKeypairFromSeed,
  issueHumanityTokenBatch,
  serializeHumanityToken,
  sha512Hex,
  signMessage,
  type PublicPersona,
} from '@mylife/sync';
import { HumanityService } from '../../humanity-service';
import {
  PersonaRegistryService,
  type PersonaRecord,
  type PersonaRegistrationAttempt,
} from '../../persona-registry';
import {
  PERSONA_GDPR_DELETE_DOMAIN,
  personaRequestBytes,
} from '../../persona-session';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresHumanityStore } from '../stores/humanity-store';
import { PostgresPersonaRegistryStore } from '../stores/persona-registry-store';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTestEnabled = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString ? describe.sequential : describe.skip;
const humanityKeys = humanityServiceKeypairFromSeed('6'.repeat(64));
const encoder = new TextEncoder();

function makeRecord(alias: string): { persona: PublicPersona; record: PersonaRecord } {
  const persona = generatePublicPersona(alias);
  const humanityBinding = 'a'.repeat(128);
  const claim = createPersonaClaim({ persona, humanityBinding });
  return {
    persona,
    record: {
      version: 1,
      alias,
      personaPubkey: persona.personaPubkey,
      humanityBinding,
      claim,
      createdAt: new Date().toISOString(),
    },
  };
}

function signDelete(persona: PublicPersona, issuedAtMs: number): string {
  const privateKey = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
  return bytesToHex(signMessage(
    privateKey,
    personaRequestBytes(PERSONA_GDPR_DELETE_DOMAIN, persona.personaPubkey, issuedAtMs),
  ));
}

function makeSagaAccount(alias: string): { record: PersonaRecord; wireToken: string } {
  const persona = generatePublicPersona(alias);
  const [token] = issueHumanityTokenBatch({
    servicePrivateKeyHex: humanityKeys.privateKeyHex,
    count: 1,
    now: Date.now(),
    randomBytes: (length) => new Uint8Array(nodeRandomBytes(length)),
  });
  const humanityBinding = sha512Hex(encoder.encode(token!.tokenId));
  const claim = createPersonaClaim({ persona, humanityBinding });
  return {
    record: {
      version: 1,
      alias,
      personaPubkey: persona.personaPubkey,
      humanityBinding,
      claim,
      createdAt: new Date().toISOString(),
    },
    wireToken: serializeHumanityToken(token!),
  };
}

describePostgres('PostgresPersonaRegistryStore multi-instance integration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_persona_${suffix}`;
  let adminPool: Pool | undefined;
  let firstPool: Pool | undefined;
  let secondPool: Pool | undefined;
  let first: PostgresPersonaRegistryStore;
  let second: PostgresPersonaRegistryStore;
  let firstHumanity: HumanityService;
  let secondHumanity: HumanityService;

  beforeAll(async () => {
    configureSyncSecretStore(createInMemorySyncSecretStore());
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    const currentName = current.rows[0]?.name ?? '';
    if (!destructiveTestEnabled || !/^meerkat_(?:ci|test)(?:_|$)/u.test(currentName)) {
      throw new Error(
        'Destructive PostgreSQL integration tests require MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS=true and a meerkat_ci or meerkat_test database',
      );
    }

    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    firstPool = new Pool({
      connectionString: databaseUrl.toString(),
      application_name: 'meerkat-persona-integration-a',
      max: 2,
      statement_timeout: 10_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    });
    firstPool.on('error', () => undefined);
    secondPool = new Pool({
      connectionString: databaseUrl.toString(),
      application_name: 'meerkat-persona-integration-b',
      max: 2,
      statement_timeout: 10_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    });
    secondPool.on('error', () => undefined);
    await runPostgresMigrations(firstPool);
    first = new PostgresPersonaRegistryStore(new PostgresStoreContext(firstPool));
    second = new PostgresPersonaRegistryStore(new PostgresStoreContext(secondPool));
    firstHumanity = new HumanityService({
      signingKeypair: humanityKeys,
      verifiers: [],
      store: new PostgresHumanityStore(new PostgresStoreContext(firstPool)),
    });
    secondHumanity = new HumanityService({
      signingKeypair: humanityKeys,
      verifiers: [],
      store: new PostgresHumanityStore(new PostgresStoreContext(secondPool)),
    });
  });

  afterAll(async () => {
    await firstPool?.end().catch(() => undefined);
    await secondPool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  it('lets one database instance win a shared alias race', async () => {
    const a = makeRecord('pgrivals').record;
    const b = makeRecord('pgrivals').record;
    const outcomes = await Promise.all([
      first.tryRegister(a),
      second.tryRegister(b),
    ]);

    expect(outcomes.filter((outcome) => outcome === 'ok')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === 'alias_taken')).toHaveLength(1);
  });

  it('enforces cooldown with database time across instances', async () => {
    const original = makeRecord('pgcooldown').record;
    expect(await first.tryRegister(original)).toBe('ok');
    const releasedAtMs = Date.now();
    await first.release(original.alias, {
      alias: original.alias,
      personaPubkey: original.personaPubkey,
      releasedAt: new Date(releasedAtMs).toISOString(),
      reregisterBlockedUntilMs: releasedAtMs + 500,
    });

    const replacement = makeRecord('pgcooldown').record;
    // A deliberately far-future application clock cannot bypass the database cooldown.
    await expect(second.tryRegister(replacement, Number.MAX_SAFE_INTEGER))
      .resolves.toBe('alias_cooldown');
    await firstPool!.query('SELECT pg_sleep(0.55)');
    // A deliberately stale application clock cannot keep an expired database tombstone alive.
    await expect(second.tryRegister(replacement, 0)).resolves.toBe('ok');
  });

  it('recovers a lost humanity response and commits once across persona replicas', async () => {
    const account = makeSagaAccount('pgsagaretry');
    let loseFirstResponse = true;
    const firstService = new PersonaRegistryService({
      store: first,
      sessionSecret: 'persona-postgres-saga-session-secret',
      redeemHumanity: async (token, registration) => {
        const result = await firstHumanity.redeemRegistration({ token, ...registration! });
        if (loseFirstResponse) {
          loseFirstResponse = false;
          throw new Error('injected response loss');
        }
        return result;
      },
    });
    const secondService = new PersonaRegistryService({
      store: second,
      sessionSecret: 'persona-postgres-saga-session-secret',
      redeemHumanity: (token, registration) => secondHumanity.redeemRegistration({
        token,
        ...registration!,
      }),
    });

    await expect(firstService.register({
      claim: account.record.claim,
      humanityToken: account.wireToken,
    })).resolves.toEqual({ ok: false, reason: 'humanity_unreachable' });
    await expect(first.getByAlias(account.record.alias)).resolves.toBeNull();
    await expect(secondService.register({
      claim: account.record.claim,
      humanityToken: account.wireToken,
    })).resolves.toMatchObject({ ok: true, alias: account.record.alias });

    const state = await firstPool!.query<{ state: string }>(
      `SELECT state FROM persona.registration_attempts WHERE alias = $1`,
      [account.record.alias],
    );
    expect(state.rows).toEqual([{ state: 'committed' }]);
    const receipts = await firstPool!.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM humanity.registration_redemptions',
    );
    expect(receipts.rows[0]?.count).toBe('1');
  });

  it('releases expired reservations with database time and sweeps verified recovery', async () => {
    const abandoned = makeRecord('pgsagaexpiry').record;
    const abandonedAttempt: PersonaRegistrationAttempt = {
      version: 1,
      attemptId: 'e'.repeat(64),
      requestDigest: 'f'.repeat(64),
      state: 'reserved',
      record: abandoned,
      createdAt: abandoned.createdAt,
      updatedAt: abandoned.createdAt,
    };
    await expect(first.beginRegistrationAttempt(abandonedAttempt, Number.MAX_SAFE_INTEGER))
      .resolves.toBe('reserved');
    await firstPool!.query(
      `UPDATE persona.registration_attempts
       SET created_at = clock_timestamp() - interval '2 days',
           updated_at = clock_timestamp() - interval '2 days',
           reservation_expires_at = clock_timestamp() - interval '1 second'
       WHERE attempt_id = $1`,
      [abandonedAttempt.attemptId],
    );

    const replacement = makeRecord('pgsagaexpiry').record;
    const replacementAttempt: PersonaRegistrationAttempt = {
      ...abandonedAttempt,
      attemptId: '1'.repeat(63) + '2',
      requestDigest: '2'.repeat(63) + '3',
      record: replacement,
      createdAt: replacement.createdAt,
      updatedAt: replacement.createdAt,
    };
    await expect(second.beginRegistrationAttempt(replacementAttempt, 0)).resolves.toBe('reserved');
    await second.cancelRegistrationAttempt(
      replacementAttempt.attemptId,
      replacementAttempt.requestDigest,
    );

    const recoverable = makeRecord('pgsagarecover').record;
    const recoverableAttempt: PersonaRegistrationAttempt = {
      ...abandonedAttempt,
      attemptId: '3'.repeat(64),
      requestDigest: '4'.repeat(64),
      record: recoverable,
      createdAt: recoverable.createdAt,
      updatedAt: recoverable.createdAt,
    };
    await expect(first.beginRegistrationAttempt(recoverableAttempt)).resolves.toBe('reserved');
    await expect(first.markRegistrationHumanityVerified(
      recoverableAttempt.attemptId,
      recoverableAttempt.requestDigest,
    )).resolves.toBe('ok');
    await second.prune(0);
    await expect(first.getByAlias(recoverable.alias)).resolves.toEqual(recoverable);
  });

  it('returns the same success to concurrent identical retries', async () => {
    const account = makeSagaAccount('pgsagadupe');
    const firstService = new PersonaRegistryService({
      store: first,
      sessionSecret: 'persona-postgres-saga-session-secret',
      redeemHumanity: (token, registration) => firstHumanity.redeemRegistration({
        token,
        ...registration!,
      }),
    });
    const secondService = new PersonaRegistryService({
      store: second,
      sessionSecret: 'persona-postgres-saga-session-secret',
      redeemHumanity: (token, registration) => secondHumanity.redeemRegistration({
        token,
        ...registration!,
      }),
    });
    const results = await Promise.all([
      firstService.register({ claim: account.record.claim, humanityToken: account.wireToken }),
      secondService.register({ claim: account.record.claim, humanityToken: account.wireToken }),
    ]);
    expect(results).toEqual([
      { ok: true, alias: account.record.alias, personaPubkey: account.record.personaPubkey },
      { ok: true, alias: account.record.alias, personaPubkey: account.record.personaPubkey },
    ]);
    const active = await firstPool!.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM persona.records WHERE alias = $1',
      [account.record.alias],
    );
    expect(active.rows[0]?.count).toBe('1');
  });

  it('does not spend the losing token in a two-pool alias race', async () => {
    const accounts = [makeSagaAccount('pgrealrace'), makeSagaAccount('pgrealrace')];
    const services = [
      new PersonaRegistryService({
        store: first,
        sessionSecret: 'persona-postgres-saga-session-secret',
        redeemHumanity: (token, registration) => firstHumanity.redeemRegistration({
          token,
          ...registration!,
        }),
      }),
      new PersonaRegistryService({
        store: second,
        sessionSecret: 'persona-postgres-saga-session-secret',
        redeemHumanity: (token, registration) => secondHumanity.redeemRegistration({
          token,
          ...registration!,
        }),
      }),
    ];
    const results = await Promise.all(services.map((service, index) => service.register({
      claim: accounts[index]!.record.claim,
      humanityToken: accounts[index]!.wireToken,
    })));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const loserIndex = results.findIndex((result) => !result.ok);
    await expect(firstHumanity.redeem(accounts[loserIndex]!.wireToken))
      .resolves.toEqual({ ok: true });
  });

  it('serializes GDPR delete against unsuspend across service replicas', async () => {
    const { persona, record } = makeRecord('pgdelete');
    const issuedAtMs = Date.now();
    const firstService = new PersonaRegistryService({
      store: first,
      sessionSecret: 'persona-postgres-integration-session-secret',
      humanityRequired: false,
      now: () => issuedAtMs,
    });
    const secondService = new PersonaRegistryService({
      store: second,
      sessionSecret: 'persona-postgres-integration-session-secret',
      humanityRequired: false,
      now: () => issuedAtMs,
    });
    await expect(firstService.register({ claim: record.claim })).resolves.toMatchObject({ ok: true });
    await expect(firstService.suspendPersona(persona.personaPubkey)).resolves.toMatchObject({ ok: true });

    const [deleted] = await Promise.all([
      firstService.deleteAccount({
        personaPubkey: persona.personaPubkey,
        issuedAtMs,
        signatureHex: signDelete(persona, issuedAtMs),
      }),
      secondService.unsuspendPersona(persona.personaPubkey),
    ]);

    expect(deleted).toMatchObject({ ok: true, releasedAlias: record.alias });
    await expect(first.getByPubkey(persona.personaPubkey)).resolves.toBeNull();
    await expect(second.isRevoked(persona.personaPubkey)).resolves.toBe(true);
    await expect(second.getTombstone(record.alias)).resolves.toMatchObject({
      alias: record.alias,
      personaPubkey: persona.personaPubkey,
    });
    const reason = await firstPool!.query<{ reason: string }>(
      'SELECT reason FROM persona.revocations WHERE persona_pubkey = $1',
      [persona.personaPubkey],
    );
    expect(reason.rows[0]?.reason).toBe('gdpr_delete');
  });

  it('batches reverse lookup and rejects corrupt JSON projections', async () => {
    const a = makeRecord('pgbatchone').record;
    const b = makeRecord('pgbatchtwo').record;
    await first.tryRegister(a);
    await first.tryRegister(b);
    await expect(second.getByPubkeys([a.personaPubkey, b.personaPubkey]))
      .resolves.toHaveLength(2);

    const corruptPubkey = 'c'.repeat(64);
    await firstPool!.query(
      `INSERT INTO persona.records (alias, persona_pubkey, created_at, payload)
       VALUES ('pgcorrupt', $1, clock_timestamp(), '{}')`,
      [corruptPubkey],
    );
    await expect(first.getByAlias('pgcorrupt')).rejects.toThrow(/record payload is invalid/u);
  });
});
