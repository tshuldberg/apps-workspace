'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addHangout, fetchPeopleMap } from '../actions';
import type { PersonRecord, ActivityTag } from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const SURFACE = 'var(--surface-elevated, #2A292F)';
const DANGER = '#EF4444';

const ACTIVITY_OPTIONS: { key: ActivityTag; emoji: string; label: string }[] = [
  { key: 'coffee', emoji: '\u2615', label: 'Coffee' },
  { key: 'dinner', emoji: '\uD83C\uDF7D\uFE0F', label: 'Dinner' },
  { key: 'lunch', emoji: '\uD83E\uDD57', label: 'Lunch' },
  { key: 'drinks', emoji: '\uD83C\uDF7B', label: 'Drinks' },
  { key: 'hike', emoji: '\uD83E\uDD7E', label: 'Hike' },
  { key: 'movie', emoji: '\uD83C\uDFAC', label: 'Movie' },
  { key: 'gaming', emoji: '\uD83C\uDFAE', label: 'Gaming' },
  { key: 'party', emoji: '\uD83C\uDF89', label: 'Party' },
  { key: 'study', emoji: '\uD83D\uDCDA', label: 'Study' },
  { key: 'work', emoji: '\uD83D\uDCBC', label: 'Work' },
  { key: 'gym', emoji: '\uD83D\uDCAA', label: 'Gym' },
  { key: 'shopping', emoji: '\uD83D\uDECD\uFE0F', label: 'Shopping' },
  { key: 'concert', emoji: '\uD83C\uDFB5', label: 'Concert' },
  { key: 'travel', emoji: '\u2708\uFE0F', label: 'Travel' },
  { key: 'random', emoji: '\uD83C\uDFB2', label: 'Random' },
];

const DURATION_OPTIONS: { label: string; minutes: number }[] = [
  { label: '30min', minutes: 30 },
  { label: '1hr', minutes: 60 },
  { label: '2hr', minutes: 120 },
  { label: '3hr', minutes: 180 },
  { label: 'Half-day', minutes: 360 },
  { label: 'Full day', minutes: 720 },
];

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

export default function AddHangoutPage() {
  const router = useRouter();

  const [peopleMap, setPeopleMap] = useState<Record<string, PersonRecord>>({});
  const [loadingPeople, setLoadingPeople] = useState(true);

  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [happenedAt, setHappenedAt] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [activityTags, setActivityTags] = useState<ActivityTag[]>([]);
  const [qualityRating, setQualityRating] = useState<number | null>(null);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchPeopleMap().then((m) => {
      setPeopleMap(m);
      setLoadingPeople(false);
    }).catch(() => setLoadingPeople(false));
  }, []);

  const allPeople = useMemo(() => {
    return Object.values(peopleMap).filter((p) => !p.is_archived);
  }, [peopleMap]);

  const filteredPeople = useMemo(() => {
    if (!peopleSearch.trim()) return allPeople;
    const q = peopleSearch.toLowerCase();
    return allPeople.filter((p) =>
      p.display_name.toLowerCase().includes(q),
    );
  }, [allPeople, peopleSearch]);

  const togglePerson = useCallback((id: string) => {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  const toggleActivity = useCallback((tag: ActivityTag) => {
    setActivityTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (selectedPeople.length === 0) {
      setError('Pick at least one person.');
      return;
    }
    setError('');
    setSaving(true);

    try {
      await addHangout({
        people_ids: selectedPeople,
        happened_at: new Date(happenedAt).toISOString(),
        duration_minutes: durationMinutes ?? undefined,
        activity_tags: activityTags,
        quality_rating: qualityRating ?? undefined,
        location_name: location.trim() || undefined,
        notes_md: notes.trim() || undefined,
      });
      router.push('/friends/hangouts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [selectedPeople, happenedAt, durationMinutes, activityTags, qualityRating, location, notes, router]);

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <Link href="/friends/hangouts" style={{ color: TEXT_SEC, textDecoration: 'none', fontSize: 14 }}>
          &larr; Back
        </Link>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Log a hangout</h1>
        <div style={{ width: 60 }} />
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: `${DANGER}15`, color: DANGER, fontSize: 14, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* People picker */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Who was there?</label>
        <input
          type="text"
          value={peopleSearch}
          onChange={(e) => setPeopleSearch(e.target.value)}
          placeholder="Search people..."
          style={{ ...inputStyle, marginBottom: 8 }}
        />
        {loadingPeople ? (
          <p style={{ color: TEXT_SEC, fontSize: 14 }}>Loading people...</p>
        ) : (
          <div style={{ display: 'grid', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
            {filteredPeople.map((person) => {
              const selected = selectedPeople.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => togglePerson(person.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: 'none',
                    backgroundColor: selected ? `${ACCENT}15` : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: getAvatarColor(person.display_name),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>
                      {getInitials(person.display_name)}
                    </span>
                  </div>
                  <span style={{ flex: 1, fontSize: 15, color: TEXT }}>
                    {person.display_name}
                  </span>
                  <span style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: selected ? `1.5px solid ${ACCENT}` : `1.5px solid ${BORDER}`,
                    backgroundColor: selected ? ACCENT : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    flexShrink: 0,
                  }}>
                    {selected ? '\u2713' : ''}
                  </span>
                </button>
              );
            })}
            {filteredPeople.length === 0 && (
              <p style={{ fontSize: 14, color: '#9F8E81', textAlign: 'center', padding: 16 }}>
                No people found.
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

      {/* Duration */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>How long?</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DURATION_OPTIONS.map((opt) => {
            const active = durationMinutes === opt.minutes;
            return (
              <button
                key={opt.minutes}
                type="button"
                onClick={() => setDurationMinutes(active ? null : opt.minutes)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 999,
                  border: `1px solid ${active ? ACCENT : BORDER}`,
                  backgroundColor: active ? ACCENT : 'transparent',
                  color: active ? '#FFFFFF' : TEXT_SEC,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Activity tags */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>What did you do?</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ACTIVITY_OPTIONS.map((opt) => {
            const active = activityTags.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleActivity(opt.key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 72,
                  padding: '10px 0',
                  borderRadius: 12,
                  border: `1px solid ${active ? ACCENT : BORDER}`,
                  backgroundColor: active ? `${ACCENT}20` : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 22, marginBottom: 4 }}>{opt.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? ACCENT : TEXT_SEC }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quality rating */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>How was your time?</label>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const active = qualityRating === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setQualityRating(active ? null : n)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: qualityRating != null && n <= qualityRating ? ACCENT : '#35343A',
                }} />
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: active ? ACCENT : '#9F8E81',
                }}>
                  {QUALITY_LABELS[n]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Location */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Where?</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Coffee shop, park, their place..."
          style={inputStyle}
        />
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you talk about? Any highlights?"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%',
          padding: '16px 0',
          borderRadius: 14,
          backgroundColor: ACCENT,
          color: '#FFFFFF',
          fontWeight: 700,
          fontSize: 16,
          border: 'none',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
          marginTop: 8,
        }}
      >
        {saving ? 'Saving...' : 'Save Hangout'}
      </button>
    </div>
  );
}
