import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FeedChallenge, SealedTailEntry } from '@mylife/sync';
import { withExclusiveFileLock } from './file-lock';
import {
  type AppendPrivateTailInput,
  type AppendPrivateTailOutcome,
  type AuthorizeAndReadPrivateStateOutcome,
  type AuthorizeAndCheckPrivateContentOutcome,
  type AuthorizePrivateRequestInput,
  type AuthorizePrivateRequestOutcome,
  type BeginPrivatePublishInput,
  type BeginPrivatePublishOutcome,
  type CommitPrivatePublishInput,
  type CommitPrivatePublishOutcome,
  type CommunityPrivateStateStore,
  type InspectPrivateChallengeOutcome,
  type IssuePrivateChallengeInput,
  type PrivateRateLimitAction,
  type ExpiredPrivatePublishStage,
  type StoredPrivateCommunityState,
  type StoredPrivateSnapshot,
  toCommunityPrivateStateUnavailableError,
} from './community-private-state';

const FILE_VERSION = 1;
const MAX_FILE_COMMUNITIES = 100_000;
const MAX_FILE_BYTES = 64 * 1024 * 1024;

interface FileChallenge {
  issuedAtMs: number;
  expiresAtMs: number;
}

interface FileRateHit {
  principalHash: string;
  action: PrivateRateLimitAction;
  occurredAtMs: number;
}

interface FileTailRecord {
  replayKey: string;
  entry: SealedTailEntry;
}

interface FileActiveState {
  descriptor: StoredPrivateCommunityState['descriptor'];
  descriptorHash: string;
  publishDigest: string;
  snapshots: StoredPrivateSnapshot[];
  tail: FileTailRecord[];
}

interface FilePublishStage extends BeginPrivatePublishInput {
  createdAtMs: number;
  expiresAtMs: number;
  compactedReplayKeys: string[];
}

interface CommunityPrivateStateFile {
  version: 1;
  communityId: string;
  active: FileActiveState | null;
  challenges: Record<string, FileChallenge>;
  rateHits: FileRateHit[];
  pendingPublish: FilePublishStage | null;
  lastChallengeAtMs: number | null;
}

function emptyFile(communityId: string): CommunityPrivateStateFile {
  return {
    version: FILE_VERSION,
    communityId,
    active: null,
    challenges: {},
    rateHits: [],
    pendingPublish: null,
    lastChallengeAtMs: null,
  };
}

/** True when the file holds no claim, no live challenge, no stage, no rate hit. */
function isEmptyState(state: CommunityPrivateStateFile): boolean {
  return state.active === null
    && state.pendingPublish === null
    && Object.keys(state.challenges).length === 0
    && state.rateHits.length === 0;
}

function cloneActive(active: FileActiveState): StoredPrivateCommunityState {
  return {
    descriptor: structuredClone(active.descriptor),
    descriptorHash: active.descriptorHash,
    publishDigest: active.publishDigest,
    snapshots: structuredClone(active.snapshots),
    tail: active.tail.map((record) => structuredClone(record.entry)),
  };
}

function distinctInfoHashes(snapshots: readonly StoredPrivateSnapshot[]): string[] {
  return [...new Set(snapshots.map((snapshot) => snapshot.manifest.infoHash))];
}

function validateLoadedFile(
  communityId: string,
  value: unknown,
): CommunityPrivateStateFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Community private-state file is not a JSON object.');
  }
  const candidate = value as Partial<CommunityPrivateStateFile>;
  if (candidate.version !== FILE_VERSION || candidate.communityId !== communityId
    || typeof candidate.challenges !== 'object' || candidate.challenges === null
    || !Array.isArray(candidate.rateHits)
    || (candidate.active !== null && typeof candidate.active !== 'object')
    || (candidate.pendingPublish !== null && typeof candidate.pendingPublish !== 'object')) {
    throw new Error('Community private-state file has an invalid envelope.');
  }
  if (candidate.active) {
    const active = candidate.active;
    if (!active.descriptor?.descriptor
      || active.descriptor.descriptor.communityId !== communityId
      || typeof active.descriptorHash !== 'string'
      || typeof active.publishDigest !== 'string'
      || !Array.isArray(active.snapshots)
      || !Array.isArray(active.tail)) {
      throw new Error('Community private-state file has an invalid active payload.');
    }
  }
  return candidate as CommunityPrivateStateFile;
}

