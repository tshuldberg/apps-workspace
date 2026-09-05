/**
 * AI configuration schema.
 *
 * NOTE: `hub_ai_permissions` and `hub_ai_table_permissions` are owned by
 * `@mylife/db` (`packages/db/src/hub-schema.ts`) as of Phase 1a. This module
 * no longer re-declares them; `createHubTables` from `@mylife/db` is the
 * single source of truth.
 *
 * `hub_ai_config` remains intelligence-local because it stores the LLM
 * provider / API key / consent state consumed only by the LLM subsystem.
 * `ensureAIPermissionTables` creates the hub permission tables (idempotent
 * via `createHubTables`) plus `hub_ai_config`, so legacy test callers and
 * the LLM layer both get a fully provisioned database.
 */

import { createHubTables } from '@mylife/db';

export const CREATE_HUB_AI_CONFIG = `
CREATE TABLE IF NOT EXISTS hub_ai_config (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'current'),
  provider TEXT NOT NULL CHECK (provider IN ('claude', 'openai')),
  api_key TEXT NOT NULL,
  consent_given INTEGER NOT NULL DEFAULT 0 CHECK (consent_given IN (0, 1)),
  consent_given_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const AI_PERMISSION_TABLES = [CREATE_HUB_AI_CONFIG] as const;

/**
 * Ensure AI-related tables exist. Safe to call multiple times (IF NOT EXISTS).
 *
 * Creates the canonical hub permission tables plus the LLM config table.
 * Callers that already ran `createHubTables` can still call this to add
 * `hub_ai_config` without side effects.
 */
export function ensureAIPermissionTables(db: { execute(sql: string): void }): void {
  createHubTables(db);
  db.execute(CREATE_HUB_AI_CONFIG);
}
