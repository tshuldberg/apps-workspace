import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';
import { createEvent, getEvents, getEventById, setEventSaved, softDeleteEvent } from '../crud/events';

describe('manhattan events CRUD', () => {
  it('creates, lists, and reads an event', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createEvent(adapter, {
      title: 'Blue Note Jazz',
      category: 'Music',
      startAt: '2026-07-01T20:00:00',
      venueName: 'Blue Note',
    });
    const all = getEvents(adapter);
    expect(all).toHaveLength(1);
    expect(getEventById(adapter, id)?.title).toBe('Blue Note Jazz');
    close();
  });

  it('marks an event saved and soft-deletes it', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createEvent(adapter, { title: 'Comedy Cellar Late Show' });
    setEventSaved(adapter, id, true);
    expect(getEventById(adapter, id)?.saved).toBe(1);
    softDeleteEvent(adapter, id);
    expect(getEventById(adapter, id)).toBeNull();
    expect(getEvents(adapter)).toHaveLength(0);
    close();
  });
});
