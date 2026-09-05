'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addMemory, fetchPeopleMap } from '../actions';
import type { PersonRecord } from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const SURFACE = 'var(--surface-elevated, #2A292F)';
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: SURFACE,
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: 16,
  color: TEXT,
  border: 'none',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: TEXT_SEC,
  marginBottom: 8,
};

export default function AddMemoryPage() {
  const router = useRouter();

  const [peopleMap, setPeopleMap] = useState<Record<string, PersonRecord>>({});
  const [loadingPeople, setLoadingPeople] = useState(true);

  const [title, setTitle] = useState('');
  const [descriptionMd, setDescriptionMd] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [happenedAt, setHappenedAt] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [tagsText, setTagsText] = useState('');
  const [isInsideJoke, setIsInsideJoke] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchPeopleMap()
      .then((m) => {
        setPeopleMap(m);
        setLoadingPeople(false);
      })
      .catch(() => setLoadingPeople(false));
  }, []);

  const allPeople = useMemo(() => {
    return Object.values(peopleMap).filter((p) => !p.is_archived);
  }, [peopleMap]);

  const togglePerson = useCallback((id: string) => {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setError('');
    setSaving(true);

    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await addMemory({
        title: title.trim(),
        description_md: descriptionMd.trim() || undefined,
        person_ids: selectedPeople,
        happened_at: new Date(happenedAt).toISOString(),
        tags,
        is_inside_joke: isInsideJoke,
      });
      router.push('/friends/memories');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [title, descriptionMd, selectedPeople, happenedAt, tagsText, isInsideJoke, router]);

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <Link href="/friends/memories" style={{ color: TEXT_SEC, textDecoration: 'none', fontSize: 14 }}>
          &larr; Back
        </Link>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Add a memory</h1>
        <div style={{ width: 60 }} />
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: `${DANGER}15`, color: DANGER, fontSize: 14, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What happened?"
          style={inputStyle}
        />
      </div>

      {/* Description */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>What's the story?</label>
        <textarea
          value={descriptionMd}
          onChange={(e) => setDescriptionMd(e.target.value)}
          placeholder="The details you want to remember..."
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* People picker */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Who was there?</label>
        {loadingPeople ? (
          <p style={{ color: TEXT_SEC, fontSize: 14 }}>Loading people...</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allPeople.map((person) => {
              const selected = selectedPeople.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => togglePerson(person.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: `1px solid ${selected ? ACCENT : BORDER}`,
                    backgroundColor: selected ? `${ACCENT}15` : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: getAvatarColor(person.display_name),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#FFFFFF' }}>
                      {getInitials(person.display_name)}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: selected ? TEXT : TEXT_SEC }}>
                    {person.display_name}
                  </span>
                </button>
              );
            })}
            {allPeople.length === 0 && (
              <p style={{ fontSize: 14, color: '#9F8E81' }}>
                No people added yet.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Date */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>When?</label>
        <input
          type="datetime-local"
          value={happenedAt}
          onChange={(e) => setHappenedAt(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Tags */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Tags (comma-separated)</label>
        <input
          type="text"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="travel, funny, late-night..."
          style={inputStyle}
        />
      </div>

      {/* Inside joke toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 16px',
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: `1px solid ${BORDER}`,
        marginBottom: 32,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT }}>
            This is an inside joke
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC }}>
            {isInsideJoke ? 'Never forget why this is funny' : 'Mark if only your group would get it'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsInsideJoke(!isInsideJoke)}
          style={{
            width: 48,
            height: 28,
            borderRadius: 14,
            border: 'none',
            backgroundColor: isInsideJoke ? ACCENT : '#35343A',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          <span style={{
            position: 'absolute',
            top: 3,
            left: isInsideJoke ? 23 : 3,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: '#FFFFFF',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !title.trim()}
        style={{
          width: '100%',
          padding: '16px 0',
          borderRadius: 14,
          backgroundColor: ACCENT,
          color: '#FFFFFF',
          fontWeight: 700,
          fontSize: 16,
          border: 'none',
          cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
          opacity: saving || !title.trim() ? 0.5 : 1,
        }}
      >
        {saving ? 'Saving...' : 'Save Memory'}
      </button>
    </div>
  );
}
