'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchCircleDetail, deleteCircleAction, type CircleDetailData } from '../actions';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const SURFACE = 'var(--surface-elevated, #2A292F)';

const AVATAR_COLORS = [
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CircleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<CircleDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const result = await fetchCircleDetail(id);
      setData(result);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!confirm('Delete this circle? This cannot be undone.')) return;
    await deleteCircleAction(id);
    router.push('/friends/circles');
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><p style={{ color: TEXT_SEC }}>Loading...</p></div>;
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: TEXT }}>Circle not found</h2>
        <Link href="/friends/circles" style={{ color: ACCENT }}>Back to circles</Link>
      </div>
    );
  }

  const { circle, members, activity, traditions, pairs } = data;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 48 }}>{circle.icon ?? '👥'}</span>
        <h1 style={{ margin: '8px 0 4px', fontSize: 32, fontWeight: 800, color: TEXT }}>{circle.name}</h1>
        {circle.description && (
          <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC }}>{circle.description}</p>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
          <button
            onClick={() => void handleDelete()}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              border: `1px solid rgba(255,180,171,0.3)`,
              background: 'transparent',
              color: '#FFB4AB',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Group Activity Stats */}
      <div style={{
        padding: 24,
        borderRadius: 20,
        background: GLASS,
        border: `1px solid ${BORDER}`,
      }}>
        <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
          Group Activity
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>{activity.totalGroupHangouts}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_SEC }}>Together</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>
              {activity.averageFrequencyDays ? `${activity.averageFrequencyDays}d` : '--'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_SEC }}>Avg gap</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>
              {activity.lastGroupHangout ? formatDate(activity.lastGroupHangout) : '--'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_SEC }}>Last met</p>
          </div>
        </div>
      </div>

      {/* Members */}
      <div style={{
        padding: 20,
        borderRadius: 16,
        background: GLASS,
        border: `1px solid ${BORDER}`,
      }}>
        <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
          Members
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {members.map((person) => (
            <Link
              key={person.id}
              href={`/friends/${person.id}`}
              style={{ textDecoration: 'none', textAlign: 'center', width: 64 }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: AVATAR_COLORS[nameHash(person.display_name) % AVATAR_COLORS.length],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 6px',
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  {getInitials(person.display_name)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: TEXT_SEC }}>{person.display_name}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Traditions */}
      {traditions.length > 0 && (
        <div style={{
          padding: 20,
          borderRadius: 16,
          background: GLASS,
          border: `1px solid ${BORDER}`,
        }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
            Traditions
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {traditions.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18 }}>🔁</span>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>{t.description}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC }}>
                    {t.occurrences} times -- last: {formatDate(t.lastOccurrence)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compatibility */}
      {pairs.length > 0 && (
        <div style={{
          padding: 20,
          borderRadius: 16,
          background: GLASS,
          border: `1px solid ${BORDER}`,
        }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TEXT_SEC }}>
            Compatibility
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {pairs.map((pair, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: TEXT, width: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pair.personAName} + {pair.personBName}
                </span>
                <div style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: SURFACE,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round(pair.coOccurrenceRate * 100)}%`,
                    backgroundColor: ACCENT,
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC, width: 36, textAlign: 'right' }}>
                  {Math.round(pair.coOccurrenceRate * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log group hangout */}
      <Link
        href={`/friends/hangouts/add?preselect=${circle.member_ids.join(',')}`}
        style={{ textDecoration: 'none' }}
      >
        <div style={{
          padding: 14,
          borderRadius: 999,
          backgroundColor: ACCENT,
          textAlign: 'center',
          cursor: 'pointer',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#131318' }}>
            Log Group Hangout
          </span>
        </div>
      </Link>
    </div>
  );
}
