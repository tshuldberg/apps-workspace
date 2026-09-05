/**
 * Custom theme profiles (P15-C / F-029, F-030).
 *
 * Local mirror of bc_custom_themes (cloud). Each row is a user-named saved
 * theme with the full ThemeProfile JSON stored in token_overrides_json so
 * presets and edits survive a relaunch and can be listed in the theme
 * browser alongside built-in presets.
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface CustomThemeRow {
  id: string;
  name: string;
  token_overrides_json: string;
  created_at: string;
  updated_at: string;
}

export interface CustomTheme {
  id: string;
  name: string;
  /** Parsed ThemeProfile JSON (validated by callers via @mylife/ui validateTheme). */
  tokenOverrides: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomThemeInput {
  name: string;
  tokenOverrides: unknown;
  /** Optional explicit id (tests). Defaults to a generated id. */
  id?: string;
}

export interface UpdateCustomThemeInput {
  id: string;
  name?: string;
  tokenOverrides?: unknown;
}

function createCustomThemeId(): string {
  return `ct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowToCustomTheme(row: CustomThemeRow): CustomTheme {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.token_overrides_json);
  } catch {
    parsed = null;
  }
  return {
    id: row.id,
    name: row.name,
    tokenOverrides: parsed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listCustomThemes(db: DatabaseAdapter): CustomTheme[] {
  const rows = db.query<CustomThemeRow>(
    `SELECT id, name, token_overrides_json, created_at, updated_at
     FROM rc_custom_themes
     ORDER BY created_at DESC`,
    [],
  );
  return rows.map(rowToCustomTheme);
}

export function getCustomThemeById(
  db: DatabaseAdapter,
  id: string,
): CustomTheme | null {
  const rows = db.query<CustomThemeRow>(
    `SELECT id, name, token_overrides_json, created_at, updated_at
     FROM rc_custom_themes WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToCustomTheme(rows[0]) : null;
}

export function createCustomTheme(
  db: DatabaseAdapter,
  input: CreateCustomThemeInput,
): CustomTheme {
  const trimmed = input.name.trim();
  if (!trimmed) {
    throw new Error('Custom theme name is required');
  }
  const id = input.id ?? createCustomThemeId();
  const json = JSON.stringify(input.tokenOverrides ?? {});
  db.execute(
    `INSERT INTO rc_custom_themes (id, name, token_overrides_json) VALUES (?, ?, ?)`,
    [id, trimmed, json],
  );
  const row = getCustomThemeById(db, id);
  if (!row) {
    throw new Error('Failed to create custom theme');
  }
  return row;
}

export function renameCustomTheme(
  db: DatabaseAdapter,
  id: string,
  name: string,
): CustomTheme {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Custom theme name is required');
  }
  db.execute(
    `UPDATE rc_custom_themes SET name = ?, updated_at = datetime('now') WHERE id = ?`,
    [trimmed, id],
  );
  const row = getCustomThemeById(db, id);
  if (!row) {
    throw new Error('Custom theme not found');
  }
  return row;
}

export function updateCustomTheme(
  db: DatabaseAdapter,
  input: UpdateCustomThemeInput,
): CustomTheme {
  const sets: string[] = [];
  const args: Array<string | number> = [];
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error('Custom theme name is required');
    }
    sets.push('name = ?');
    args.push(trimmed);
  }
  if (input.tokenOverrides !== undefined) {
    sets.push('token_overrides_json = ?');
    args.push(JSON.stringify(input.tokenOverrides));
  }
  if (sets.length === 0) {
    const existing = getCustomThemeById(db, input.id);
    if (!existing) throw new Error('Custom theme not found');
    return existing;
  }
  sets.push(`updated_at = datetime('now')`);
  args.push(input.id);
  db.execute(
    `UPDATE rc_custom_themes SET ${sets.join(', ')} WHERE id = ?`,
    args,
  );
  const row = getCustomThemeById(db, input.id);
  if (!row) {
    throw new Error('Custom theme not found');
  }
  return row;
}

export function duplicateCustomTheme(
  db: DatabaseAdapter,
  id: string,
  newName: string,
): CustomTheme {
  const source = getCustomThemeById(db, id);
  if (!source) {
    throw new Error('Custom theme not found');
  }
  return createCustomTheme(db, {
    name: newName,
    tokenOverrides: source.tokenOverrides,
  });
}

export function deleteCustomTheme(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM rc_custom_themes WHERE id = ?`, [id]);
}
