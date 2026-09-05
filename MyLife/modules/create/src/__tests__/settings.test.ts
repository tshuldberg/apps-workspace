import { afterEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { CREATE_MODULE } from '../definition';
import {
  getCreateSetting,
  getCreateSettings,
  saveCreateSettings,
  setCreateSetting,
} from '../db';

describe('MyCreate settings', () => {
  const openDatabases: Array<ReturnType<typeof createModuleTestDatabase>> = [];

  afterEach(() => {
    while (openDatabases.length > 0) {
      openDatabases.pop()?.close();
    }
  });

  function createDb() {
    const db = createModuleTestDatabase('create', CREATE_MODULE.migrations ?? []);
    openDatabases.push(db);
    return db;
  }

  it('stores and reads raw setting rows', () => {
    const db = createDb();

    expect(getCreateSetting(db.adapter, 'defaultLandingTab')).toBeNull();

    setCreateSetting(db.adapter, 'defaultLandingTab', 'practice');

    expect(getCreateSetting(db.adapter, 'defaultLandingTab')).toBe('practice');
  });

  it('merges persisted values onto typed defaults', () => {
    const db = createDb();

    const settings = saveCreateSettings(db.adapter, {
      defaultLandingTab: 'skills',
      defaultSessionMinutes: 60,
      weeklyPracticeGoalMinutes: 240,
      portfolioVisibility: 'share_link_only',
      captureReflectionPrompts: false,
    });

    expect(settings.defaultLandingTab).toBe('skills');
    expect(settings.defaultSessionMinutes).toBe(60);
    expect(settings.weeklyPracticeGoalMinutes).toBe(240);
    expect(settings.portfolioVisibility).toBe('share_link_only');
    expect(settings.captureReflectionPrompts).toBe(false);
  });

  it('round-trips defaults through save and reload without drift', () => {
    const db = createDb();

    const updated = saveCreateSettings(db.adapter, {
      defaultLandingTab: 'portfolio',
      defaultSessionMinutes: 90,
      weeklyPracticeGoalMinutes: 300,
      portfolioVisibility: 'private',
      captureReflectionPrompts: true,
    });

    expect(getCreateSettings(db.adapter)).toEqual(updated);
  });
});
