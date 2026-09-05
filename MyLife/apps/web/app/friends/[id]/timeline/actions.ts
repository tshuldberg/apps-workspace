'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  getPerson,
  listHangoutsForPerson,
  listMemoriesForPerson,
  listGiftsForPerson,
  buildPersonTimeline,
  detectMilestones,
  type TimelineEntry,
  type Milestone,
  type PersonRecord,
} from '@mylife/friends';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('friends');
  return adapter;
}

interface LifeEventRow {
  id: string;
  person_id: string;
  type: string;
  description: string | null;
  happened_at: string | null;
}

function fetchLifeEvents(personId: string): LifeEventRow[] {
  try {
    const adapter = db();
    const rows = adapter.query<LifeEventRow>(
      `SELECT * FROM fn_life_events WHERE person_id = ? ORDER BY happened_at DESC`,
      [personId],
    );
    return rows;
  } catch {
    return [];
  }
}

export async function fetchTimelineData(personId: string): Promise<{
  person: PersonRecord | null;
  entries: TimelineEntry[];
}> {
  try {
    const adapter = db();
    const person = getPerson(adapter, personId);
    if (!person) return { person: null, entries: [] };

    const hangouts = listHangoutsForPerson(adapter, personId);
    const memories = listMemoriesForPerson(adapter, personId);
    const gifts = listGiftsForPerson(adapter, personId);
    const lifeEvents = fetchLifeEvents(personId);

    const milestones: Milestone[] = detectMilestones(
      person.display_name,
      person.when_met ?? null,
      hangouts.map((h) => ({ happened_at: h.happened_at, activity_tags: h.activity_tags })),
    );

    const entries = buildPersonTimeline(
      personId,
      hangouts,
      memories,
      gifts,
      lifeEvents,
      milestones,
    );

    return { person, entries };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load timeline.';
    throw new Error(message);
  }
}