async function atomicWriteJson(file: string, value: CommunityPrivateStateFile): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, file);
}

/** Crash-safe complete self-host authority for private community state. */
export class FileCommunityPrivateStateStore implements CommunityPrivateStateStore {
  constructor(private readonly baseDir: string) {}

  async issueChallenge(input: IssuePrivateChallengeInput): Promise<FeedChallenge | null> {
    return this.run('issue private community challenge', () =>
      withExclusiveFileLock(this.globalLock(), async () => {
        await this.evictUnclaimedAtLimit(input);
        return this.withCommunity(input.communityId, async (state) => {
          this.prune(state, input.nowMs);
          if (Object.keys(state.challenges).length >= input.ceilingPerCommunity) {
            return { value: null, dirty: false };
          }
          const issuedAtMs = input.nowMs;
          const expiresAtMs = issuedAtMs + input.ttlMs;
          state.challenges[input.nonce] = { issuedAtMs, expiresAtMs };
          state.lastChallengeAtMs = issuedAtMs;
          return {
            value: {
              nonce: input.nonce,
              issuedAt: new Date(issuedAtMs).toISOString(),
              expiresAt: new Date(expiresAtMs).toISOString(),
            },
            dirty: true,
          };
        });
      }));
  }

  async inspectChallenge(
    communityId: string,
    nonce: string,
    nowMs: number,
  ): Promise<InspectPrivateChallengeOutcome> {
    return this.run('inspect private community challenge', () =>
      this.withCommunity<InspectPrivateChallengeOutcome>(communityId, async (state) => {
        const challenge = state.challenges[nonce];
        if (!challenge) return { value: { outcome: 'bad_nonce' } as const, dirty: false };
        if (challenge.expiresAtMs <= nowMs) {
          delete state.challenges[nonce];
          this.prune(state, nowMs);
          return { value: { outcome: 'expired' } as const, dirty: true };
        }
        return {
          value: {
            outcome: 'ready',
            context: {
              authorityNow: new Date(nowMs).toISOString(),
              expiresAt: new Date(challenge.expiresAtMs).toISOString(),
              state: state.active ? {
                descriptor: structuredClone(state.active.descriptor),
                descriptorHash: state.active.descriptorHash,
                publishDigest: state.active.publishDigest,
              } : null,
            },
          } as const,
          dirty: false,
        };
      }));
  }

  async authorizeRequest(
    input: AuthorizePrivateRequestInput,
  ): Promise<AuthorizePrivateRequestOutcome> {
    return this.run('authorize private community request', () =>
      this.withCommunity<AuthorizePrivateRequestOutcome>(input.communityId, async (state) => {
        const outcome = this.authorize(state, input);
        return { value: outcome, dirty: outcome === 'accepted' || outcome === 'expired' };
      }));
  }

  async authorizeAndReadState(
    input: AuthorizePrivateRequestInput,
  ): Promise<AuthorizeAndReadPrivateStateOutcome> {
    return this.run('authorize and read private community state', () =>
      this.withCommunity<AuthorizeAndReadPrivateStateOutcome>(input.communityId, async (state) => {
        const outcome = this.authorize(state, input);
        if (outcome !== 'accepted') {
          return {
            value: { outcome },
            dirty: outcome === 'expired',
          };
        }
        if (!state.active) {
          return { value: { outcome: 'state_changed' }, dirty: true };
        }
        return {
          value: { outcome: 'accepted', state: cloneActive(state.active) },
          dirty: true,
        };
      }));
  }

  async authorizeAndCheckContent(
    input: AuthorizePrivateRequestInput,
    infoHash: string,
  ): Promise<AuthorizeAndCheckPrivateContentOutcome> {
    return this.run('authorize private community content read', () =>
      this.withCommunity<AuthorizeAndCheckPrivateContentOutcome>(input.communityId, async (state) => {
        const outcome = this.authorize(state, input);
        if (outcome !== 'accepted') {
          return {
            value: { outcome },
            dirty: outcome === 'expired',
          };
        }
        if (!state.active) {
          return { value: { outcome: 'state_changed' }, dirty: true };
        }
        return {
          value: {
            outcome: 'accepted',
            owned: state.active.snapshots.some(
              (snapshot) => snapshot.manifest.infoHash === infoHash,
            ),
          },
          dirty: true,
        };
      }));
  }

