/**
 * Durable, restart-safe billing store for the deployable hosted service (Plan 22
 * Phase 2). It persists the three billing rows the API needs: hosted subscriptions,
 * one-time app-unlock purchases, and single-use cross-rail link codes.
 *
 * WHY FILESYSTEM, NOT SQLITE. Same reasoning as FileHumanityStore: this package's
 * durability convention is the filesystem (FileCommunityDescriptorStore,
 * FileSeederPieceStore, FilePublicationStore all write files under a DATA_DIR
 * volume); `node:sqlite` is experimental and `better-sqlite3` is a native module we
 * do not ship in these images. An `O_EXCL` exclusive-create is a genuinely ATOMIC
 * insert-if-absent on a POSIX volume, which is exactly the single-use guarantee the
 * link-redeem gate needs, so a file-per-code marker meets the atomic + durable
 * contract with zero new dependencies.
 *
 * PII note: Stripe customer/subscription ids live in the subscription row (env-gated
 * volume, never logged). Nothing here is a decryption key; the relay/community node
 * remain zero-knowledge.
 */

import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { deriveMeerkatAppUnlock } from '@mylife/entitlements';
import { withExclusiveFileLock } from './file-lock';
import { AppUnlockPersonaInUseError } from './hosted-api';
import type {
  MeerkatAppBillingStore,
  MeerkatAppLink,
  MeerkatAppPurchase,
  MeerkatHostedBillingStore,
  MeerkatHostedSubscription,
  ProviderEventApplyResult,
} from './hosted-api';

/** A link code must be one safe path segment (our codes are UUIDs). */
const CODE_RE = /^[A-Za-z0-9._-]{1,128}$/;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function readJsonFile<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFileAtomic(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value), 'utf8');
  await fs.rename(tmp, file); // atomic replace on a POSIX volume
}

export function shouldApplyProviderEvent(input: {
  currentEventId?: string;
  currentEventAt?: string;
  incomingEventId: string;
  incomingEventAt: string;
  incomingMoreRestrictive: boolean;
  currentMoreRestrictive: boolean;
}): ProviderEventApplyResult {
  if (input.currentEventId === input.incomingEventId) return 'duplicate';
  const incomingMs = Date.parse(input.incomingEventAt);
  if (!Number.isFinite(incomingMs)) return 'stale';
  if (!input.currentEventAt) return 'applied';
  const currentMs = Date.parse(input.currentEventAt);
  if (!Number.isFinite(currentMs) || incomingMs > currentMs) return 'applied';
  if (incomingMs < currentMs) return 'stale';
  // Stripe timestamps have one-second precision. For different events in the
  // same second, deny wins: a cancellation/refund may replace active state, but
  // active state may not resurrect an already restrictive record.
  return input.incomingMoreRestrictive && !input.currentMoreRestrictive ? 'applied' : 'stale';
}

export class FileMeerkatBillingStore implements MeerkatHostedBillingStore, MeerkatAppBillingStore {
  private readonly subsDir: string;
  private readonly purchasesDir: string;
  private readonly linksDir: string;
  private readonly bindingsDir: string;

  constructor(baseDir: string) {
    this.subsDir = path.join(baseDir, 'subscriptions');
    this.purchasesDir = path.join(baseDir, 'purchases');
    this.linksDir = path.join(baseDir, 'links');
    this.bindingsDir = path.join(baseDir, 'persona-bindings');
  }

  // --- Hosted subscriptions --------------------------------------------------
  async getSubscription(subjectId: string): Promise<MeerkatHostedSubscription | null> {
    return readJsonFile<MeerkatHostedSubscription>(
      path.join(this.subsDir, `${sha256Hex(subjectId)}.json`),
    );
  }

  async upsertSubscription(subscription: MeerkatHostedSubscription): Promise<void> {
    await writeJsonFileAtomic(
      path.join(this.subsDir, `${sha256Hex(subscription.subjectId)}.json`),
      subscription,
    );
  }

  async applySubscriptionEvent(subscription: MeerkatHostedSubscription): Promise<ProviderEventApplyResult> {
    const file = path.join(this.subsDir, `${sha256Hex(subscription.subjectId)}.json`);
    return withExclusiveFileLock(`${file}.lock`, async () => {
      const current = await readJsonFile<MeerkatHostedSubscription>(file);
      const result = shouldApplyProviderEvent({
        currentEventId: current?.lastProviderEventId,
        currentEventAt: current?.lastProviderEventAt,
        incomingEventId: subscription.lastProviderEventId ?? '',
        incomingEventAt: subscription.lastProviderEventAt ?? '',
        incomingMoreRestrictive: !['active', 'trialing'].includes(subscription.status),
        currentMoreRestrictive: current ? !['active', 'trialing'].includes(current.status) : false,
      });
      if (result === 'applied') await writeJsonFileAtomic(file, subscription);
      return result;
    });
  }

  // --- One-time app-unlock purchases -----------------------------------------
  async getAppPurchase(subjectId: string): Promise<MeerkatAppPurchase | null> {
    return readJsonFile<MeerkatAppPurchase>(
      path.join(this.purchasesDir, `${sha256Hex(subjectId)}.json`),
    );
  }

  async upsertAppPurchase(purchase: MeerkatAppPurchase): Promise<void> {
    await writeJsonFileAtomic(
      path.join(this.purchasesDir, `${sha256Hex(purchase.subjectId)}.json`),
      purchase,
    );
  }

