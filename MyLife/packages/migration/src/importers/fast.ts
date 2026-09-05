import type { DatabaseAdapter } from '@mylife/db';

export interface FastImportResult {
  fastsImported: number;
  protocolsImported: number;
  weightEntriesImported: number;
  goalsImported: number;
  goalProgressImported: number;
  settingsImported: number;
  waterIntakeImported: number;
  notificationsConfigImported: number;
  errors: string[];
  warnings: string[];
}

/**
 * Import data from a standalone MyFast SQLite database into the hub database.
 * Reads from unprefixed tables in sourceDb, writes to ft_-prefixed tables in hubDb.
 *
 * Table mapping (standalone -> hub):
 *   fasts            -> ft_fasts
 *   weight_entries   -> ft_weight_entries
 *   protocols        -> ft_protocols
 *   streak_cache     -> ft_streak_cache
 *   active_fast      -> ft_active_fast
 *   settings         -> ft_settings
 *   water_intake     -> ft_water_intake
 *   goals            -> ft_goals
 *   goal_progress    -> ft_goal_progress
 *   notifications_config -> ft_notifications_config
 */
export function importFromMyFast(
  sourceDb: DatabaseAdapter,
  hubDb: DatabaseAdapter,
): FastImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let fastsImported = 0;
  let protocolsImported = 0;
  let weightEntriesImported = 0;
  let goalsImported = 0;
  let goalProgressImported = 0;
  let settingsImported = 0;
  let waterIntakeImported = 0;
  let notificationsConfigImported = 0;

  hubDb.transaction(() => {
    // 1. Import protocols (before fasts, since fasts reference protocol names)
    try {
      const protocols = sourceDb.query<Record<string, unknown>>('SELECT * FROM protocols');
      for (const p of protocols) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO ft_protocols (id, name, fasting_hours, eating_hours, description, is_custom, is_default, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.id, p.name, p.fasting_hours, p.eating_hours, p.description, p.is_custom, p.is_default, p.sort_order],
          );
          protocolsImported++;
        } catch (e) {
          errors.push(`Protocol ${p.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist in older versions
    }

    // 2. Import fasts
    const fasts = sourceDb.query<Record<string, unknown>>('SELECT * FROM fasts');
    for (const f of fasts) {
      try {
        hubDb.execute(
          `INSERT OR IGNORE INTO ft_fasts (id, protocol, target_hours, started_at, ended_at, duration_seconds, hit_target, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [f.id, f.protocol, f.target_hours, f.started_at, f.ended_at, f.duration_seconds, f.hit_target, f.notes, f.created_at],
        );
        fastsImported++;
      } catch (e) {
        errors.push(`Fast ${f.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 3. Import weight entries
    try {
      const weights = sourceDb.query<Record<string, unknown>>('SELECT * FROM weight_entries');
      for (const w of weights) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO ft_weight_entries (id, weight_value, unit, date, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [w.id, w.weight_value, w.unit, w.date, w.notes, w.created_at],
          );
          weightEntriesImported++;
        } catch (e) {
          errors.push(`WeightEntry ${w.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 4. Import streak cache
    try {
      const streaks = sourceDb.query<Record<string, unknown>>('SELECT * FROM streak_cache');
      for (const s of streaks) {
        try {
          hubDb.execute(
            'INSERT OR IGNORE INTO ft_streak_cache (key, value, updated_at) VALUES (?, ?, ?)',
            [s.key, s.value, s.updated_at],
          );
        } catch (e) {
          errors.push(`StreakCache ${s.key}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 5. Import active fast (singleton -- at most one row)
    try {
      const activeFasts = sourceDb.query<Record<string, unknown>>('SELECT * FROM active_fast');
      for (const af of activeFasts) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO ft_active_fast (id, fast_id, protocol, target_hours, started_at)
             VALUES (?, ?, ?, ?, ?)`,
            [af.id, af.fast_id, af.protocol, af.target_hours, af.started_at],
          );
        } catch (e) {
          errors.push(`ActiveFast: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 6. Import settings
    try {
      const settings = sourceDb.query<Record<string, unknown>>('SELECT * FROM settings');
      for (const s of settings) {
        try {
          hubDb.execute(
            'INSERT OR IGNORE INTO ft_settings (key, value) VALUES (?, ?)',
            [s.key, s.value],
          );
          settingsImported++;
        } catch (e) {
          errors.push(`Setting ${s.key}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 7. Import water intake
    try {
      const waterEntries = sourceDb.query<Record<string, unknown>>('SELECT * FROM water_intake');
      for (const w of waterEntries) {
        try {
          hubDb.execute(
            'INSERT OR IGNORE INTO ft_water_intake (date, count, target, updated_at) VALUES (?, ?, ?, ?)',
            [w.date, w.count, w.target, w.updated_at],
          );
          waterIntakeImported++;
        } catch (e) {
          errors.push(`WaterIntake ${w.date}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 8. Import goals
    try {
      const goals = sourceDb.query<Record<string, unknown>>('SELECT * FROM goals');
      for (const g of goals) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO ft_goals (id, type, target_value, period, direction, label, unit, start_date, end_date, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [g.id, g.type, g.target_value, g.period, g.direction, g.label, g.unit, g.start_date, g.end_date, g.is_active, g.created_at],
          );
          goalsImported++;
        } catch (e) {
          errors.push(`Goal ${g.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 9. Import goal progress
    try {
      const progress = sourceDb.query<Record<string, unknown>>('SELECT * FROM goal_progress');
      for (const p of progress) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO ft_goal_progress (id, goal_id, period_start, period_end, current_value, target_value, completed, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.id, p.goal_id, p.period_start, p.period_end, p.current_value, p.target_value, p.completed, p.created_at],
          );
          goalProgressImported++;
        } catch (e) {
          errors.push(`GoalProgress ${p.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 10. Import notifications config
    try {
      const notifConfig = sourceDb.query<Record<string, unknown>>('SELECT * FROM notifications_config');
      for (const n of notifConfig) {
        try {
          hubDb.execute(
            'INSERT OR IGNORE INTO ft_notifications_config (key, enabled) VALUES (?, ?)',
            [n.key, n.enabled],
          );
          notificationsConfigImported++;
        } catch (e) {
          errors.push(`NotificationsConfig ${n.key}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // Rebuild streak cache after import
    if (fastsImported > 0) {
      try {
        // Calculate current streak from imported fasts
        const completedFasts = hubDb.query<Record<string, unknown>>(
          `SELECT DISTINCT date(started_at) as fast_date
           FROM ft_fasts
           WHERE hit_target = 1
           ORDER BY fast_date DESC`,
        );

        let currentStreak = 0;
        if (completedFasts.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let checkDate = today;

          for (const f of completedFasts) {
            const fastDate = new Date(f.fast_date as string);
            fastDate.setHours(0, 0, 0, 0);
            const diffDays = Math.round(
              (checkDate.getTime() - fastDate.getTime()) / (1000 * 60 * 60 * 24),
            );

            if (diffDays <= 1) {
              currentStreak++;
              checkDate = fastDate;
            } else {
              break;
            }
          }
        }

        hubDb.execute(
          `INSERT OR REPLACE INTO ft_streak_cache (key, value, updated_at)
           VALUES ('currentStreak', ?, datetime('now'))`,
          [currentStreak],
        );
        hubDb.execute(
          `INSERT OR REPLACE INTO ft_streak_cache (key, value, updated_at)
           VALUES ('totalCompleted', ?, datetime('now'))`,
          [fastsImported],
        );
      } catch (e) {
        warnings.push(`Streak cache rebuild failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  });

  return {
    fastsImported,
    protocolsImported,
    weightEntriesImported,
    goalsImported,
    goalProgressImported,
    settingsImported,
    waterIntakeImported,
    notificationsConfigImported,
    errors,
    warnings,
  };
}
