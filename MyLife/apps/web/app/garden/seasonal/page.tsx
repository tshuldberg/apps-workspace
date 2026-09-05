'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  fetchPendingSeasonalTasks, doCompleteSeasonalTask, doSnoozeSeasonalTask,
  engineGetSeason, engineGetPlantCategories, engineGetSeasonalTasks,
} from '../actions';

const ACCENT = '#22C55E';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const TEXT_TER = 'rgba(240,240,245,0.35)';
const SURFACE = '#12121A';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.04)';


type Season = 'spring' | 'summer' | 'fall' | 'winter';

interface SeasonalTask {
  id: string;
  plantId: string | null;
  season: string;
  taskType: string;
  description: string | null;
  dueMonth: number | null;
  completedAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
}

interface BrowseTask {
  category: string;
  season: string;
  taskType: string;
  description: string;
  dueMonth: number | null;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function SeasonalPage() {
  const [tasks, setTasks] = useState<SeasonalTask[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [season, setSeason] = useState<Season>('spring');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [browseTasks, setBrowseTasks] = useState<BrowseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Determine current season on mount
  useEffect(() => {
    engineGetSeason(new Date().getMonth() + 1)
      .then((s) => setSeason(s as Season))
      .catch(() => { /* keep default */ });
  }, []);

  // Fetch pending tasks and categories
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchPendingSeasonalTasks(season),
      engineGetPlantCategories(),
    ])
      .then(([t, c]) => {
        if (cancelled) return;
        setTasks(t as SeasonalTask[]);
        setCategories(c as string[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load seasonal tasks');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [season, tick]);

  // Browse tasks by category
  const handleBrowseCategory = useCallback(async (cat: string) => {
    setCategoryFilter(cat);
    if (cat === 'all') {
      setBrowseTasks([]);
      return;
    }
    setBrowseLoading(true);
    try {
      const result = await engineGetSeasonalTasks(cat, season);
      setBrowseTasks(result as BrowseTask[]);
    } catch {
      setBrowseTasks([]);
    } finally {
      setBrowseLoading(false);
    }
  }, [season]);

  const handleComplete = useCallback(async (id: string) => {
    try {
      await doCompleteSeasonalTask(id);
      refresh();
    } catch {
      /* silent */
    }
  }, [refresh]);

  const handleSnooze = useCallback(async (id: string) => {
    const until = new Date();
    until.setDate(until.getDate() + 7);
    try {
      await doSnoozeSeasonalTask(id, until.toISOString());
      refresh();
    } catch {
      /* silent */
    }
  }, [refresh]);

  // Group categories with task counts from browse data
  const categoryTaskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      const cat = t.taskType || 'uncategorized';
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  if (tasks.length === 0 && categories.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 24, justifyItems: 'center', padding: '80px 0', textAlign: 'center' }}>
        <span style={{ fontSize: 64 }}>🌿</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>No seasonal tasks yet</h2>
        <p style={{ margin: 0, color: TEXT_SEC, maxWidth: 400 }}>
          Seasonal care tasks help you stay on top of pruning, fertilizing, and preparing your garden for each season. Add plants and they will generate seasonal reminders.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Seasonal Care</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Season</label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value as Season)}
              style={inputStyle}
            >
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
              <option value="fall">Fall</option>
              <option value="winter">Winter</option>
            </select>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => handleBrowseCategory(e.target.value)}
              style={inputStyle}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pending tasks */}
      <div style={{ display: 'grid', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Pending Tasks ({tasks.length})
        </h3>
        {tasks.length === 0 && (
          <p style={{ textAlign: 'center', color: TEXT_TER, padding: 32 }}>
            No pending tasks for {season}. Your garden is all caught up!
          </p>
        )}
        {tasks.map((t) => (
          <div key={t.id} style={{ ...card, display: 'flex', gap: 14, alignItems: 'center', padding: '14px 20px' }}>
            <div style={{ flex: 1 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                backgroundColor: `${ACCENT}18`, color: ACCENT,
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                {t.taskType}
              </span>
              {t.description && (
                <p style={{ margin: '6px 0 0', fontSize: 14, color: TEXT }}>{t.description}</p>
              )}
              {t.dueMonth != null && (
                <span style={{ fontSize: 12, color: TEXT_TER, marginLeft: 8 }}>
                  Due: {MONTHS[t.dueMonth - 1] ?? `Month ${t.dueMonth}`}
                </span>
              )}
            </div>
            <button type="button" onClick={() => handleComplete(t.id)} style={primaryBtn}>Complete</button>
            <button type="button" onClick={() => handleSnooze(t.id)} style={ghostBtn}>Snooze 1wk</button>
          </div>
        ))}
      </div>

      {/* Browse by category */}
      <div style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Browse by Category
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleBrowseCategory(cat)}
              style={{
                ...card,
                textAlign: 'left',
                cursor: 'pointer',
                padding: '16px 20px',
                border: categoryFilter === cat ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                backgroundColor: categoryFilter === cat ? `${ACCENT}10` : GLASS,
              }}
            >
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT }}>{cat}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_TER }}>
                {categoryTaskCounts.get(cat) ?? 0} pending
              </p>
            </button>
          ))}
        </div>

        {/* Browse results */}
        {categoryFilter !== 'all' && (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {browseLoading && <p style={{ color: TEXT_SEC, padding: 16 }}>Loading tasks...</p>}
            {!browseLoading && browseTasks.length === 0 && (
              <p style={{ color: TEXT_TER, padding: 16, textAlign: 'center' }}>
                No tasks for {categoryFilter} in {season}.
              </p>
            )}
            {!browseLoading && browseTasks.map((bt, i) => (
              <div key={`${bt.category}-${bt.taskType}-${i}`} style={{ ...card, padding: '12px 20px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                    backgroundColor: `${ACCENT}18`, color: ACCENT,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {bt.taskType}
                  </span>
                  <span style={{ fontSize: 14, color: TEXT }}>{bt.description}</span>
                  {bt.dueMonth != null && (
                    <span style={{ fontSize: 12, color: TEXT_TER, marginLeft: 'auto' }}>
                      {MONTHS[bt.dueMonth - 1] ?? `Month ${bt.dueMonth}`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...skel, width: 180, height: 32 }} />
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...skel, width: 120, height: 50 }} />
          <div style={{ ...skel, width: 140, height: 50 }} />
        </div>
      </div>
      {[1, 2, 3, 4].map((i) => <div key={i} style={{ ...skel, height: 64 }} />)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[1, 2, 3, 4].map((i) => <div key={i} style={{ ...skel, height: 72 }} />)}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ ...card, textAlign: 'center', padding: 40 }}>
      <p style={{ fontSize: 18, color: TEXT, margin: 0 }}>Something went wrong</p>
      <p style={{ fontSize: 14, color: TEXT_SEC, margin: '8px 0 0' }}>{message}</p>
      <button type="button" onClick={onRetry} style={{ ...ghostBtn, marginTop: 16 }}>Retry</button>
    </div>
  );
}

const card: CSSProperties = { padding: 20, borderRadius: 20, backgroundColor: GLASS, border: `1px solid ${BORDER}` };
const primaryBtn: CSSProperties = { borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 18px', fontWeight: 700, cursor: 'pointer', border: 'none', fontSize: 14 };
const ghostBtn: CSSProperties = { borderRadius: 999, backgroundColor: 'transparent', color: TEXT_SEC, padding: '10px 18px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${BORDER}`, fontSize: 14 };
const inputStyle: CSSProperties = { borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE, color: TEXT, padding: '8px 12px', fontSize: 14,  };
const skel: CSSProperties = { borderRadius: 20, backgroundColor: SURFACE };
