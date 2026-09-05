/**
 * GDPR DELETE end-to-end coordinator (Plan 39 P13, AC-5). Ties together the pieces the tracks
 * built into ONE authorized chain. A persona-signed delete request is the authorization; on a
 * valid signature the coordinator:
 *
 *   1. verifies the request and revokes sessions while retaining the registry row for retries;
 *   2. tombstones EVERY public post authored by that persona across the node's publications
 *      (Track B tombstone path, operator-signed -- the node never holds the operator key);
 *   3. purges the persona's durable flood-cap counters;
 *   4. RELEASES the app-unlock persona binding so the SAME $4.99 purchase can rebind to a new
 *      persona later (NC-P5: no new SKU; resolves the recorded Track B founder flag);
 *   5. purges operator-console TRIAGE rows keyed to the persona where legally purgeable;
 *   6. only then releases the alias and removes the registry row.
 *
 * The append-only AUDIT log is NEVER purged -- it is the legal record (NC-P4). The chain is
 * FAIL-CLOSED at the gate: a bad signature purges NOTHING. Any incomplete downstream step
 * returns ok:false and keeps the registry row, so the persona signing key can authorize a retry.
 *
 * Seams (injected) so this runs in-process (tests, single-box) OR wired to HTTP clients across
 * the persona-service / community-node / hosted-billing deployables, mirroring the operator
 * console's PersonaAdminClient pattern.
 */

import {
  createPublicPostTombstone,
  type AcceptedPublicPost,
  type PublicPostTombstone,
} from '@mylife/sync';

/** Track A registry delete (persona-signed authorization + alias release + session revoke). */
export interface GdprRegistry {
  authorizeDeleteAccount(input: {
    personaPubkey: string;
    issuedAtMs: number;
    signatureHex: string;
  }): Promise<{ ok: true } | { ok: false; reason: string }>;
  deleteAccount(input: {
    personaPubkey: string;
    issuedAtMs: number;
    signatureHex: string;
  }): Promise<
    | { ok: true; releasedAlias: string | null; revokedPersona: string; reregisterBlockedUntilMs: number | null }
    | { ok: false; reason: string }
  >;
  exportAccount(input: {
    personaPubkey: string;
    issuedAtMs: number;
    signatureHex: string;
  }): Promise<
    | { ok: true; record: unknown; revoked: boolean }
    | { ok: false; reason: string }
  >;
}

/** Community-node public-post archive: enumerate + tombstone + purge flood counters. */
export interface GdprPostArchive {
  blockPersonaPublicPosting(personaPubkey: string): Promise<void>;
  /** Wait until every public submission that passed the block check has left its publication lock. */
  drainPersonaPublicWrites(personaPubkey: string): Promise<void>;
  listPublicPostsByPersona(personaPubkey: string): Promise<Array<{ publicationId: string; channelId: string; postId: string }>>;
  exportPublicPostsByPersona(personaPubkey: string): Promise<AcceptedPublicPost[]>;
  recordPublicPostTombstone(
    publicationId: string,
    tombstone: PublicPostTombstone,
  ): Promise<{ ok: true } | { ok: false; status: number; reason: string }>;
  purgePersonaFloodCounters(personaPubkey: string): Promise<{ publicationsCleared: number }>;
}

/** Hosted-billing app-unlock binding: reverse-lookup the subject, then release the binding. */
export interface GdprAppUnlockStore {
  getSubjectByAppUnlockPersona(personaHash: string): Promise<string | null>;
  releaseAppUnlockPersona(subjectId: string): Promise<{ released: boolean; personaHash: string | null }>;
}

/**
 * Operator-console triage rows for the persona's reported posts (purged where legally purgeable;
 * the append-only audit log always stays). Keyed by the persona's post ids -- a report's targetId
 * survives the post tombstone, so this resolves even after step 2 has removed the posts.
 */
export interface GdprConsoleTriagePurge {
  purgeTriageForPosts(postIds: readonly string[]): Promise<{ purged: number }>;
}

export interface GdprDeletionCoordinatorOptions {
  registry: GdprRegistry;
  postArchive: GdprPostArchive;
  /** The operator (Trust & Safety) Ed25519 keypair used to sign the GDPR post tombstones. */
  operator: { publicKeyHex: string; privateKeyHex: string };
  /** sha256(lowercased persona pubkey) -- the SAME hash the app-unlock binding stores. */
  personaBindingHash: (personaPubkey: string) => string;
  appUnlock?: GdprAppUnlockStore;
  consoleTriage?: GdprConsoleTriagePurge;
  now?: () => number;
}

/** Honest, itemized receipt of everything the delete chain did (surfaced to the operator/user). */
export interface GdprDeletionReceipt {
  ok: boolean;
  reason?: string;
  releasedAlias: string | null;
  reregisterBlockedUntilMs: number | null;
  tombstonedPosts: number;
  /** Posts that were found but whose tombstone was refused by the node (surfaced, not hidden). */
  tombstoneRefusals: number;
  floodCounterPublicationsCleared: number;
  appUnlockBindingReleased: boolean;
  triageRowsPurged: number;
}

export type GdprExportReceipt =
  | { ok: true; record: unknown; revoked: boolean; publicPosts: AcceptedPublicPost[] }
  | { ok: false; reason: string };

