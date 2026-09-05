/**
 * Durable room-admission generation contract (Plan 25 WP-25E).
 *
 * Generation 1 is implicit for a room with no stored row. Revocation atomically
 * advances the generation, which moves future participants to a different opaque
 * LiveKit room name. The file adapter follows the relay's crash-safe ledger pattern:
 * one cross-process lock and one atomic replacement per mutation.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './community-node';
import { withExclusiveFileLock } from './file-lock';

const MAX_ROOM_SCOPE_CHARS = 256;
const FILE_LEDGER_VERSION = 1;

export interface AdmissionGenerationBump {
  previousGeneration: number;
  generation: number;
}

export interface AdmissionGenerationStore {
  /** Returns the implicit initial generation (1) when no row exists. */
  getGeneration(communityId: string, roomId: string): number | Promise<number>;
  /** Atomically advances one room and returns both sides of the committed change. */
  bumpGeneration(
    communityId: string,
    roomId: string,
  ): AdmissionGenerationBump | Promise<AdmissionGenerationBump>;
}

interface RoomAdmissionStateRecord {
  communityId: string;
  roomId: string;
  generation: number;
  updatedAt: string;
}

interface RoomAdmissionFileLedger {
  version: 1;
  entries: Record<string, RoomAdmissionStateRecord>;
}

function assertRoomScopeId(name: string, value: string): void {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_ROOM_SCOPE_CHARS
    || value.trim().length === 0
  ) {
    throw new TypeError(`${name} must contain between 1 and ${MAX_ROOM_SCOPE_CHARS} characters`);
  }
}

function assertGeneration(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('Room admission generation is invalid');
  }
}

function assertClock(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new TypeError('Room admission clock is invalid');
  }
}

function roomKey(communityId: string, roomId: string): string {
  return JSON.stringify([communityId, roomId]);
}

function emptyLedger(): RoomAdmissionFileLedger {
  return { version: FILE_LEDGER_VERSION, entries: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateLedger(value: unknown): asserts value is RoomAdmissionFileLedger {
  if (!isRecord(value) || value.version !== FILE_LEDGER_VERSION || !isRecord(value.entries)) {
    throw new Error('FileAdmissionGenerationStore: room admission ledger is corrupt');
  }
  for (const [key, raw] of Object.entries(value.entries)) {
    if (!isRecord(raw)) {
      throw new Error('FileAdmissionGenerationStore: room admission ledger is corrupt');
    }
    const { communityId, roomId, generation, updatedAt } = raw;
    try {
      assertRoomScopeId('communityId', communityId as string);
      assertRoomScopeId('roomId', roomId as string);
      assertGeneration(generation as number);
    } catch (error) {
      throw new Error('FileAdmissionGenerationStore: room admission ledger is corrupt', { cause: error });
    }
    if (
      typeof updatedAt !== 'string'
      || !Number.isFinite(Date.parse(updatedAt))
      || key !== roomKey(communityId as string, roomId as string)
    ) {
      throw new Error('FileAdmissionGenerationStore: room admission ledger is corrupt');
    }
  }
}

export class InMemoryAdmissionGenerationStore implements AdmissionGenerationStore {
  private readonly generations = new Map<string, number>();

  getGeneration(communityId: string, roomId: string): number {
    assertRoomScopeId('communityId', communityId);
    assertRoomScopeId('roomId', roomId);
    return this.generations.get(roomKey(communityId, roomId)) ?? 1;
  }

  bumpGeneration(communityId: string, roomId: string): AdmissionGenerationBump {
    const previousGeneration = this.getGeneration(communityId, roomId);
    if (previousGeneration === Number.MAX_SAFE_INTEGER) {
      throw new Error('Room admission generation is exhausted');
    }
    const generation = previousGeneration + 1;
    this.generations.set(roomKey(communityId, roomId), generation);
    return { previousGeneration, generation };
  }
}

export class FileAdmissionGenerationStore implements AdmissionGenerationStore {
  private readonly ledgerFile: string;
  private readonly lockFile: string;
  private readonly nowMs: () => number;

  constructor(baseDir: string, nowMs: () => number = () => Date.now()) {
    this.ledgerFile = path.join(baseDir, 'room-admission-state.json');
    this.lockFile = path.join(baseDir, '.room-admission-state.lock');
    this.nowMs = nowMs;
  }

  private async readLedger(): Promise<RoomAdmissionFileLedger> {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.ledgerFile, 'utf8'));
      validateLedger(parsed);
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyLedger();
      if (error instanceof SyntaxError) {
        throw new Error('FileAdmissionGenerationStore: room admission ledger is corrupt', {
          cause: error,
        });
      }
      throw error;
    }
  }

  getGeneration(communityId: string, roomId: string): Promise<number> {
    assertRoomScopeId('communityId', communityId);
    assertRoomScopeId('roomId', roomId);
    return withExclusiveFileLock(this.lockFile, async () => {
      const ledger = await this.readLedger();
      return ledger.entries[roomKey(communityId, roomId)]?.generation ?? 1;
    });
  }

  bumpGeneration(communityId: string, roomId: string): Promise<AdmissionGenerationBump> {
    assertRoomScopeId('communityId', communityId);
    assertRoomScopeId('roomId', roomId);
    return withExclusiveFileLock(this.lockFile, async () => {
      const ledger = await this.readLedger();
      const key = roomKey(communityId, roomId);
      const previousGeneration = ledger.entries[key]?.generation ?? 1;
      if (previousGeneration === Number.MAX_SAFE_INTEGER) {
        throw new Error('Room admission generation is exhausted');
      }
      const generation = previousGeneration + 1;
      const now = this.nowMs();
      assertClock(now);
      ledger.entries[key] = {
        communityId,
        roomId,
        generation,
        updatedAt: new Date(now).toISOString(),
      };
      await atomicWriteFile(this.ledgerFile, JSON.stringify(ledger));
      return { previousGeneration, generation };
    });
  }
}