  async appendTail(input: AppendPrivateTailInput): Promise<AppendPrivateTailOutcome> {
    return this.run('append private community tail', () =>
      this.withCommunity<AppendPrivateTailOutcome>(input.communityId, async (state) => {
        if (!state.active || state.active.descriptorHash !== input.expectedDescriptorHash) {
          return { value: { outcome: 'state_changed' } as const, dirty: false };
        }
        const channelCount = state.active.tail.reduce(
          (count, record) => count + (record.entry.channelId === input.entry.channelId ? 1 : 0),
          0,
        );
        const duplicate = state.active.tail.some((record) => record.replayKey === input.replayKey);
        if (!duplicate && channelCount >= input.maximumEntriesPerChannel) {
          return { value: { outcome: 'tail_full' } as const, dirty: false };
        }
        const authorization = this.authorize(state, input);
        if (authorization !== 'accepted') {
          return {
            value: { outcome: authorization } as AppendPrivateTailOutcome,
            dirty: authorization === 'expired',
          };
        }
        if (duplicate) {
          return { value: { outcome: 'duplicate' } as const, dirty: true };
        }
        state.active.tail.push({ replayKey: input.replayKey, entry: structuredClone(input.entry) });
        return { value: { outcome: 'inserted' } as const, dirty: true };
      }));
  }

  async getState(communityId: string): Promise<StoredPrivateCommunityState | null> {
    return this.run('read private community state', async () => {
      const state = await this.read(communityId);
      return state.active ? cloneActive(state.active) : null;
    });
  }

  async beginPublish(input: BeginPrivatePublishInput): Promise<BeginPrivatePublishOutcome> {
    return this.run('stage private community publish', () =>
      this.withCommunity<BeginPrivatePublishOutcome>(input.communityId, async (state) => {
        this.prune(state, input.nowMs);
        const active = state.active;
        if (active?.publishDigest === input.publishDigest) {
          return {
            value: { outcome: 'idempotent', stageId: input.stageId } as const,
            dirty: false,
          };
        }
        if ((active?.descriptorHash ?? null) !== input.expectedDescriptorHash) {
          return { value: { outcome: 'conflict' } as const, dirty: false };
        }
        const priorRevision = active?.descriptor.descriptor.revision ?? null;
        const revision = input.descriptor.descriptor.revision;
        if (priorRevision !== null && revision < priorRevision) {
          return { value: { outcome: 'stale' } as const, dirty: false };
        }
        if (priorRevision !== null && revision === priorRevision
          && active?.descriptorHash !== input.descriptorHash) {
          return { value: { outcome: 'conflict' } as const, dirty: false };
        }
        const pending = state.pendingPublish;
        if (pending) {
          if (pending.stageId === input.stageId && pending.publishDigest === input.publishDigest) {
            return {
              value: { outcome: 'idempotent', stageId: pending.stageId } as const,
              dirty: false,
            };
          }
          return { value: { outcome: 'busy' } as const, dirty: false };
        }
        state.pendingPublish = {
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
        };
        return {
          value: { outcome: 'staged', stageId: input.stageId } as const,
          dirty: true,
        };
      }));
  }

  async commitPublish(input: CommitPrivatePublishInput): Promise<CommitPrivatePublishOutcome> {
    return this.run('commit private community publish', () =>
      this.withCommunity<CommitPrivatePublishOutcome>(input.communityId, async (state) => {
        if (state.active?.publishDigest === input.publishDigest) {
          return {
            value: { outcome: 'idempotent', previousInfoHashes: [] } as const,
            dirty: false,
          };
        }
        const stage = state.pendingPublish;
        if (!stage || stage.stageId !== input.stageId || stage.publishDigest !== input.publishDigest) {
          return { value: { outcome: 'missing' } as const, dirty: false };
        }
        if (stage.expiresAtMs <= input.nowMs) {
          return { value: { outcome: 'expired' } as const, dirty: false };
        }
        if ((state.active?.descriptorHash ?? null) !== stage.expectedDescriptorHash) {
          return { value: { outcome: 'conflict' } as const, dirty: false };
        }
        const previousInfoHashes = state.active
          ? distinctInfoHashes(state.active.snapshots)
          : [];
        state.active = {
          descriptor: structuredClone(stage.descriptor),
          descriptorHash: stage.descriptorHash,
          publishDigest: stage.publishDigest,
          snapshots: structuredClone(stage.snapshots),
          tail: (state.active?.tail ?? []).filter(
            (record) => !stage.compactedReplayKeys.includes(record.replayKey),
          ),
        };
        state.pendingPublish = null;
        return {
          value: { outcome: 'committed', previousInfoHashes } as const,
          dirty: true,
        };
      }));
  }

