/**
 * Plan 39 P12: FileOperatorConsoleStore durability + the persona registry's
 * suspend/delete race guard (codex review findings folded):
 *  - concurrent triage decisions are serialized (no lost decision on the
 *    read-modify-write of triage.json);
 *  - a torn audit tail (crash mid-append, no trailing newline) never swallows
 *    the NEXT row after restart;
 *  - audit rows survive a corrupt line without losing later rows;
 *  - a GDPR delete racing an operator unsuspend can never leave a deleted
 *    account with cleared revocation, under any interleaving.
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  bytesToHex,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createPersonaClaim,
  extractPersonaPrivateKeyHex,
  generatePublicPersona,
  personaRequestBytes,
  PERSONA_GDPR_DELETE_DOMAIN,
  sha512Hex,
  signMessage,
} from '@mylife/sync';
import {
  InMemoryPersonaRegistryStore,
  PersonaRegistryService,
  type PersonaRecord,
  type PersonaRegistryStore,
} from '../index';
import { FileOperatorConsoleStore } from '../operator-console-store-file';

let tmpDir: string;
beforeEach(async () => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-console-store-'));
});
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function auditRow(reason: string) {
  return {
    at: new Date().toISOString(),
    actorKeyHex: 'aa'.repeat(32),
    action: 'posting_freeze_set' as const,
    target: { publicationId: 'p' },
    reason,
    outcome: 'ok',
  };
}

describe('FileOperatorConsoleStore', () => {
  it('serializes concurrent triage decisions (no lost update)', async () => {
    const store = new FileOperatorConsoleStore(tmpDir);
    await Promise.all([
      store.putTriage({ reportKey: 'a'.repeat(64), status: 'dismissed', decidedAt: 't1', auditSeq: 1 }),
      store.putTriage({ reportKey: 'b'.repeat(64), status: 'actioned', decidedAt: 't2', auditSeq: 2 }),
      store.putTriage({ reportKey: 'c'.repeat(64), status: 'reviewed', decidedAt: 't3', auditSeq: 3 }),
    ]);
    const rows = await store.listTriage();
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.status))).toEqual(new Set(['dismissed', 'actioned', 'reviewed']));
  });

  it('repairs a torn audit tail: the first post-restart append is never swallowed', async () => {
    const first = new FileOperatorConsoleStore(tmpDir);
    await first.appendAudit(auditRow('before crash'));
    // Simulate a crash mid-append: a partial JSON line with NO trailing newline.
    await fs.appendFile(path.join(tmpDir, 'audit.log'), '{"seq":2,"at":"torn', 'utf8');

    const restarted = new FileOperatorConsoleStore(tmpDir);
    const appended = await restarted.appendAudit(auditRow('after restart'));
    const rows = await restarted.listAudit(10);
    expect(rows.map((r) => r.reason)).toEqual(['after restart', 'before crash']);
    expect(appended.seq).toBeGreaterThan(1);
    // The torn line stays skipped; nothing else was lost.
    expect(await restarted.auditCount()).toBe(2);
  });

  it('keeps rows after an interior corrupt line and pages with before-cursor', async () => {
    const store = new FileOperatorConsoleStore(tmpDir);
    await store.appendAudit(auditRow('one'));
    await fs.appendFile(path.join(tmpDir, 'audit.log'), 'not-json-at-all\n', 'utf8');
    await store.appendAudit(auditRow('two'));
    await store.appendAudit(auditRow('three'));
    const page = await store.listAudit(2);
    expect(page.map((r) => r.reason)).toEqual(['three', 'two']);
    const older = await store.listAudit(2, page.at(-1)!.seq);
    expect(older.map((r) => r.reason)).toEqual(['one']);
  });
});

/** A store wrapper that injects async yields to widen race windows. */
function slowStore(inner: PersonaRegistryStore): PersonaRegistryStore {
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 1));
  return {
    tryRegister: (r: PersonaRecord) => inner.tryRegister(r),
    remove: (a: string) => inner.remove(a),
    getByAlias: (a: string) => inner.getByAlias(a),
    getByPubkey: async (p: string) => { await tick(); return inner.getByPubkey(p); },
    release: async (a, t) => { await tick(); return inner.release(a, t); },
    getTombstone: (a: string) => inner.getTombstone(a),
    revoke: async (p: string) => { await tick(); return inner.revoke(p); },
    unrevoke: async (p: string) => { await tick(); return inner.unrevoke(p); },
    isRevoked: async (p: string) => { await tick(); return inner.isRevoked(p); },
    prune: (n: number) => inner.prune(n),
    stats: () => inner.stats(),
  };
}

describe('suspend/delete race guard (persona lock)', () => {
  it('a delete racing an unsuspend never leaves a deleted account unrevoked', async () => {
    for (let round = 0; round < 5; round += 1) {
      const inner = new InMemoryPersonaRegistryStore();
      const service = new PersonaRegistryService({
        store: slowStore(inner),
        sessionSecret: 'race-secret-000000000000000000000000',
        humanityRequired: false,
      });
      const persona = generatePublicPersona(`racer${round}`);
      const claim = createPersonaClaim({ persona, humanityBinding: sha512Hex(new TextEncoder().encode('t')) });
      expect((await service.register({ claim })).ok).toBe(true);
      expect((await service.suspendPersona(persona.personaPubkey)).ok).toBe(true);

      const issuedAtMs = Date.now();
      const priv = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
      const signature = bytesToHex(signMessage(priv, personaRequestBytes(PERSONA_GDPR_DELETE_DOMAIN, persona.personaPubkey, issuedAtMs)));
      // Race the delete against the unsuspend in both launch orders.
      const ops = round % 2 === 0
        ? [
          service.deleteAccount({ personaPubkey: persona.personaPubkey, issuedAtMs, signatureHex: signature }),
          service.unsuspendPersona(persona.personaPubkey),
        ] as const
        : [
          service.unsuspendPersona(persona.personaPubkey),
          service.deleteAccount({ personaPubkey: persona.personaPubkey, issuedAtMs, signatureHex: signature }),
        ] as const;
      await Promise.all(ops);

      // INVARIANT: once the account row is gone, the revocation must hold, so
      // the deleted account's unexpired bearers can never verify again.
      expect(await inner.getByPubkey(persona.personaPubkey)).toBeNull();
      expect(await inner.isRevoked(persona.personaPubkey)).toBe(true);
    }
  });
});
