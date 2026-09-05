import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createPersonaClaim,
  generatePublicPersona,
  humanityServiceKeypairFromSeed,
  issueHumanityTokenBatch,
  serializeHumanityToken,
  sha512Hex,
  type PersonaClaim,
} from '@mylife/sync';
import { HumanityService } from '../humanity-service';
import {
  InMemoryPersonaRegistryStore,
  PersonaRegistryService,
  type CommitPersonaRegistrationOutcome,
} from '../persona-registry';

const NOW = Date.parse('2026-07-10T17:00:00.000Z');
const keys = humanityServiceKeypairFromSeed('7'.repeat(64));
const encoder = new TextEncoder();

type CrashPoint = 'before_mark' | 'before_commit' | 'after_commit';

class CrashOncePersonaStore extends InMemoryPersonaRegistryStore {
  constructor(private crashPoint: CrashPoint | null) {
    super();
  }

  override markRegistrationHumanityVerified(
    attemptId: string,
    requestDigest: string,
  ): 'ok' | 'not_found' | 'attempt_conflict' {
    if (this.crashPoint === 'before_mark') {
      this.crashPoint = null;
      throw new Error('injected process death before verified transition');
    }
    return super.markRegistrationHumanityVerified(attemptId, requestDigest);
  }

  override commitRegistrationAttempt(
    attemptId: string,
    requestDigest: string,
    nowMs?: number,
  ): CommitPersonaRegistrationOutcome {
    if (this.crashPoint === 'before_commit') {
      this.crashPoint = null;
      throw new Error('injected process death before active commit');
    }
    const result = super.commitRegistrationAttempt(attemptId, requestDigest, nowMs);
    if (this.crashPoint === 'after_commit') {
      this.crashPoint = null;
      throw new Error('injected response loss after active commit');
    }
    return result;
  }
}

function makeAccount(alias: string): { claim: PersonaClaim; wireToken: string } {
  const persona = generatePublicPersona(alias);
  const [token] = issueHumanityTokenBatch({
    servicePrivateKeyHex: keys.privateKeyHex,
    count: 1,
    now: NOW,
    randomBytes: (length) => new Uint8Array(nodeRandomBytes(length)),
  });
  const humanityBinding = sha512Hex(encoder.encode(token!.tokenId));
  return {
    claim: createPersonaClaim({ persona, humanityBinding }),
    wireToken: serializeHumanityToken(token!),
  };
}

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
});