  async applyAppPurchaseEvent(purchase: MeerkatAppPurchase): Promise<ProviderEventApplyResult> {
    const file = path.join(this.purchasesDir, `${sha256Hex(purchase.subjectId)}.json`);
    return withExclusiveFileLock(`${file}.lock`, async () => {
      const current = await readJsonFile<MeerkatAppPurchase>(file);
      const result = shouldApplyProviderEvent({
        currentEventId: current?.lastProviderEventId,
        currentEventAt: current?.lastProviderEventAt,
        incomingEventId: purchase.lastProviderEventId ?? '',
        incomingEventAt: purchase.lastProviderEventAt ?? '',
        incomingMoreRestrictive: !purchase.isActive,
        currentMoreRestrictive: current ? !current.isActive : false,
      });
      if (result === 'applied') await writeJsonFileAtomic(file, purchase);
      return result;
    });
  }

  // --- Cross-rail link codes (single-use, atomic O_EXCL consume) -------------
  private linkFile(code: string): string {
    if (!CODE_RE.test(code)) throw new Error('Invalid link code.');
    return path.join(this.linksDir, `${code}.json`);
  }

  async createLink(link: MeerkatAppLink): Promise<void> {
    await writeJsonFileAtomic(this.linkFile(link.code), link);
  }

  async redeemLink(code: string, nowMs: number): Promise<{ subjectId: string } | null> {
    if (!CODE_RE.test(code)) return null; // forged/unsafe -> fail closed
    const link = await readJsonFile<MeerkatAppLink>(this.linkFile(code));
    if (!link) return null;
    if (link.consumedAt) return null;
    if (Date.parse(link.expiresAt) <= nowMs) return null;
    // The bound purchase must still be ACTIVE (a refund between mint and redeem
    // must not unlock the other rail).
    const purchase = await this.getAppPurchase(link.subjectId);
    if (!deriveMeerkatAppUnlock(purchase ? [purchase] : []).unlocked) return null;
    // Atomic single-use: exactly one concurrent redeem creates the marker.
    const marker = `${this.linkFile(code)}.consumed`;
    try {
      await fs.writeFile(marker, String(nowMs), { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return null; // already redeemed
      throw error;
    }
    await writeJsonFileAtomic(this.linkFile(code), {
      ...link,
      consumedAt: new Date(nowMs).toISOString(),
    } satisfies MeerkatAppLink);
    return { subjectId: link.subjectId };
  }

  // --- Persona bindings (Plan 39 P6: one purchase, one persona) ---------------
  // Two indexes: subject -> personaHash (the sticky binding, O_EXCL first-bind-
  // wins so a concurrent double-bind resolves to exactly one winner) and
  // personaHash -> subject (proof re-mints without a link code). Nothing here is
  // a raw persona key: only the sha256 hash the proofs carry.

  private bindingFile(subjectId: string): string {
    return path.join(this.bindingsDir, `${sha256Hex(subjectId)}.subject.json`);
  }

  private reverseBindingFile(personaHash: string): string {
    return path.join(this.bindingsDir, `${sha256Hex(personaHash.toLowerCase())}.persona.json`);
  }

  async getAppUnlockPersona(subjectId: string): Promise<string | null> {
    const parsed = await readJsonFile<{ personaHash?: unknown }>(this.bindingFile(subjectId));
    return typeof parsed?.personaHash === 'string' ? parsed.personaHash : null;
  }

  async bindAppUnlockPersona(subjectId: string, personaHash: string): Promise<string> {
    const hash = personaHash.toLowerCase();
    const file = this.bindingFile(subjectId);
    const reverseFile = this.reverseBindingFile(hash);
    // Lock the requested persona first, then the subject. Every bind follows this
    // order, so two subjects cannot claim one persona and two personas racing for one
    // subject cannot deadlock.
    return withExclusiveFileLock(`${reverseFile}.lock`, async () => (
      withExclusiveFileLock(`${file}.lock`, async () => {
        await fs.mkdir(path.dirname(file), { recursive: true });
        const existing = await this.getAppUnlockPersona(subjectId);
        if (existing) {
          if (existing === hash) {
            const reverse = await readJsonFile<{ subjectId?: unknown }>(reverseFile);
            if (reverse?.subjectId !== subjectId) {
              if (typeof reverse?.subjectId === 'string') {
                throw new AppUnlockPersonaInUseError();
              }
              await writeJsonFileAtomic(reverseFile, { subjectId });
            }
          }
          return existing;
        }

        const reverse = await readJsonFile<{ subjectId?: unknown }>(reverseFile);
        if (typeof reverse?.subjectId === 'string' && reverse.subjectId !== subjectId) {
          throw new AppUnlockPersonaInUseError();
        }
        await writeJsonFileAtomic(file, { personaHash: hash });
        await writeJsonFileAtomic(reverseFile, { subjectId });
        return hash;
      })
    ));
  }

  async getSubjectByAppUnlockPersona(personaHash: string): Promise<string | null> {
    const parsed = await readJsonFile<{ subjectId?: unknown }>(this.reverseBindingFile(personaHash));
    return typeof parsed?.subjectId === 'string' ? parsed.subjectId : null;
  }

  async releaseAppUnlockPersona(subjectId: string): Promise<{ released: boolean; personaHash: string | null }> {
    const file = this.bindingFile(subjectId);
    return withExclusiveFileLock(`${file}.lock`, async () => {
      const personaHash = await this.getAppUnlockPersona(subjectId);
      if (!personaHash) return { released: false, personaHash: null };
      // Clear both indexes so the purchase is free to rebind and no stale reverse pointer
      // resolves proof re-mints to a deleted persona. rm is best-effort idempotent.
      await fs.rm(file, { force: true });
      await fs.rm(this.reverseBindingFile(personaHash), { force: true });
      return { released: true, personaHash };
    });
  }
}
