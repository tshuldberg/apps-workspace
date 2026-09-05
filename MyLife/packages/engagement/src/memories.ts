/**
 * "This Day Last Year" memory card engine.
 *
 * Queries getActivityFeed() with a date from the past (default: 365
 * days ago) to surface cross-module memory cards.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleDefinition } from '@mylife/module-registry';
import type { MemoryCard, MemoryModuleEntry } from './types';

/**
 * Generate a memory card for a historical date.
 *
 * @param db - Database adapter
 * @param modules - All enabled modules
 * @param today - Today's date (YYYY-MM-DD)
 * @param yearsAgo - How many years back to look (default 1)
 */
export function getMemoryCard(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
  today: string,
  yearsAgo = 1,
): MemoryCard {
  const historicalDate = getDateYearsAgo(today, yearsAgo);
  const dayStart = new Date(`${historicalDate}T00:00:00.000Z`);

  const moduleEntries: MemoryModuleEntry[] = [];

  for (const mod of modules) {
    if (!mod.crossModule?.getActivityFeed) continue;
    try {
      const feed = mod.crossModule.getActivityFeed(db, dayStart);
      // Filter to only items on the exact historical date
      const dayItems = feed.filter((item) => {
        return item.timestamp.slice(0, 10) === historicalDate;
      });

      if (dayItems.length > 0) {
        moduleEntries.push({
          moduleId: mod.id,
          moduleName: mod.name,
          activities: dayItems.map((item) => item.description),
        });
      }
    } catch {
      // Skip failing modules
    }
  }

  return {
    date: historicalDate,
    yearsAgo,
    modules: moduleEntries,
    hasMemories: moduleEntries.length > 0,
  };
}

/**
 * Get memory cards for multiple years back (e.g., 1, 2, 3 years ago).
 * Returns only cards that have memories.
 */
export function getAvailableMemories(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
  today: string,
  maxYearsBack = 5,
): MemoryCard[] {
  const cards: MemoryCard[] = [];

  for (let y = 1; y <= maxYearsBack; y++) {
    const card = getMemoryCard(db, modules, today, y);
    if (card.hasMemories) {
      cards.push(card);
    }
  }

  return cards;
}

/**
 * Get the date N years ago from a given date string.
 * Handles leap year: Feb 29 becomes Feb 28 in non-leap years.
 */
export function getDateYearsAgo(date: string, years: number): string {
  const [yearStr, month, day] = date.split('-');
  const targetYear = parseInt(yearStr, 10) - years;

  // Handle leap year edge case: Feb 29 -> Feb 28
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);

  if (monthNum === 2 && dayNum === 29 && !isLeapYear(targetYear)) {
    return `${targetYear}-02-28`;
  }

  return `${targetYear}-${month}-${day}`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
