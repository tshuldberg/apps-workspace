'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchMemory, fetchPeopleMap, removeMemory } from '../actions';
import type { MemoryRecord, PersonRecord } from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const DANGER = '#EF4444';

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
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
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

export default function MemoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [memory, setMemory] = useState<MemoryRecord | null>(null);
  const [peopleMap, setPeopleMap] = useState<Record<string, PersonRecord>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    void Promise.all([fetchMemory(params.id), fetchPeopleMap()])
      .then(([m, pMap]) => {
        setMemory(m);
        setPeopleMap(pMap);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  const handleDelete = useCallback(async () => {
    if (!memory) return;
    if (!confirm('Delete this memory? This cannot be undone.')) return;
    try {
      await removeMemory(memory.id);
      router.push('/friends/memories');
    } catch {
      // silently handle
    }
  }, [memory, router]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: TEXT_SEC }}>Loading...</div>;
  }

  if (!memory) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: TEXT }}>Memory not found</h2>
        <Link href="/friends/memories" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 600 }}>
          Back to memories
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 28, maxWidth: 720 }}>
      {/* Back link */}
      <Link href="/friends/memories" style={{ color: TEXT_SEC, textDecoration: 'none', fontSize: 14 }}>
        &larr; Back to memories
      </Link>

      {/* Inside joke badge */}
      {memory.is_inside_joke && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          padding: '6px 14px',
          borderRadius: 999,
          backgroundColor: 'rgba(168, 85, 247, 0.15)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          fontSize: 13,
          fontWeight: 700,
          color: '#A855F7',
        }}>
          😂 Inside Joke
        </span>
      )}

      {/* Title hero */}
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: TEXT }}>
          {memory.title}
        </h1>
        {memory.happened_at && (
          <p style={{ margin: '6px 0 0', fontSize: 14, color: TEXT_SEC }}>
            {formatDate(memory.happened_at)}
          </p>
        )}
      </div>

      {/* Description */}
      {memory.description_md && (
        <section>
          <h3 style={sectionTitleStyle}>The Story</h3>
          <div style={glassCardStyle}>
            <p style={{ margin: 0, fontSize: 15, color: TEXT, lineHeight: 1.6 }}>
              {memory.description_md}
            </p>
          </div>
        </section>
      )}

      {/* People */}
      {memory.person_ids.length > 0 && (
        <section>
          <h3 style={sectionTitleStyle}>Who was there</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {memory.person_ids.map((pid) => {
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
      )}

      {/* Tags */}
      {memory.tags.length > 0 && (
        <section>
          <h3 style={sectionTitleStyle}>Tags</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {memory.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 14px',
                  borderRadius: 999,
                  backgroundColor: `${ACCENT}15`,
                  border: `1px solid ${ACCENT}30`,
                  fontSize: 13,
                  fontWeight: 600,
                  color: ACCENT,
                }}
              >
                {tag}
              </span>
            ))}
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
          Delete Memory
        </button>
      </div>
    </div>
  );
}
