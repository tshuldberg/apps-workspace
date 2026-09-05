import type { DatabaseAdapter } from '@mylife/db';
import { getHabits } from './crud';
import {
  resolveStack,
  validateNoCircularDependency,
  type StackNode,
} from '../stacking/engine';

export interface CreateHabitLinkInput {
  parentHabitId: string;
  childHabitId: string;
  linkType: 'after' | 'before' | 'with';
  sortOrder?: number;
}

export interface CreateHabitStackInput {
  habitIds: string[];
  linkType?: 'after' | 'before' | 'with';
}

export interface HabitStackRecord {
  id: string;
  anchorHabitId: string;
  habitIds: string[];
  chain: StackNode[];
  linkIds: string[];
}

export interface HabitStackSuggestion {
  id: string;
  title: string;
  description: string;
  habitIds: string[];
  habitNames: string[];
  confidence: number;
}

export interface HabitStackBreakpoint {
  habitId: string;
  completionRate: number;
  dropOff: number;
  activityDays: number;
}

export interface HabitStackAnalytics {
  anchorHabitId: string;
  completionRate: number;
  strongestStepHabitId: string | null;
  totalActivityDays: number;
  chainBreaks: HabitStackBreakpoint[];
}

interface HabitLinkRow {
  id: string;
  parent_habit_id: string;
  child_habit_id: string;
  link_type: string;
  sort_order: number;
  created_at: string;
}

function rowToLink(row: HabitLinkRow) {
  return {
    id: row.id,
    parentHabitId: row.parent_habit_id,
    childHabitId: row.child_habit_id,
    linkType: row.link_type as 'after' | 'before' | 'with',
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function getAllHabitLinks(db: DatabaseAdapter) {
  return db.query<HabitLinkRow>(
    'SELECT * FROM hb_habit_links ORDER BY parent_habit_id ASC, sort_order ASC, created_at ASC',
  ).map(rowToLink);
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function normalizeStackHabitIds(habitIds: string[]) {
  const normalized = unique(habitIds.map((habitId) => habitId.trim()).filter(Boolean));
  if (normalized.length < 2) {
    throw new Error('A habit stack needs at least two habits.');
  }
  return normalized;
}

function getStackRoots(links: ReturnType<typeof getAllHabitLinks>) {
  const parentIds = links.map((link) => link.parentHabitId);
  const childIds = new Set(links.map((link) => link.childHabitId));
  const roots = unique(parentIds.filter((parentId) => !childIds.has(parentId)));
  return roots.length > 0 ? roots : unique(parentIds);
}

function collectStackLinkIds(
  links: ReturnType<typeof getAllHabitLinks>,
  anchorHabitId: string,
) {
  const linkIds = new Set<string>();
  const visitedParents = new Set<string>([anchorHabitId]);

  const visit = (parentHabitId: string) => {
    const outgoing = links.filter((link) => link.parentHabitId === parentHabitId);
    for (const link of outgoing) {
      if (linkIds.has(link.id)) continue;
      linkIds.add(link.id);
      if (visitedParents.has(link.childHabitId)) continue;
      visitedParents.add(link.childHabitId);
      visit(link.childHabitId);
    }
  };

  visit(anchorHabitId);

  return [...linkIds];
}

function getActivityDayCount(
  db: DatabaseAdapter,
  habitId: string,
  sinceDate: string,
) {
  const rows = db.query<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM (
       SELECT DISTINCT DATE(completed_at) as day
       FROM hb_completions
       WHERE habit_id = ? AND DATE(completed_at) >= ?
       UNION
       SELECT DISTINCT DATE(measured_at) as day
       FROM hb_measurements
       WHERE habit_id = ? AND DATE(measured_at) >= ?
       UNION
       SELECT DISTINCT DATE(started_at) as day
       FROM hb_timed_sessions
       WHERE habit_id = ? AND completed = 1 AND DATE(started_at) >= ?
     )`,
    [habitId, sinceDate, habitId, sinceDate, habitId, sinceDate],
  );

  return rows[0]?.total ?? 0;
}

function writeHabitStack(
  db: DatabaseAdapter,
  habitIds: string[],
  linkType: 'after' | 'before' | 'with',
) {
  const existingLinks = getAllHabitLinks(db);
  const graph = existingLinks.map((link) => ({
    parentHabitId: link.parentHabitId,
    childHabitId: link.childHabitId,
  }));

  for (let index = 0; index < habitIds.length - 1; index += 1) {
    const parentHabitId = habitIds[index];
    const childHabitId = habitIds[index + 1];
    if (!validateNoCircularDependency(graph, parentHabitId, childHabitId)) {
      throw new Error('This stack would create a circular dependency.');
    }
    graph.push({ parentHabitId, childHabitId });
  }

  for (let index = 0; index < habitIds.length - 1; index += 1) {
    db.execute(
      `INSERT INTO hb_habit_links (id, parent_habit_id, child_habit_id, link_type, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), habitIds[index], habitIds[index + 1], linkType, 0],
    );
  }
}

