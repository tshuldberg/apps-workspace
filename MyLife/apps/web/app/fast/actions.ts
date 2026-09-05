'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  startFast,
  endFast,
  getActiveFast,
  getFast,
  listFasts,
  countFasts,
  deleteFast,
  getProtocols,
  getSetting,
  setSetting,
  getStreaks,
  refreshStreakCache,
  averageDuration,
  adherenceRate,
  weeklyRollup,
  monthlyRollup,
  durationTrend,
  exportFastsCSV,
  exportWeightCSV,
  type ListFastsOptions,
} from '@mylife/fast';

/** Ensure fast module tables exist before any query. */
function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('fast');
  return adapter;
}

export async function fetchActiveFast() {
  return getActiveFast(db());
}

export async function doStartFast(id: string, protocol: string, targetHours: number) {
  return startFast(db(), id, protocol, targetHours);
}

export async function doEndFast(notes?: string) {
  return endFast(db(), undefined, notes);
}

export async function fetchFast(id: string) {
  return getFast(db(), id);
}

export async function fetchFasts(options?: ListFastsOptions) {
  return listFasts(db(), options);
}

export async function fetchFastCount() {
  return countFasts(db());
}

export async function doDeleteFast(id: string) {
  return deleteFast(db(), id);
}

export async function fetchProtocols() {
  return getProtocols(db());
}

export async function fetchSetting(key: string) {
  return getSetting(db(), key);
}

export async function updateSetting(key: string, value: string) {
  return setSetting(db(), key, value);
}

export async function fetchStreaks() {
  return getStreaks(db());
}

export async function doRefreshStreaks() {
  return refreshStreakCache(db());
}

export async function fetchAverageDuration() {
  return averageDuration(db());
}

export async function fetchAdherenceRate() {
  return adherenceRate(db());
}

export async function fetchWeeklyRollup() {
  return weeklyRollup(db());
}

export async function fetchMonthlyRollup(year: number, month: number) {
  return monthlyRollup(db(), year, month);
}

export async function fetchDurationTrend(days?: number) {
  return durationTrend(db(), days);
}

export async function doExportFastsCSV() {
  return exportFastsCSV(db());
}

export async function doExportWeightCSV() {
  return exportWeightCSV(db());
}
