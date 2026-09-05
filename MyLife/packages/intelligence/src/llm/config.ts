/**
 * LLM configuration CRUD operations.
 *
 * Manages the hub_ai_config table: API key, provider, and consent state.
 * The API key is stored as-is; encryption at rest is handled by the
 * SQLite file-level encryption if configured by the host app.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { LLMConfig, LLMProvider } from './types';

/** Get the current LLM configuration. Returns null if not configured. */
export function getLLMConfig(db: DatabaseAdapter): LLMConfig | null {
  const rows = db.query<{
    provider: LLMProvider;
    api_key: string;
    consent_given: number;
    consent_given_at: string | null;
  }>('SELECT provider, api_key, consent_given, consent_given_at FROM hub_ai_config WHERE id = ?', [
    'current',
  ]);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    provider: row.provider,
    apiKey: row.api_key,
    consentGiven: row.consent_given === 1,
    consentGivenAt: row.consent_given_at,
  };
}

/** Save or update the LLM configuration. Consent must be explicitly granted. */
export function setLLMConfig(
  db: DatabaseAdapter,
  provider: LLMProvider,
  apiKey: string,
  consentGiven: boolean,
): void {
  const consentAt = consentGiven ? new Date().toISOString() : null;
  db.execute(
    `INSERT INTO hub_ai_config (id, provider, api_key, consent_given, consent_given_at)
     VALUES ('current', ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       provider = excluded.provider,
       api_key = excluded.api_key,
       consent_given = excluded.consent_given,
       consent_given_at = excluded.consent_given_at,
       updated_at = datetime('now')`,
    [provider, apiKey, consentGiven ? 1 : 0, consentAt],
  );
}

/** Remove the LLM configuration (clears API key and revokes consent). */
export function clearLLMConfig(db: DatabaseAdapter): void {
  db.execute('DELETE FROM hub_ai_config WHERE id = ?', ['current']);
}

/** Check if LLM insights are available (config exists + consent given + key present). */
export function isLLMConfigured(db: DatabaseAdapter): boolean {
  const config = getLLMConfig(db);
  return config !== null && config.consentGiven && config.apiKey.length > 0;
}
