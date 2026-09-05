import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  SLEEP_STREAK_TYPES,
  buildWeeklyGoalDots,
  checkGoalProgress,
  compactStreakHistory,
  formatGoalProgress,
  formatGoalTarget,
  formatGoalTypeLabel,
  formatStreakTypeLabel,
  generateAccountabilityMessage,
  getActiveGoals,
  getDefaultGoalTarget,
  getSleepWeekStart,
  getStreakHistory,
  getStreaks,
  getWeeklySummary,
  isNewLongestStreak,
  listEntries,
  type SleepGoal,
  type SleepGoalProgress,
  type SleepGoalType,
  type SleepStreak,
  type SleepStreakHistoryPoint,
} from '@mylife/sleep';
import { getAdapter } from '@/lib/db';
import { readSleepTargetHours } from '../presentation';
import {
  createSleepGoalAction,
  deactivateSleepGoalAction,
  updateSleepGoalAction,
} from '../actions';

const GOAL_TYPES: SleepGoalType[] = [
  'duration',
  'bedtime',
  'wake_time',
  'consistency',
];

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getLatestEntryDate(entries: readonly { date: string }[]): string {
  return entries.reduce(
    (latest, entry) => (entry.date > latest ? entry.date : latest),
    todayDate(),
  );
}

function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export default function SleepGoalsPage() {
  const adapter = getAdapter();
  const entries = listEntries(adapter, { limit: 500 });
  const goals = getActiveGoals(adapter);
  const streaks = getStreaks(adapter);
  const targetHours = readSleepTargetHours(adapter);
  const weekStart = getSleepWeekStart(getLatestEntryDate(entries));
  const summary = getWeeklySummary(entries, goals, weekStart, streaks);
  const weekDots = buildWeeklyGoalDots(entries, goals, weekStart);
  const progress = goals.reduce<Record<string, SleepGoalProgress>>(
    (acc, goal) => {
      const goalProgress = checkGoalProgress(adapter, goal.id);
      if (goalProgress) {
        acc[goal.id] = goalProgress;
      }
      return acc;
    },
    {},
  );
  const history = SLEEP_STREAK_TYPES.reduce<
    Record<string, SleepStreakHistoryPoint[]>
  >((acc, type) => {
    acc[type] = compactStreakHistory(getStreakHistory(adapter, type), 21);
    return acc;
  }, {});

  return (
    <div style={styles.stack}>
      <style>
        {`@keyframes sleepRecordPulse {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(48,209,88,0); }
          50% { transform: scale(1.04); box-shadow: 0 0 24px rgba(48,209,88,0.22); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(48,209,88,0); }
        }`}
      </style>

      <section style={styles.hero}>
        <p style={styles.eyebrow}>Goals</p>
        <h2 style={styles.heroTitle}>Track targets, streaks, and weekly momentum.</h2>
        <p style={styles.heroCopy}>
          Goals stay simple on purpose: set the target, log the night, and MySleep keeps the progress math in the shared engine.
        </p>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <p style={styles.eyebrow}>Weekly accountability</p>
            <h3 style={styles.panelTitle}>
              {summary.daysOnTarget} of {summary.evaluatedDays} nights on target
            </h3>
          </div>
          <div style={styles.scoreRing}>
            {formatPercentage(summary.goalAdherencePercentage)}
          </div>
        </div>
        <p style={styles.body}>{generateAccountabilityMessage(summary)}</p>
        <div style={styles.weekDotRow}>
          {weekDots.map((dot) => (
            <div key={dot.date} style={styles.weekDotItem}>
              <div
                style={{
                  ...styles.weekDot,
                  ...(dot.status === 'met' ? styles.weekDotMet : {}),
                  ...(dot.status === 'missed' ? styles.weekDotMissed : {}),
                }}
              />
              <span style={styles.weekDotLabel}>{dot.label}</span>
            </div>
          ))}
        </div>
        <Link href="/sleep/insights" style={styles.secondaryLink}>
          View full insights
        </Link>
      </section>

      <section style={styles.panel}>
        <p style={styles.eyebrow}>Set a goal</p>
        <form action={createSleepGoalAction} style={styles.goalForm}>
          <select name="type" defaultValue="duration" style={styles.input}>
            {GOAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatGoalTypeLabel(type)}
              </option>
            ))}
          </select>
          <input
            name="target_value"
            defaultValue={getDefaultGoalTarget('duration', targetHours)}
            placeholder="8"
            style={styles.input}
          />
          <input type="hidden" name="start_date" value={todayDate()} />
          <textarea
            name="notes"
            placeholder="Optional note"
            style={{ ...styles.input, ...styles.textarea }}
          />
          <button type="submit" style={styles.primaryButton}>
            Add Goal
          </button>
        </form>
      </section>

      <section style={styles.grid}>
        <div style={styles.column}>
          <h3 style={styles.sectionTitle}>Active Goals</h3>
          {goals.length === 0 ? (
            <div style={styles.emptyCard}>
              <strong>No active goals yet</strong>
              <span>Add duration, bedtime, wake time, or consistency above.</span>
            </div>
          ) : (
            goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                progress={progress[goal.id]}
              />
            ))
          )}
        </div>

        <div style={styles.column}>
          <h3 style={styles.sectionTitle}>Streaks</h3>
          {streaks.map((streak) => (
            <StreakCard
              key={streak.type}
              streak={streak}
              history={history[streak.type] ?? []}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function GoalCard({
  goal,
  progress,
}: {
  goal: SleepGoal;
  progress?: SleepGoalProgress;
}) {
  const percentage = progress?.percentage ?? 0;

  return (
    <article style={styles.card}>
      <div style={styles.panelHeader}>
        <div>
          <p style={styles.eyebrow}>{formatGoalTypeLabel(goal.type)}</p>
          <h4 style={styles.cardTitle}>
            {formatGoalTarget(goal.type, goal.target_value)}
          </h4>
        </div>
        <div style={styles.scoreRing}>{formatPercentage(percentage)}</div>
      </div>
      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressFill,
            width: `${Math.min(100, percentage)}%`,
          }}
        />
      </div>
      <p style={styles.body}>
        {progress ? formatGoalProgress(progress) : 'No nights evaluated yet'}
      </p>
      <form action={updateSleepGoalAction} style={styles.inlineForm}>
        <input type="hidden" name="id" value={goal.id} />
        <input type="hidden" name="type" value={goal.type} />
        <input
          name="target_value"
          defaultValue={goal.target_value}
          aria-label={`${formatGoalTypeLabel(goal.type)} target`}
          style={styles.input}
        />
        <input
          name="notes"
          defaultValue={goal.notes ?? ''}
          placeholder="Note"
          aria-label={`${formatGoalTypeLabel(goal.type)} note`}
          style={styles.input}
        />
        <button type="submit" style={styles.secondaryButton}>
          Save
        </button>
      </form>
      <form action={deactivateSleepGoalAction}>
        <input type="hidden" name="id" value={goal.id} />
        <button type="submit" style={styles.dangerButton}>
          Deactivate
        </button>
      </form>
    </article>
  );
}

function StreakCard({
  streak,
  history,
}: {
  streak: SleepStreak;
  history: SleepStreakHistoryPoint[];
}) {
  const record = isNewLongestStreak(streak);

  return (
    <article style={styles.card}>
      <div style={styles.streakHeader}>
        <div style={styles.flame}>🔥</div>
        <div style={{ flex: 1 }}>
          <p style={styles.eyebrow}>{formatStreakTypeLabel(streak.type)}</p>
          <h4 style={styles.cardTitle}>{streak.current_count}-day streak</h4>
          <p style={styles.body}>Longest record {streak.longest_count} days</p>
        </div>
        {record && (
          <span className="sleep-record-badge" style={styles.recordBadge}>
            New record
          </span>
        )}
      </div>
      <div style={styles.historyRow}>
        {history.length === 0 ? (
          <span style={styles.body}>History starts with your next logged night.</span>
        ) : (
          history.map((point) => (
            <span
              key={point.id}
              style={{
                ...styles.historyCell,
                ...(point.met ? styles.historyCellMet : styles.historyCellMissed),
              }}
            />
          ))
        )}
      </div>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: {
    display: 'grid',
    gap: 16,
  },
  hero: {
    display: 'grid',
    gap: 10,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(167,139,250,0.10)',
  },
  eyebrow: {
    margin: 0,
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  heroTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 30,
    lineHeight: 1.08,
  },
  heroCopy: {
    margin: 0,
    maxWidth: 760,
    color: 'var(--text-secondary)',
    fontSize: 15,
    lineHeight: 1.6,
  },
  panel: {
    display: 'grid',
    gap: 14,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  panelTitle: {
    margin: '4px 0 0',
    color: 'var(--text)',
    fontSize: 24,
    lineHeight: 1.1,
  },
  body: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.55,
  },
  scoreRing: {
    width: 66,
    height: 66,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    border: '3px solid #A78BFA',
    background: 'rgba(167,139,250,0.14)',
    color: '#F5F3FF',
    fontWeight: 900,
  },
  weekDotRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 8,
  },
  weekDotItem: {
    display: 'grid',
    gap: 6,
    justifyItems: 'center',
  },
  weekDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  weekDotMet: {
    background: 'rgba(48,209,88,0.72)',
    borderColor: 'rgba(48,209,88,0.92)',
  },
  weekDotMissed: {
    background: 'rgba(255,69,58,0.55)',
    borderColor: 'rgba(255,69,58,0.82)',
  },
  weekDotLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
  },
  secondaryLink: {
    width: 'fit-content',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 16px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 800,
  },
  goalForm: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
  },
  input: {
    minHeight: 44,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 12px',
    fontSize: 14,
  },
  textarea: {
    minHeight: 80,
    gridColumn: '1 / -1',
  },
  primaryButton: {
    border: 0,
    borderRadius: 999,
    background: '#A78BFA',
    color: '#0E0E13',
    padding: '11px 18px',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
  },
  secondaryButton: {
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  dangerButton: {
    borderRadius: 999,
    border: '1px solid rgba(255,69,58,0.34)',
    background: 'rgba(255,69,58,0.12)',
    color: '#FECACA',
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 16,
  },
  column: {
    display: 'grid',
    alignContent: 'start',
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 20,
    lineHeight: 1.2,
  },
  card: {
    display: 'grid',
    gap: 12,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  cardTitle: {
    margin: '4px 0 0',
    color: 'var(--text)',
    fontSize: 20,
    lineHeight: 1.2,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.08)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: '#A78BFA',
  },
  inlineForm: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr auto',
    gap: 8,
  },
  streakHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  flame: {
    width: 46,
    height: 46,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(167,139,250,0.14)',
    border: '1px solid rgba(167,139,250,0.32)',
    fontSize: 22,
  },
  recordBadge: {
    borderRadius: 999,
    padding: '8px 10px',
    background: 'rgba(48,209,88,0.14)',
    border: '1px solid rgba(48,209,88,0.34)',
    color: '#BBF7D0',
    fontSize: 12,
    fontWeight: 900,
    animation: 'sleepRecordPulse 1.4s ease-in-out infinite',
  },
  historyRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
    minHeight: 24,
    alignItems: 'center',
  },
  historyCell: {
    width: 13,
    height: 13,
    borderRadius: 4,
    background: 'rgba(255,255,255,0.08)',
  },
  historyCellMet: {
    background: 'rgba(48,209,88,0.72)',
  },
  historyCellMissed: {
    background: 'rgba(255,69,58,0.56)',
  },
  emptyCard: {
    display: 'grid',
    gap: 6,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-secondary)',
  },
};
