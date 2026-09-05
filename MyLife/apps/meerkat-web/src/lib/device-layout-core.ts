// Device-local presentation preferences. mk_settings is never replicated.
import type { DatabaseAdapter } from '@mylife/db';
import type { MkLayoutDocument } from '@mylife/meerkat-layout';
import { buildExperienceLayout, findOnboardingExperience, type ExperienceId } from './onboarding-experience-core';

export type LayoutDeviceClass = 'desktop' | 'mobile';
export type DeviceLayoutChoice = ExperienceId | 'community';
const PROFILE_KEY = 'layout_device_class';
const keyFor = (profile: LayoutDeviceClass) => `layout_default:${profile}`;
let revision = 0;
const listeners = new Set<() => void>();
export const deviceLayoutRevision = () => revision;
export function subscribeDeviceLayout(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function notify(): void { revision += 1; for (const listener of listeners) listener(); }
function read(db: DatabaseAdapter, key: string): string | null {
  return db.query<{ value: string | null }>('SELECT value FROM mk_settings WHERE key = ?', [key])[0]?.value ?? null;
}
function write(db: DatabaseAdapter, key: string, value: string): void {
  db.execute('INSERT OR REPLACE INTO mk_settings (key, value) VALUES (?, ?)', [key, value]);
  notify();
}
function assertProfile(profile: string): asserts profile is LayoutDeviceClass {
  if (profile !== 'desktop' && profile !== 'mobile') throw new Error('Choose desktop or mobile.');
}
export function getLayoutDeviceClass(db: DatabaseAdapter, fallback: LayoutDeviceClass): LayoutDeviceClass {
  const stored = read(db, PROFILE_KEY);
  return stored === 'desktop' || stored === 'mobile' ? stored : fallback;
}
export function setLayoutDeviceClass(db: DatabaseAdapter, profile: LayoutDeviceClass): void {
  assertProfile(profile);
  write(db, PROFILE_KEY, profile);
}
export function getDeviceLayoutDefault(db: DatabaseAdapter, profile: LayoutDeviceClass): DeviceLayoutChoice {
  const stored = read(db, keyFor(profile));
  return stored && findOnboardingExperience(stored) ? stored as ExperienceId : 'community';
}
export function setDeviceLayoutDefault(db: DatabaseAdapter, profile: LayoutDeviceClass, choice: DeviceLayoutChoice): void {
  assertProfile(profile);
  if (choice !== 'community' && !findOnboardingExperience(choice)) throw new Error('Choose a known layout.');
  write(db, keyFor(profile), choice);
}
/** Explicit local home override. null means use the verified community layout. */
export function deviceHomeLayout(db: DatabaseAdapter, fallback: LayoutDeviceClass, name: string, channelId?: string, ownerCapabilities: readonly string[] = []): MkLayoutDocument | null {
  const choice = getDeviceLayoutDefault(db, getLayoutDeviceClass(db, fallback));
  if (choice === 'community') return null;
  const document = buildExperienceLayout(choice, name, channelId);
  // A local view may rearrange content, but cannot enable an owner capability.
  return { ...document, capabilities: document.capabilities.filter((key) => ownerCapabilities.includes(key)) };
}
