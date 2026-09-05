'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchMemories, fetchPeopleMap } from './actions';
import type { MemoryRecord, PersonRecord } from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const JOKE_BG = 'rgba(168, 85, 247, 0.06)';
const JOKE_BORDER = 'rgba(168, 85, 247, 0.25)';

const GRADIENT_PAIRS: string[] = [
  '#EC4899', '#8B5CF6', '#06B6D4', '#F59E0B',
  '#10B981', '#EF4444', '#6366F1', '#E879A1',
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getAvatarColor(name: string): string {
  return GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getMonthKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function FriendsMemoriesPage() {
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [peopleMap, setPeopleMap] = useState<Record<string, PersonRecord>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'jokes'>('all');

  const loadData = useCallback(async () => {
    try {
      const [mems, pMap] = await Promise.all([
        fetchMemories(filter === 'jokes' ? { is_inside_joke: true } : undefined),
        fetchPeopleMap(),
      ]);
      setMemories(mems);
      setPeopleMap(pMap);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const isEmpty = memories.length === 0 && !loading;

  // Group by month
  const grouped: { month: string; items: MemoryRecord[] }[] = [];
  let currentMonth = '';
  for (const m of memories) {
    const month = m.happened_at ? getMonthKey(m.happened_at) : 'Undated';
    if (month !== currentMonth) {
      currentMonth = month;
      grouped.push({ month, items: [m] });
    } else {
      grouped[grouped.length - 1].items.push(m);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: TEXT_SEC }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setFilter('all')}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              border: `1px solid ${filter === 'all' ? ACCENT : BORDER}`,
              backgroundColor: filter === 'all' ? ACCENT : 'transparent',
              color: filter === 'all' ? '#FFFFFF' : TEXT_SEC,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('jokes')}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              border: `1px solid ${filter === 'jokes' ? ACCENT : BORDER}`,
              backgroundColor: filter === 'jokes' ? ACCENT : 'transparent',
              color: filter === 'jokes' ? '#FFFFFF' : TEXT_SEC,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Inside Jokes
          </button>
        </div>
        <Link
          href="/friends/memories/add"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 20px',
            borderRadius: 999,
            backgroundColor: ACCENT,
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          + Add Memory
        </Link>
      </div>

      {isEmpty ? (
        <div style={emptyContainerStyle}>
          <div style={iconWrapStyle}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </div>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: TEXT }}>
            Moments worth keeping
          </h2>
          <p style={{ margin: '0 0 28px', fontSize: 15, color: TEXT_SEC, lineHeight: 1.6, textAlign: 'center', maxWidth: 340 }}>
            Capture inside jokes, shared adventures, and the things you never
            want to forget about the people you love.
          </p>
          <Link
            href="/friends/memories/add"
            style={{
              display: 'inline-block',
              padding: '14px 28px',
              borderRadius: 999,
              backgroundColor: ACCENT,
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
            }}
          >
            Add Memory
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          {grouped.map((group) => (
            <div key={group.month}>
              <h3 style={monthHeaderStyle}>{group.month.toUpperCase()}</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {group.items.map((memory) => (
                  <Link
                    key={memory.id}
                    href={`/friends/memories/${memory.id}`}
                    style={{
                      display: 'block',
                      padding: '14px 16px',
                      borderRadius: 16,
                      backgroundColor: memory.is_inside_joke ? JOKE_BG : GLASS,
                      border: `1px solid ${memory.is_inside_joke ? JOKE_BORDER : BORDER}`,
                      textDecoration: 'none',
                      position: 'relative',
                      transform: memory.is_inside_joke ? 'rotate(-0.3deg)' : 'none',
                    }}
                  >
                    {/* Inside joke badge */}
                    {memory.is_inside_joke && (
                      <span style={{
                        position: 'absolute',
                        top: -6,
                        right: 12,
                        fontSize: 18,
                      }}>
                        😂
                      </span>
                    )}

                    {/* Title */}
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT }}>
                      {memory.title}
                    </h4>

                    {/* Date */}
                    {memory.happened_at && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9F8E81' }}>
                        {formatDate(memory.happened_at)}
                      </p>
                    )}

                    {/* People avatars */}
                    {memory.person_ids.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        {memory.person_ids.slice(0, 5).map((pid) => {
                          const person = peopleMap[pid];
                          const name = person?.display_name ?? '?';
                          return (
                            <div
                              key={pid}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: getAvatarColor(name),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#FFFFFF' }}>
                                {getInitials(name)}
                              </span>
                            </div>
                          );
                        })}
                        {memory.person_ids.length > 5 && (
                          <div style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: '#35343A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#FFFFFF' }}>
                              +{memory.person_ids.length - 5}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {memory.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {memory.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: 999,
                              backgroundColor: `${ACCENT}15`,
                              fontSize: 11,
                              fontWeight: 600,
                              color: ACCENT,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {memory.tags.length > 4 && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_SEC, alignSelf: 'center' }}>
                            +{memory.tags.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40vh',
  padding: 48,
};

const iconWrapStyle: React.CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: 48,
  backgroundColor: 'rgba(236, 72, 153, 0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 24,
};

const monthHeaderStyle: React.CSSProperties = {
  margin: '20px 0 12px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.5,
  color: 'var(--text-secondary, #D6C3B5)',
};
