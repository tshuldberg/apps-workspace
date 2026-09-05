import { describe, expect, it } from 'vitest';
import { MODULE_IDS } from '../constants';
import {
  GA_MODULE_IDS,
  HIDDEN_MODULE_IDS,
  MERGED_MODULE_IDS,
  MODULE_RELEASE_STATES,
  PUBLIC_BETA_MODULE_IDS,
  USER_VISIBLE_MODULE_IDS,
  getModuleReleaseDescription,
  getModuleReleaseLabel,
  isGeneralAvailabilityModule,
  isHiddenModule,
  isPublicBetaModule,
  isUserVisibleModule,
} from '../release-states';

describe('module release states', () => {
  it('covers every registered module exactly once', () => {
    const allReleaseIds = new Set([
      ...GA_MODULE_IDS,
      ...PUBLIC_BETA_MODULE_IDS,
      ...HIDDEN_MODULE_IDS,
      ...MERGED_MODULE_IDS,
    ]);

    expect(allReleaseIds.size).toBe(MODULE_IDS.length);

    for (const moduleId of MODULE_IDS) {
      expect(allReleaseIds.has(moduleId)).toBe(true);
      expect(MODULE_RELEASE_STATES[moduleId]).toBeDefined();
    }
  });

  it('matches the agreed launch counts', () => {
    expect(GA_MODULE_IDS).toHaveLength(5);
    expect(PUBLIC_BETA_MODULE_IDS).toHaveLength(13);
    expect(HIDDEN_MODULE_IDS).toHaveLength(23);
    expect(MERGED_MODULE_IDS).toHaveLength(0);
    expect(USER_VISIBLE_MODULE_IDS).toHaveLength(18);
  });

  it('returns stable release helpers for each tier', () => {
    expect(isGeneralAvailabilityModule('budget')).toBe(true);
    expect(isPublicBetaModule('workouts')).toBe(true);
    expect(isPublicBetaModule('garden')).toBe(true);
    expect(isPublicBetaModule('books')).toBe(true);
    expect(isPublicBetaModule('classes')).toBe(true);
    expect(isHiddenModule('rsvp')).toBe(true);
    expect(isHiddenModule('surf')).toBe(true);
    expect(isHiddenModule('mail')).toBe(true);
    expect(isHiddenModule('subs')).toBe(true);
    expect(isHiddenModule('fast')).toBe(true);
    expect(isHiddenModule('flash')).toBe(true);
    expect(isHiddenModule('friends')).toBe(true);
    expect(isHiddenModule('homes')).toBe(true);
    expect(isHiddenModule('journal')).toBe(true);
    expect(isHiddenModule('notes')).toBe(true);
    expect(isHiddenModule('create')).toBe(true);
    expect(isHiddenModule('payments')).toBe(true);
    expect(isHiddenModule('sleep')).toBe(true);
    expect(isHiddenModule('sports')).toBe(true);
    expect(isHiddenModule('voice')).toBe(true);
    expect(isHiddenModule('words')).toBe(true);
    expect(isUserVisibleModule('subs')).toBe(false);
    expect(isUserVisibleModule('books')).toBe(true);
    expect(isUserVisibleModule('fast')).toBe(false);
    expect(isUserVisibleModule('words')).toBe(false);
    expect(isUserVisibleModule('garden')).toBe(true);
    expect(isUserVisibleModule('budget')).toBe(true);
  });

  it('formats launch labels and descriptions', () => {
    expect(getModuleReleaseLabel('budget')).toBe('GA');
    expect(getModuleReleaseLabel('workouts')).toBe('BETA');
    expect(getModuleReleaseLabel('mail')).toBe('HIDDEN');
    expect(getModuleReleaseDescription('budget')).toContain('production launch promise');
    expect(getModuleReleaseDescription('workouts')).toContain('public beta');
    expect(getModuleReleaseDescription('mail')).toContain('Not yet available');
  });
});
