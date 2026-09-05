import type {
  ContentManifest,
  FeedChallenge,
  SealedTailEntry,
  SignedCommunityDescriptor,
} from '@mylife/sync';

export type MaybePromise<T> = T | Promise<T>;

export type PrivateRateLimitAction = 'publish' | 'append' | 'pull';

export interface StoredPrivateSnapshot {
  channelId: string;
  manifest: ContentManifest;
  record: { epoch: number; infoHash: string };
}

export interface StoredPrivateCommunityState {
  descriptor: SignedCommunityDescriptor;
  descriptorHash: string;
  publishDigest: string;
  snapshots: StoredPrivateSnapshot[];
  tail: SealedTailEntry[];
}

export interface PrivateCommunityIdentityState {
  descriptor: SignedCommunityDescriptor;
  descriptorHash: string;
  publishDigest: string;
}

export interface PrivateChallengeContext {
  authorityNow: string;
  expiresAt: string;
  state: PrivateCommunityIdentityState | null;
}

export type InspectPrivateChallengeOutcome =
  | { outcome: 'ready'; context: PrivateChallengeContext }
  | { outcome: 'bad_nonce' | 'expired' };

export interface IssuePrivateChallengeInput {
  communityId: string;
  nonce: string;
  ttlMs: number;
  ceilingPerCommunity: number;
  maxUnclaimedCommunities: number;
  nowMs: number;
}

export interface AuthorizePrivateRequestInput {
  communityId: string;
  nonce: string;
  expectedDescriptorHash: string | null;
  consume: boolean;
  action?: PrivateRateLimitAction;
  principalHash?: string;
  ceiling?: number;
  windowMs?: number;
  nowMs: number;
}

export type AuthorizePrivateRequestOutcome =
  | 'accepted'
  | 'bad_nonce'
  | 'expired'
  | 'rate_limited'
  | 'state_changed';

export type AuthorizeAndReadPrivateStateOutcome =
  | { outcome: 'accepted'; state: StoredPrivateCommunityState }
  | { outcome: Exclude<AuthorizePrivateRequestOutcome, 'accepted'> };

export type AuthorizeAndCheckPrivateContentOutcome =
  | { outcome: 'accepted'; owned: boolean }
  | { outcome: Exclude<AuthorizePrivateRequestOutcome, 'accepted'> };

export interface AppendPrivateTailInput extends AuthorizePrivateRequestInput {
  expectedDescriptorHash: string;
  action: 'append';
  principalHash: string;
  ceiling: number;
  windowMs: number;
  entry: SealedTailEntry;
  replayKey: string;
  maximumEntriesPerChannel: number;
}

export type AppendPrivateTailOutcome =
  | { outcome: 'inserted' | 'duplicate' }
  | { outcome: Exclude<AuthorizePrivateRequestOutcome, 'accepted'> | 'tail_full' };

export interface BeginPrivatePublishInput {
  communityId: string;
  expectedDescriptorHash: string | null;
  descriptor: SignedCommunityDescriptor;
  descriptorHash: string;
  publishDigest: string;
  stageId: string;
  snapshots: StoredPrivateSnapshot[];
  stageTtlMs: number;
  nowMs: number;
}

export type BeginPrivatePublishOutcome =
  | { outcome: 'staged' | 'idempotent'; stageId: string }
  | { outcome: 'stale' | 'conflict' | 'busy' };

export interface CommitPrivatePublishInput {
  communityId: string;
  stageId: string;
  publishDigest: string;
  nowMs: number;
}

export type CommitPrivatePublishOutcome =
  | {
    outcome: 'committed' | 'idempotent';
    previousInfoHashes: string[];
  }
  | { outcome: 'missing' | 'conflict' | 'expired' };

export interface ExpiredPrivatePublishStage {
  communityId: string;
  stageId: string;
  candidateInfoHashes: string[];
}

export interface CommunityPrivateStateStore {
  issueChallenge(input: IssuePrivateChallengeInput): MaybePromise<FeedChallenge | null>;
  inspectChallenge(
    communityId: string,
    nonce: string,
    nowMs: number,
  ): MaybePromise<InspectPrivateChallengeOutcome>;
  authorizeRequest(
    input: AuthorizePrivateRequestInput,
  ): MaybePromise<AuthorizePrivateRequestOutcome>;
  authorizeAndReadState(
    input: AuthorizePrivateRequestInput,
  ): MaybePromise<AuthorizeAndReadPrivateStateOutcome>;
  authorizeAndCheckContent(
    input: AuthorizePrivateRequestInput,
    infoHash: string,
  ): MaybePromise<AuthorizeAndCheckPrivateContentOutcome>;
  appendTail(input: AppendPrivateTailInput): MaybePromise<AppendPrivateTailOutcome>;
  getState(communityId: string): MaybePromise<StoredPrivateCommunityState | null>;
  beginPublish(input: BeginPrivatePublishInput): MaybePromise<BeginPrivatePublishOutcome>;
  commitPublish(input: CommitPrivatePublishInput): MaybePromise<CommitPrivatePublishOutcome>;
  isContentReferenced(infoHash: string): MaybePromise<boolean>;
  listExpiredPublishStages(
    limit: number,
    nowMs: number,
  ): MaybePromise<ExpiredPrivatePublishStage[]>;
  completeExpiredPublishStage(
    communityId: string,
    stageId: string,
    nowMs: number,
  ): MaybePromise<boolean>;
  sweepExpired(nowMs: number): MaybePromise<void>;
  trackedCommunityCount(nowMs: number): MaybePromise<number>;
}

