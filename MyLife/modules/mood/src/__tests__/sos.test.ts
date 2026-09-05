import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { MOOD_MODULE } from '../definition';
import {
  createSosSession,
  completeSosSession,
  getSosSession,
  getSosSessions,
  createEmergencyContact,
  getEmergencyContacts,
  deleteEmergencyContact,
} from '../db/sos';
import {
  getSosFlow,
  getRandomAffirmation,
  computeSosDuration,
  getSosStepCount,
  GROUNDING_SENSES,
  DEFAULT_AFFIRMATIONS,
} from '../engine/sos';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('mood', MOOD_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('SOS Engine', () => {
  describe('getSosFlow', () => {
    it('returns 4 steps in correct order', () => {
      const flow = getSosFlow('box');
      expect(flow).toHaveLength(4);
      expect(flow[0].type).toBe('breathing');
      expect(flow[1].type).toBe('grounding');
      expect(flow[2].type).toBe('affirmation');
      expect(flow[3].type).toBe('exit');
    });

    it('uses the specified breathing pattern name', () => {
      const flow = getSosFlow('478');
      expect(flow[0].instruction).toContain('4-7-8');
    });

    it('defaults to box breathing', () => {
      const flow = getSosFlow();
      expect(flow[0].instruction).toContain('Box Breathing');
    });
  });

  describe('computeSosDuration', () => {
    it('sums all step durations', () => {
      const flow = getSosFlow('box');
      const duration = computeSosDuration(flow);
      expect(duration).toBe(240);
    });
  });

  describe('getSosStepCount', () => {
    it('returns 4', () => {
      expect(getSosStepCount()).toBe(4);
    });
  });

  describe('GROUNDING_SENSES', () => {
    it('has 5 senses in 5-4-3-2-1 order', () => {
      expect(GROUNDING_SENSES).toHaveLength(5);
      expect(GROUNDING_SENSES[0].count).toBe(5);
      expect(GROUNDING_SENSES[1].count).toBe(4);
      expect(GROUNDING_SENSES[2].count).toBe(3);
      expect(GROUNDING_SENSES[3].count).toBe(2);
      expect(GROUNDING_SENSES[4].count).toBe(1);
    });
  });

  describe('DEFAULT_AFFIRMATIONS', () => {
    it('has at least 15 affirmations', () => {
      expect(DEFAULT_AFFIRMATIONS.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('getRandomAffirmation', () => {
    it('returns a string from the affirmations list', () => {
      const affirmation = getRandomAffirmation();
      expect(DEFAULT_AFFIRMATIONS).toContain(affirmation);
    });
  });
});

describe('SOS CRUD', () => {
  it('creates an SOS session', () => {
    const session = createSosSession(testDb.adapter, 'sos-1', {
      triggerMoodScore: 2,
      breathingPattern: 'box',
    });
    expect(session.id).toBe('sos-1');
    expect(session.triggerMoodScore).toBe(2);
    expect(session.stepsCompleted).toBe(0);
    expect(session.completedAt).toBeNull();
  });

  it('completes an SOS session', () => {
    createSosSession(testDb.adapter, 'sos-1', { triggerMoodScore: 2 });
    completeSosSession(testDb.adapter, 'sos-1', {
      stepsCompleted: 4,
      totalDurationSeconds: 240,
      exitMoodScore: 5,
      groundingCompleted: true,
    });
    const session = getSosSession(testDb.adapter, 'sos-1');
    expect(session).not.toBeNull();
    expect(session!.stepsCompleted).toBe(4);
    expect(session!.exitMoodScore).toBe(5);
    expect(session!.groundingCompleted).toBe(true);
    expect(session!.completedAt).not.toBeNull();
  });

  it('retrieves session by id', () => {
    createSosSession(testDb.adapter, 'sos-1', { triggerMoodScore: 3 });
    const found = getSosSession(testDb.adapter, 'sos-1');
    expect(found).not.toBeNull();
    expect(found!.triggerMoodScore).toBe(3);
  });

  it('returns null for missing session', () => {
    expect(getSosSession(testDb.adapter, 'missing')).toBeNull();
  });

  it('lists sessions in descending order', () => {
    createSosSession(testDb.adapter, 'sos-1', { triggerMoodScore: 2 });
    createSosSession(testDb.adapter, 'sos-2', { triggerMoodScore: 3 });
    const sessions = getSosSessions(testDb.adapter);
    expect(sessions).toHaveLength(2);
  });

  it('creates and lists emergency contacts', () => {
    createEmergencyContact(testDb.adapter, 'c1', { name: 'Mom', phone: '555-1234', relationship: 'parent' });
    createEmergencyContact(testDb.adapter, 'c2', { name: 'Therapist', phone: '555-5678' });
    const contacts = getEmergencyContacts(testDb.adapter);
    expect(contacts).toHaveLength(2);
    expect(contacts[0].name).toBe('Mom');
  });

  it('deletes emergency contact', () => {
    createEmergencyContact(testDb.adapter, 'c1', { name: 'Test', phone: '555-0000' });
    deleteEmergencyContact(testDb.adapter, 'c1');
    expect(getEmergencyContacts(testDb.adapter)).toHaveLength(0);
  });
});
