import type { DatabaseAdapter } from '@mylife/db';
import type { NotePlugin, NotePluginSetting } from '../types';

function rowToPlugin(row: Record<string, unknown>): NotePlugin {
  return {
    id: row.id as string,
    name: row.name as string,
    version: row.version as string,
    description: (row.description as string) ?? '',
    author: (row.author as string) ?? '',
    isEnabled: (row.is_enabled as number) === 1,
    isBuiltIn: (row.is_built_in as number) === 1,
    manifestJson: (row.manifest_json as string) ?? '{}',
    installedAt: row.installed_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function installPlugin(
  db: DatabaseAdapter,
  id: string,
  input: { name: string; version?: string; description?: string; author?: string; isBuiltIn?: boolean; manifestJson?: string },
): NotePlugin {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO nt_plugins (id, name, version, description, author, is_built_in, manifest_json, installed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.version ?? '0.1.0', input.description ?? '', input.author ?? '', input.isBuiltIn ? 1 : 0, input.manifestJson ?? '{}', now, now],
  );
  return { id, name: input.name, version: input.version ?? '0.1.0', description: input.description ?? '', author: input.author ?? '', isEnabled: false, isBuiltIn: input.isBuiltIn ?? false, manifestJson: input.manifestJson ?? '{}', installedAt: now, updatedAt: now };
}

export function getPlugins(db: DatabaseAdapter, limit = 100): NotePlugin[] {
  return db.query<Record<string, unknown>>(`SELECT * FROM nt_plugins ORDER BY name ASC LIMIT ?`, [limit]).map(rowToPlugin);
}

export function getPluginById(db: DatabaseAdapter, id: string): NotePlugin | null {
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM nt_plugins WHERE id = ?`, [id]);
  return rows.length > 0 ? rowToPlugin(rows[0]) : null;
}

export function enablePlugin(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE nt_plugins SET is_enabled = 1, updated_at = datetime('now') WHERE id = ?`, [id]);
}

export function disablePlugin(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE nt_plugins SET is_enabled = 0, updated_at = datetime('now') WHERE id = ?`, [id]);
}

export function uninstallPlugin(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM nt_plugins WHERE id = ? AND is_built_in = 0`, [id]);
  return true;
}

export function getEnabledPlugins(db: DatabaseAdapter, limit = 100): NotePlugin[] {
  return db.query<Record<string, unknown>>(`SELECT * FROM nt_plugins WHERE is_enabled = 1 LIMIT ?`, [limit]).map(rowToPlugin);
}

// ── Plugin Settings ───────────────────────────────────────────────────

export function getPluginSetting(db: DatabaseAdapter, pluginId: string, key: string): string | null {
  const rows = db.query<NotePluginSetting>(
    `SELECT * FROM nt_plugin_settings WHERE plugin_id = ? AND key = ?`,
    [pluginId, key],
  );
  return rows.length > 0 ? rows[0].value : null;
}

export function setPluginSetting(db: DatabaseAdapter, pluginId: string, key: string, value: string): void {
  db.execute(
    `INSERT INTO nt_plugin_settings (plugin_id, key, value) VALUES (?, ?, ?) ON CONFLICT(plugin_id, key) DO UPDATE SET value = excluded.value`,
    [pluginId, key, value],
  );
}

export function getPluginSettings(db: DatabaseAdapter, pluginId: string): NotePluginSetting[] {
  return db.query<{ plugin_id: string; key: string; value: string }>(
    `SELECT * FROM nt_plugin_settings WHERE plugin_id = ?`,
    [pluginId],
  ).map((r) => ({ pluginId: r.plugin_id, key: r.key, value: r.value }));
}
