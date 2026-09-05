'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchMoodCalendar, fetchOverallStats, fetchWellnessTimeline } from '../actions';

interface TimelineEntry {
  date: string;
  moodScore: number | null;
  adherenceRate: number | null;
  symptomCount: number;
}

interface CalendarEntry {
  date: string;
  dominantMood: string | null;
  pleasantness: 'pleasant' | 'unpleasant' | 'neutral' | null;
  color: string;
  hasData: boolean;
}

interface Stats {
  overallAdherence30d: number;
  moodEntries30d: number;
  activeMedications: number;
  symptomEntries30d: number;
}

const T = {
  bg: '#131318',
  depth: '#0E0E13',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  textDim: 'rgba(228,225,233,0.5)',
  textFaint: 'rgba(228,225,233,0.35)',
  border: 'rgba(255,255,255,0.06)',
  accent: '#EF4444',
  accentDim: 'rgba(239,68,68,0.15)',
} as const;

const font = "'Plus Jakarta Sans', -apple-system, system-ui, sans-serif";

const TOOLS = [
  {
    key: 'checkin',
    label: 'Mood Check-In',
    icon: '☺',
    description: 'Log how you are feeling right now',
  },
  {
    key: 'breathing',
    label: 'Breathing Exercise',
    icon: '◎',
    description: 'Guided box breathing and 4-7-8 patterns',
  },
  {
    key: 'cbt',
    label: 'CBT Exercise',
    icon: '◈',
    description: 'Cognitive reframing and thought logging',
  },
  {
    key: 'grounding',
    label: '5-4-3-2-1 Grounding',
    icon: '◉',
    description: 'Grounding technique for anxious moments',
  },
  {
    key: 'meditation',
    label: 'Meditation',
    icon: '☯',
    description: 'Timed mindfulness sessions',
  },
] as const;

type ToolKey = (typeof TOOLS)[number]['key'];