  async isContentReferenced(infoHash: string): Promise<boolean> {
    return this.run('check private community content references', async () => {
      for (const file of await this.listStateFiles()) {
        const state = await this.readFilePath(file);
        if (state.active?.snapshots.some((snapshot) => snapshot.manifest.infoHash === infoHash)) {
          return true;
        }
      }
      return false;
    });
  }

  async listExpiredPublishStages(
    limit: number,
    nowMs: number,
  ): Promise<ExpiredPrivatePublishStage[]> {
    return this.run('list expired private community publish stages', () =>
      withExclusiveFileLock(this.globalLock(), async () => {
        const expired: ExpiredPrivatePublishStage[] = [];
        for (const file of await this.listStateFiles()) {
          if (expired.length >= limit) break;
          const state = await this.readFilePath(file);
          const stage = state.pendingPublish;
          if (!stage || stage.expiresAtMs > nowMs) continue;
          expired.push({
            communityId: state.communityId,
            stageId: stage.stageId,
            candidateInfoHashes: distinctInfoHashes(stage.snapshots),
          });
        }
        return expired;
      }));
  }

  async completeExpiredPublishStage(
    communityId: string,
    stageId: string,
    nowMs: number,
  ): Promise<boolean> {
    return this.run('complete expired private community publish stage', () =>
      this.withCommunity<boolean>(communityId, async (state) => {
        const stage = state.pendingPublish;
        if (!stage || stage.stageId !== stageId || stage.expiresAtMs > nowMs) {
          return { value: false, dirty: false };
        }
        state.pendingPublish = null;
        return { value: true, dirty: true };
      }));
  }

  async sweepExpired(nowMs: number): Promise<void> {
    await this.run('sweep private community state', () =>
      withExclusiveFileLock(this.globalLock(), async () => {
        for (const file of await this.listStateFiles()) {
          const communityId = this.communityIdFromPath(file);
          await this.withCommunity(communityId, async (state) => {
            const before = JSON.stringify(state);
            this.prune(state, nowMs);
            return { value: undefined, dirty: JSON.stringify(state) !== before };
          });
        }
      }));
  }

  async trackedCommunityCount(nowMs: number): Promise<number> {
    return this.run('count private community state', async () => {
      let count = 0;
      for (const file of await this.listStateFiles()) {
        const state = await this.readFilePath(file);
        this.prune(state, nowMs);
        if (state.active || Object.keys(state.challenges).length > 0) count += 1;
      }
      return count;
    });
  }

  private authorize(
    state: CommunityPrivateStateFile,
    input: AuthorizePrivateRequestInput,
  ): AuthorizePrivateRequestOutcome {
    const challenge = state.challenges[input.nonce];
    if (!challenge) return 'bad_nonce';
    if (challenge.expiresAtMs <= input.nowMs) {
      delete state.challenges[input.nonce];
      this.prune(state, input.nowMs);
      return 'expired';
    }
    if ((state.active?.descriptorHash ?? null) !== input.expectedDescriptorHash) {
      return 'state_changed';
    }
    if (input.action) {
      const ceiling = input.ceiling;
      if (!input.principalHash || !Number.isSafeInteger(ceiling) || ceiling === undefined || !input.windowMs) {
        throw new TypeError('Authenticated rate-limit inputs are incomplete.');
      }
      const cutoff = input.nowMs - input.windowMs;
      state.rateHits = state.rateHits.filter((hit) => hit.occurredAtMs > cutoff);
      const count = state.rateHits.reduce(
        (total, hit) => total + (
          hit.principalHash === input.principalHash && hit.action === input.action ? 1 : 0
        ),
        0,
      );
      if (count >= ceiling) return 'rate_limited';
      state.rateHits.push({
        principalHash: input.principalHash,
        action: input.action,
        occurredAtMs: input.nowMs,
      });
    }
    if (input.consume) delete state.challenges[input.nonce];
    this.prune(state, input.nowMs);
    return 'accepted';
  }

