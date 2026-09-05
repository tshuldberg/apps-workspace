'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchHangouts, fetchPeopleMap } from './actions';
import type { HangoutRecord, PersonRecord } from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';

const ACTIVITY_ICONS: Record<string, string> = {
  coffee: '\u2615',
  dinner: '\uD83C\uDF7D\uFE0F',
  lunch: '\uD83E\uDD57',
  drinks: '\uD83C\uDF7B',
  hike: '\uD83E\uDD7E',
  movie: '\uD83C\uDFAC',
  gaming: '\uD83C\uDFAE',
  party: '\uD83C\uDF89',
  study: '\uD83D\uDCDA',
  work: '\uD83D\uDCBC',
  gym: '\uD83D\uDCAA',
  shopping: '\uD83D\uDECD\uFE0F',
  concert: '\uD83C\uDFB5',
  travel: '\u2708\uFE0F',
  random: '\uD83C\uDFB2',
};

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function getMonthKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

export default function FriendsHangoutsPage() {
  const [hangouts, setHangouts] = useState<HangoutRecord[]>([]);
  const [peopleMap, setPeopleMap] = useState<Record<string, PersonRecord>>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [h, pMap] = await Promise.all([fetchHangouts(), fetchPeopleMap()]);
      setHangouts(h);
      setPeopleMap(pMap);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const isEmpty = hangouts.length === 0 && !loading;

  // Group by month
  const grouped: { month: string; items: HangoutRecord[] }[] = [];
  let currentMonth = '';
  for (const h of hangouts) {
    const month = getMonthKey(h.happened_at);
    if (month !== currentMonth) {
      currentMonth = month;
      grouped.push({ month, items: [h] });
    } else {
      grouped[grouped.length - 1].items.push(h);
    }
  }

  function getPeopleNames(ids: string[]): string {
    return ids.map((id) => peopleMap[id]?.display_name ?? 'Unknown').join(', ');
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: TEXT_SEC }}>
            Hangouts
          </p>
          <h1 style={{ margin: '6px 0 0', fontSize: 38, fontWeight: 800, color: TEXT }}>
            Timeline
          </h1>
        </div>
        <Link
          href="/friends/hangouts/add"
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
          + Log Hangout
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: TEXT_SEC }}>Loading...</p>
        </div>
      ) : isEmpty ? (
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
              <path d="M21 10.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6.5" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
              <path d="M21.29 14.7a2.43 2.43 0 0 0-2.65-.52c-.3.12-.57.3-.8.53l-.34.34-.35-.34a2.43 2.43 0 0 0-2.65-.53c-.3.12-.56.3-.79.53-.95.94-1 2.53.2 3.74L17.5 22l3.6-3.55c1.2-1.21 1.14-2.8.19-3.74Z" />
            </svg>
          </div>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: TEXT, textAlign: 'center' }}>
            Time well spent
          </h2>
          <p style={{ margin: '0 0 32px', fontSize: 15, color: TEXT_SEC, textAlign: 'center', lineHeight: 1.6 }}>
            Log your first hangout to see your social timeline.
          </p>
          <Link
            href="/friends/hangouts/add"
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
            Log First Hangout
          </Link>
        </div>
      ) : (
        <div>
          {grouped.map((group) => (
            <div key={group.month}>
              <p style={{
                margin: '24px 0 12px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: TEXT_SEC,
              }}>
                {group.month}
              </p>
              <div style={{ display: 'grid', gap: 10 }}>
                {group.items.map((hangout) => (
                  <HangoutCard
                    key={hangout.id}
                    hangout={hangout}
                    peopleMap={peopleMap}
                    getPeopleNames={getPeopleNames}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HangoutCard({
  hangout,
  peopleMap,
  getPeopleNames,
}: {
  hangout: HangoutRecord;
  peopleMap: Record<string, PersonRecord>;
  getPeopleNames: (ids: string[]) => string;
}) {
  return (
    <Link
      href={`/friends/hangouts/${hangout.id}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
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
      {/* Mini avatars */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, width: 56, flexShrink: 0 }}>
        {hangout.people_ids.slice(0, 4).map((pid) => {
          const person = peopleMap[pid];
          const name = person?.display_name ?? '?';
          return (
            <div
              key={pid}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: getAvatarColor(name),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: '#FFFFFF' }}>
                {getInitials(name)}
              </span>
            </div>
          );
        })}
        {hangout.people_ids.length > 4 && (
          <div style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#35343A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#FFFFFF' }}>
              +{hangout.people_ids.length - 4}
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 600,
          color: TEXT,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {getPeopleNames(hangout.people_ids)}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {hangout.activity_tags.length > 0 && (
            <span style={{ fontSize: 14 }}>
              {hangout.activity_tags.map((t) => ACTIVITY_ICONS[t] ?? t).join(' ')}
            </span>
          )}
          {hangout.location_name && (
            <span style={{ fontSize: 13, color: '#9F8E81', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hangout.location_name}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: 12, color: '#9F8E81' }}>
            {formatDate(hangout.happened_at)}
          </span>
          {hangout.duration_minutes != null && (
            <span style={{ fontSize: 12, color: '#9F8E81' }}>
              {formatDuration(hangout.duration_minutes)}
            </span>
          )}
          {hangout.quality_rating != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: n <= hangout.quality_rating! ? ACCENT : '#35343A',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