export class GdprDeletionCoordinator {
  private readonly registry: GdprRegistry;
  private readonly postArchive: GdprPostArchive;
  private readonly operator: { publicKeyHex: string; privateKeyHex: string };
  private readonly personaBindingHash: (personaPubkey: string) => string;
  private readonly appUnlock?: GdprAppUnlockStore;
  private readonly consoleTriage?: GdprConsoleTriagePurge;
  private readonly now: () => number;

  constructor(options: GdprDeletionCoordinatorOptions) {
    this.registry = options.registry;
    this.postArchive = options.postArchive;
    this.operator = options.operator;
    this.personaBindingHash = options.personaBindingHash;
    this.appUnlock = options.appUnlock;
    this.consoleTriage = options.consoleTriage;
    this.now = options.now ?? (() => Date.now());
  }

  async deletePersona(input: {
    personaPubkey: string;
    issuedAtMs: number;
    signatureHex: string;
  }): Promise<GdprDeletionReceipt> {
    // Verify and revoke sessions first, but retain the registry row and alias
    // until every required dependent-data deletion has succeeded. The caller
    // therefore keeps a retryable persona key on any incomplete receipt.
    const authorized = await this.registry.authorizeDeleteAccount(input);
    if (!authorized.ok) {
      return {
        ok: false,
        reason: authorized.reason,
        releasedAlias: null,
        reregisterBlockedUntilMs: null,
        tombstonedPosts: 0,
        tombstoneRefusals: 0,
        floodCounterPublicationsCleared: 0,
        appUnlockBindingReleased: false,
        triageRowsPurged: 0,
      };
    }

    const nowIso = new Date(this.now()).toISOString();
    let refs: Array<{ publicationId: string; channelId: string; postId: string }> = [];
    let tombstoned = 0;
    let refusals = 0;
    let appUnlockReleased = false;
    let floodCounterPublicationsCleared = 0;
    let triagePurged = 0;
    try {
      await this.postArchive.blockPersonaPublicPosting(input.personaPubkey);
      await this.postArchive.drainPersonaPublicWrites(input.personaPubkey);
      refs = await this.postArchive.listPublicPostsByPersona(input.personaPubkey);
      // Purge triage before removing posts. If a later dependency fails, a retry
      // may no longer be able to rediscover a tombstoned post's author.
      if (this.consoleTriage && refs.length > 0) {
        triagePurged = (await this.consoleTriage.purgeTriageForPosts(refs.map((r) => r.postId))).purged;
      }
      for (const ref of refs) {
        const tombstone = createPublicPostTombstone(this.operator, {
          publicationId: ref.publicationId,
          postId: ref.postId,
          now: nowIso,
        });
        const verdict = await this.postArchive.recordPublicPostTombstone(ref.publicationId, tombstone);
        if (verdict.ok) tombstoned += 1;
        else refusals += 1;
      }
      if (refusals > 0) {
        return {
          ok: false,
          reason: 'post_tombstone_incomplete',
          releasedAlias: null,
          reregisterBlockedUntilMs: null,
          tombstonedPosts: tombstoned,
          tombstoneRefusals: refusals,
          floodCounterPublicationsCleared: 0,
          appUnlockBindingReleased: false,
          triageRowsPurged: triagePurged,
        };
      }
      floodCounterPublicationsCleared = (
        await this.postArchive.purgePersonaFloodCounters(input.personaPubkey)
      ).publicationsCleared;
      if (this.appUnlock) {
        const personaHash = this.personaBindingHash(input.personaPubkey);
        const subjectId = await this.appUnlock.getSubjectByAppUnlockPersona(personaHash);
        if (subjectId) {
          appUnlockReleased = (await this.appUnlock.releaseAppUnlockPersona(subjectId)).released;
        }
      }
    } catch {
      return {
        ok: false,
        reason: 'downstream_delete_failed',
        releasedAlias: null,
        reregisterBlockedUntilMs: null,
        tombstonedPosts: tombstoned,
        tombstoneRefusals: refusals,
        floodCounterPublicationsCleared,
        appUnlockBindingReleased: appUnlockReleased,
        triageRowsPurged: triagePurged,
      };
    }

    const del = await this.registry.deleteAccount(input);
    if (!del.ok) return {
      ok: false,
      reason: del.reason,
      releasedAlias: null,
      reregisterBlockedUntilMs: null,
      tombstonedPosts: tombstoned,
      tombstoneRefusals: refusals,
      floodCounterPublicationsCleared,
      appUnlockBindingReleased: appUnlockReleased,
      triageRowsPurged: triagePurged,
    };

    return {
      ok: true,
      releasedAlias: del.releasedAlias,
      reregisterBlockedUntilMs: del.reregisterBlockedUntilMs,
      tombstonedPosts: tombstoned,
      tombstoneRefusals: refusals,
      floodCounterPublicationsCleared,
      appUnlockBindingReleased: appUnlockReleased,
      triageRowsPurged: triagePurged,
    };
  }

  async exportPersona(input: {
    personaPubkey: string;
    issuedAtMs: number;
    signatureHex: string;
  }): Promise<GdprExportReceipt> {
    const account = await this.registry.exportAccount(input);
    if (!account.ok) return account;
    try {
      return {
        ok: true,
        record: account.record,
        revoked: account.revoked,
        publicPosts: await this.postArchive.exportPublicPostsByPersona(input.personaPubkey),
      };
    } catch {
      return { ok: false, reason: 'public_post_export_failed' };
    }
  }
}
