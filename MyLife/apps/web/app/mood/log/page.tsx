'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { addEntry, fetchActivities, initDefaultActivities } from '../actions';
import {
  MoodScoreDescriptors,
  PlutchikEmotionSchema,
  type MoodActivity,
} from '@mylife/mood';

type PlutchikEmotion = typeof PlutchikEmotionSchema._type;

// ── Obsidian Noir Tokens ──────────────────────────────────────────────

const ACCENT = 'var(--accent-mood)';
const ACCENT_RAW = '#FB923C';
const ACCENT_DIM = 'rgba(251,146,60,0.12)';
const ACCENT_BORDER = 'rgba(251,146,60,0.25)';
const SURFACE = 'var(--surface, #131318)';
const SURFACE_ELEVATED = 'var(--surface-elevated, #2A292F)';
const BORDER = 'var(--border)';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const GLASS_STRONG = 'var(--glass-strong, rgba(255,255,255,0.08))';
const BACKGROUND = 'var(--background, #131318)';

// Score color map matching mobile MOOD_SCORE_COLORS
const SCORE_COLORS: Record<number, string> = {
  1: '#FF453A',
  2: '#FF6B5A',
  3: '#FF8C42',
  4: '#FFA833',
  5: '#D4A04A',
  6: '#A8B84A',
  7: '#7ACC52',
  8: '#4AD86A',
  9: '#30D158',
  10: '#28CD6A',
};

// ── Plutchik Wheel Data ───────────────────────────────────────────────

const PLUTCHIK_AXES = [
  { axis: 'Joy', emotions: ['ecstasy', 'joy', 'serenity'] as PlutchikEmotion[], color: '#FFD700', angle: -90 },
  { axis: 'Trust', emotions: ['admiration', 'trust', 'acceptance'] as PlutchikEmotion[], color: '#7BCC70', angle: -90 + 45 },
  { axis: 'Fear', emotions: ['terror', 'fear', 'apprehension'] as PlutchikEmotion[], color: '#5B9F5B', angle: -90 + 90 },
  { axis: 'Surprise', emotions: ['amazement', 'surprise', 'distraction'] as PlutchikEmotion[], color: '#5BB5CF', angle: -90 + 135 },
  { axis: 'Sadness', emotions: ['grief', 'sadness', 'pensiveness'] as PlutchikEmotion[], color: '#5B7BCF', angle: -90 + 180 },
  { axis: 'Disgust', emotions: ['loathing', 'disgust', 'boredom'] as PlutchikEmotion[], color: '#9B5BCF', angle: -90 + 225 },
  { axis: 'Anger', emotions: ['rage', 'anger', 'annoyance'] as PlutchikEmotion[], color: '#CF5B5B', angle: -90 + 270 },
  { axis: 'Anticipation', emotions: ['vigilance', 'anticipation', 'interest'] as PlutchikEmotion[], color: '#CFAA5B', angle: -90 + 315 },
] as const;

// Slider emoji markers
const SLIDER_EMOJIS = [
  { emoji: '\u{1F61E}', score: 1, label: 'Awful' },
  { emoji: '\u{1F615}', score: 3, label: 'Bad' },
  { emoji: '\u{1F610}', score: 5, label: 'Meh' },
  { emoji: '\u{1F60A}', score: 7, label: 'Good' },
  { emoji: '\u{1F604}', score: 9, label: 'Amazing' },
  { emoji: '\u{1F929}', score: 10, label: 'Incredible' },
];

// Activity icon map
const ACTIVITY_ICONS: Record<string, string> = {
  exercise: '\u{1F3CB}',
  social: '\u{1F465}',
  work: '\u{1F4BC}',
  sleep: '\u{1F319}',
  outdoors: '\u{1F333}',
  nutrition: '\u{1F957}',
  reading: '\u{1F4DA}',
  meditation: '\u{1F9D8}',
  music: '\u{1F3B5}',
  gaming: '\u{1F3AE}',
  family: '\u{1F46A}',
  creative: '\u{1F3A8}',
  travel: '\u{2708}\u{FE0F}',
  shopping: '\u{1F6CD}\u{FE0F}',
  cleaning: '\u{1F9F9}',
};

