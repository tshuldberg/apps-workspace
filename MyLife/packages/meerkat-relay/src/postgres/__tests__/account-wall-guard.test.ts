/**
 * Plan 51 P4 (AC-2): the one-way wall, enforced at the schema layer.
 *
 * Statically parses every CREATE TABLE across ALL migrations and asserts:
 *  1. No table anywhere contains both an account-identifier column and a
 *     persona/device-key column.
 *  2. The account schema never contains a credential serial, persona, or
 *     device column (the issuer cannot hold what it must not learn).
 *  3. The credential schema never contains an account, persona, or device
 *     column (the bridge is anonymous on both sides).
 *  4. Role grants keep the wall: only meerkat_account touches account.*, and
 *     meerkat_account touches nothing outside account/credential/readiness.
 *
 * This test runs on every migration added later, so a future column cannot
 * silently join the two identity layers.
 */

import { describe, expect, it } from 'vitest';
import { MEERKAT_POSTGRES_MIGRATIONS } from '../migrations/index';
import { MEERKAT_DATABASE_ROLES } from '../roles';

interface ParsedTable {
  schema: string;
  table: string;
  columns: string[];
  migration: number;
}

const CONSTRAINT_KEYWORDS = new Set([
  'constraint', 'primary', 'unique', 'check', 'foreign', 'exclude', 'like',
]);

function parseCreateTables(): ParsedTable[] {
  const tables: ParsedTable[] = [];
  for (const migration of MEERKAT_POSTGRES_MIGRATIONS) {
    const pattern = /CREATE TABLE\s+([a-z_]+)\.([a-z_]+)\s*\(([\s\S]*?)\n\);/gu;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(migration.sql)) !== null) {
      const [, schema, table, body] = match;
      const columns: string[] = [];
      for (const rawLine of body!.split('\n')) {
        const line = rawLine.trim().replace(/,+$/u, '');
        if (!line || line.startsWith('--')) continue;
        const first = line.split(/\s+/u)[0]!.toLowerCase();
        if (CONSTRAINT_KEYWORDS.has(first)) continue;
        if (/^[a-z_][a-z0-9_]*$/u.test(first)) columns.push(first);
      }
      tables.push({ schema: schema!, table: table!, columns, migration: migration.version });
    }
  }
  for (const migration of MEERKAT_POSTGRES_MIGRATIONS) {
    const additions = /ALTER TABLE\s+([a-z_]+)\.([a-z_]+)\s+ADD COLUMN\s+([a-z_][a-z0-9_]*)/gu;
    for (const match of migration.sql.matchAll(additions)) {
      const table = tables.find((item) => item.schema === match[1] && item.table === match[2]);
      if (!table) throw new Error('ALTER TABLE refers to an unparsed table');
      table.columns.push(match[3]!);
    }
  }
  return tables;
}

const ACCOUNT_IDENT = /^(account_id|provider_subject|relay_email)$/u;
const PERSONA_DEVICE_IDENT = /(persona|device_id|device_key|device_pubkey)/u;
const SERIAL_IDENT = /(^serial$|_serial$|^serial_)/u;

describe('AC-2 schema wall guard', () => {
  const tables = parseCreateTables();

  it('parses a meaningful table set (parser self-check)', () => {
    expect(tables.length).toBeGreaterThan(20);
    const revocations = tables.find((t) => t.schema === 'credential' && t.table === 'revocations');
    expect(revocations?.columns).toContain('serial');
    const accounts = tables.find((t) => t.schema === 'account' && t.table === 'accounts');
    expect(accounts?.columns).toContain('provider_subject');
  });

  it('no table anywhere holds both an account identifier and a persona/device identifier', () => {
    for (const table of tables) {
      const hasAccount = table.columns.some((column) => ACCOUNT_IDENT.test(column));
      const hasPersona = table.columns.some((column) => PERSONA_DEVICE_IDENT.test(column));
      expect(
        hasAccount && hasPersona,
        `${table.schema}.${table.table} (migration ${table.migration}) joins the two identity layers`,
      ).toBe(false);
    }
  });

  it('the account schema never contains a serial, persona, or device column', () => {
    for (const table of tables.filter((t) => t.schema === 'account')) {
      for (const column of table.columns) {
        expect(
          SERIAL_IDENT.test(column) || PERSONA_DEVICE_IDENT.test(column),
          `account.${table.table}.${column} breaches the wall`,
        ).toBe(false);
      }
    }
  });

  it('the credential schema never contains an account, persona, or device column', () => {
    for (const table of tables.filter((t) => t.schema === 'credential')) {
      for (const column of table.columns) {
        expect(
          ACCOUNT_IDENT.test(column) || PERSONA_DEVICE_IDENT.test(column) || /account/u.test(column),
          `credential.${table.table}.${column} breaches the wall`,
        ).toBe(false);
      }
    }
  });

  it('only meerkat_account holds any grant on the account schema', () => {
    for (const role of MEERKAT_DATABASE_ROLES) {
      const touchesAccount = role.access.some((access) => access.schema === 'account');
      if (role.name === 'meerkat_account') {
        expect(touchesAccount).toBe(true);
      } else {
        expect(touchesAccount, `${role.name} must not touch account.*`).toBe(false);
      }
    }
  });

  it('meerkat_account holds nothing outside account, credential, and schema readiness', () => {
    const role = MEERKAT_DATABASE_ROLES.find((r) => r.name === 'meerkat_account')!;
    for (const access of role.access) {
      const allowed = access.schema === 'account'
        || access.schema === 'credential'
        || (access.schema === 'ops' && access.tables.length === 1 && access.tables[0] === 'schema_migrations');
      expect(allowed, `meerkat_account grant on ${access.schema} breaches the wall`).toBe(true);
    }
  });

  it('non-account roles touching the credential bridge are read-only, except moderation revocation writes', () => {
    for (const role of MEERKAT_DATABASE_ROLES) {
      if (role.name === 'meerkat_account') continue;
      for (const access of role.access.filter((a) => a.schema === 'credential')) {
        for (const privilege of access.privileges) {
          const isModerationRevoke = role.name === 'meerkat_moderation'
            && access.tables.length === 1
            && access.tables[0] === 'revocations'
            && (privilege === 'SELECT' || privilege === 'INSERT');
          expect(
            privilege === 'SELECT' || isModerationRevoke,
            `${role.name} has ${privilege} on credential.${access.tables.join(',')}`,
          ).toBe(true);
        }
      }
    }
  });
});