export function createHabitLink(db: DatabaseAdapter, input: CreateHabitLinkInput) {
  const id = crypto.randomUUID();
  db.execute(
    `INSERT INTO hb_habit_links (id, parent_habit_id, child_habit_id, link_type, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.parentHabitId, input.childHabitId, input.linkType, input.sortOrder ?? 0],
  );
  return id;
}

export function getLinksForHabit(db: DatabaseAdapter, habitId: string) {
  const rows = db.query<HabitLinkRow>(
    `SELECT * FROM hb_habit_links
     WHERE parent_habit_id = ? OR child_habit_id = ?
     ORDER BY sort_order ASC`,
    [habitId, habitId],
  );
  return rows.map(rowToLink);
}

export function getLinksFromParent(db: DatabaseAdapter, parentHabitId: string) {
  const rows = db.query<HabitLinkRow>(
    'SELECT * FROM hb_habit_links WHERE parent_habit_id = ? ORDER BY sort_order ASC',
    [parentHabitId],
  );
  return rows.map(rowToLink);
}

export function getHabitStacks(db: DatabaseAdapter) {
  const links = getAllHabitLinks(db);
  return getStackRoots(links).map((anchorHabitId) => {
    const chain = resolveStack(links, anchorHabitId).chain;
    return {
      id: anchorHabitId,
      anchorHabitId,
      habitIds: unique(chain.map((node) => node.habitId)),
      chain,
      linkIds: collectStackLinkIds(links, anchorHabitId),
    };
  });
}

export function createHabitStack(db: DatabaseAdapter, input: CreateHabitStackInput) {
  const habitIds = normalizeStackHabitIds(input.habitIds);

  db.transaction(() => {
    writeHabitStack(db, habitIds, input.linkType ?? 'after');
  });

  return habitIds[0];
}

export function updateHabitStack(
  db: DatabaseAdapter,
  anchorHabitId: string,
  input: CreateHabitStackInput,
) {
  const habitIds = normalizeStackHabitIds(input.habitIds);

  db.transaction(() => {
    const links = getAllHabitLinks(db);
    const linkIds = collectStackLinkIds(links, anchorHabitId);
    for (const linkId of linkIds) {
      db.execute('DELETE FROM hb_habit_links WHERE id = ?', [linkId]);
    }
    writeHabitStack(db, habitIds, input.linkType ?? 'after');
  });

  return habitIds[0];
}

export function getStackSuggestions(db: DatabaseAdapter) {
  const habits = getHabits(db, { isArchived: false });
  const linkedHabitIds = new Set(getHabitStacks(db).flatMap((stack) => stack.habitIds));
  const available = habits.filter((habit) => !linkedHabitIds.has(habit.id));
  const suggestions: HabitStackSuggestion[] = [];

  const byTimeOfDay = {
    morning: available.filter((habit) => habit.timeOfDay === 'morning'),
    evening: available.filter((habit) => habit.timeOfDay === 'evening'),
    anytime: available.filter((habit) => habit.timeOfDay === 'anytime'),
  };

  const morning = [...byTimeOfDay.morning, ...byTimeOfDay.anytime].slice(0, 3);
  if (morning.length >= 2) {
    suggestions.push({
      id: 'morning-momentum',
      title: 'Morning Momentum',
      description: 'Turn your first wins of the day into one obvious chain.',
      habitIds: morning.map((habit) => habit.id),
      habitNames: morning.map((habit) => habit.name),
      confidence: 92,
    });
  }

  const evening = [...byTimeOfDay.evening, ...byTimeOfDay.anytime].slice(0, 3);
  if (evening.length >= 2) {
    suggestions.push({
      id: 'night-reset',
      title: 'Before Bed Reset',
      description: 'Use one evening cue to close your day without extra decision-making.',
      habitIds: evening.map((habit) => habit.id),
      habitNames: evening.map((habit) => habit.name),
      confidence: 88,
    });
  }

  const keywordMatches = available.filter((habit) =>
    /(run|workout|walk|stretch|hydrate|water|read|journal|meditat|focus|vitamin)/i.test(habit.name),
  ).slice(0, 3);
  if (keywordMatches.length >= 2) {
    suggestions.push({
      id: 'identity-loop',
      title: 'Identity Loop',
      description: 'These habits already read like a natural cue-response sequence.',
      habitIds: keywordMatches.map((habit) => habit.id),
      habitNames: keywordMatches.map((habit) => habit.name),
      confidence: 81,
    });
  }

  if (suggestions.length === 0 && available.length >= 2) {
    const fallback = available.slice(0, Math.min(3, available.length));
    suggestions.push({
      id: 'fresh-stack',
      title: 'Fresh Stack',
      description: 'Start with two small habits and let the chain earn the right to grow.',
      habitIds: fallback.map((habit) => habit.id),
      habitNames: fallback.map((habit) => habit.name),
      confidence: 74,
    });
  }

  return suggestions.slice(0, 3);
}

export function getStackAnalytics(db: DatabaseAdapter) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceDate = since.toISOString().slice(0, 10);

  return getHabitStacks(db).map((stack) => {
    const activityByHabit = new Map(
      stack.habitIds.map((habitId) => [habitId, getActivityDayCount(db, habitId, sinceDate)]),
    );

    const chainBreaks: HabitStackBreakpoint[] = [];
    for (let index = 1; index < stack.habitIds.length; index += 1) {
      const parentId = stack.habitIds[index - 1];
      const habitId = stack.habitIds[index];
      const parentDays = activityByHabit.get(parentId) ?? 0;
      const activityDays = activityByHabit.get(habitId) ?? 0;

      chainBreaks.push({
        habitId,
        completionRate: parentDays === 0 ? 0 : Math.round((activityDays / parentDays) * 100),
        dropOff: Math.max(parentDays - activityDays, 0),
        activityDays,
      });
    }

    const strongestEntry = [...activityByHabit.entries()]
      .sort((left, right) => right[1] - left[1])[0];

    return {
      anchorHabitId: stack.anchorHabitId,
      completionRate: chainBreaks.length === 0
        ? (activityByHabit.get(stack.anchorHabitId) ?? 0) > 0 ? 100 : 0
        : Math.round(
            chainBreaks.reduce((total, breakpoint) => total + breakpoint.completionRate, 0)
              / chainBreaks.length,
          ),
      strongestStepHabitId: strongestEntry?.[0] ?? null,
      totalActivityDays: [...activityByHabit.values()].reduce((total, value) => total + value, 0),
      chainBreaks,
    };
  });
}

export function deleteHabitLink(db: DatabaseAdapter, id: string) {
  db.execute('DELETE FROM hb_habit_links WHERE id = ?', [id]);
}

export function deleteHabitStack(db: DatabaseAdapter, anchorHabitId: string) {
  const linkIds = collectStackLinkIds(getAllHabitLinks(db), anchorHabitId);
  db.transaction(() => {
    for (const linkId of linkIds) {
      db.execute('DELETE FROM hb_habit_links WHERE id = ?', [linkId]);
    }
  });
}

export function deleteAllLinksForHabit(db: DatabaseAdapter, habitId: string) {
  db.execute(
    'DELETE FROM hb_habit_links WHERE parent_habit_id = ? OR child_habit_id = ?',
    [habitId, habitId],
  );
}