export class CommunityPrivateStateUnavailableError extends Error {
  readonly code = 'community_private_state_unavailable';

  constructor(readonly operation: string, cause: unknown) {
    super(`Community private state is unavailable during ${operation}`, { cause });
    this.name = 'CommunityPrivateStateUnavailableError';
  }
}

export function toCommunityPrivateStateUnavailableError(
  operation: string,
  error: unknown,
): CommunityPrivateStateUnavailableError {
  if (error instanceof CommunityPrivateStateUnavailableError) return error;
  return new CommunityPrivateStateUnavailableError(operation, error);
}

interface MemoryChallenge {
  issuedAtMs: number;
  expiresAtMs: number;
}

interface MemoryRateHit {
  principalHash: string;
  action: PrivateRateLimitAction;
  occurredAtMs: number;
}

interface MemoryTailRecord {
  replayKey: string;
  entry: SealedTailEntry;
}

interface MemoryActiveState {
  descriptor: SignedCommunityDescriptor;
  descriptorHash: string;
  publishDigest: string;
  snapshots: StoredPrivateSnapshot[];
  tail: MemoryTailRecord[];
}

interface MemoryPublishStage extends BeginPrivatePublishInput {
  createdAtMs: number;
  expiresAtMs: number;
  compactedReplayKeys: string[];
}

function distinctInfoHashes(snapshots: readonly StoredPrivateSnapshot[]): string[] {
  return [...new Set(snapshots.map((snapshot) => snapshot.manifest.infoHash))];
}

function cloneState(state: MemoryActiveState): StoredPrivateCommunityState {
  return {
    descriptor: structuredClone(state.descriptor),
    descriptorHash: state.descriptorHash,
    publishDigest: state.publishDigest,
    snapshots: structuredClone(state.snapshots),
    tail: state.tail.map((record) => structuredClone(record.entry)),
  };
}

/**
 * Synchronous authority used by unit tests and explicitly ephemeral nodes. Every
 * mutation completes without an await, so the comparison and write are atomic in
 * one JavaScript turn. File and PostgreSQL adapters implement the same contract.
 */
export class InMemoryCommunityPrivateStateStore implements CommunityPrivateStateStore {
  private readonly active = new Map<string, MemoryActiveState>();
  private readonly challenges = new Map<string, Map<string, MemoryChallenge>>();
  private readonly challengeTouches = new Map<string, number>();
  private readonly rateHits = new Map<string, MemoryRateHit[]>();
  private readonly stages = new Map<string, MemoryPublishStage>();

