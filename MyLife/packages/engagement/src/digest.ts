/**
 * Weekly Digest engine.
 *
 * Aggregates getActivityFeed() from all enabled modules for the past
 * 7 days and formats a human-readable summary.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleDefinition } from '@mylife/module-registry';
import type { ActivityItem } from '@mylife/module-registry';
import type { WeeklyDigest, DigestModuleEntry } from './types';

/**
 * Generate a weekly digest for the given period.
 *
 * @param db - Database adapter
 * @param modules - All enabled modules
 * @param periodEnd - End date (YYYY-MM-DD), defaults to today
 * @param periodDays - Number of days to look back, defaults to 7
 */
export function generateWeeklyDigest(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
  periodEnd: string,
  periodDays = 7,
): WeeklyDigest {
  const startDate = new Date(`${periodEnd}T00:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - (periodDays - 1));
  const periodStart = startDate.toISOString().slice(0, 10);

  // Collect activities from all modules
  const allActivities: (ActivityItem & { moduleName: string })[] = [];

  for (const mod of modules) {
    if (!mod.crossModule?.getActivityFeed) continue;
    try {
      const feed = mod.crossModule.getActivityFeed(db, startDate);
      // Filter to only items within the period
      for (const item of feed) {
        const itemDate = item.timestamp.slice(0, 10);
        if (itemDate >= periodStart && itemDate <= periodEnd) {
          allActivities.push({ ...item, moduleName: mod.name });
        }
      }
    } catch {
      // Skip failing modules
    }
  }

  // Group by module
  const byModule = new Map<string, { name: string; items: ActivityItem[] }>();
  for (const activity of allActivities) {
    const existing = byModule.get(activity.moduleId);
    if (existing) {
      existing.items.push(activity);
    } else {
      byModule.set(activity.moduleId, {
        name: activity.moduleName,
        items: [activity],
      });
    }
  }

  // Build module entries
  const moduleEntries: DigestModuleEntry[] = [];
  byModule.forEach((data, moduleId) => {
    moduleEntries.push({
      moduleId,
      moduleName: data.name,
      summary: formatModuleSummary(data.name, data.items),
      activityCount: data.items.length,
    });
  });

  // Sort by activity count descending
  moduleEntries.sort((a, b) => b.activityCount - a.activityCount);

  const totalActivities = allActivities.length;
  const formattedSummary = formatDigestSummary(moduleEntries, totalActivities);

  return {
    periodStart,
    periodEnd,
    modules: moduleEntries,
    formattedSummary,
    totalActivities,
  };
}

/**
 * Format a single module's activity into a summary line.
 */
function formatModuleSummary(moduleName: string, items: ActivityItem[]): string {
  // Group by action type for a richer summary
  const actionCounts = new Map<string, number>();
  for (const item of items) {
    actionCounts.set(item.action, (actionCounts.get(item.action) ?? 0) + 1);
  }

  const parts: string[] = [];
  actionCounts.forEach((count, action) => {
    parts.push(`${count} ${action}`);
  });

  return `${moduleName}: ${parts.join(', ')}`;
}

/**
 * Format the overall digest into a single human-readable summary.
 *
 * Example: "Your week: 3 workouts, finished a book, 12 meals logged, $234 under budget"
 */
function formatDigestSummary(
  entries: DigestModuleEntry[],
  totalActivities: number,
): string {
  if (entries.length === 0) {
    return 'Your week: No activity recorded. Enable some modules and start tracking!';
  }

  const highlights = entries.slice(0, 4).map((e) => e.summary);
  const summary = `Your week: ${highlights.join('; ')}`;

  if (entries.length > 4) {
    return `${summary} (+${entries.length - 4} more modules, ${totalActivities} total activities)`;
  }

  return summary;
}