export default function LogMoodPage() {
  const router = useRouter();
  const [score, setScore] = useState(5);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [selectedEmotions, setSelectedEmotions] = useState<Map<PlutchikEmotion, number>>(new Map());
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [activities, setActivities] = useState<MoodActivity[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await initDefaultActivities();
        const acts = await fetchActivities();
        if (!cancelled) setActivities(acts);
      } catch {
        if (!cancelled) setError('Failed to load activities');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const toggleEmotion = useCallback((emotion: PlutchikEmotion) => {
    setSelectedEmotions((prev) => {
      const next = new Map(prev);
      if (next.has(emotion)) next.delete(emotion);
      else next.set(emotion, 2);
      return next;
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await addEntry({
        score,
        note: note.trim() || undefined,
        emotions: Array.from(selectedEmotions.entries()).map(([emotion, intensity]) => ({ emotion, intensity })),
        activityIds: Array.from(selectedActivities),
      });
      setSaved(true);
      setTimeout(() => router.push('/mood'), 800);
    } catch {
      setError('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const displayScore = hoveredScore ?? score;
  const descriptor = MoodScoreDescriptors[displayScore];
  const scoreColor = SCORE_COLORS[displayScore] ?? ACCENT_RAW;

  const selectedEmotionLabels = useMemo(() => {
    return Array.from(selectedEmotions.keys()).map(
      (e) => e.charAt(0).toUpperCase() + e.slice(1)
    );
  }, [selectedEmotions]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24, maxWidth: 760, margin: '0 auto' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            height: i === 2 ? 320 : 140,
            borderRadius: 20,
            background: 'rgba(255,255,255,0.04)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <h2 style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 800,
          color: TEXT,
          lineHeight: 1.2,
        }}>
          How are you feeling?
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 15, color: TEXT_SEC }}>
          Log your emotional state right now.
        </p>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 12,
          background: 'rgba(255,69,58,0.12)',
          border: '1px solid rgba(255,69,58,0.25)',
          color: 'var(--danger, #FFB4AB)',
          fontSize: 14,
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {/* ── Mood Intensity Slider ──────────────────────────────────── */}
      <section style={{
        padding: 28,
        borderRadius: 20,
        background: SURFACE_ELEVATED,
        border: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: TEXT_SEC,
          }}>
            Mood Intensity
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
              {displayScore}
            </span>
            <span style={{ fontSize: 16, color: TEXT_SEC, fontWeight: 500 }}>/10</span>
          </div>
        </div>

        {/* Custom slider track */}
        <div
          ref={sliderRef}
          style={{
            position: 'relative',
            height: 44,
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onMouseDown={(e) => {
            const rect = sliderRef.current?.getBoundingClientRect();
            if (!rect) return;
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            setScore(Math.max(1, Math.min(10, Math.round(ratio * 9) + 1)));
          }}
        >
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            onMouseMove={(e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              setHoveredScore(Math.max(1, Math.min(10, Math.round(ratio * 9) + 1)));
            }}
            onMouseLeave={() => setHoveredScore(null)}
            style={{
              width: '100%',
              accentColor: scoreColor,
              height: 6,
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Emoji faces row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
          padding: '0 2px',
        }}>
          {SLIDER_EMOJIS.map((item) => {
            const isActive = Math.abs(score - item.score) <= 1;
            return (
              <div
                key={item.score}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  transition: 'transform 150ms ease',
                  transform: isActive ? 'scale(1.2)' : 'scale(1)',
                }}
                onClick={() => setScore(item.score)}
                title={`${item.label} (${item.score})`}
              >
                <span style={{
                  fontSize: isActive ? 28 : 22,
                  opacity: isActive ? 1 : 0.35,
                  transition: 'all 200ms ease',
                  filter: isActive ? 'none' : 'grayscale(50%)',
                }}>
                  {item.emoji}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  color: isActive ? scoreColor : TEXT_SEC,
                  opacity: isActive ? 1 : 0.5,
                  transition: 'all 200ms ease',
                }}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Descriptor label */}
        <div style={{
          textAlign: 'center',
          marginTop: 16,
          padding: '10px 20px',
          borderRadius: 999,
          background: `${scoreColor}18`,
          display: 'inline-flex',
          alignSelf: 'center',
          margin: '16px auto 0',
          width: 'fit-content',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: scoreColor, letterSpacing: 0.5 }}>
            {descriptor?.label ?? `Score ${displayScore}`}
          </span>
        </div>
      </section>

      {/* ── Plutchik Emotion Wheel ─────────────────────────────────── */}
      <section style={{
        padding: 28,
        borderRadius: 20,
        background: SURFACE_ELEVATED,
        border: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: TEXT_SEC,
              display: 'block',
              marginBottom: 4,
            }}>
              Emotion Mapping
            </span>
            {selectedEmotionLabels.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {selectedEmotionLabels.map((label) => (
                  <span key={label} style={{
                    padding: '4px 12px',
                    borderRadius: 999,
                    background: ACCENT_DIM,
                    border: `1px solid ${ACCENT_BORDER}`,
                    color: ACCENT,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                  }}>
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SVG Plutchik Wheel */}
        <PlutchikWheelSVG
          selectedEmotions={selectedEmotions}
          onToggleEmotion={toggleEmotion}
        />

        {/* Flat emotion chip grid as alternative */}
        <div style={{ marginTop: 20, display: 'grid', gap: 10 }}>
          {PLUTCHIK_AXES.map((axis) => (
            <div key={axis.axis}>
              <p style={{
                margin: '0 0 6px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: axis.color,
                opacity: 0.8,
              }}>
                {axis.axis}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {axis.emotions.map((emotion) => {
                  const isSelected = selectedEmotions.has(emotion);
                  return (
                    <button
                      key={emotion}
                      type="button"
                      onClick={() => toggleEmotion(emotion)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 999,
                        border: `1px solid ${isSelected ? axis.color : BORDER}`,
                        background: isSelected ? `${axis.color}22` : 'transparent',
                        color: isSelected ? axis.color : TEXT_SEC,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {emotion}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Activities Grid ────────────────────────────────────────── */}
      <section style={{
        padding: 28,
        borderRadius: 20,
        background: SURFACE_ELEVATED,
        border: `1px solid ${BORDER}`,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: TEXT_SEC,
          display: 'block',
          marginBottom: 16,
        }}>
          What influenced this?
        </span>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
        }}>
          {activities.map((a) => {
            const isSelected = selectedActivities.has(a.id);
            const icon = a.icon || ACTIVITY_ICONS[a.name.toLowerCase()] || '\u{1F4CC}';
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setSelectedActivities((prev) => {
                    const next = new Set(prev);
                    if (next.has(a.id)) next.delete(a.id);
                    else next.add(a.id);
                    return next;
                  });
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: '16px 8px',
                  borderRadius: 14,
                  border: `1px solid ${isSelected ? ACCENT_BORDER : BORDER}`,
                  background: isSelected ? ACCENT_DIM : GLASS,
                  color: isSelected ? TEXT : TEXT_SEC,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                <span style={{ fontSize: 22 }}>{icon}</span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}>
                  {a.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Attachments ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Photo Upload */}
        <section style={{
          padding: 28,
          borderRadius: 20,
          background: SURFACE_ELEVATED,
          border: `1px dashed rgba(255,255,255,0.1)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          minHeight: 140,
          cursor: 'pointer',
          transition: 'border-color 200ms ease, background 200ms ease',
        }}>
          <span style={{ fontSize: 32, opacity: 0.5 }}>{'\u{1F4F7}'}</span>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: TEXT_SEC,
          }}>
            Add Photo
          </span>
          <span style={{ fontSize: 12, color: TEXT_SEC, opacity: 0.6 }}>
            Drag and drop or click to upload
          </span>
        </section>

        {/* Voice Memo */}
        <section style={{
          padding: 28,
          borderRadius: 20,
          background: SURFACE_ELEVATED,
          border: `1px dashed rgba(255,255,255,0.1)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          minHeight: 140,
          cursor: 'pointer',
          transition: 'border-color 200ms ease, background 200ms ease',
        }}>
          <span style={{ fontSize: 32, opacity: 0.5 }}>{'\u{1F3A4}'}</span>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: TEXT_SEC,
          }}>
            Voice Memo
          </span>
          <span style={{ fontSize: 12, color: TEXT_SEC, opacity: 0.6 }}>
            Record a voice note
          </span>
        </section>
      </div>

      {/* ── Note ───────────────────────────────────────────────────── */}
      <section style={{
        padding: 28,
        borderRadius: 20,
        background: SURFACE_ELEVATED,
        border: `1px solid ${BORDER}`,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: TEXT_SEC,
          display: 'block',
          marginBottom: 12,
        }}>
          Note (optional)
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          rows={4}
          placeholder="What's on your mind? Jot down a few words about how you're feeling..."
          style={{
            width: '100%',
            padding: 16,
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            background: BACKGROUND,
            color: TEXT,
            fontSize: 14,
            lineHeight: 1.6,
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <span style={{ fontSize: 12, color: TEXT_SEC }}>{note.length}/500</span>
        </div>
      </section>

      {/* ── Action Buttons ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            padding: '14px 28px',
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            background: 'transparent',
            color: TEXT_SEC,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || saved}
          style={{
            padding: '14px 40px',
            borderRadius: 12,
            border: 'none',
            background: saved ? 'var(--success, #30D158)' : `linear-gradient(135deg, ${ACCENT_RAW}, #E8822A)`,
            color: '#0A0A0F',
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: 0.5,
            cursor: saving || saved ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            transition: 'all 200ms ease',
            boxShadow: saved ? 'none' : `0 4px 20px rgba(251,146,60,0.3)`,
          }}
        >
          {saved ? '\u2713 Saved!' : saving ? 'Saving...' : 'Save Mood Entry'}
        </button>
      </div>
    </div>
  );
}

// ── Plutchik Wheel SVG Component ──────────────────────────────────────

function PlutchikWheelSVG({
  selectedEmotions,
  onToggleEmotion,
}: {
  selectedEmotions: Map<PlutchikEmotion, number>;
  onToggleEmotion: (emotion: PlutchikEmotion) => void;
}) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const size = 340;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 130;
  const midR = 85;
  const innerR = 45;
  const labelR = outerR + 24;
  const segmentAngle = 360 / PLUTCHIK_AXES.length;

  const degToRad = (deg: number) => (deg * Math.PI) / 180;

  const getPoint = (angleDeg: number, r: number) => ({
    x: cx + r * Math.cos(degToRad(angleDeg)),
    y: cy + r * Math.sin(degToRad(angleDeg)),
  });

  const makeArcPath = (startAngle: number, endAngle: number, rOuter: number, rInner: number) => {
    const outerStart = getPoint(startAngle, rOuter);
    const outerEnd = getPoint(endAngle, rOuter);
    const innerStart = getPoint(startAngle, rInner);
    const innerEnd = getPoint(endAngle, rInner);
    const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
      'Z',
    ].join(' ');
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: 'visible' }}
      >
        {/* Render segments for each axis: 3 rings (outer=intense, mid=primary, inner=mild) */}
        {PLUTCHIK_AXES.map((axis, i) => {
          const startAngle = axis.angle - segmentAngle / 2;
          const endAngle = axis.angle + segmentAngle / 2;

          const rings = [
            { emotions: [axis.emotions[0]], rOuter: outerR, rInner: midR, opacity: 0.9 },
            { emotions: [axis.emotions[1]], rOuter: midR, rInner: innerR, opacity: 0.65 },
            { emotions: [axis.emotions[2]], rOuter: innerR, rInner: 15, opacity: 0.4 },
          ];

          return rings.map((ring, ri) => {
            const emotion = ring.emotions[0];
            const isSelected = selectedEmotions.has(emotion);
            const isHovered = hoveredSegment === emotion;
            const path = makeArcPath(startAngle, endAngle, ring.rOuter, ring.rInner);

            return (
              <path
                key={`${axis.axis}-${ri}`}
                d={path}
                fill={isSelected ? `${axis.color}55` : isHovered ? `${axis.color}30` : `${axis.color}15`}
                stroke={isSelected ? axis.color : isHovered ? `${axis.color}80` : 'rgba(255,255,255,0.06)'}
                strokeWidth={isSelected ? 2 : 1}
                style={{ cursor: 'pointer', transition: 'fill 150ms ease, stroke 150ms ease' }}
                onClick={() => onToggleEmotion(emotion)}
                onMouseEnter={() => setHoveredSegment(emotion)}
                onMouseLeave={() => setHoveredSegment(null)}
              />
            );
          });
        })}

        {/* Radial separator lines */}
        {PLUTCHIK_AXES.map((axis) => {
          const startAngle = axis.angle - segmentAngle / 2;
          const inner = getPoint(startAngle, 15);
          const outer = getPoint(startAngle, outerR);
          return (
            <line
              key={`line-${axis.axis}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Axis labels */}
        {PLUTCHIK_AXES.map((axis) => {
          const hasSelected = axis.emotions.some((e) => selectedEmotions.has(e));
          const pos = getPoint(axis.angle, labelR);
          return (
            <text
              key={`label-${axis.axis}`}
              x={pos.x}
              y={pos.y}
              fill={hasSelected ? axis.color : 'rgba(255,255,255,0.4)'}
              fontSize={10}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
              letterSpacing="1"
              style={{ transition: 'fill 200ms ease' }}
            >
              {axis.axis.toUpperCase()}
            </text>
          );
        })}

        {/* Hover tooltip */}
        {hoveredSegment && (() => {
          const axis = PLUTCHIK_AXES.find((a) => a.emotions.includes(hoveredSegment as PlutchikEmotion));
          if (!axis) return null;
          return (
            <text
              x={cx}
              y={cy}
              fill="rgba(255,255,255,0.9)"
              fontSize={13}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ textTransform: 'capitalize' }}
            >
              {hoveredSegment}
            </text>
          );
        })()}
      </svg>
    </div>
  );
}
