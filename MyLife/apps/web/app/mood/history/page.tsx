'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  fetchEntries,
  removeEntry,
  fetchEmotionTagsForEntry,
  fetchTopEmotions,
} from '../actions';
import { MoodScoreDescriptors, type MoodEntry, type MoodEmotionTag } from '@mylife/mood';

// ── Obsidian Noir Tokens ──────────────────────────────────────────────

const ACCENT = 'var(--accent-mood)';
const ACCENT_RAW = '#FB923C';
const ACCENT_DIM = 'rgba(251,146,60,0.12)';
const ACCENT_BORDER = 'rgba(251,146,60,0.25)';
const SURFACE_ELEVATED = 'var(--surface-elevated, #2A292F)';
const BORDER = 'var(--border)';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const GLASS_STRONG = 'var(--glass-strong, rgba(255,255,255,0.08))';
const BACKGROUND = 'var(--background, #131318)';

const SCORE_COLORS: Record<number, string> = {
  1: '#FF453A', 2: '#FF6B5A', 3: '#FF8C42', 4: '#FFA833', 5: '#D4A04A',
  6: '#A8B84A', 7: '#7ACC52', 8: '#4AD86A', 9: '#30D158', 10: '#28CD6A',
};

const PAGE_SIZE = 30;

type SortField = 'date' | 'score';
type SortDir = 'desc' | 'asc';