  private prune(state: CommunityPrivateStateFile, nowMs: number): void {
    for (const [nonce, challenge] of Object.entries(state.challenges)) {
      if (challenge.expiresAtMs <= nowMs) delete state.challenges[nonce];
    }
    state.rateHits = state.rateHits.filter(
      (hit) => hit.occurredAtMs > nowMs - 24 * 60 * 60 * 1000,
    );
    if (Object.keys(state.challenges).length === 0) state.lastChallengeAtMs = null;
  }

  private async evictUnclaimedAtLimit(input: IssuePrivateChallengeInput): Promise<void> {
    const candidates: Array<{ communityId: string; touchedAt: number }> = [];
    for (const file of await this.listStateFiles()) {
      const state = await this.readFilePath(file);
      this.prune(state, input.nowMs);
      if (!state.active && Object.keys(state.challenges).length > 0) {
        candidates.push({
          communityId: state.communityId,
          touchedAt: state.lastChallengeAtMs ?? 0,
        });
      }
    }
    if (candidates.some((candidate) => candidate.communityId === input.communityId)) return;
    if (candidates.length < input.maxUnclaimedCommunities) return;
    candidates.sort((left, right) => left.touchedAt - right.touchedAt);
    const victim = candidates[0];
    if (!victim) return;
    await this.withCommunity(victim.communityId, async (state) => {
      state.challenges = {};
      state.lastChallengeAtMs = null;
      return { value: undefined, dirty: true };
    });
  }

  private async withCommunity<T>(
    communityId: string,
    operation: (
      state: CommunityPrivateStateFile,
    ) => Promise<{ value: T; dirty: boolean }>,
  ): Promise<T> {
    return withExclusiveFileLock(this.lockFile(communityId), async () => {
      const state = await this.read(communityId);
      const result = await operation(state);
      if (result.dirty) {
        // An UNCLAIMED community whose last challenge expired or was evicted
        // owns nothing: remove its file instead of persisting an empty shell.
        // Otherwise every unknown id ever challenged leaves a file behind
        // forever, and listStateFiles() (read on every issuance and sweep)
        // grows until it trips MAX_FILE_COMMUNITIES and the whole authority
        // fails closed (audit 2026-09-01, R1).
        if (isEmptyState(state)) await fs.rm(this.stateFile(communityId), { force: true });
        else await atomicWriteJson(this.stateFile(communityId), state);
      }
      return result.value;
    });
  }

  private async read(communityId: string): Promise<CommunityPrivateStateFile> {
    const file = this.stateFile(communityId);
    try {
      return await this.readFilePath(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyFile(communityId);
      throw error;
    }
  }

  private async readFilePath(file: string): Promise<CommunityPrivateStateFile> {
    const stat = await fs.stat(file);
    if (stat.size > MAX_FILE_BYTES) throw new Error('Community private-state file is too large.');
    const raw = await fs.readFile(file, 'utf8');
    const communityId = this.communityIdFromPath(file);
    return validateLoadedFile(communityId, JSON.parse(raw) as unknown);
  }

  private async listStateFiles(): Promise<string[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.baseDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const files = entries
      .filter((entry) => entry.endsWith('.private-state.json'))
      .sort()
      .map((entry) => path.join(this.baseDir, entry));
    if (files.length > MAX_FILE_COMMUNITIES) {
      throw new Error('Community private-state directory exceeds its bounded file limit.');
    }
    return files;
  }

  private stateFile(communityId: string): string {
    return path.join(this.baseDir, `${Buffer.from(communityId, 'utf8').toString('hex')}.private-state.json`);
  }

  private lockFile(communityId: string): string {
    const digest = createHash('sha256').update(communityId, 'utf8').digest('hex');
    return path.join(this.baseDir, '.locks', `${digest}.lock`);
  }

  private globalLock(): string {
    return path.join(this.baseDir, '.locks', 'global-challenge-sweep.lock');
  }

  private communityIdFromPath(file: string): string {
    const name = path.basename(file, '.private-state.json');
    return Buffer.from(name, 'hex').toString('utf8');
  }

  private async run<T>(operation: string, callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      throw toCommunityPrivateStateUnavailableError(operation, error);
    }
  }
}
