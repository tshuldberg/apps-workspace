import { afterEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  getClassesFoundationChecklist,
  getClassesSetting,
  getClassesSettings,
  getClassesStarterStats,
  saveClassesSettings,
  setClassesSetting,
} from '../db';

describe('MyClasses settings', () => {
  const openDatabases: Array<ReturnType<typeof createModuleTestDatabase>> = [];

  afterEach(() => {
    while (openDatabases.length > 0) {
      openDatabases.pop()?.close();
    }
  });

  function createDb() {
    const db = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
    openDatabases.push(db);
    return db;
  }

  it('stores and reads raw setting rows', () => {
    const db = createDb();

    expect(getClassesSetting(db.adapter, 'activeTermLabel')).toBeNull();

    setClassesSetting(db.adapter, 'activeTermLabel', 'Fall 2026');

    expect(getClassesSetting(db.adapter, 'activeTermLabel')).toBe('Fall 2026');
  });

  it('merges persisted values onto typed defaults', () => {
    const db = createDb();

    const settings = saveClassesSettings(db.adapter, {
      activeTermLabel: 'Spring 2027',
      campusLabel: 'North Hall',
      assignmentReminderOffsets: [60, 1440],
      showWeekends: true,
    });

    expect(settings.activeTermLabel).toBe('Spring 2027');
    expect(settings.campusLabel).toBe('North Hall');
    expect(settings.assignmentReminderOffsets).toEqual([60, 1440]);
    expect(settings.showWeekends).toBe(true);
    expect(settings.gradeScale).toBe('percent');
    expect(getClassesSettings(db.adapter).weekStartsOn).toBe('monday');
  });

  it('round-trips defaults → save → reload without drift (P5_5-A)', () => {
    const db = createDb();

    const initial = getClassesSettings(db.adapter);

    const updated = saveClassesSettings(db.adapter, {
      ...initial,
      activeTermLabel: 'Spring 2027',
      campusLabel: 'North Hall',
      weekStartsOn: 'sunday',
      scheduleDensity: 'compact',
      gradeScale: 'gpa_4',
      defaultStudyMinutes: 60,
      focusBreakMinutes: 5,
      assignmentView: 'today',
      assignmentReminderOffsets: [60, 1440, 4320],
      showWeekends: true,
    });

    const reloaded = getClassesSettings(db.adapter);
    expect(reloaded).toEqual(updated);
    expect(reloaded.weekStartsOn).toBe('sunday');
    expect(reloaded.scheduleDensity).toBe('compact');
    expect(reloaded.gradeScale).toBe('gpa_4');
    expect(reloaded.defaultStudyMinutes).toBe(60);
    expect(reloaded.focusBreakMinutes).toBe(5);
    expect(reloaded.assignmentView).toBe('today');
    expect(reloaded.assignmentReminderOffsets).toEqual([60, 1440, 4320]);
    expect(reloaded.showWeekends).toBe(true);
    expect(reloaded.activeTermLabel).toBe('Spring 2027');
    expect(reloaded.campusLabel).toBe('North Hall');
  });

  it('defaults privacy + biometric keys and round-trips them (P5_5-B)', () => {
    const db = createDb();

    const initial = getClassesSettings(db.adapter);
    expect(initial.requireBiometricLock).toBe(false);
    expect(initial.privacyConsentAcknowledgedAt).toBe('');

    const ack = '2026-04-20T12:00:00.000Z';
    const saved = saveClassesSettings(db.adapter, {
      requireBiometricLock: true,
      privacyConsentAcknowledgedAt: ack,
    });

    expect(saved.requireBiometricLock).toBe(true);
    expect(saved.privacyConsentAcknowledgedAt).toBe(ack);

    const reloaded = getClassesSettings(db.adapter);
    expect(reloaded.requireBiometricLock).toBe(true);
    expect(reloaded.privacyConsentAcknowledgedAt).toBe(ack);

    const cleared = saveClassesSettings(db.adapter, {
      requireBiometricLock: false,
    });
    expect(cleared.requireBiometricLock).toBe(false);
    expect(cleared.privacyConsentAcknowledgedAt).toBe(ack);
  });

  it('builds starter summaries and checklist state from saved preferences', () => {
    const db = createDb();

    saveClassesSettings(db.adapter, {
      activeTermLabel: 'Winter 2028',
      campusLabel: 'Design Lab',
      assignmentReminderOffsets: [4320, 1440],
      defaultStudyMinutes: 60,
    });

    const stats = getClassesStarterStats(db.adapter);
    const checklist = getClassesFoundationChecklist(db.adapter);

    expect(stats.currentTermLabel).toBe('Winter 2028');
    expect(stats.customPreferenceCount).toBe(4);
    expect(stats.reminderSummary).toContain('3 days before');
    expect(stats.dailyFocusLabel).toBe('60 min focus + 10 min break');
    expect(checklist.every((item) => item.ready)).toBe(true);
  });
});