  issueChallenge(input: IssuePrivateChallengeInput): FeedChallenge | null {
    this.pruneCommunity(input.communityId, input.nowMs);
    let communityChallenges = this.challenges.get(input.communityId);
    if (!communityChallenges) {
      if (!this.active.has(input.communityId)) {
        this.evictUnclaimedAtLimit(input.maxUnclaimedCommunities, input.nowMs);
      }
      communityChallenges = new Map();
      this.challenges.set(input.communityId, communityChallenges);
    }
    if (communityChallenges.size >= input.ceilingPerCommunity) return null;
    const issuedAtMs = input.nowMs;
    const expiresAtMs = issuedAtMs + input.ttlMs;
    communityChallenges.set(input.nonce, { issuedAtMs, expiresAtMs });
    this.challengeTouches.set(input.communityId, issuedAtMs);
    return {
      nonce: input.nonce,
      issuedAt: new Date(issuedAtMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  inspectChallenge(
    communityId: string,
    nonce: string,
    nowMs: number,
  ): InspectPrivateChallengeOutcome {
    const challenge = this.challenges.get(communityId)?.get(nonce);
    if (!challenge) return { outcome: 'bad_nonce' };
    if (challenge.expiresAtMs <= nowMs) {
      this.challenges.get(communityId)?.delete(nonce);
      this.pruneCommunity(communityId, nowMs);
      return { outcome: 'expired' };
    }
    const state = this.active.get(communityId);
    return {
      outcome: 'ready',
      context: {
        authorityNow: new Date(nowMs).toISOString(),
        expiresAt: new Date(challenge.expiresAtMs).toISOString(),
        state: state ? {
          descriptor: structuredClone(state.descriptor),
          descriptorHash: state.descriptorHash,
          publishDigest: state.publishDigest,
        } : null,
      },
    };
  }

  authorizeRequest(input: AuthorizePrivateRequestInput): AuthorizePrivateRequestOutcome {
    return this.authorize(input);
  }

  authorizeAndReadState(input: AuthorizePrivateRequestInput): AuthorizeAndReadPrivateStateOutcome {
    const authorization = this.authorize(input);
    if (authorization !== 'accepted') return { outcome: authorization };
    const state = this.active.get(input.communityId);
    if (!state) return { outcome: 'state_changed' };
    return { outcome: 'accepted', state: cloneState(state) };
  }

  authorizeAndCheckContent(
    input: AuthorizePrivateRequestInput,
    infoHash: string,
  ): AuthorizeAndCheckPrivateContentOutcome {
    const authorization = this.authorize(input);
    if (authorization !== 'accepted') return { outcome: authorization };
    const state = this.active.get(input.communityId);
    if (!state) return { outcome: 'state_changed' };
    return {
      outcome: 'accepted',
      owned: state.snapshots.some((snapshot) => snapshot.manifest.infoHash === infoHash),
    };
  }

  appendTail(input: AppendPrivateTailInput): AppendPrivateTailOutcome {
    const authorization = this.authorize(input);
    if (authorization !== 'accepted') return { outcome: authorization };
    const state = this.active.get(input.communityId);
    if (!state || state.descriptorHash !== input.expectedDescriptorHash) {
      return { outcome: 'state_changed' };
    }
    if (state.tail.some((record) => record.replayKey === input.replayKey)) {
      return { outcome: 'duplicate' };
    }
    const channelEntries = state.tail.reduce(
      (count, record) => count + (record.entry.channelId === input.entry.channelId ? 1 : 0),
      0,
    );
    if (channelEntries >= input.maximumEntriesPerChannel) return { outcome: 'tail_full' };
    state.tail.push({ replayKey: input.replayKey, entry: structuredClone(input.entry) });
    return { outcome: 'inserted' };
  }

  getState(communityId: string): StoredPrivateCommunityState | null {
    const state = this.active.get(communityId);
    return state ? cloneState(state) : null;
  }

  beginPublish(input: BeginPrivatePublishInput): BeginPrivatePublishOutcome {
    const active = this.active.get(input.communityId);
    if (active?.publishDigest === input.publishDigest) {
      return { outcome: 'idempotent', stageId: input.stageId };
    }
    const activeHash = active?.descriptorHash ?? null;
    if (activeHash !== input.expectedDescriptorHash) return { outcome: 'conflict' };
    const activeRevision = active?.descriptor.descriptor.revision ?? null;
    const incomingRevision = input.descriptor.descriptor.revision;
    if (activeRevision !== null && incomingRevision < activeRevision) return { outcome: 'stale' };
    if (activeRevision !== null && incomingRevision === activeRevision
      && activeHash !== input.descriptorHash) return { outcome: 'conflict' };

    const pending = this.stages.get(input.communityId);
    if (pending) {
      if (pending.publishDigest === input.publishDigest && pending.stageId === input.stageId) {
        return { outcome: 'idempotent', stageId: pending.stageId };
      }
      return { outcome: 'busy' };
    }
    this.stages.set(input.communityId, {
      ...structuredClone(input),
      createdAtMs: input.nowMs,
      expiresAtMs: input.nowMs + input.stageTtlMs,
      compactedReplayKeys: active
        ? active.tail
          .filter((record) => input.snapshots.some(
            (snapshot) => snapshot.channelId === record.entry.channelId,
          ))
          .map((record) => record.replayKey)
        : [],
    });
    return { outcome: 'staged', stageId: input.stageId };
  }

  commitPublish(input: CommitPrivatePublishInput): CommitPrivatePublishOutcome {
    const active = this.active.get(input.communityId);
    if (active?.publishDigest === input.publishDigest) {
      return { outcome: 'idempotent', previousInfoHashes: [] };
    }
    const stage = this.stages.get(input.communityId);
    if (!stage || stage.stageId !== input.stageId || stage.publishDigest !== input.publishDigest) {
      return { outcome: 'missing' };
    }
    if (stage.expiresAtMs <= input.nowMs) {
      return { outcome: 'expired' };
    }
    if ((active?.descriptorHash ?? null) !== stage.expectedDescriptorHash) {
      return { outcome: 'conflict' };
    }
    const previousInfoHashes = active ? distinctInfoHashes(active.snapshots) : [];
    this.active.set(input.communityId, {
      descriptor: structuredClone(stage.descriptor),
      descriptorHash: stage.descriptorHash,
      publishDigest: stage.publishDigest,
      snapshots: structuredClone(stage.snapshots),
      tail: (active?.tail ?? []).filter(
        (record) => !stage.compactedReplayKeys.includes(record.replayKey),
      ),
    });
    this.stages.delete(input.communityId);
    return { outcome: 'committed', previousInfoHashes };
  }

  isContentReferenced(infoHash: string): boolean {
    for (const state of this.active.values()) {
      if (state.snapshots.some((snapshot) => snapshot.manifest.infoHash === infoHash)) return true;
    }
    return false;
  }

  listExpiredPublishStages(limit: number, nowMs: number): ExpiredPrivatePublishStage[] {
    const expired: ExpiredPrivatePublishStage[] = [];
    for (const [communityId, stage] of this.stages) {
      if (expired.length >= limit) break;
      if (stage.expiresAtMs <= nowMs) {
        expired.push({
          communityId,
          stageId: stage.stageId,
          candidateInfoHashes: distinctInfoHashes(stage.snapshots),
        });
      }
    }
    return expired;
  }

  completeExpiredPublishStage(communityId: string, stageId: string, nowMs: number): boolean {
    const stage = this.stages.get(communityId);
    if (!stage || stage.stageId !== stageId || stage.expiresAtMs > nowMs) return false;
    this.stages.delete(communityId);
    return true;
  }

  sweepExpired(nowMs: number): void {
    for (const communityId of [...this.challenges.keys()]) this.pruneCommunity(communityId, nowMs);
    for (const [key, hits] of this.rateHits) {
      const live = hits.filter((hit) => hit.occurredAtMs > nowMs - 24 * 60 * 60 * 1000);
      if (live.length > 0) this.rateHits.set(key, live);
      else this.rateHits.delete(key);
    }
  }

  trackedCommunityCount(nowMs: number): number {
    this.sweepExpired(nowMs);
    return new Set([...this.active.keys(), ...this.challenges.keys()]).size;
  }

  private authorize(input: AuthorizePrivateRequestInput): AuthorizePrivateRequestOutcome {
    const challenge = this.challenges.get(input.communityId)?.get(input.nonce);
    if (!challenge) return 'bad_nonce';
    if (challenge.expiresAtMs <= input.nowMs) {
      this.challenges.get(input.communityId)?.delete(input.nonce);
      this.pruneCommunity(input.communityId, input.nowMs);
      return 'expired';
    }
    const activeHash = this.active.get(input.communityId)?.descriptorHash ?? null;
    if (activeHash !== input.expectedDescriptorHash) return 'state_changed';
    if (input.action) {
      const ceiling = input.ceiling;
      if (!input.principalHash || !Number.isSafeInteger(ceiling) || ceiling === undefined || !input.windowMs) {
        throw new TypeError('Authenticated rate-limit inputs are incomplete.');
      }
      const key = `${input.communityId}:${input.principalHash}:${input.action}`;
      const cutoff = input.nowMs - input.windowMs;
      const hits = (this.rateHits.get(key) ?? []).filter((hit) => hit.occurredAtMs > cutoff);
      if (hits.length >= ceiling) {
        this.rateHits.set(key, hits);
        return 'rate_limited';
      }
      hits.push({
        principalHash: input.principalHash,
        action: input.action,
        occurredAtMs: input.nowMs,
      });
      this.rateHits.set(key, hits);
    }
    if (input.consume) {
      this.challenges.get(input.communityId)?.delete(input.nonce);
      this.pruneCommunity(input.communityId, input.nowMs);
    }
    return 'accepted';
  }

  private pruneCommunity(communityId: string, nowMs: number): void {
    const challenges = this.challenges.get(communityId);
    if (!challenges) return;
    for (const [nonce, challenge] of challenges) {
      if (challenge.expiresAtMs <= nowMs) challenges.delete(nonce);
    }
    if (challenges.size === 0) {
      this.challenges.delete(communityId);
      this.challengeTouches.delete(communityId);
    }
  }

  private evictUnclaimedAtLimit(maximum: number, nowMs: number): void {
    this.sweepExpired(nowMs);
    const unclaimed = [...this.challengeTouches.entries()]
      .filter(([communityId]) => !this.active.has(communityId))
      .sort((left, right) => left[1] - right[1]);
    if (unclaimed.length < maximum) return;
    const victim = unclaimed[0]?.[0];
    if (victim) {
      this.challenges.delete(victim);
      this.challengeTouches.delete(victim);
    }
  }

}
