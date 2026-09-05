'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  getSetting,
  setSetting,
  getSettings,
  getDataStats,
  exportAllData,
  exportCSV,
  deleteAllData,
  type FriendsSettingKey,
  type DataStats,
  type FriendsExport,
} from '@mylife/friends';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('friends');
  return adapter;
}

async function runAction<T>(work: () => T): Promise<T> {
  try {
    return work();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Settings action failed.';
    throw new Error(message);
  }
}

export async function fetchSettings(): Promise<Record<string, string>> {
  return runAction(() => getSettings(db()));
}

export async function fetchSetting(key: FriendsSettingKey): Promise<string | null> {
  return runAction(() => getSetting(db(), key));
}

export async function updateSetting(
  key: FriendsSettingKey,
  value: string,
): Promise<void> {
  return runAction(() => setSetting(db(), key, value));
}

export async function fetchDataStats(): Promise<DataStats> {
  return runAction(() => getDataStats(db()));
}

export async function exportJSON(): Promise<FriendsExport> {
  return runAction(() => exportAllData(db()));
}

export async function exportTableCSV(table: string): Promise<string> {
  return runAction(() => exportCSV(db(), table));
}

export async function deleteAll(): Promise<void> {
  return runAction(() => deleteAllData(db()));
}
