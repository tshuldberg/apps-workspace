'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchPet, addPet, editPetStats, editPetName, addPetActivity,
  fetchPetActivities, fetchPetActivitiesToday, fetchEntryCount,
} from '../actions';
import {
  feedPet, getEvolutionStage, EVOLUTION_NAMES, EVOLUTION_THRESHOLDS,
  HATCH_MOOD_ENTRIES_REQUIRED, type Pet,
} from '@mylife/mood';

const ACCENT = 'var(--accent-mood)';
const ACCENT_DIM = 'var(--accent-mood-dim, rgba(251,146,60,0.15))';
const ACCENT_BORDER = 'var(--accent-mood-border, rgba(251,146,60,0.25))';
const SURFACE_ELEVATED = 'var(--surface-elevated, #2A292F)';
const BORDER = 'var(--border)';
const TEXT_SEC = 'var(--text-secondary)';
const GLASS = 'var(--glass)';

const WARDROBE_ITEMS = [
  { id: 'top_hat', icon: '\uD83C\uDFA9', name: "Gentleman's Visit", unlockLevel: 0 },
  { id: 'glasses', icon: '\uD83D\uDC53', name: 'Wise Eyes', unlockLevel: 2 },
  { id: 'scarf', icon: '\uD83E\uDDE3', name: 'Cozy Wrap', unlockLevel: 1 },
  { id: 'bow', icon: '\uD83C\uDF80', name: 'Pretty Bow', unlockLevel: 3 },
  { id: 'crown', icon: '\uD83D\uDC51', name: 'Royal Crown', unlockLevel: 5 },
  { id: 'flower', icon: '\uD83C\uDF3B', name: 'Sunflower', unlockLevel: 1 },
  { id: 'shield', icon: '\uD83D\uDEE1\uFE0F', name: 'Guardian', unlockLevel: 4 },
  { id: 'star_pin', icon: '\u2B50', name: 'Star Pin', unlockLevel: 2 },
  { id: 'cape', icon: '\uD83E\uDDB8', name: 'Hero Cape', unlockLevel: 4 },
  { id: 'bell', icon: '\uD83D\uDD14', name: 'Jingle Bell', unlockLevel: 0 },
  { id: 'gem', icon: '\uD83D\uDC8E', name: 'Soul Gem', unlockLevel: 5 },
  { id: 'leaf', icon: '\uD83C\uDF43', name: 'Autumn Leaf', unlockLevel: 3 },
] as const;

const ACTIVITY_DISPLAY: Record<string, { icon: string; label: string }> = {
  mood_log: { icon: '\uD83C\uDF73', label: 'Morning Meal' },
  breathing: { icon: '\uD83E\uDDD8', label: 'Spirit Meditation' },
  meditation: { icon: '\u2728', label: 'Deep Rest Cycle' },
  journal: { icon: '\uD83D\uDCD3', label: 'Story Time' },
  workout: { icon: '\uD83C\uDFC3', label: 'Play Session' },
  experiment: { icon: '\uD83E\uDDEA', label: 'Lab Snack' },
  streak_bonus: { icon: '\uD83C\uDF89', label: 'Joyful Treat' },
};

type PetActivityType = 'mood_log' | 'breathing' | 'meditation' | 'journal' | 'workout' | 'experiment' | 'streak_bonus';

interface PetActivityRecord {
  id: string;
  activityType: string;
  happinessDelta: number;
  experienceDelta: number;
  createdAt: string;
}

