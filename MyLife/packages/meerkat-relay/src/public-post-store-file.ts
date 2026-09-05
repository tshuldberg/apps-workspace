/**
 * Durable, restart-safe PublicPostStore (Plan 39 P6). The community-node deploy
 * points this at its DATA_DIR volume so node-accepted public posts, honored post
 * tombstones, the posting freeze, and the per-persona flood windows all survive a
 * restart (a forgotten tombstone would resurrect a removed post; a reset flood
 * window would re-open a flood). Same filesystem discipline as the other stores:
 * JSON files per publication, atomic temp+rename writes, corrupt files degrade to
 * empty (posts) or absent (freeze) -- never to a torn state.
 *
 * Everything written is PUBLIC signed content (dual-signed posts, signed
 * tombstones/freezes, timestamps); no keys, no private plaintext.
 */

import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type {
  AcceptedPublicPost,
  PublicPostTombstone,
  PublicPostingFreeze,
} from '@mylife/sync';
import { atomicWriteFile, type PublicPostStore } from './community-node';
import { withExclusiveFileLock } from './file-lock';

export class FilePublicPostStore implements PublicPostStore {
  constructor(private readonly baseDir: string) {}

  private file(publicationId: string, suffix: string): string {
    const safe = Buffer.from(publicationId, 'utf8').toString('hex');
    return path.join(this.baseDir, `${safe}.${suffix}.json`);
  }

  withPublicationWriteLock<T>(publicationId: string, operation: () => Promise<T>): Promise<T> {
    const safe = Buffer.from(publicationId, 'utf8').toString('hex');
    return withExclusiveFileLock(path.join(this.baseDir, '.locks', `${safe}.lock`), operation);
  }

  private blockedPersonaFile(personaPubkey: string): string {
    const hash = createHash('sha256').update(personaPubkey.toLowerCase(), 'utf8').digest('hex');
    return path.join(this.baseDir, 'blocked-personas', `${hash}.blocked`);
  }

  async isPersonaBlocked(personaPubkey: string): Promise<boolean> {
    try {
      await fs.access(this.blockedPersonaFile(personaPubkey));
      return true;
    } catch {
      return false;
    }
  }

  async blockPersona(personaPubkey: string): Promise<void> {
    const file = this.blockedPersonaFile(personaPubkey);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '', { flag: 'a', mode: 0o600 });
  }

  private async readJson<T>(file: string): Promise<T | null> {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  async listPosts(publicationId: string): Promise<AcceptedPublicPost[]> {
    const parsed = await this.readJson<AcceptedPublicPost[]>(this.file(publicationId, 'posts'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => typeof p === 'object' && p !== null
      && typeof (p as AcceptedPublicPost).post === 'object'
      && typeof (p as AcceptedPublicPost).receipt === 'object');
  }

  async putPosts(publicationId: string, posts: AcceptedPublicPost[]): Promise<void> {
    await atomicWriteFile(this.file(publicationId, 'posts'), JSON.stringify(posts));
  }

  async listTombstones(publicationId: string): Promise<PublicPostTombstone[]> {
    const parsed = await this.readJson<PublicPostTombstone[]>(this.file(publicationId, 'post-tombstones'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => typeof t === 'object' && t !== null
      && typeof (t as PublicPostTombstone).postId === 'string'
      && typeof (t as PublicPostTombstone).signature === 'string');
  }

  async putTombstones(publicationId: string, tombstones: PublicPostTombstone[]): Promise<void> {
    await atomicWriteFile(this.file(publicationId, 'post-tombstones'), JSON.stringify(tombstones));
  }

  async getFreeze(publicationId: string): Promise<PublicPostingFreeze | null> {
    const parsed = await this.readJson<PublicPostingFreeze>(this.file(publicationId, 'freeze'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.signature !== 'string') return null;
    return parsed;
  }

  async putFreeze(publicationId: string, freeze: PublicPostingFreeze): Promise<void> {
    await atomicWriteFile(this.file(publicationId, 'freeze'), JSON.stringify(freeze));
  }

  async listSubmits(publicationId: string, personaKey: string): Promise<number[]> {
    const parsed = await this.readJson<Record<string, number[]>>(this.file(publicationId, 'flood'));
    const list = parsed?.[personaKey];
    return Array.isArray(list) ? list.filter((n) => typeof n === 'number') : [];
  }

  async putSubmits(publicationId: string, personaKey: string, timestampsMs: number[]): Promise<void> {
    const file = this.file(publicationId, 'flood');
    const parsed = (await this.readJson<Record<string, number[]>>(file)) ?? {};
    if (timestampsMs.length === 0) {
      delete parsed[personaKey];
    } else {
      parsed[personaKey] = timestampsMs;
    }
    await atomicWriteFile(file, JSON.stringify(parsed));
  }
}
