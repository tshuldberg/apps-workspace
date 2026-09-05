'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  listPeople,
  listHangouts,
  getTimeDistribution,
  getInnerCircle,
  getTimeVsQualityQuadrant,
  getEnergyCorrelation,
  type PersonTimeShare,
  type QualityCorrelation,
  type TimeQualityQuadrant,
  type EnergyBreakdown,
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
      error instanceof Error ? error.message : 'Quality insights action failed.';
    throw new Error(message);
  }
}

// ── Exported types ──────────────────────────────────────────────────

export interface QuadrantEntry {
  personId: string;
  personName: string;
  quadrant: TimeQualityQuadrant;
}

export interface QualityInsightsData {
  timeDistribution: PersonTimeShare[];
  innerCircle: QualityCorrelation[];
  quadrants: QuadrantEntry[];
  energyBreakdown: EnergyBreakdown[];
}

// ── Fetch quality insights data ─────────────────────────────────────

export async function fetchQualityInsights(): Promise<QualityInsightsData> {
  return runAction(() => {
    const d = db();
    const people = listPeople(d, { is_archived: false });
    const hangouts = listHangouts(d, {});

    const hangoutData = hangouts.map((h) => ({
      people_ids: h.people_ids,
      duration_minutes: h.duration_minutes,
      quality_rating: h.quality_rating,
    }));

    const peopleData = people.map((p) => ({
      id: p.id,
      display_name: p.display_name,
    }));

    const peopleWithEnergy = people.map((p) => ({
      id: p.id,
      display_name: p.display_name,
      energy_tag: p.energy_tag,
    }));

    // Time distribution (top 10)
    const allStats = getTimeDistribution(hangoutData, peopleData);
    const timeDistribution = allStats.slice(0, 10);

    // Inner circle
    const innerCircle = getInnerCircle(hangoutData, peopleData, 5);

    // Quadrants
    const quadrants: QuadrantEntry[] = peopleData
      .map((p) => ({
        personId: p.id,
        personName: p.display_name,
        quadrant: getTimeVsQualityQuadrant(p.id, hangoutData, allStats),
      }))
      .filter((q) => allStats.some((s) => s.personId === q.personId));

    // Energy correlation
    const energyBreakdown = getEnergyCorrelation(hangoutData, peopleWithEnergy);

    return { timeDistribution, innerCircle, quadrants, energyBreakdown };
  });
}
