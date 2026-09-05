'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchCirclesList, createCircleAction, fetchPeopleList, type CircleListItem } from './actions';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';

const AVATAR_COLORS = [
  '#EC4899', '#8B5CF6', '#06B6D4', '#F59E0B',
  '#10B981', '#EF4444', '#6366F1', '#E879A1',
];

const COLOR_PRESETS = [
  '#EC4899', '#8B5CF6', '#06B6D4', '#F59E0B',
  '#10B981', '#EF4444', '#6366F1', '#F97316',
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

export default function CirclesPage() {
  const [items, setItems] = useState<CircleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const result = await fetchCirclesList();
      setItems(result);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><p style={{ color: TEXT_SEC }}>Loading...</p></div>;
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: TEXT_SEC }}>
            Friends
          </p>
          <h1 style={{ margin: '6px 0 0', fontSize: 38, fontWeight: 800, color: TEXT }}>
            Circles
          </h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: '10px 20px',
            borderRadius: 999,
            border: 'none',
            background: ACCENT,
            color: '#131318',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          + New Circle
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <CreateCircleForm
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); void loadData(); }}
        />
      )}

      {/* Empty state */}
      {items.length === 0 && !showForm && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 400,
          margin: '40px auto',
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
            fontSize: 40,
          }}>
            👥
          </div>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: TEXT }}>
            No circles yet
          </h2>
          <p style={{ margin: 0, fontSize: 15, color: TEXT_SEC, textAlign: 'center', lineHeight: 1.6 }}>
            Create a circle to group friends together and track group dynamics.
          </p>
        </div>
      )}

      {/* Circle cards */}
      {items.map(({ circle, memberNames, lastGroupHangout }) => (
        <Link key={circle.id} href={`/friends/circles/${circle.id}`} style={{ textDecoration: 'none' }}>
          <div style={{
            padding: 20,
            borderRadius: 16,
            background: GLASS,
            border: `1px solid ${BORDER}`,
            borderLeft: `4px solid ${circle.color ?? ACCENT}`,
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>{circle.icon ?? '👥'}</span>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>{circle.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC }}>
                  {circle.member_ids.length} member{circle.member_ids.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Stacked avatars */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              {memberNames.map((name, i) => (
                <div
                  key={i}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: AVATAR_COLORS[nameHash(name) % AVATAR_COLORS.length],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: i > 0 ? -8 : 0,
                    border: '2px solid #131318',
                    zIndex: memberNames.length - i,
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
                    {getInitials(name)}
                  </span>
                </div>
              ))}
              {circle.member_ids.length > 5 && (
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: -8,
                  border: '2px solid #131318',
                }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: TEXT_SEC }}>
                    +{circle.member_ids.length - 5}
                  </span>
                </div>
              )}
            </div>

            {lastGroupHangout && (
              <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>
                Last together: {formatDate(lastGroupHangout)}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Inline create form ��─────────────────────────────────────────────

function CreateCircleForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [people, setPeople] = useState<Array<{ id: string; display_name: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchPeopleList().then(setPeople);
  }, []);

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createCircleAction({
        name: name.trim(),
        icon: icon.trim() || undefined,
        color,
        member_ids: selectedMembers,
      });
      onCreated();
    } catch {
      // silently handle
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      padding: 24,
      borderRadius: 20,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${BORDER}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT }}>New Circle</h3>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: TEXT_SEC, fontSize: 18, cursor: 'pointer' }}
        >
          {'\u2715'}
        </button>
      </div>

      {/* Name */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT_SEC, marginBottom: 6 }}>
          Name *
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. College Friends"
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.04)',
            color: TEXT,
            fontSize: 14,
            outline: 'none',
          }}
        />
      </div>

      {/* Icon */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT_SEC, marginBottom: 6 }}>
          Icon (emoji)
        </label>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value.slice(0, 2))}
          placeholder="👥"
          style={{
            width: 60,
            padding: '10px 14px',
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.04)',
            color: TEXT,
            fontSize: 20,
            textAlign: 'center',
            outline: 'none',
          }}
        />
      </div>

      {/* Color */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT_SEC, marginBottom: 6 }}>
          Color
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: c,
                border: color === c ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>

      {/* Members */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT_SEC, marginBottom: 6 }}>
          Members ({selectedMembers.length})
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {people.map((p) => {
            const selected = selectedMembers.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleMember(p.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: `1px solid ${selected ? ACCENT : BORDER}`,
                  background: selected ? 'rgba(236,72,153,0.1)' : 'transparent',
                  color: selected ? TEXT : TEXT_SEC,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {p.display_name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => void handleSubmit()}
        disabled={!name.trim() || saving}
        style={{
          width: '100%',
          padding: '12px 20px',
          borderRadius: 999,
          border: 'none',
          background: name.trim() ? ACCENT : 'rgba(255,255,255,0.1)',
          color: name.trim() ? '#131318' : TEXT_SEC,
          fontSize: 15,
          fontWeight: 700,
          cursor: name.trim() ? 'pointer' : 'not-allowed',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Creating...' : 'Create Circle'}
      </button>
    </div>
  );
}