describe('persona registration crash recovery saga', () => {
  for (const crashPoint of [
    'before_remote',
    'after_remote',
    'before_mark',
    'before_commit',
    'after_commit',
  ] as const) {
    it(`recovers deterministically at ${crashPoint}`, async () => {
      const humanity = new HumanityService({ signingKeypair: keys, verifiers: [], now: () => NOW });
      const store = new CrashOncePersonaStore(
        crashPoint === 'before_mark' || crashPoint === 'before_commit' || crashPoint === 'after_commit'
          ? crashPoint
          : null,
      );
      const account = makeAccount(`crash_${crashPoint.replace('before_', 'b').replace('after_', 'a')}`);
      let transportCrash = crashPoint === 'before_remote' || crashPoint === 'after_remote';
      const remoteResults: Array<{ ok: boolean; replayed?: boolean }> = [];
      const service = new PersonaRegistryService({
        store,
        sessionSecret: 'registration-saga-test-session-secret',
        now: () => NOW,
        redeemHumanity: async (token, registration) => {
          if (!registration) throw new Error('registration context required');
          if (crashPoint === 'before_remote' && transportCrash) {
            transportCrash = false;
            throw new Error('injected request loss before humanity');
          }
          const result = await humanity.redeemRegistration({ token, ...registration });
          remoteResults.push(result);
          if (crashPoint === 'after_remote' && transportCrash) {
            transportCrash = false;
            throw new Error('injected response loss after humanity commit');
          }
          return result;
        },
      });

      const first = service.register({
        claim: account.claim,
        humanityToken: account.wireToken,
      });
      if (crashPoint === 'before_remote' || crashPoint === 'after_remote') {
        await expect(first).resolves.toEqual({ ok: false, reason: 'humanity_unreachable' });
      } else {
        await expect(first).rejects.toThrow(/injected/u);
      }
      if (crashPoint === 'after_commit') {
        await expect(service.resolve(account.claim.alias)).resolves.toMatchObject({
          alias: account.claim.alias,
        });
      } else {
        await expect(service.resolve(account.claim.alias)).resolves.toBeNull();
      }

      await expect(service.register({
        claim: account.claim,
        humanityToken: account.wireToken,
      })).resolves.toEqual({
        ok: true,
        alias: account.claim.alias,
        personaPubkey: account.claim.personaPubkey,
      });
      await expect(service.resolve(account.claim.alias)).resolves.toMatchObject({
        personaPubkey: account.claim.personaPubkey,
      });

      if (crashPoint === 'after_remote' || crashPoint === 'before_mark') {
        expect(remoteResults).toEqual([
          { ok: true, replayed: false },
          { ok: true, replayed: true },
        ]);
      } else {
        expect(remoteResults).toEqual([{ ok: true, replayed: false }]);
      }
    });
  }

  it('never resolves a provisional alias while humanity is pending', async () => {
    const humanity = new HumanityService({ signingKeypair: keys, verifiers: [], now: () => NOW });
    const store = new InMemoryPersonaRegistryStore();
    const account = makeAccount('pendingalias');
    let entered!: () => void;
    let continueRedeem!: () => void;
    const redeemEntered = new Promise<void>((resolve) => { entered = resolve; });
    const waitForRelease = new Promise<void>((resolve) => { continueRedeem = resolve; });
    const service = new PersonaRegistryService({
      store,
      sessionSecret: 'registration-saga-test-session-secret',
      now: () => NOW,
      redeemHumanity: async (token, registration) => {
        entered();
        await waitForRelease;
        return humanity.redeemRegistration({ token, ...registration! });
      },
    });

    const pending = service.register({ claim: account.claim, humanityToken: account.wireToken });
    await redeemEntered;
    await expect(service.resolve(account.claim.alias)).resolves.toBeNull();
    continueRedeem();
    await expect(pending).resolves.toMatchObject({ ok: true });
    await expect(service.resolve(account.claim.alias)).resolves.toMatchObject({
      personaPubkey: account.claim.personaPubkey,
    });
  });

  it('does not burn the token belonging to an alias-race loser', async () => {
    const humanity = new HumanityService({ signingKeypair: keys, verifiers: [], now: () => NOW });
    const store = new InMemoryPersonaRegistryStore();
    const accounts = [makeAccount('realrace'), makeAccount('realrace')];
    const service = new PersonaRegistryService({
      store,
      sessionSecret: 'registration-saga-test-session-secret',
      now: () => NOW,
      redeemHumanity: (token, registration) => humanity.redeemRegistration({
        token,
        ...registration!,
      }),
    });
    const results = await Promise.all(accounts.map((account) => service.register({
      claim: account.claim,
      humanityToken: account.wireToken,
    })));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const loserIndex = results.findIndex((result) => !result.ok);
    expect(loserIndex).toBeGreaterThanOrEqual(0);
    await expect(humanity.redeem(accounts[loserIndex]!.wireToken)).resolves.toEqual({ ok: true });
  });

  it('releases a verified reservation when a concurrent operator revokes its persona', async () => {
    const humanity = new HumanityService({ signingKeypair: keys, verifiers: [], now: () => NOW });
    const store = new InMemoryPersonaRegistryStore();
    const first = makeAccount('policyrace');
    let injectRevocation = true;
    const service = new PersonaRegistryService({
      store,
      sessionSecret: 'registration-saga-test-session-secret',
      now: () => NOW,
      redeemHumanity: async (token, registration) => {
        const result = await humanity.redeemRegistration({ token, ...registration! });
        if (injectRevocation) {
          injectRevocation = false;
          await store.revoke(first.claim.personaPubkey, 'operator_suspend');
        }
        return result;
      },
    });
    await expect(service.register({
      claim: first.claim,
      humanityToken: first.wireToken,
    })).resolves.toEqual({ ok: false, reason: 'persona_revoked' });
    await expect(service.resolve(first.claim.alias)).resolves.toBeNull();

    const replacement = makeAccount('policyrace');
    await expect(service.register({
      claim: replacement.claim,
      humanityToken: replacement.wireToken,
    })).resolves.toMatchObject({ ok: true, alias: replacement.claim.alias });
  });
});
