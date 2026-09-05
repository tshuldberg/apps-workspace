'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { fetchPeople } from './actions';
import type { PersonRecord, PersonFilter, PersonSort, RelationshipType } from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const SURFACE = 'var(--surface-elevated, #2A292F)';

const GRADIENT_PAIRS: [string, string][] = [
  ['#EC4899', '#F472B6'],
  ['#8B5CF6', '#A78BFA'],
  ['#06B6D4', '#22D3EE'],
  ['#F59E0B', '#FBBF24'],
  ['#10B981', '#34D399'],
  ['#EF4444', '#F87171'],
  ['#6366F1', '#818CF8'],
  ['#E879A1', '#F0ABAF'],
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getGradient(name: string): string {
  const pair = GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length];
  return pair[0];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  close_friend: 'Close friend',
  friend: 'Friend',
  acquaintance: 'Acquaintance',
  family: 'Family',
  partner: 'Partner',
  ex: 'Ex',
  colleague: 'Colleague',
  mentor: 'Mentor',
  neighbor: 'Neighbor',
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  close_friend: '#EC4899',
  friend: '#8B5CF6',
  acquaintance: '#9F8E81',
  family: '#F59E0B',
  partner: '#EF4444',
  ex: '#6B7280',
  colleague: '#06B6D4',
  mentor: '#10B981',
  neighbor: '#F97316',
};

const ENERGY_COLORS: Record<string, string> = {
  energizing: '#10B981',
  neutral: '#9F8E81',
  draining: '#EF4444',
  complicated: '#F59E0B',
};

const RELATIONSHIP_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'close_friend', label: 'Close' },
  { key: 'friend', label: 'Friend' },
  { key: 'family', label: 'Family' },
  { key: 'colleague', label: 'Colleague' },
  { key: 'acquaintance', label: 'Acquaintance' },
  { key: 'partner', label: 'Partner' },
  { key: 'mentor', label: 'Mentor' },
  { key: 'neighbor', label: 'Neighbor' },
];

const SORT_OPTIONS: { key: PersonSort; label: string }[] = [
  { key: 'name_asc', label: 'Name A-Z' },
  { key: 'created_at_desc', label: 'Recently added' },
  { key: 'last_seen_desc', label: 'Last seen' },
];

export default function FriendsPeoplePage() {
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [relFilter, setRelFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<PersonSort>('name_asc');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search]);

  const loadPeople = useCallback(async () => {
    try {
      const filters: PersonFilter = { is_archived: false };
      if (relFilter !== 'all') filters.relationship_type = relFilter as RelationshipType;
      if (debouncedSearch.trim()) filters.search = debouncedSearch.trim();
      const results = await fetchPeople(filters, sortBy);
      setPeople(results);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [relFilter, sortBy, debouncedSearch]);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  const hasFilters = relFilter !== 'all' || debouncedSearch.trim().length > 0;
  const isEmpty = people.length === 0 && !loading;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: TEXT_SEC }}>
            People
          </p>
          <h1 style={{ margin: '6px 0 0', fontSize: 38, fontWeight: 800, color: TEXT }}>
            MyFriends
          </h1>
        </div>
        <Link
          href="/friends/add"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 24px',
            borderRadius: 14,
            background: ACCENT,
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 15,
            textDecoration: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          + Add Friend
        </Link>
      </div>

      {/* Search */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        backgroundColor: SURFACE,
        borderRadius: 12,
        padding: '10px 14px',
      }}>
        <span style={{ fontSize: 16, color: '#9F8E81' }}>&#128269;</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 16,
            color: TEXT,
            padding: 0,
          }}
        />
      </div>

      {/* Filter chips + sort */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {RELATIONSHIP_FILTERS.map((f) => {
          const active = relFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setRelFilter(f.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                backgroundColor: active ? ACCENT : 'transparent',
                color: active ? '#FFFFFF' : TEXT_SEC,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: TEXT_SEC }}>
            {people.length} {people.length === 1 ? 'person' : 'people'}
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as PersonSort)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: `1px solid ${BORDER}`,
              backgroundColor: GLASS,
              color: TEXT_SEC,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: TEXT_SEC }}>Loading...</p>
        </div>
      ) : isEmpty && !hasFilters ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 400,
          margin: '0 auto',
          padding: 48,
          borderRadius: 24,
          background: GLASS,
          border: `1px solid ${BORDER}`,
        }}>
          <div style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: 'rgba(236, 72, 153, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: TEXT, textAlign: 'center' }}>
            Your people, your memories
          </h2>
          <p style={{ margin: '0 0 32px', fontSize: 15, color: TEXT_SEC, textAlign: 'center', lineHeight: 1.6 }}>
            Add your first friend to get started.
          </p>
          <Link
            href="/friends/add"
            style={{
              backgroundColor: ACCENT,
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: 700,
              padding: '14px 28px',
              borderRadius: 999,
              textDecoration: 'none',
            }}
          >
            Add First Friend
          </Link>
        </div>
      ) : isEmpty && hasFilters ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 18, color: TEXT }}>No matches</h3>
          <p style={{ margin: '8px 0 0', color: TEXT_SEC }}>Try a different search or filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {people.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonCard({ person }: { person: PersonRecord }) {
  const initials = getInitials(person.display_name);
  const bgColor = getGradient(person.display_name);
  const relColor = RELATIONSHIP_COLORS[person.relationship_type] ?? '#9F8E81';
  const relLabel = RELATIONSHIP_LABELS[person.relationship_type] ?? person.relationship_type;
  const energyColor = person.energy_tag ? ENERGY_COLORS[person.energy_tag] : null;

  return (
    <Link
      href={`/friends/${person.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        borderRadius: 16,
        backgroundColor: GLASS,
        border: `1px solid ${BORDER}`,
        textDecoration: 'none',
        color: TEXT,
        cursor: 'pointer',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>{initials}</span>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 16,
            fontWeight: 600,
            color: TEXT,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {person.display_name}
          </span>
          {energyColor && (
            <span style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: energyColor,
              flexShrink: 0,
              display: 'inline-block',
            }} />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: 6,
            backgroundColor: `${relColor}20`,
            color: relColor,
            fontSize: 11,
            fontWeight: 600,
          }}>
            {relLabel}
          </span>
          {person.city && (
            <span style={{ fontSize: 12, color: '#9F8E81' }}>{person.city}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
