'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchTimelineData } from './actions';
import {
  getYearGroup,
  formatTimelineDate,
  type TimelineEntry,
  type PersonRecord,
} from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const LINE_COLOR = '#35343A';

const TYPE_COLORS: Record<string, string> = {
  hangout: '#EC4899',
  memory: '#8B5CF6',
  gift_given: '#10B981',
  gift_received: '#06B6D4',
  life_event: '#F59E0B',
  milestone: '#FFB877',
};

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
  return GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length][0];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatTypeName(type: string): string {
  switch (type) {
    case 'hangout': return 'Hangout';
    case 'memory': return 'Memory';
    case 'gift_given': return 'Gift given';
    case 'gift_received': return 'Gift received';
    case 'life_event': return 'Life event';
    case 'milestone': return 'Milestone';
    default: return type;
  }
}

export default function TimelinePage() {
  const params = useParams<{ id: string }>();
  const [person, setPerson] = useState<PersonRecord | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    void fetchTimelineData(params.id)
      .then((data) => {
        setPerson(data.person);
        setEntries(data.entries);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  const yearGroups = useMemo(() => {
    const groups = new Map<string, TimelineEntry[]>();
    for (const entry of entries) {
      const year = getYearGroup(entry.date);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year)!.push(entry);
    }
    return Array.from(groups.entries());
  }, [entries]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: TEXT_SEC }}>Loading...</div>;
  }

  if (!person) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: TEXT }}>Person not found</h2>
        <Link href="/friends" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>
          Back to people
        </Link>
      </div>
    );
  }

  const displayName = person.display_name;
  const initials = getInitials(displayName);
  const avatarColor = getGradient(displayName);

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 720 }}>
      {/* Back link */}
      <Link href={`/friends/${params.id}`} style={{ color: TEXT_SEC, textDecoration: 'none', fontSize: 14 }}>
        &larr; Back to {displayName}
      </Link>

      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: avatarColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF' }}>{initials}</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT }}>
          Your story with {displayName}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC }}>
          {entries.length} moment{entries.length !== 1 ? 's' : ''} together
        </p>
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div style={{
          backgroundColor: GLASS,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: 32,
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT }}>No timeline entries yet</p>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: TEXT_SEC }}>
            Log hangouts, memories, and gifts to build your shared story
          </p>
        </div>
      )}

      {/* Timeline */}
      {yearGroups.map(([year, yearEntries]) => (
        <div key={year}>
          {/* Year header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            margin: '8px 0 16px',
          }}>
            <div style={{ flex: 1, height: 1, backgroundColor: LINE_COLOR }} />
            <span style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>{year}</span>
            <div style={{ flex: 1, height: 1, backgroundColor: LINE_COLOR }} />
          </div>

          {/* Entries */}
          {yearEntries.map((entry, idx) => {
            const isMilestone = entry.type === 'milestone';
            const dotColor = TYPE_COLORS[entry.type] ?? '#9F8E81';
            const isLast = idx === yearEntries.length - 1;

            return (
              <div key={entry.id} style={{ display: 'flex', gap: 12, marginBottom: isLast ? 0 : 12 }}>
                {/* Line + dot */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
                  <div style={{
                    width: isMilestone ? 16 : 12,
                    height: isMilestone ? 16 : 12,
                    borderRadius: '50%',
                    backgroundColor: dotColor,
                    marginTop: 16,
                    border: isMilestone ? '2px solid #FFB877' : 'none',
                    flexShrink: 0,
                  }} />
                  {!isLast && (
                    <div style={{ width: 1, flex: 1, backgroundColor: LINE_COLOR, marginTop: 4 }} />
                  )}
                </div>

                {/* Entry card */}
                <div style={{
                  flex: 1,
                  backgroundColor: isMilestone ? 'rgba(255, 184, 119, 0.04)' : GLASS,
                  border: `1px solid ${isMilestone ? 'rgba(255, 184, 119, 0.3)' : BORDER}`,
                  borderRadius: 12,
                  padding: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{entry.icon}</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: `${dotColor}20`,
                      color: dotColor,
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {formatTypeName(entry.type)}
                    </span>
                    {isMilestone && <span style={{ marginLeft: 'auto', fontSize: 14 }}>{'\u2B50'}</span>}
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: TEXT }}>{entry.title}</p>
                  <p style={{ margin: '0 0 6px', fontSize: 13, color: TEXT_SEC, lineHeight: 1.4 }}>{entry.summary}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#9F8E81' }}>{formatTimelineDate(entry.date)}</p>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