interface EnrichedEntry extends MoodEntry {
  emotions: MoodEmotionTag[];
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<EnrichedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minScore, setMinScore] = useState(1);
  const [maxScore, setMaxScore] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState<Set<string>>(new Set());
  const [topEmotions, setTopEmotions] = useState<string[]>([]);

  // Sort
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Load top emotions for filter sidebar
  useEffect(() => {
    async function loadTopEmotions() {
      try {
        const now = new Date().toISOString().slice(0, 10);
        const past = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
        const emotions = await fetchTopEmotions(past, now, 12);
        setTopEmotions(emotions.map((e: { emotion: string }) => e.emotion));
      } catch {
        // Non-critical, ignore
      }
    }
    void loadTopEmotions();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (startDate) filter.startDate = startDate;
      if (endDate) filter.endDate = endDate;
      if (minScore > 1) filter.minScore = minScore;
      if (maxScore < 10) filter.maxScore = maxScore;

      const result = await fetchEntries(filter as Parameters<typeof fetchEntries>[0]);

      // Enrich with emotion tags
      const enriched: EnrichedEntry[] = [];
      for (const entry of result) {
        try {
          const emotions = await fetchEmotionTagsForEntry(entry.id);
          enriched.push({ ...entry, emotions });
        } catch {
          enriched.push({ ...entry, emotions: [] });
        }
      }

      setEntries(enriched);
    } catch {
      setError('Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, [page, startDate, endDate, minScore, maxScore]);

  useEffect(() => { void load(); }, [load]);

  // Client-side filtering and sorting
  const filtered = useMemo(() => {
    let result = [...entries];

    // Search filter
    if (searchQuery.length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          (e.note?.toLowerCase().includes(q)) ||
          e.emotions.some((em) => em.emotion.toLowerCase().includes(q)),
      );
    }

    // Emotion filter
    if (selectedEmotions.size > 0) {
      result = result.filter((e) =>
        e.emotions.some((em) => selectedEmotions.has(em.emotion)),
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp: number;
      if (sortField === 'score') {
        cmp = a.score - b.score;
      } else {
        cmp = a.createdAt.localeCompare(b.createdAt);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [entries, searchQuery, selectedEmotions, sortField, sortDir]);

  // Group by date for timeline view
  const grouped = useMemo(() => {
    const groups = new Map<string, EnrichedEntry[]>();
    for (const entry of filtered) {
      const list = groups.get(entry.date) ?? [];
      list.push(entry);
      groups.set(entry.date, list);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const handleDelete = async (id: string) => {
    try {
      await removeEntry(id);
      setConfirmDelete(null);
      void load();
    } catch {
      setError('Failed to delete entry');
    }
  };

  const toggleEmotion = useCallback((emotion: string) => {
    setSelectedEmotions((prev) => {
      const next = new Set(prev);
      if (next.has(emotion)) next.delete(emotion);
      else next.add(emotion);
      return next;
    });
    setPage(0);
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }, [sortField]);

  const clearFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setMinScore(1);
    setMaxScore(10);
    setSearchQuery('');
    setSelectedEmotions(new Set());
    setPage(0);
  }, []);

  const hasActiveFilters = startDate || endDate || minScore > 1 || maxScore < 10 || searchQuery || selectedEmotions.size > 0;

  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  if (loading && entries.length === 0) {
    return (
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ width: 260, flexShrink: 0, display: 'grid', gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 60, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
        <div style={{ flex: 1, display: 'grid', gap: 12 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ height: 80, borderRadius: 16, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* ── Left Sidebar: Filters ──────────────────────────────────── */}
      <aside style={{
        width: 260,
        flexShrink: 0,
        position: 'sticky',
        top: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Search */}
        <div style={{
          padding: 16,
          borderRadius: 16,
          background: SURFACE_ELEVATED,
          border: `1px solid ${BORDER}`,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 10,
            background: BACKGROUND,
            border: `1px solid ${BORDER}`,
          }}>
            <span style={{ fontSize: 14, opacity: 0.5 }}>{'\u{1F50D}'}</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              placeholder="Search notes..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: TEXT,
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Date Range */}
        <div style={{
          padding: 16,
          borderRadius: 16,
          background: SURFACE_ELEVATED,
          border: `1px solid ${BORDER}`,
        }}>
          <span style={filterLabelStyle}>Date Range</span>
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <div>
              <span style={{ fontSize: 11, color: TEXT_SEC, marginBottom: 4, display: 'block' }}>From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                style={dateInputStyle}
              />
            </div>
            <div>
              <span style={{ fontSize: 11, color: TEXT_SEC, marginBottom: 4, display: 'block' }}>To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                style={dateInputStyle}
              />
            </div>
          </div>
        </div>

        {/* Score Range */}
        <div style={{
          padding: 16,
          borderRadius: 16,
          background: SURFACE_ELEVATED,
          border: `1px solid ${BORDER}`,
        }}>
          <span style={filterLabelStyle}>Score Range</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, color: TEXT_SEC }}>Min</span>
              <input
                type="range"
                min={1}
                max={10}
                value={minScore}
                onChange={(e) => { setMinScore(Number(e.target.value)); setPage(0); }}
                style={{ width: '100%', accentColor: ACCENT_RAW }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: SCORE_COLORS[minScore] }}>{minScore}</span>
            </div>
            <span style={{ color: TEXT_SEC, fontSize: 12, marginTop: 14 }}>-</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, color: TEXT_SEC }}>Max</span>
              <input
                type="range"
                min={1}
                max={10}
                value={maxScore}
                onChange={(e) => { setMaxScore(Number(e.target.value)); setPage(0); }}
                style={{ width: '100%', accentColor: ACCENT_RAW }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: SCORE_COLORS[maxScore] }}>{maxScore}</span>
            </div>
          </div>
        </div>

        {/* Emotion Filter */}
        {topEmotions.length > 0 && (
          <div style={{
            padding: 16,
            borderRadius: 16,
            background: SURFACE_ELEVATED,
            border: `1px solid ${BORDER}`,
          }}>
            <span style={filterLabelStyle}>Emotions</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {topEmotions.map((emotion) => {
                const isSelected = selectedEmotions.has(emotion);
                return (
                  <button
                    key={emotion}
                    type="button"
                    onClick={() => toggleEmotion(emotion)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      border: `1px solid ${isSelected ? ACCENT_BORDER : BORDER}`,
                      background: isSelected ? ACCENT_DIM : 'transparent',
                      color: isSelected ? ACCENT : TEXT_SEC,
                      fontSize: 12,
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
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: 'transparent',
              color: TEXT_SEC,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            Clear All Filters
          </button>
        )}
      </aside>

      {/* ── Main Content: Timeline ─────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 20 }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 13, color: TEXT_SEC }}>
              {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <SortButton
              label="Date"
              active={sortField === 'date'}
              dir={sortField === 'date' ? sortDir : undefined}
              onClick={() => toggleSort('date')}
            />
            <SortButton
              label="Score"
              active={sortField === 'score'}
              dir={sortField === 'score' ? sortDir : undefined}
              onClick={() => toggleSort('score')}
            />
          </div>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(255,69,58,0.12)',
            border: '1px solid rgba(255,69,58,0.25)',
            color: 'var(--danger, #FFB4AB)',
            fontSize: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              style={{
                background: 'none',
                border: 'none',
                color: ACCENT,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && !loading && (
          <div style={{
            padding: '64px 32px',
            borderRadius: 20,
            background: SURFACE_ELEVATED,
            border: `1px solid ${BORDER}`,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 48, margin: '0 0 12px' }}>{'\u{1F4DD}'}</p>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: TEXT }}>
              {entries.length === 0 ? 'Start logging to build your history' : 'No entries match your filters'}
            </h3>
            <p style={{ margin: 0, color: TEXT_SEC, fontSize: 14 }}>
              {entries.length === 0
                ? 'Your mood entries will appear here as a searchable timeline.'
                : 'Try adjusting your date range, score range, or emotion filters.'}
            </p>
            {entries.length === 0 && (
              <Link href="/mood/log" style={{
                display: 'inline-block',
                marginTop: 16,
                padding: '12px 24px',
                borderRadius: 999,
                background: ACCENT,
                color: '#0A0A0F',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
              }}>
                Log Your First Mood
              </Link>
            )}
          </div>
        )}

        {/* Timeline entries grouped by date */}
        {grouped.map(([date, dayEntries]) => (
          <div key={date}>
            {/* Date header with timeline dot */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
              paddingLeft: 4,
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: ACCENT,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: TEXT_SEC,
              }}>
                {formatDateHeader(date)}
              </span>
            </div>

            {/* Entry cards */}
            <div style={{ display: 'grid', gap: 10, paddingLeft: 22 }}>
              {dayEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  isDeleting={confirmDelete === entry.id}
                  onDelete={() => void handleDelete(entry.id)}
                  onConfirmDelete={() => setConfirmDelete(entry.id)}
                  onCancelDelete={() => setConfirmDelete(null)}
                  formatTime={formatTime}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Pagination */}
        {(entries.length > 0 || page > 0) && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
          }}>
            <span style={{ fontSize: 13, color: TEXT_SEC }}>Page {page + 1}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                style={{ ...pageBtnStyle, opacity: page === 0 ? 0.3 : 1 }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={entries.length < PAGE_SIZE}
                onClick={() => setPage(page + 1)}
                style={{ ...pageBtnStyle, opacity: entries.length < PAGE_SIZE ? 0.3 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Entry Card ────────────────────────────────────────────────────────

function EntryCard({
  entry,
  isDeleting,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  formatTime,
}: {
  entry: EnrichedEntry;
  isDeleting: boolean;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  formatTime: (iso: string) => string;
}) {
  const descriptor = MoodScoreDescriptors[entry.score];
  const scoreColor = SCORE_COLORS[entry.score] ?? ACCENT_RAW;
  const emotionLabels = entry.emotions.map((e) => e.emotion);

  return (
    <div style={{
      padding: '18px 20px',
      borderRadius: 16,
      background: SURFACE_ELEVATED,
      border: `1px solid ${BORDER}`,
      transition: 'border-color 200ms ease',
    }}>
      {/* Header: Score bubble + emotion label + time + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Score bubble */}
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          background: `${scoreColor}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor }}>
            {entry.score}
          </span>
        </div>

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: TEXT,
          }}>
            {descriptor?.label ?? `Score ${entry.score}`}
          </p>
          <p style={{
            margin: '2px 0 0',
            fontSize: 13,
            color: TEXT_SEC,
          }}>
            {formatTime(entry.loggedAt || entry.createdAt)}
          </p>
        </div>

        {/* Delete action */}
        <div style={{ flexShrink: 0 }}>
          {isDeleting ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={onDelete}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--danger, #FF453A)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: 'transparent',
                  color: TEXT_SEC,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onConfirmDelete}
              title="Delete entry"
              style={{
                background: 'none',
                border: 'none',
                color: TEXT_SEC,
                cursor: 'pointer',
                fontSize: 16,
                padding: '4px 8px',
                borderRadius: 6,
                opacity: 0.5,
                transition: 'opacity 150ms ease',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.5'; }}
            >
              {'\u{1F5D1}'}
            </button>
          )}
        </div>
      </div>

      {/* Note */}
      {entry.note && (
        <p style={{
          margin: '12px 0 0',
          fontSize: 14,
          color: TEXT_SEC,
          lineHeight: 1.5,
          fontStyle: 'italic',
          paddingLeft: 58,
        }}>
          &ldquo;{entry.note}&rdquo;
        </p>
      )}

      {/* Emotion tags */}
      {emotionLabels.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          marginTop: 12,
          paddingLeft: 58,
        }}>
          {emotionLabels.map((emotion) => (
            <span key={emotion} style={{
              padding: '3px 10px',
              borderRadius: 999,
              background: GLASS_STRONG,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: ACCENT,
            }}>
              #{emotion}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sort Button ───────────────────────────────────────────────────────

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir?: SortDir;
  onClick: () => void;
}) {
  const arrow = active ? (dir === 'desc' ? ' \u2193' : ' \u2191') : '';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 8,
        border: `1px solid ${active ? ACCENT_BORDER : BORDER}`,
        background: active ? ACCENT_DIM : 'transparent',
        color: active ? ACCENT : TEXT_SEC,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: 0.5,
        transition: 'all 150ms ease',
      }}
    >
      {label}{arrow}
    </button>
  );
}

// ── Shared Styles ─────────────────────────────────────────────────────

const filterLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: TEXT_SEC,
};

const dateInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: BACKGROUND,
  color: TEXT,
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const pageBtnStyle: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: GLASS,
  color: TEXT_SEC,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 150ms ease',
};
