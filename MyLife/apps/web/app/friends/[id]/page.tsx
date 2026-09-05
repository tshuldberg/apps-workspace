'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchPerson, archiveFriend } from '../actions';
import type { PersonRecord } from '@mylife/friends';

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
  return GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length][0];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  close_friend: 'Close friend', friend: 'Friend', acquaintance: 'Acquaintance',
  family: 'Family', partner: 'Partner', ex: 'Ex',
  colleague: 'Colleague', mentor: 'Mentor', neighbor: 'Neighbor',
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  close_friend: '#EC4899', friend: '#8B5CF6', acquaintance: '#9F8E81',
  family: '#F59E0B', partner: '#EF4444', ex: '#6B7280',
  colleague: '#06B6D4', mentor: '#10B981', neighbor: '#F97316',
};

const ENERGY_LABELS: Record<string, string> = {
  energizing: 'Energizing', neutral: 'Neutral', draining: 'Draining', complicated: 'Complicated',
};

const ENERGY_COLORS: Record<string, string> = {
  energizing: '#10B981', neutral: '#9F8E81', draining: '#EF4444', complicated: '#F59E0B',
};

const COMM_LABELS: Record<string, string> = {
  text: 'Text', call: 'Call', in_person: 'In person', social_dm: 'Social DM',
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function PersonDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [person, setPerson] = useState<PersonRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    void fetchPerson(params.id).then((p) => {
      setPerson(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [params.id]);

  const handleArchive = useCallback(async () => {
    if (!person) return;
    if (!confirm('Archive this person? They will be hidden but data is preserved.')) return;
    try {
      await archiveFriend(person.id);
      router.push('/friends');
    } catch {
      // silently handle
    }
  }, [person, router]);

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

  const initials = getInitials(person.display_name);
  const bgColor = getGradient(person.display_name);
  const relColor = RELATIONSHIP_COLORS[person.relationship_type] ?? '#9F8E81';
  const relLabel = RELATIONSHIP_LABELS[person.relationship_type] ?? person.relationship_type;
  const energyColor = person.energy_tag ? ENERGY_COLORS[person.energy_tag] : null;

  const quickFacts: { label: string; value: string }[] = [];
  if (person.birthday) quickFacts.push({ label: 'Birthday', value: formatDate(person.birthday) ?? person.birthday });
  if (person.city) quickFacts.push({ label: 'City', value: person.city });
  if (person.communication_preference) quickFacts.push({ label: 'Prefers', value: COMM_LABELS[person.communication_preference] ?? person.communication_preference });
  if (person.frequency_goal_days) quickFacts.push({ label: 'Catch up every', value: `${person.frequency_goal_days} days` });

  return (
    <div style={{ display: 'grid', gap: 28, maxWidth: 720 }}>
      {/* Back link */}
      <Link href="/friends" style={{ color: TEXT_SEC, textDecoration: 'none', fontSize: 14 }}>
        &larr; Back to people
      </Link>

      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
        <div style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: 36, fontWeight: 700, color: '#FFFFFF' }}>{initials}</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: TEXT }}>{person.display_name}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            padding: '4px 12px',
            borderRadius: 8,
            backgroundColor: `${relColor}20`,
            color: relColor,
            fontSize: 13,
            fontWeight: 600,
          }}>
            {relLabel}
          </span>
          {energyColor && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: energyColor, display: 'inline-block' }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: energyColor }}>
                {person.energy_tag ? ENERGY_LABELS[person.energy_tag] : ''}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* How we met */}
      {(person.how_met || person.where_met || person.when_met) && (
        <section>
          <h3 style={sectionTitleStyle}>How we met</h3>
          <div style={glassCardStyle}>
            {person.how_met && <p style={{ margin: 0, fontSize: 15, color: TEXT, lineHeight: 1.5 }}>{person.how_met}</p>}
            {(person.where_met || person.when_met) && (
              <p style={{ margin: person.how_met ? '6px 0 0' : 0, fontSize: 13, color: '#9F8E81' }}>
                {[person.where_met, person.when_met].filter(Boolean).join(' \u2022 ')}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Quick facts */}
      {quickFacts.length > 0 && (
        <section>
          <h3 style={sectionTitleStyle}>Quick facts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {quickFacts.map((fact) => (
              <div key={fact.label} style={{
                ...glassCardStyle,
                padding: 12,
              }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#9F8E81', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {fact.label}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 15, color: TEXT, fontWeight: 500 }}>{fact.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Interests */}
      {person.interests && person.interests.length > 0 && (
        <section>
          <h3 style={sectionTitleStyle}>Interests</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {person.interests.map((tag) => (
              <span key={tag} style={{
                backgroundColor: `${ACCENT}15`,
                borderRadius: 8,
                padding: '5px 10px',
                fontSize: 13,
                color: ACCENT,
                fontWeight: 500,
              }}>
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {person.notes_md && (
        <section>
          <h3 style={sectionTitleStyle}>Notes</h3>
          <div style={glassCardStyle}>
            <p style={{ margin: 0, fontSize: 14, color: TEXT, lineHeight: 1.5 }}>{person.notes_md}</p>
          </div>
        </section>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Link
          href={`/friends/${person.id}/edit`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 0',
            borderRadius: 12,
            backgroundColor: ACCENT,
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={handleArchive}
          style={{
            flex: 1,
            padding: '12px 0',
            borderRadius: 12,
            backgroundColor: SURFACE,
            color: TEXT_SEC,
            fontWeight: 600,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Archive
        </button>
        <button
          type="button"
          disabled
          style={{
            flex: 1,
            padding: '12px 0',
            borderRadius: 12,
            backgroundColor: SURFACE,
            color: TEXT_SEC,
            fontWeight: 600,
            fontSize: 14,
            border: 'none',
            cursor: 'not-allowed',
            opacity: 0.6,
          }}
        >
          Log Hangout
        </button>
        <Link
          href={`/friends/${person.id}/timeline`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 0',
            borderRadius: 12,
            backgroundColor: SURFACE,
            color: TEXT_SEC,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Timeline
        </Link>
      </div>

      {/* Gifts */}
      <section>
        <h3 style={sectionTitleStyle}>Gifts</h3>
        <Link
          href={`/friends/${person.id}/gifts`}
          style={{
            ...glassCardStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            textDecoration: 'none',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: ACCENT, fontWeight: 600 }}>
            View gift tracker &rarr;
          </p>
        </Link>
      </section>

      {/* Recent Hangouts */}
      <section>
        <h3 style={sectionTitleStyle}>Recent Hangouts</h3>
        <div style={{
          ...glassCardStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <p style={{ margin: 0, fontSize: 13, color: '#9F8E81', fontStyle: 'italic' }}>Coming soon</p>
        </div>
      </section>

      {/* Journal */}
      <section>
        <h3 style={sectionTitleStyle}>Journal</h3>
        <Link
          href={`/friends/${person.id}/journal`}
          style={{
            ...glassCardStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            textDecoration: 'none',
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: ACCENT, fontWeight: 600 }}>
            Gratitude, processing & growth &rarr;
          </p>
        </Link>
      </section>
    </div>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 14,
  fontWeight: 700,
  color: TEXT_SEC,
  textTransform: 'uppercase',
  letterSpacing: 1,
};

const glassCardStyle: React.CSSProperties = {
  backgroundColor: GLASS,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 16,
};