const MOOD_LEVELS = [
  { score: 1, label: 'Very Bad', color: '#EF4444' },
  { score: 2, label: 'Bad', color: '#F97316' },
  { score: 3, label: 'Okay', color: '#EAB308' },
  { score: 4, label: 'Good', color: '#84CC16' },
  { score: 5, label: 'Great', color: '#22C55E' },
];

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: T.bg,
    color: T.text,
    fontFamily: font,
    padding: '40px 32px 120px',
  },
  container: { maxWidth: 1200, margin: '0 auto' },
  backLink: {
    color: T.textDim,
    textDecoration: 'none',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    display: 'inline-block',
    marginBottom: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: T.text,
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: T.textSecondary,
    marginTop: 8,
    marginBottom: 40,
  },

  /* Stats */
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 40,
  },
  statCard: {
    background: T.low,
    borderRadius: 16,
    padding: 20,
    border: `1px solid ${T.border}`,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.textDim,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: T.text,
  },

  /* Two Panel */
  twoPanel: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    gap: 24,
    marginBottom: 40,
  },
  leftPanel: {
    background: T.low,
    borderRadius: 16,
    padding: 24,
    border: `1px solid ${T.border}`,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: T.accent,
    marginBottom: 20,
  },
  toolList: { display: 'flex', flexDirection: 'column', gap: 8 },
  toolItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    borderRadius: 12,
    background: 'transparent',
    border: `1px solid ${T.border}`,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    color: T.text,
    fontFamily: font,
  },
  toolItemActive: {
    background: T.accentDim,
    borderColor: T.accent,
  },
  toolIcon: {
    fontSize: 22,
    color: T.accent,
    width: 32,
    textAlign: 'center',
  },
  toolLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: T.text,
  },
  toolDesc: { fontSize: 10, color: T.textDim, marginTop: 2 },

  /* Right panel - selected tool */
  rightPanel: {
    background: T.low,
    borderRadius: 16,
    padding: 40,
    border: `1px solid ${T.border}`,
    minHeight: 480,
  },
  panelHeader: {
    textAlign: 'center',
    marginBottom: 32,
  },
  panelTitle: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: T.text,
    margin: 0,
  },
  panelSub: {
    fontSize: 13,
    color: T.textSecondary,
    marginTop: 8,
  },

  /* Mood check-in */
  moodRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
    marginTop: 40,
    marginBottom: 32,
  },
  moodBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 16,
    background: T.high,
    border: `1px solid ${T.border}`,
    cursor: 'pointer',
    width: 100,
    fontFamily: font,
  },
  moodBtnActive: { background: T.accentDim, borderColor: T.accent },
  moodEmoji: { fontSize: 28 },
  moodLabelText: { fontSize: 11, fontWeight: 600, color: T.textSecondary },
  moodNote: {
    width: '100%',
    minHeight: 100,
    background: T.depth,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: 16,
    fontSize: 13,
    color: T.text,
    fontFamily: font,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  saveBtn: {
    marginTop: 24,
    padding: '12px 32px',
    borderRadius: 9999,
    background: T.accent,
    color: '#fff',
    border: 'none',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    width: '100%',
  },

  /* Breathing circle */
  breatheWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 40,
  },
  breatheCircle: {
    width: 220,
    height: 220,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${T.accentDim} 0%, transparent 70%)`,
    border: `2px solid ${T.accent}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: T.accent,
    animation: 'breathe 8s ease-in-out infinite',
  },
  breatheLabel: {
    marginTop: 32,
    fontSize: 13,
    color: T.textSecondary,
    textAlign: 'center',
  },

  /* CBT Flow */
  cbtStep: {
    marginBottom: 24,
  },
  cbtLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.textDim,
    marginBottom: 8,
  },
  cbtText: {
    fontSize: 14,
    color: T.textSecondary,
    lineHeight: 1.6,
    marginBottom: 12,
  },
  cbtInput: {
    width: '100%',
    minHeight: 60,
    background: T.depth,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: 14,
    fontSize: 13,
    color: T.text,
    fontFamily: font,
    boxSizing: 'border-box',
  },

  /* Grounding */
  groundStep: {
    background: T.high,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  groundNum: {
    fontSize: 36,
    fontWeight: 800,
    color: T.accent,
    width: 56,
  },
  groundText: { fontSize: 14, color: T.text, fontWeight: 600 },
  groundHint: { fontSize: 11, color: T.textDim, marginTop: 2 },

  /* Calendar */
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: T.text,
    marginBottom: 16,
  },
  calGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4,
  },
  calDayLabel: {
    fontSize: 10,
    color: T.textDim,
    textAlign: 'center',
    padding: '4px 0',
    fontWeight: 600,
  },
  calCell: {
    aspectRatio: '1',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    color: T.textSecondary,
    border: `1px solid ${T.border}`,
  },

  empty: {
    padding: 48,
    textAlign: 'center',
    color: T.textFaint,
    fontSize: 13,
  },
};

