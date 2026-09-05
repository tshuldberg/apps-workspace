'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  fetchDashboard,
  fetchDailyAverages,
  fetchPet,
  fetchEntries,
  fetchEmotionTagsForEntry,
  addEntry,
  addPetActivity,
  editPetStats,
  fetchPetActivitiesToday,
} from './actions';
import {
  MoodScoreDescriptors,
  feedPet,
  getEvolutionStage,
  EVOLUTION_NAMES,
  PlutchikEmotionSchema,
  type MoodDashboard,
  type MoodEntry,
  type MoodEmotionTag,
  type Pet,
} from '@mylife/mood';

const ACCENT = 'var(--accent-mood)';
const ACCENT_DIM = 'var(--accent-mood-dim, rgba(251,146,60,0.15))';
const ACCENT_BORDER = 'var(--accent-mood-border, rgba(251,146,60,0.25))';
const SURFACE_ELEVATED = 'var(--surface-elevated, #2A292F)';
const BORDER = 'var(--border)';
const TEXT_SEC = 'var(--text-secondary)';
const GLASS = 'var(--glass)';

interface DailyAvg { date: string; average: number; count: number }

export default function MoodDashboardPage() {
  const [dashboard, setDashboard] = useState<MoodDashboard | null>(null);
  const [dailyAvgs, setDailyAvgs] = useState<DailyAvg[]>([]);
  const [pet, setPet] = useState<Pet | null>(null);
  const [recentEntries, setRecentEntries] = useState<MoodEntry[]>([]);
  const [emotionMap, setEmotionMap] = useState<Map<string, MoodEmotionTag[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const d7 = new Date();
        d7.setDate(d7.getDate() - 6);
        const start7 = d7.toISOString().slice(0, 10);

        const [dash, avgs, p, entries] = await Promise.all([
          fetchDashboard(),
          fetchDailyAverages(start7, today),
          fetchPet().catch(() => null),
          fetchEntries({ limit: 5 }),
        ]);
        if (cancelled) return;
        setDashboard(dash);
        setDailyAvgs(avgs);
        setPet(p);
        setRecentEntries(entries);

        // Load emotions for recent entries
        const eMap = new Map<string, MoodEmotionTag[]>();
        await Promise.all(
          entries.slice(0, 3).map(async (e: MoodEntry) => {
            try {
              const tags = await fetchEmotionTagsForEntry(e.id);
              eMap.set(e.id, tags);
            } catch { /* skip */ }
          })
        );
        if (!cancelled) setEmotionMap(eMap);
      } catch {
        if (!cancelled) setError('Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={() => window.location.reload()} />;
  if (!dashboard || dashboard.totalEntries === 0) return <EmptyDashboard />;

  const yesterdayDiff = computeYesterdayDiff(dailyAvgs, dashboard.todayAverage);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Top row: Score + Entries + Pet */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <TodayScoreCard
          average={dashboard.todayAverage}
          diff={yesterdayDiff}
        />
        <EntryCountCard
          count={dashboard.todayEntries}
          recentEntries={recentEntries}
        />
        <PetCard pet={pet} onPetUpdate={setPet} />
      </div>

      {/* AI Insights Banner */}
      <InsightBanner dashboard={dashboard} dailyAvgs={dailyAvgs} />

      {/* Inline Mood Logger */}
      <InlineMoodLogger />

      {/* Bottom row: Weekly Trend + Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <WeeklyTrendCard dailyAvgs={dailyAvgs} />
        <RecentActivityCard entries={recentEntries} emotionMap={emotionMap} />
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function computeYesterdayDiff(dailyAvgs: DailyAvg[], todayAvg: number | null): number | null {
  if (todayAvg == null || dailyAvgs.length < 2) return null;
  const sorted = [...dailyAvgs].sort((a, b) => b.date.localeCompare(a.date));
  const yesterday = sorted.find((d) => d.date !== new Date().toISOString().slice(0, 10));
  if (!yesterday) return null;
  return Math.round((todayAvg - yesterday.average) * 10) / 10;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Today's Score ────────────────────────────────────────────────────

function TodayScoreCard({ average, diff }: { average: number | null; diff: number | null }) {
  return (
    <div style={{
      padding: 24,
      borderRadius: 20,
      background: SURFACE_ELEVATED,
      border: `1px solid ${BORDER}`,
    }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
        Today&apos;s Average
      </p>
      <p style={{ margin: '12px 0 0', fontSize: 48, fontWeight: 800, color: ACCENT, lineHeight: 1 }}>
        {average != null ? average.toFixed(1) : '--'}
      </p>
      {diff != null && (
        <p style={{
          margin: '8px 0 0',
          fontSize: 13,
          fontWeight: 600,
          color: diff >= 0 ? 'var(--success)' : 'var(--danger)',
        }}>
          {diff >= 0 ? '+' : ''}{diff.toFixed(1)} from yesterday
        </p>
      )}
    </div>
  );
}

// ── Entry Count ──────────────────────────────────────────────────────

function EntryCountCard({ count, recentEntries }: { count: number; recentEntries: MoodEntry[] }) {
  const lastEntry = recentEntries[0];
  return (
    <div style={{
      padding: 24,
      borderRadius: 20,
      background: SURFACE_ELEVATED,
      border: `1px solid ${BORDER}`,
    }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
        Entries Today
      </p>
      <p style={{ margin: '12px 0 0', fontSize: 48, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
        {count}
      </p>
      {lastEntry && (
        <p style={{ margin: '8px 0 0', fontSize: 13, color: TEXT_SEC }}>
          Last entry {formatTimeAgo(lastEntry.createdAt)}
        </p>
      )}
    </div>
  );
}

// ── Pet Card ─────────────────────────────────────────────────────────

function PetCard({ pet, onPetUpdate }: { pet: Pet | null; onPetUpdate: (p: Pet | null) => void }) {
  const [feedMsg, setFeedMsg] = useState<string | null>(null);

  const handleFeed = async () => {
    if (!pet) return;
    let todayCount = 0;
    try { todayCount = await fetchPetActivitiesToday('mood_log'); } catch { /* default 0 */ }
    const result = feedPet(pet, 'mood_log', todayCount);
    if (result.dailyLimitReached || (result.happinessDelta === 0 && result.experienceDelta === 0)) {
      setFeedMsg('Limit reached');
      setTimeout(() => setFeedMsg(null), 2000);
      return;
    }
    try {
      await addPetActivity('mood_log', result.happinessDelta, result.experienceDelta, 'mood');
      await editPetStats(result.newHappiness, result.newExperience, result.newEvolutionStage, pet.totalFeeds + 1, result.justHatched ? new Date().toISOString() : pet.hatchedAt);
      setFeedMsg(`+${result.happinessDelta} happy`);
      setTimeout(() => setFeedMsg(null), 2000);
      const updated = await fetchPet();
      onPetUpdate(updated);
    } catch {
      setFeedMsg('Feed failed');
      setTimeout(() => setFeedMsg(null), 2000);
    }
  };

  const handlePlay = () => {
    // Navigate to pet page for full interaction
    window.location.href = '/mood/pet';
  };

  if (!pet) {
    return (
      <Link href="/mood/pet" style={{
        padding: 24,
        borderRadius: 20,
        background: SURFACE_ELEVATED,
        border: `1px solid ${BORDER}`,
        textDecoration: 'none',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 40 }}>🥚</span>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Hatch Your Pet</p>
        <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>Log moods to unlock</p>
      </Link>
    );
  }

  const stage = getEvolutionStage(pet.experience, pet.evolutionStage);
  const petEmoji = stage === 0 ? '🥚' : stage === 1 ? '🐣' : stage === 2 ? '🐥' : '🦉';

  return (
    <div style={{
      padding: 20,
      borderRadius: 20,
      background: SURFACE_ELEVATED,
      border: `1px solid ${BORDER}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{pet.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC }}>
            {EVOLUTION_NAMES[stage] ?? 'Unknown'}
          </p>
        </div>
        <div style={{
          padding: '4px 10px',
          borderRadius: 999,
          background: ACCENT_DIM,
          border: `1px solid ${ACCENT_BORDER}`,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{pet.happiness}%</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
        <span style={{ fontSize: 56 }}>{petEmoji}</span>
      </div>

      {/* Happiness bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: TEXT_SEC, marginBottom: 4 }}>
          <span>Happiness</span>
          <span>{pet.happiness}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--glass-strong, rgba(255,255,255,0.08))', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            borderRadius: 3,
            background: pet.happiness > 50 ? 'var(--success)' : pet.happiness > 20 ? 'var(--warning, #FF9F0A)' : 'var(--danger)',
            width: `${pet.happiness}%`,
            transition: 'width 300ms ease',
          }} />
        </div>
      </div>

      {feedMsg && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--success)', textAlign: 'center', fontWeight: 600 }}>
          {feedMsg}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button
          type="button"
          onClick={() => void handleFeed()}
          style={{
            padding: '8px 0',
            borderRadius: 10,
            border: `1px solid ${ACCENT_BORDER}`,
            background: ACCENT_DIM,
            color: ACCENT,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Feed
        </button>
        <button
          type="button"
          onClick={handlePlay}
          style={{
            padding: '8px 0',
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            background: GLASS,
            color: 'var(--text)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Play
        </button>
      </div>
    </div>
  );
}

// ── AI Insights Banner ───────────────────────────────────────────────

function InsightBanner({ dashboard, dailyAvgs }: { dashboard: MoodDashboard; dailyAvgs: DailyAvg[] }) {
  const message = useMemo(() => {
    if (dashboard.todayAverage != null && dashboard.todayAverage >= 7) {
      return 'Your energy seems high today. Consider a walk to maintain this momentum.';
    }
    if (dashboard.todayAverage != null && dashboard.todayAverage <= 4) {
      return 'Today feels tough. Try a breathing exercise or reach out to someone you trust.';
    }
    if (dashboard.currentStreak >= 7) {
      return `Amazing ${dashboard.currentStreak}-day streak! Consistency builds self-awareness.`;
    }
    if (dailyAvgs.length >= 5) {
      const avg = dailyAvgs.reduce((s, d) => s + d.average, 0) / dailyAvgs.length;
      if (avg >= 6.5) return 'Your week is trending positively. Keep up the great habits!';
    }
    return 'Track consistently to unlock personalized insights about your patterns.';
  }, [dashboard, dailyAvgs]);

  return (
    <Link href="/mood/insights" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '16px 20px',
      borderRadius: 16,
      background: ACCENT_DIM,
      border: `1px solid ${ACCENT_BORDER}`,
      textDecoration: 'none',
      color: 'var(--text)',
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: ACCENT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 16 }}>&#x2728;</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: ACCENT }}>
          AI Insights
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text)', lineHeight: 1.4 }}>
          {message}
        </p>
      </div>
      <span style={{ color: ACCENT, fontSize: 18, flexShrink: 0 }}>&#x2192;</span>
    </Link>
  );
}

// ── Inline Mood Logger ───────────────────────────────────────────────

const QUICK_EMOTIONS = ['Joyful', 'Calm', 'Focused', 'Creative', 'Anxious', 'Tired', 'Grateful', 'Restless'] as const;
type PlutchikEmotion = typeof PlutchikEmotionSchema._type;

const EMOTION_TO_PLUTCHIK: Record<string, PlutchikEmotion> = {
  Joyful: 'joy',
  Calm: 'serenity',
  Focused: 'vigilance',
  Creative: 'interest',
  Anxious: 'apprehension',
  Tired: 'pensiveness',
  Grateful: 'admiration',
  Restless: 'annoyance',
};

function InlineMoodLogger() {
  const router = useRouter();
  const [score, setScore] = useState(5);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const emotions = selectedEmotion && EMOTION_TO_PLUTCHIK[selectedEmotion]
        ? [{ emotion: EMOTION_TO_PLUTCHIK[selectedEmotion]!, intensity: 2 }]
        : [];
      await addEntry({ score, emotions, activityIds: [] });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setSelectedEmotion(null);
        setScore(5);
        router.refresh();
      }, 1500);
    } catch {
      // Silently fail for inline logger; user can use full log page
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      padding: 24,
      borderRadius: 20,
      background: SURFACE_ELEVATED,
      border: `1px solid ${BORDER}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          How are you feeling now?
        </p>
        <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: ACCENT }}>
          {score.toFixed(1)}
        </p>
      </div>

      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={score}
        onChange={(e) => setScore(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent-mood)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: TEXT_SEC }}>VERY LOW</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: TEXT_SEC }}>NEUTRAL</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: TEXT_SEC }}>PEAK</span>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
        Select Emotion
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {QUICK_EMOTIONS.map((emotion) => {
          const isSelected = selectedEmotion === emotion;
          return (
            <button
              key={emotion}
              type="button"
              onClick={() => setSelectedEmotion(isSelected ? null : emotion)}
              style={{
                padding: '7px 16px',
                borderRadius: 999,
                border: `1px solid ${isSelected ? ACCENT : BORDER}`,
                background: isSelected ? ACCENT : 'transparent',
                color: isSelected ? '#0A0A0F' : TEXT_SEC,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {emotion}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving || saved}
        style={{
          width: '100%',
          padding: '12px 0',
          borderRadius: 12,
          border: 'none',
          background: saved ? 'var(--success)' : ACCENT,
          color: '#0A0A0F',
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: 1,
          textTransform: 'uppercase',
          cursor: saving || saved ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
          transition: 'background 200ms ease',
        }}
      >
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Entry'}
      </button>
    </div>
  );
}

// ── Weekly Trend ─────────────────────────────────────────────────────

function WeeklyTrendCard({ dailyAvgs }: { dailyAvgs: DailyAvg[] }) {
  const days = useMemo(() => {
    const result: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const avg = dailyAvgs.find((a) => a.date === dateStr);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().slice(0, 3);
      result.push({ label: dayLabel, value: avg?.average ?? 0 });
    }
    return result;
  }, [dailyAvgs]);

  return (
    <div style={{
      padding: 24,
      borderRadius: 20,
      background: SURFACE_ELEVATED,
      border: `1px solid ${BORDER}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text)' }}>
            Weekly Trend
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: TEXT_SEC, letterSpacing: 0.5 }}>
            Last 7 Days
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
        {days.map((day, i) => {
          const height = day.value > 0 ? Math.max(12, (day.value / 10) * 100) : 4;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT, opacity: day.value > 0 ? 1 : 0 }}>
                {day.value > 0 ? day.value.toFixed(1) : ''}
              </span>
              <div style={{
                width: '100%',
                maxWidth: 32,
                height: `${height}%`,
                borderRadius: 6,
                background: day.value > 0
                  ? `linear-gradient(180deg, ${ACCENT} 0%, rgba(251,146,60,0.4) 100%)`
                  : 'rgba(255,255,255,0.06)',
                transition: 'height 300ms ease',
              }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: TEXT_SEC, letterSpacing: 0.5 }}>
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recent Activity ──────────────────────────────────────────────────

function RecentActivityCard({ entries, emotionMap }: { entries: MoodEntry[]; emotionMap: Map<string, MoodEmotionTag[]> }) {
  return (
    <div style={{
      padding: 24,
      borderRadius: 20,
      background: SURFACE_ELEVATED,
      border: `1px solid ${BORDER}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text)' }}>
          Recent Activity
        </p>
        <Link href="/mood/history" style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textDecoration: 'none', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          View All
        </Link>
      </div>

      {entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC }}>No entries yet today.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {entries.slice(0, 4).map((entry) => {
            const emotions = emotionMap.get(entry.id) ?? [];
            const emotionLabel = emotions.length > 0
              ? emotions.map((e) => e.emotion.charAt(0).toUpperCase() + e.emotion.slice(1)).join(' & ')
              : MoodScoreDescriptors[entry.score]?.label ?? `Score ${entry.score}`;
            const scoreColor = entry.score >= 7 ? 'var(--success)' : entry.score >= 4 ? ACCENT : 'var(--danger)';

            return (
              <Link
                key={entry.id}
                href="/mood/history"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: GLASS,
                  border: `1px solid ${BORDER}`,
                  textDecoration: 'none',
                  color: 'var(--text)',
                }}
              >
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: scoreColor,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emotionLabel}
                  </p>
                  {entry.note && (
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.note}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor, flexShrink: 0 }}>
                  {entry.score.toFixed(1)}
                </span>
                <span style={{ fontSize: 11, color: TEXT_SEC, flexShrink: 0 }}>
                  {formatTimeAgo(entry.createdAt)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Skeleton / Error / Empty ─────────────────────────────────────────

function DashboardSkeleton() {
  const pulseStyle = { background: 'rgba(255,255,255,0.06)', borderRadius: 20, animation: 'pulse 1.5s ease-in-out infinite' };
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div style={{ ...pulseStyle, height: 160 }} />
        <div style={{ ...pulseStyle, height: 160 }} />
        <div style={{ ...pulseStyle, height: 160 }} />
      </div>
      <div style={{ ...pulseStyle, height: 56 }} />
      <div style={{ ...pulseStyle, height: 200 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ ...pulseStyle, height: 200 }} />
        <div style={{ ...pulseStyle, height: 200 }} />
      </div>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', gap: 16 }}>
      <span style={{ fontSize: 64 }}>🎭</span>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Your emotional journey starts here</h2>
      <p style={{ margin: 0, color: TEXT_SEC, fontSize: 15, maxWidth: 480, textAlign: 'center' }}>
        Log your first mood to begin building your dashboard and uncovering patterns in your emotional life.
      </p>
      <Link href="/mood/log" style={{
        marginTop: 8,
        padding: '12px 24px',
        borderRadius: 'var(--radius-pill)',
        background: ACCENT,
        color: '#0A0A0F',
        fontWeight: 700,
        fontSize: 15,
        textDecoration: 'none',
      }}>
        Log Your First Mood
      </Link>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', gap: 16 }}>
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${BORDER}`, background: GLASS, textAlign: 'center' }}>
        <p style={{ margin: '0 0 12px', fontSize: 15 }}>{message}</p>
        <button onClick={onRetry} style={{
          padding: '10px 20px',
          borderRadius: 8,
          border: 'none',
          background: ACCENT,
          color: '#0A0A0F',
          fontWeight: 700,
          cursor: 'pointer',
        }}>
          Retry
        </button>
      </div>
    </div>
  );
}
