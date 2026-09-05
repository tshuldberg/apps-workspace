// schema-boot.ts: the ONE place that creates every local table family.
//
// Why this module exists (2026-08-28, TestFlight builds 13 + 14 crashed at first
// launch on a fresh install). Screens read the database during their RENDER phase
// (e.g. the Feed's `useState(() => listCommunities(db))`, the Messages surface's
// DM read). React runs child renders and child effects BEFORE a parent provider's
// effect, so ANY schema creation living in a provider effect loses that race on a
// brand-new meerkat.db. Build 13 died on `sync_communities`; fixing only that
// family moved the crash to `dm_conversations` in build 14. The class of bug is
// "a table family whose DDL runs later than its first reader", so the fix has to
// be class-level: schema existence is an INVARIANT of holding a db handle.
//
// Rule for anyone adding a new table family: add its `ensure*` call here. The
// guard test (app/__tests__/fresh-install-boot.test.ts) enumerates every exported
// `ensure*Tables` / `ensure*Schema` in data/ and FAILS if one is not wired in, so
// this cannot silently regress again.
//
// Every call below is idempotent (CREATE TABLE IF NOT EXISTS), so re-running it
// on an existing database is a no-op, and the provider effects that still call
// their own ensure* functions stay harmless.

import type { DatabaseAdapter } from '@mylife/db';
import { ensureMeerkatTables } from './db';
import { ensureSyncSchema } from './sync-core';
import { ensureDmTables } from './dm-core';
import { ensurePersonIdentityTables } from './person-identity-core';

/**
 * Create every local table family: mk_ (+ call/share-intake/pinned/theme via
 * ensureMeerkatTables), sync_ + mp_ + pi_ + cm_ (ensureSyncSchema), dm_
 * (ensureDmTables), and the person-identity ceremony tables. Idempotent.
 * Called synchronously at database open, before any handle is handed out.
 */
export function ensureFullMeerkatSchema(db: DatabaseAdapter): void {
  ensureMeerkatTables(db);
  ensureSyncSchema(db);
  ensureDmTables(db);
  ensurePersonIdentityTables(db);
}
