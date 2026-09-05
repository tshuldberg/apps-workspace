import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  getGoalForYear,
  getGoalProgress,
  createGoal,
  updateGoal,
  type ReadingGoal,
  type GoalProgress,
} from '@mylife/books';

export function useGoal(year: number) {
  const db = useDatabase();
  const [goal, setGoal] = useState<ReadingGoal | null>(null);
  const [progress, setProgress] = useState<GoalProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    try {
      setLoading(true);
      setGoal(getGoalForYear(db, year));
      setProgress(getGoalProgress(db, year));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [db, year]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    (targetBooks: number, targetPages?: number | null) => {
      if (goal) {
        updateGoal(db, goal.id, {
          target_books: targetBooks,
          target_pages: targetPages ?? undefined,
        });
      } else {
        const id = uuid();
        createGoal(db, id, {
          year,
          target_books: targetBooks,
          target_pages: targetPages ?? undefined,
        });
      }
      refresh();
    },
    [db, goal, year, refresh],
  );

  return { goal, progress, loading, error, refresh, save };
}
