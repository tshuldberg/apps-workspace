'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchUpcomingBirthdays } from './actions';
import {
  formatBirthdayDate,
  generateDaysUntilLabel,
  type UpcomingBirthday,
} from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';

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

export default function FriendsBirthdaysPage() {
  const [thisWeek, setThisWeek] = useState<UpcomingBirthday[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingBirthday[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const all = await fetchUpcomingBirthdays(90);
      setThisWeek(all.filter((b) => b.daysUntil <= 7));
      setUpcoming(all.filter((b) => b.daysUntil > 7));
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const isEmpty = thisWeek.length === 0 && upcoming.length === 0 && !loading;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: TEXT_SEC }}>
            Birthdays
          </p>
          <h1 style={{ margin: '6px 0 0', fontSize: 38, fontWeight: 800, color: TEXT }}>
            Coming Up
          </h1>
        </div>
        <Link
          href="/friends/people"
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
          + Add Birthday
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
              <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
              <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
              <path d="M2 21h20" />
              <path d="M7 8v3" />
              <path d="M12 8v3" />
              <path d="M17 8v3" />
              <path d="M7 4h0.01" />
              <path d="M12 4h0.01" />
              <path d="M17 4h0.01" />
            </svg>
          </div>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: TEXT, textAlign: 'center' }}>
            Never forget again
          </h2>
          <p style={{ margin: '0 0 32px', fontSize: 15, color: TEXT_SEC, textAlign: 'center', lineHeight: 1.6 }}>
            Know a birthday? Add it to a friend's profile to get gentle
            reminders so you always show up.
          </p>
          <Link
            href="/friends/people"
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
            Add Birthday
          </Link>
        </div>
      ) : (
        <div>
          {/* This week section */}
          {thisWeek.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <p style={{
                margin: '0 0 12px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: TEXT_SEC,
              }}>
                {'\uD83C\uDF82'} Coming up!
              </p>
              <div style={{ display: 'grid', gap: 10 }}>
                {thisWeek.map((b) => (
                  <BirthdayCard key={b.id} birthday={b} highlighted />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming section */}
          {upcoming.length > 0 && (
            <div>
              <p style={{
                margin: '0 0 12px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: TEXT_SEC,
              }}>
                Upcoming
              </p>
              <div style={{ display: 'grid', gap: 10 }}>
                {upcoming.map((b) => (
                  <BirthdayCard key={b.id} birthday={b} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BirthdayCard({
  birthday: b,
  highlighted = false,
}: {
  birthday: UpcomingBirthday;
  highlighted?: boolean;
}) {
  return (
    <Link
      href={`/friends/people/${b.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        borderRadius: 16,
        backgroundColor: highlighted ? 'rgba(236, 72, 153, 0.06)' : GLASS,
        border: highlighted
          ? '1px solid rgba(236, 72, 153, 0.15)'
          : `1px solid ${BORDER}`,
        borderLeft: highlighted ? `3px solid ${ACCENT}` : undefined,
        textDecoration: 'none',
        color: TEXT,
        cursor: 'pointer',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: getAvatarColor(b.display_name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>
          {getInitials(b.display_name)}
        </span>
      </div>

      {/* Body */}
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
          {b.display_name}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: TEXT_SEC }}>
          {formatBirthdayDate(b.birthday)}
          {b.age != null ? ` \u00B7 Turning ${b.age}` : ''}
        </p>
      </div>

      {/* Badge */}
      <div style={{
        backgroundColor: highlighted ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255,255,255,0.06)',
        padding: '4px 10px',
        borderRadius: 12,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: highlighted ? ACCENT : '#9F8E81',
        }}>
          {generateDaysUntilLabel(b.daysUntil)}
        </span>
      </div>
    </Link>
  );
}
