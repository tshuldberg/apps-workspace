'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  listCircles,
  listPeople,
  listHangouts,
  getCircle,
  createCircle,
  updateCircle,
  deleteCircle,
  getGroupActivity,
  getCompatibilityPairs,
  detectTraditions,
  type CircleRecord,
  type GroupActivitySummary,
  type CompatibilityPair,
  type GroupTradition,
} from '@mylife/friends';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('friends');
  return adapter;
}

// ── List ────────────���───────────────────���─────────────────────────

export interface CircleListItem {
  circle: CircleRecord;
  memberNames: string[];
  lastGroupHangout: string | null;
}

export async function fetchCirclesList(): Promise<CircleListItem[]> {
  try {
    const d = db();
    const circles = listCircles(d);
    const people = listPeople(d, { is_archived: false });
    const hangouts = listHangouts(d, {});

    const pMap = new Map(people.map((p) => [p.id, p.display_name]));
    const hangoutInputs = hangouts.map((h) => ({
      people_ids: h.people_ids ?? [],
      happened_at: h.happened_at,
    }));

    return circles.map((circle) => {
      const activity = getGroupActivity(circle.member_ids, hangoutInputs);
      const memberNames = circle.member_ids
        .map((id) => pMap.get(id) ?? 'Unknown')
        .slice(0, 5);

      return {
        circle,
        memberNames,
        lastGroupHangout: activity.lastGroupHangout,
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load circles.';
    throw new Error(message);
  }
}

// ── Detail ────────────────────────────────────────────────────────

export interface CircleDetailData {
  circle: CircleRecord;
  members: Array<{ id: string; display_name: string }>;
  activity: GroupActivitySummary;
  traditions: GroupTradition[];
  pairs: CompatibilityPair[];
}

export async function fetchCircleDetail(id: string): Promise<CircleDetailData | null> {
  try {
    const d = db();
    const circle = getCircle(d, id);
    if (!circle) return null;

    const allPeople = listPeople(d, { is_archived: false });
    const hangouts = listHangouts(d, {});

    const hangoutInputs = hangouts.map((h) => ({
      people_ids: h.people_ids ?? [],
      happened_at: h.happened_at,
      activity_tags: h.activity_tags ?? [],
    }));

    const activity = getGroupActivity(circle.member_ids, hangoutInputs);

    const memberPeople = allPeople.filter((p) => circle.member_ids.includes(p.id));
    const memberInputs = memberPeople.map((p) => ({ id: p.id, display_name: p.display_name }));

    const memberHangouts = hangoutInputs.filter((h) =>
      h.people_ids.some((pid) => circle.member_ids.includes(pid)),
    );
    const pairs = getCompatibilityPairs(memberHangouts, memberInputs, 5);
    const traditions = detectTraditions(circle.member_ids, hangoutInputs);

    return {
      circle,
      members: memberInputs,
      activity,
      traditions,
      pairs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load circle detail.';
    throw new Error(message);
  }
}

// ── People list for form ──────────────────────────────────────────

export async function fetchPeopleList(): Promise<Array<{ id: string; display_name: string }>> {
  try {
    const d = db();
    const people = listPeople(d, { is_archived: false });
    return people.map((p) => ({ id: p.id, display_name: p.display_name }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load people.';
    throw new Error(message);
  }
}

// ── Mutations ────────────────��────────────────────────────────────

export async function createCircleAction(input: {
  name: string;
  icon?: string;
  color?: string;
  member_ids?: string[];
}): Promise<CircleRecord> {
  try {
    const d = db();
    return createCircle(d, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create circle.';
    throw new Error(message);
  }
}

export async function updateCircleAction(
  id: string,
  updates: { name?: string; icon?: string; color?: string; member_ids?: string[] },
): Promise<void> {
  try {
    const d = db();
    updateCircle(d, id, updates);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update circle.';
    throw new Error(message);
  }
}

export async function deleteCircleAction(id: string): Promise<void> {
  try {
    const d = db();
    deleteCircle(d, id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete circle.';
    throw new Error(message);
  }
}