export default function MindPage() {
  const now = new Date();
  const [selected, setSelected] = useState<ToolKey>('checkin');
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [moodNote, setMoodNote] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [calendar, setCalendar] = useState<CalendarEntry[]>([]);
  const [calYear] = useState(now.getFullYear());
  const [calMonth] = useState(now.getMonth() + 1);

  const load = useCallback(async () => {
    try {
      const [st, tl, cal] = await Promise.all([
        fetchOverallStats(),
        fetchWellnessTimeline(14),
        fetchMoodCalendar(calYear, calMonth),
      ]);
      setStats(st as Stats | null);
      setTimeline(tl as TimelineEntry[]);
      setCalendar(cal as CalendarEntry[]);
    } catch (err) {
      console.error('Failed to load mind data:', err);
    }
  }, [calYear, calMonth]);

  useEffect(() => {
    load();
  }, [load]);

  // Calendar grid
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
  const calCells: (CalendarEntry | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calCells.push(null);
  for (const entry of calendar) calCells.push(entry);

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link href="/health" style={s.backLink}>
          ← MyHealth / Mind
        </Link>
        <h1 style={s.title}>Mind</h1>
        <p style={s.subtitle}>Wellness tools for mental and emotional health</p>

        {/* Stats */}
        {stats && (
          <div style={s.statsGrid}>
            <div style={s.statCard}>
              <div style={s.statLabel}>Mood Entries</div>
              <div style={s.statValue}>{stats.moodEntries30d}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Med Adherence</div>
              <div style={s.statValue}>{stats.overallAdherence30d}%</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Active Meds</div>
              <div style={s.statValue}>{stats.activeMedications}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Symptoms</div>
              <div style={s.statValue}>{stats.symptomEntries30d}</div>
            </div>
          </div>
        )}

        {/* Two Panel */}
        <div style={s.twoPanel}>
          {/* Left - Tool List */}
          <div style={s.leftPanel}>
            <div style={s.sectionLabel}>Wellness Tools</div>
            <div style={s.toolList}>
              {TOOLS.map((tool) => (
                <button
                  key={tool.key}
                  type="button"
                  style={{
                    ...s.toolItem,
                    ...(selected === tool.key ? s.toolItemActive : {}),
                  }}
                  onClick={() => setSelected(tool.key)}
                >
                  <div style={s.toolIcon}>{tool.icon}</div>
                  <div>
                    <div style={s.toolLabel}>{tool.label}</div>
                    <div style={s.toolDesc}>{tool.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right - Tool Detail */}
          <div style={s.rightPanel}>
            {selected === 'checkin' && (
              <div>
                <div style={s.panelHeader}>
                  <h2 style={s.panelTitle}>How are you feeling?</h2>
                  <p style={s.panelSub}>Select your current mood</p>
                </div>
                <div style={s.moodRow}>
                  {MOOD_LEVELS.map((level) => (
                    <button
                      key={level.score}
                      type="button"
                      style={{
                        ...s.moodBtn,
                        ...(moodScore === level.score ? s.moodBtnActive : {}),
                      }}
                      onClick={() => setMoodScore(level.score)}
                    >
                      <div style={{ ...s.moodEmoji, color: level.color }}>●</div>
                      <div style={s.moodLabelText}>{level.label}</div>
                    </button>
                  ))}
                </div>
                <textarea
                  style={s.moodNote}
                  placeholder="Optional note about your day..."
                  value={moodNote}
                  onChange={(e) => setMoodNote(e.target.value)}
                />
                <button
                  type="button"
                  style={s.saveBtn}
                  disabled={moodScore == null}
                  onClick={() => {
                    // Mobile handles full mood persistence. Web is read-only for now.
                    setMoodScore(null);
                    setMoodNote('');
                  }}
                >
                  Save Check-In
                </button>
              </div>
            )}

            {selected === 'breathing' && (
              <div>
                <div style={s.panelHeader}>
                  <h2 style={s.panelTitle}>Box Breathing</h2>
                  <p style={s.panelSub}>Inhale 4 · Hold 4 · Exhale 4 · Hold 4</p>
                </div>
                <div style={s.breatheWrap}>
                  <div style={s.breatheCircle}>Breathe</div>
                  <div style={s.breatheLabel}>
                    Follow the circle's rhythm.
                    <br />
                    Continue for 4 cycles (2 minutes).
                  </div>
                </div>
              </div>
            )}

            {selected === 'cbt' && (
              <div>
                <div style={s.panelHeader}>
                  <h2 style={s.panelTitle}>Thought Reframing</h2>
                  <p style={s.panelSub}>Identify and challenge negative thoughts</p>
                </div>
                <div style={s.cbtStep}>
                  <div style={s.cbtLabel}>1 · The Situation</div>
                  <div style={s.cbtText}>What happened? Who was involved?</div>
                  <textarea style={s.cbtInput} placeholder="Describe the situation..." />
                </div>
                <div style={s.cbtStep}>
                  <div style={s.cbtLabel}>2 · Automatic Thought</div>
                  <div style={s.cbtText}>What went through your mind?</div>
                  <textarea style={s.cbtInput} placeholder="The thought..." />
                </div>
                <div style={s.cbtStep}>
                  <div style={s.cbtLabel}>3 · Reframe</div>
                  <div style={s.cbtText}>What's a more balanced perspective?</div>
                  <textarea style={s.cbtInput} placeholder="A balanced view..." />
                </div>
              </div>
            )}

            {selected === 'grounding' && (
              <div>
                <div style={s.panelHeader}>
                  <h2 style={s.panelTitle}>5-4-3-2-1 Grounding</h2>
                  <p style={s.panelSub}>Use your senses to anchor to the present</p>
                </div>
                <div style={s.groundStep}>
                  <div style={s.groundNum}>5</div>
                  <div>
                    <div style={s.groundText}>Things you can see</div>
                    <div style={s.groundHint}>Look around and name them</div>
                  </div>
                </div>
                <div style={s.groundStep}>
                  <div style={s.groundNum}>4</div>
                  <div>
                    <div style={s.groundText}>Things you can touch</div>
                    <div style={s.groundHint}>Notice textures and temperatures</div>
                  </div>
                </div>
                <div style={s.groundStep}>
                  <div style={s.groundNum}>3</div>
                  <div>
                    <div style={s.groundText}>Things you can hear</div>
                    <div style={s.groundHint}>Near and far sounds</div>
                  </div>
                </div>
                <div style={s.groundStep}>
                  <div style={s.groundNum}>2</div>
                  <div>
                    <div style={s.groundText}>Things you can smell</div>
                    <div style={s.groundHint}>Any scents in the air</div>
                  </div>
                </div>
                <div style={s.groundStep}>
                  <div style={s.groundNum}>1</div>
                  <div>
                    <div style={s.groundText}>Thing you can taste</div>
                    <div style={s.groundHint}>Notice the taste in your mouth</div>
                  </div>
                </div>
              </div>
            )}

            {selected === 'meditation' && (
              <div>
                <div style={s.panelHeader}>
                  <h2 style={s.panelTitle}>Meditation</h2>
                  <p style={s.panelSub}>Choose a session length</p>
                </div>
                <div style={{ ...s.moodRow, marginTop: 60 }}>
                  {[5, 10, 15, 20].map((min) => (
                    <button key={min} type="button" style={s.moodBtn}>
                      <div style={{ ...s.moodEmoji, color: T.accent }}>{min}</div>
                      <div style={s.moodLabelText}>minutes</div>
                    </button>
                  ))}
                </div>
                <div style={{ ...s.breatheLabel, marginTop: 48 }}>
                  Sessions run on mobile. Use the web dashboard to review your streaks.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mood Calendar */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Mood Calendar</div>
          <div style={s.calGrid}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} style={s.calDayLabel}>
                {d}
              </div>
            ))}
            {calCells.map((cell, i) => (
              <div
                key={i}
                style={{
                  ...s.calCell,
                  background: cell?.hasData ? cell.color : T.low,
                  borderColor: cell ? T.border : 'transparent',
                }}
                title={cell ? `${cell.date}: ${cell.dominantMood ?? 'no data'}` : ''}
              >
                {cell ? parseInt(cell.date.slice(8, 10), 10) : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Wellness Timeline */}
        <div style={s.section}>
          <div style={s.sectionTitle}>14-Day Wellness Timeline</div>
          {timeline.length === 0 ? (
            <div style={s.empty}>No wellness data yet</div>
          ) : (
            timeline.map((entry) => (
              <div
                key={entry.date}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: `1px solid ${T.border}`,
                  fontSize: 12,
                }}
              >
                <div style={{ width: 60, color: T.textDim }}>{entry.date.slice(5)}</div>
                <div
                  style={{
                    flex: 1,
                    background: T.highest,
                    borderRadius: 9999,
                    height: 12,
                    overflow: 'hidden',
                  }}
                >
                  {entry.moodScore != null && (
                    <div
                      style={{
                        height: '100%',
                        background: T.accent,
                        width: `${Math.min(entry.moodScore * 20, 100)}%`,
                      }}
                    />
                  )}
                </div>
                <div style={{ width: 60, textAlign: 'right', color: T.textDim }}>
                  {entry.adherenceRate != null ? `${entry.adherenceRate}%` : '--'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
