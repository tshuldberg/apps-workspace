'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  listPeople,
  listActiveNudges,
  dismissNudge,
  snoozeNudge,
  actOnNudge,
  listHangoutsForPerson,
  getLastHangoutDate,
  calculateDaysSinceLastSeen,
  getFrequencyStatus,
  getFrequencyColor,
  generateLastSeenLabel,
  getNudgeUrgency,
  detectDrift,
  type PersonRecord,
  type NudgeRecord,
  type DriftInfo,
  type FrequencyStatus,
  type NudgeUrgency,
} from '@mylife/friends';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('friends');
  return adapter;
}

async function runAction<T>(work: () => T): Promise<T> {
  try {
    return work();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Health action failed.';
    throw new Error(message);
  }
}

// ── Enriched types returned to the client ──────────────────────────

export interface NudgeWithPerson {
  id: string;
  person_id: string;
  personName: string;
  type: NudgeRecord['type'];
  urgency: NudgeUrgency;
  daysSince: number | null;
  message: string;
  triggered_at: string;
}

export interface FrequencyBar {
  personId: string;
  personName: string;
  daysSince: number | null;
  goalDays: number;
  status: FrequencyStatus;
  color: string;
  label: string;
}

export interface HealthData {
  nudges: NudgeWithPerson[];
  frequencyBars: FrequencyBar[];
  drifts: DriftInfo[];
}

// ── Fetch all health data in one call ──────────────────────────────

export async function fetchHealthData(): Promise<HealthData> {
  return runAction(() => {
    const d = db();
    const people = listPeople(d, { is_archived: false });
    const personMap = new Map<string, PersonRecord>(people.map((p) => [p.id, p]));

    // Active nudges
    const rawNudges = listActiveNudges(d);
    const nudges: NudgeWithPerson[] = rawNudges
      .map((n) => {
        const person = personMap.get(n.person_id);
        if (!person) return null;
        const lastDate = getLastHangoutDate(d, person.id);
        const daysSince = calculateDaysSinceLastSeen(lastDate);
        const goalDays = person.frequency_goal_days ?? 30;
        const urgency: NudgeUrgency =
          daysSince !== null ? getNudgeUrgency(daysSince, goalDays) : 'medium';
        const label = generateLastSeenLabel(daysSince);
        return {
          id: n.id,
          person_id: n.person_id,
          personName: person.display_name,
          type: n.type,
          urgency,
          daysSince,
          message:
            daysSince !== null
              ? `Haven't seen ${person.display_name} in a while. ${label}.`
              : `You haven't hung out with ${person.display_name} yet.`,
          triggered_at: n.triggered_at,
        };
      })
      .filter((n): n is NudgeWithPerson => n !== null);

    // Frequency bars
    const frequencyBars: FrequencyBar[] = [];
    for (const person of people) {
      if (person.frequency_goal_days === null) continue;
      const lastDate = getLastHangoutDate(d, person.id);
      const daysSince = calculateDaysSinceLastSeen(lastDate);
      const status = getFrequencyStatus(daysSince, person.frequency_goal_days);
      frequencyBars.push({
        personId: person.id,
        personName: person.display_name,
        daysSince,
        goalDays: person.frequency_goal_days,
        status,
        color: getFrequencyColor(status),
        label: generateLastSeenLabel(daysSince),
      });
    }
    const statusOrder: Record<FrequencyStatus, number> = {
      overdue: 0,
      approaching: 1,
      'on-track': 2,
      'no-goal': 3,
    };
    frequencyBars.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    // Drift detection
    const drifts: DriftInfo[] = [];
    for (const person of people) {
      const hangouts = listHangoutsForPerson(d, person.id);
      const dates = hangouts.map((h) => h.happened_at);
      const drift = detectDrift(person.display_name, person.id, dates);
      if (drift) drifts.push(drift);
    }
    drifts.sort((a, b) => b.driftRatio - a.driftRatio);

    return { nudges, frequencyBars, drifts };
  });
}

// ── Nudge actions ──────────────────────────────────────────────────

export async function dismissHealthNudge(nudgeId: string): Promise<void> {
  return runAction(() => dismissNudge(db(), nudgeId));
}

export async function snoozeHealthNudge(nudgeId: string): Promise<void> {
  return runAction(() => {
    const until = new Date();
    until.setDate(until.getDate() + 7);
    snoozeNudge(db(), nudgeId, until.toISOString());
  });
}

export async function actOnHealthNudge(nudgeId: string): Promise<void> {
  return runAction(() => actOnNudge(db(), nudgeId));
}
