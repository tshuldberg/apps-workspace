'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchHangout, fetchPeopleMap, removeHangout } from '../actions';
import type { HangoutRecord, PersonRecord } from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const DANGER = '#EF4444';

const ACTIVITY_ICONS: Record<string, { emoji: string; label: string }> = {
  coffee: { emoji: '\u2615', label: 'Coffee' },
  dinner: { emoji: '\uD83C\uDF7D\uFE0F', label: 'Dinner' },
  lunch: { emoji: '\uD83E\uDD57', label: 'Lunch' },
  drinks: { emoji: '\uD83C\uDF7B', label: 'Drinks' },
  hike: { emoji: '\uD83E\uDD7E', label: 'Hike' },
  movie: { emoji: '\uD83C\uDFAC', label: 'Movie' },
  gaming: { emoji: '\uD83C\uDFAE', label: 'Gaming' },
  party: { emoji: '\uD83C\uDF89', label: 'Party' },
  study: { emoji: '\uD83D\uDCDA', label: 'Study' },
  work: { emoji: '\uD83D\uDCBC', label: 'Work' },
  gym: { emoji: '\uD83D\uDCAA', label: 'Gym' },
  shopping: { emoji: '\uD83D\uDECD\uFE0F', label: 'Shopping' },
  concert: { emoji: '\uD83C\uDFB5', label: 'Concert' },
  travel: { emoji: '\u2708\uFE0F', label: 'Travel' },
  random: { emoji: '\uD83C\uDFB2', label: 'Random' },
};

const QUALITY_LABELS: Record<number, string> = {
  1: 'Rough',
  2: 'Meh',
  3: 'Fine',
  4: 'Good',
  5: 'Amazing',
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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hrs}hr ${rem}min` : `${hrs}hr`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 1.5,
  color: TEXT_SEC,
};

const glassCardStyle: React.CSSProperties = {
  backgroundColor: GLASS,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 16,
};

export default function HangoutDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [hangout, setHangout] = useState<HangoutRecord | null>(null);
  const [peopleMap, setPeopleMap] = useState<Record<string, PersonRecord>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    void Promise.all([fetchHangout(params.id), fetchPeopleMap()])
      .then(([h, pMap]) => {
        setHangout(h);
        setPeopleMap(pMap);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  const handleDelete = useCallback(async () => {
    if (!hangout) return;
    if (!confirm('Delete this hangout? This cannot be undone.')) return;
    try {
      await removeHangout(hangout.id);
      router.push('/friends/hangouts');
    } catch {
      // silently handle
    }
  }, [hangout, router]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: TEXT_SEC }}>Loading...</div>;
  }

  if (!hangout) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: TEXT }}>Hangout not found</h2>
        <Link href="/friends/hangouts" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>
          Back to hangouts
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 28, maxWidth: 720 }}>
      {/* Back link */}
      <Link href="/friends/hangouts" style={{ color: TEXT_SEC, textDecoration: 'none', fontSize: 14 }}>
        &larr; Back to hangouts
      </Link>

      {/* Date hero */}
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>
          {formatDate(hangout.happened_at)}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: TEXT_SEC }}>
          {formatTime(hangout.happened_at)}
        </p>
      </div>

      {/* People */}
      <section>
        <h3 style={sectionTitleStyle}>Who was there</h3>
        <div style={{ display: 'grid', gap: 6 }}>
          {hangout.people_ids.map((pid) => {
            const person = peopleMap[pid];
            const name = person?.display_name ?? 'Unknown';
            return (
              <Link
                key={pid}
                href={person ? `/friends/${pid}` : '#'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 14,
                  backgroundColor: GLASS,
                  border: `1px solid ${BORDER}`,
                  textDecoration: 'none',
                  color: TEXT,
                }}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: getAvatarColor(name),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>
                    {getInitials(name)}
                  </span>
                </div>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: TEXT }}>{name}</span>
                <span style={{ fontSize: 18, color: '#9F8E81' }}>&rsaquo;</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Duration & location */}
      {(hangout.duration_minutes != null || hangout.location_name) && (
        <section>
          <div style={{
            ...glassCardStyle,
            display: 'flex',
            gap: 24,
          }}>
            {hangout.duration_minutes != null && (
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#9F8E81', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Duration
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 600, color: TEXT }}>
                  {formatDuration(hangout.duration_minutes)}
                </p>
              </div>
            )}
            {hangout.location_name && (
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#9F8E81', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Location
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 600, color: TEXT }}>
                  {hangout.location_name}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Activities */}
      {hangout.activity_tags.length > 0 && (
        <section>
          <h3 style={sectionTitleStyle}>Activities</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {hangout.activity_tags.map((tag) => {
              const info = ACTIVITY_ICONS[tag];
              return (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 999,
                    backgroundColor: `${ACCENT}15`,
                    border: `1px solid ${ACCENT}30`,
                    fontSize: 13,
                    fontWeight: 600,
                    color: ACCENT,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{info?.emoji ?? tag}</span>
                  {info?.label ?? tag}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* Quality */}
      {hangout.quality_rating != null && (
        <section>
          <h3 style={sectionTitleStyle}>Quality</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: n <= hangout.quality_rating! ? ACCENT : '#35343A',
                }}
              />
            ))}
            <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 600, color: TEXT }}>
              {QUALITY_LABELS[hangout.quality_rating]}
            </span>
          </div>
        </section>
      )}

      {/* Notes */}
      {hangout.notes_md && (
        <section>
          <h3 style={sectionTitleStyle}>Notes</h3>
          <div style={glassCardStyle}>
            <p style={{ margin: 0, fontSize: 15, color: TEXT, lineHeight: 1.5 }}>
              {hangout.notes_md}
            </p>
          </div>
        </section>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={handleDelete}
          style={{
            flex: 1,
            padding: '14px 0',
            borderRadius: 14,
            backgroundColor: `${DANGER}10`,
            border: `1px solid ${DANGER}30`,
            color: DANGER,
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Delete Hangout
        </button>
      </div>
    </div>
  );
}
