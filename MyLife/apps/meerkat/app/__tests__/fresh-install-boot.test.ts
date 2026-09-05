// Fresh-install boot order (2026-08-28: TestFlight builds 13 AND 14 crashed).
//
// Root cause class: screens read the db during their RENDER phase (the Feed's
// `useState(() => listCommunities(db))`, the Messages/DM surface), and React runs
// child renders + child effects BEFORE a parent provider's effect. So any table
// family whose DDL lives in a provider effect loses the race on a brand-new
// meerkat.db. Build 13 crashed on `sync_communities`; wiring only that family
// moved the crash to `dm_conversations` in build 14. Fix: `ensureFullMeerkatSchema`
// runs every family synchronously at database open (meerkat-db.ts
// openActiveDatabase), so schema existence is an invariant of holding a handle.
//
// The completeness guard below is the important test: it enumerates every
// exported `ensure*Tables` / `ensure*Schema` in data/ and fails if one is not
// reachable from ensureFullMeerkatSchema. A new table family added tomorrow
// cannot silently reintroduce this crash.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import { listCommunities } from '@mylife/sync';
import { ensureFullMeerkatSchema } from '../(root)/data/schema-boot';
import { listDmConversations } from '../(root)/data/dm-core';

const DATA_DIR = join(__dirname, '..', '(root)', 'data');

describe('fresh-install boot order', () => {
  it('documents the failure mode: a fresh database has none of the tables first-render reads touch', () => {
    const db = createInMemoryTestDatabase().adapter;
    // These are the exact first-render reads that crashed builds 13 and 14.
    expect(() => listCommunities(db)).toThrow(/sync_communities/);
    expect(() => listDmConversations(db)).toThrow(/dm_conversations/);
  });

  it('ensureFullMeerkatSchema makes every first-render read safe on a fresh database', () => {
    const db = createInMemoryTestDatabase().adapter;
    ensureFullMeerkatSchema(db);
    expect(listCommunities(db)).toEqual([]);           // build 13 crash
    expect(listDmConversations(db)).toEqual([]);       // build 14 crash
    expect(db.query('SELECT COUNT(*) AS n FROM cm_messages')).toEqual([{ n: 0 }]);
    expect(db.query('SELECT COUNT(*) AS n FROM mk_settings')).toEqual([{ n: 0 }]);
    expect(db.query('SELECT COUNT(*) AS n FROM pi_person_group')).toEqual([{ n: 0 }]);
    // Idempotent: reopening, or a provider effect's own ensure* call, is a no-op.
    ensureFullMeerkatSchema(db);
    expect(listCommunities(db)).toEqual([]);
  });

  it('completeness guard: every ensure*Tables/Schema in data/ is wired into ensureFullMeerkatSchema', () => {
    const exported = new Set<string>();
    for (const file of readdirSync(DATA_DIR)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const source = readFileSync(join(DATA_DIR, file), 'utf8');
      for (const match of source.matchAll(
        /export function (ensure[A-Za-z0-9]*(?:Tables|Schema))\s*\(/g,
      )) {
        exported.add(match[1]);
      }
    }
    // Sanity: the enumeration itself must be finding things.
    expect(exported.size).toBeGreaterThanOrEqual(4);

    const bootSource = readFileSync(join(DATA_DIR, 'schema-boot.ts'), 'utf8');
    // Only the CALL BODY counts. Checking the whole file would let a leftover
    // import satisfy the guard while the call itself was deleted (caught by
    // mutation-testing this guard on 2026-08-28).
    const body = bootSource.slice(bootSource.indexOf('export function ensureFullMeerkatSchema'));
    const missing = [...exported]
      .filter((fn) => fn !== 'ensureFullMeerkatSchema')
      // Families reached transitively by another ensure* are still covered.
      .filter((fn) => !TRANSITIVELY_COVERED.has(fn))
      .filter((fn) => !body.includes(`${fn}(db)`));
    expect(missing).toEqual([]);
  });

  it('source guard: openActiveDatabase builds the full schema before caching the handle', () => {
    const source = readFileSync(join(DATA_DIR, 'meerkat-db.ts'), 'utf8');
    const open = source.slice(source.indexOf('function openActiveDatabase'));
    const body = open.slice(0, open.indexOf('cachedNativeDb = db'));
    expect(body).toContain('ensureFullMeerkatSchema(');
  });
});

// ensure* functions that another wired ensure* already calls. Keep this list
// honest: an entry here is a claim that the family is created at open.
// ensureCallTables <- ensureMeerkatTables; ensureCommunityTables <- ensureSyncSchema.
const TRANSITIVELY_COVERED = new Set(['ensureCallTables', 'ensureCommunityTables']);