export default function PetPage() {
  const [pet, setPet] = useState<Pet | null>(null);
  const [activities, setActivities] = useState<PetActivityRecord[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedMsg, setFeedMsg] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [equippedItem, setEquippedItem] = useState('top_hat');
  const [hoveredWardrobe, setHoveredWardrobe] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, count] = await Promise.all([fetchPet(), fetchEntryCount()]);
      setPet(p);
      setEntryCount(count);
      if (p) {
        const acts = await fetchPetActivities(20);
        setActivities(acts);
      }
    } catch {
      setError('Failed to load pet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleHatch = async (name: string) => {
    try {
      const result = await addPet(name || 'Buddy');
      setPet(result);
      void load();
    } catch {
      setError('Failed to hatch pet');
    }
  };

  const handleFeed = async (type: PetActivityType) => {
    if (!pet) return;
    let todayCount = 0;
    try { todayCount = await fetchPetActivitiesToday(type); } catch { /* default 0 */ }
    const result = feedPet(pet, type, todayCount);
    if (result.dailyLimitReached) {
      setFeedMsg('Daily limit reached!');
      setTimeout(() => setFeedMsg(null), 3000);
      return;
    }
    if (result.happinessDelta === 0 && result.experienceDelta === 0) {
      setFeedMsg('Cannot feed right now');
      setTimeout(() => setFeedMsg(null), 3000);
      return;
    }
    try {
      await addPetActivity(type, result.happinessDelta, result.experienceDelta, 'mood');
      await editPetStats(result.newHappiness, result.newExperience, result.newEvolutionStage, pet.totalFeeds + 1, result.justHatched ? new Date().toISOString() : pet.hatchedAt);
      setFeedMsg(`+${result.happinessDelta} happiness, +${result.experienceDelta} XP`);
      setTimeout(() => setFeedMsg(null), 3000);
      void load();
    } catch {
      setError('Failed to feed pet');
    }
  };

  const handleRename = async () => {
    if (!newName.trim()) return;
    try {
      await editPetName(newName.trim());
      setRenaming(false);
      setNewName('');
      void load();
    } catch {
      setError('Failed to rename');
    }
  };

  if (loading) return <PetSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={() => void load()} />;

  // ── Adopt / Hatch Screen ──────────────────────────────────────────
  if (!pet) {
    return <AdoptScreen entryCount={entryCount} onHatch={handleHatch} />;
  }

  const stage = getEvolutionStage(pet.experience, pet.evolutionStage);
  const stageName = EVOLUTION_NAMES[stage] ?? 'Unknown';
  const petEmoji = stage === 0 ? '\uD83E\uDD5A' : stage === 1 ? '\uD83D\uDC23' : stage === 2 ? '\uD83D\uDC25' : '\uD83E\uDD89';
  const nextStage = stage + 1;
  const nextThreshold = EVOLUTION_THRESHOLDS[nextStage];
  const expProgress = nextThreshold ? Math.min(pet.experience / nextThreshold, 1) : 1;
  const petAge = Math.floor((Date.now() - new Date(pet.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {renaming ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={pet.name}
                autoFocus
                style={{
                  padding: '8px 14px', borderRadius: 10, border: `1px solid ${BORDER}`,
                  background: 'var(--background)', color: 'var(--text)', fontSize: 18, fontWeight: 700, width: 180,
                }}
              />
              <button onClick={() => void handleRename()} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: ACCENT, color: '#0A0A0F', fontWeight: 600, cursor: 'pointer' }}>Save</button>
              <button onClick={() => setRenaming(false)} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SEC, cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <>
              <h1
                onClick={() => setRenaming(true)}
                style={{ margin: 0, fontSize: 26, fontWeight: 700, cursor: 'pointer' }}
                title="Click to rename"
              >
                Meet {pet.name}
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                Your emotional sanctuary companion
              </p>
            </>
          )}
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: 8, background: ACCENT_DIM,
          border: `1px solid ${ACCENT_BORDER}`,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: ACCENT }}>
            MOOD GARDEN LEVEL {stage + 1}
          </span>
        </div>
      </div>

      {/* Three-Column Layout: Stats | Pet | Wardrobe */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 260px', gap: 20 }}>
        {/* Left: Companion Stats */}
        <div style={{
          padding: 24, borderRadius: 20, background: SURFACE_ELEVATED,
          border: `1px solid ${BORDER}`, display: 'grid', gap: 16, alignContent: 'start',
        }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: ACCENT }}>
            COMPANION STATS
          </p>

          {/* Happiness */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Happiness</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{pet.happiness}%</span>
            </div>
            <ProgressBar value={pet.happiness} max={100} color={pet.happiness > 60 ? 'var(--success)' : pet.happiness > 30 ? ACCENT : 'var(--danger)'} />
          </div>

          {/* Spirit Energy */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Spirit Energy</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{Math.round(expProgress * 100)}%</span>
            </div>
            <ProgressBar value={expProgress * 100} max={100} color="#8BCFF0" />
          </div>

          {/* Inline Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: 12, borderRadius: 12, background: GLASS, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 18 }}>{'\uD83D\uDCC5'}</p>
              <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700 }}>{petAge} Days</p>
              <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, color: TEXT_SEC }}>AGE</p>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: GLASS, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 18 }}>{'\uD83C\uDF1F'}</p>
              <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700 }}>{stageName}</p>
              <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, color: TEXT_SEC }}>STAGE</p>
            </div>
          </div>

          {/* Evolution Stage Tracker */}
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: TEXT_SEC }}>
              EVOLUTION STAGE
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
              {Object.entries(EVOLUTION_NAMES).map(([stageKey, name]) => {
                const stageNum = Number(stageKey);
                const isCurrent = stageNum === stage;
                const isPast = stageNum < stage;
                return (
                  <div key={stageKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isCurrent ? ACCENT : isPast ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.08)',
                    }}>
                      <span style={{ fontSize: 11, color: 'var(--text)' }}>
                        {isPast ? '\u2713' : stageNum === 0 ? '\uD83E\uDD5A' : stageNum}
                      </span>
                    </div>
                    <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const, color: isCurrent ? ACCENT : 'rgba(255,255,255,0.4)' }}>
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
            {nextThreshold != null && (
              <div style={{ marginTop: 10 }}>
                <ProgressBar value={pet.experience} max={nextThreshold} color={ACCENT} />
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                  {pet.experience} / {nextThreshold} XP to {EVOLUTION_NAMES[nextStage]}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Center: Pet Display + Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          {/* Pet Circle */}
          <div style={{
            width: 240, height: 240, borderRadius: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.04)',
          }}>
            <div style={{
              width: 210, height: 210, borderRadius: 105, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)',
            }}>
              <span style={{ fontSize: 96 }}>{petEmoji}</span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.5)' }}>
            {stageName}
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 320 }}>
            <button
              onClick={() => void handleFeed('mood_log')}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
                background: ACCENT, color: '#0A0A0F', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              {'\uD83C\uDF7D'} Feed {pet.name}
            </button>
            <button
              onClick={() => void handleFeed('workout')}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 14,
                border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_DIM,
                color: ACCENT, fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              {'\uD83C\uDFAE'} Play Session
            </button>
          </div>

          {/* Feed Message */}
          {feedMsg && (
            <div style={{
              padding: '10px 20px', borderRadius: 10,
              background: feedMsg.startsWith('+') ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)',
              border: `1px solid ${feedMsg.startsWith('+') ? 'rgba(48,209,88,0.3)' : 'rgba(255,69,58,0.3)'}`,
              color: feedMsg.startsWith('+') ? 'var(--success)' : 'var(--danger)',
              fontSize: 14, fontWeight: 600, textAlign: 'center',
            }}>
              {feedMsg}
            </div>
          )}

          {/* Hatching Progress (if egg) */}
          {stage === 0 && (
            <div style={{
              width: '100%', maxWidth: 320, padding: 16, borderRadius: 14,
              background: GLASS, border: `1px solid ${BORDER}`, textAlign: 'center',
            }}>
              <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: ACCENT }}>
                HATCHING PROGRESS
              </p>
              <ProgressBar value={entryCount} max={HATCH_MOOD_ENTRIES_REQUIRED} color={ACCENT} />
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                Log {Math.max(0, HATCH_MOOD_ENTRIES_REQUIRED - entryCount)} more moods to hatch!
              </p>
            </div>
          )}
        </div>

        {/* Right: Wardrobe */}
        <div style={{
          padding: 24, borderRadius: 20, background: SURFACE_ELEVATED,
          border: `1px solid ${BORDER}`, display: 'grid', gap: 14, alignContent: 'start',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: ACCENT }}>
              WARDROBE
            </p>
            <span style={{ fontSize: 12, color: TEXT_SEC }}>{WARDROBE_ITEMS.length} Items</span>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
          }}>
            {WARDROBE_ITEMS.map((item) => {
              const locked = stage < item.unlockLevel;
              const equipped = equippedItem === item.id;
              const hovered = hoveredWardrobe === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => !locked && setEquippedItem(item.id)}
                  onMouseEnter={() => setHoveredWardrobe(item.id)}
                  onMouseLeave={() => setHoveredWardrobe(null)}
                  style={{
                    position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 14,
                    border: equipped ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
                    background: equipped ? ACCENT_DIM : hovered && !locked ? 'rgba(255,255,255,0.06)' : GLASS,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.4 : 1,
                    transition: 'all 150ms',
                  }}
                  title={`${item.name}${locked ? ` (unlock at level ${item.unlockLevel + 1})` : ''}${equipped ? ' (equipped)' : ''}`}
                >
                  <span style={{ fontSize: 24 }}>{item.icon}</span>
                  {locked && (
                    <span style={{ position: 'absolute', bottom: 4, fontSize: 10 }}>{'\uD83D\uDD12'}</span>
                  )}
                  {equipped && (
                    <span style={{
                      position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9,
                      background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#1a1008', fontWeight: 700,
                    }}>
                      {'\u2713'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Feeding & Care History Timeline */}
      {activities.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: TEXT_SEC }}>
                KITCHEN LOG
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 600 }}>Feeding & Care History</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {activities.slice(0, 10).map((a) => {
              const display = ACTIVITY_DISPLAY[a.activityType] ?? { icon: '\u2753', label: a.activityType };
              return (
                <div key={a.id} style={{
                  minWidth: 130, padding: 16, borderRadius: 16, background: SURFACE_ELEVATED,
                  border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 6, flexShrink: 0,
                }}>
                  <span style={{ fontSize: 28 }}>{display.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{display.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: 'rgba(255,255,255,0.4)' }}>
                    {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {a.happinessDelta !== 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: a.happinessDelta > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {a.happinessDelta > 0 ? '+' : ''}{a.happinessDelta} hp
                      </span>
                    )}
                    {a.experienceDelta !== 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT }}>
                        +{a.experienceDelta} xp
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Adopt Screen ────────────────────────────────────────────────────

function AdoptScreen({ entryCount, onHatch }: { entryCount: number; onHatch: (name: string) => void }) {
  const [name, setName] = useState('');
  const progress = Math.min(100, (entryCount / HATCH_MOOD_ENTRIES_REQUIRED) * 100);
  const canHatch = entryCount >= HATCH_MOOD_ENTRIES_REQUIRED;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 32px', gap: 20 }}>
      <div style={{
        width: 140, height: 140, borderRadius: 70, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontSize: 64 }}>{'\uD83E\uDD5A'}</span>
      </div>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Adopt Your Companion</h2>
      <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC, textAlign: 'center', maxWidth: 400 }}>
        Your pet grows as you log moods, breathe, and meditate.
      </p>
      {!canHatch ? (
        <>
          <div style={{ width: '60%', maxWidth: 300 }}>
            <ProgressBar value={entryCount} max={HATCH_MOOD_ENTRIES_REQUIRED} color={ACCENT} />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>{entryCount} / {HATCH_MOOD_ENTRIES_REQUIRED} entries to hatch</p>
        </>
      ) : (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Choose a name..."
            maxLength={20}
            style={{
              width: 220, padding: 14, borderRadius: 12, border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.06)', color: 'var(--text)', fontSize: 16,
              textAlign: 'center', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => void onHatch(name)}
            style={{
              padding: '14px 40px', borderRadius: 999, border: 'none', background: ACCENT,
              color: '#0A0A0F', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}
          >
            Hatch Companion
          </button>
        </>
      )}
    </div>
  );
}

// ── Progress Bar ────────────────────────────────────────────────────

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'var(--glass-strong, rgba(255,255,255,0.08))', overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 300ms' }} />
    </div>
  );
}

// ── Skeleton / Error ────────────────────────────────────────────────

function PetSkeleton() {
  const pulse = { borderRadius: 20, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' };
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ ...pulse, height: 60 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 260px', gap: 20 }}>
        <div style={{ ...pulse, height: 400 }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{ ...pulse, width: 240, height: 240, borderRadius: 120 }} />
          <div style={{ ...pulse, height: 48, width: 320 }} />
        </div>
        <div style={{ ...pulse, height: 400 }} />
      </div>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', gap: 16 }}>
      <span style={{ fontSize: 48 }}>{'\uD83E\uDD89'}</span>
      <p style={{ margin: 0, fontSize: 15 }}>{message}</p>
      <button onClick={onRetry} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: ACCENT, color: '#0A0A0F', fontWeight: 700, cursor: 'pointer' }}>Retry</button>
    </div>
  );
}
