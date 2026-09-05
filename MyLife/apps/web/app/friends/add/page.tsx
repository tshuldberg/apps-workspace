'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addPerson } from '../actions';
import type { PersonInput, RelationshipType, EnergyTag } from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const SURFACE = 'var(--surface-elevated, #2A292F)';
const DANGER = '#EF4444';

const RELATIONSHIP_OPTIONS: { key: RelationshipType; label: string }[] = [
  { key: 'friend', label: 'Friend' },
  { key: 'close_friend', label: 'Close friend' },
  { key: 'family', label: 'Family' },
  { key: 'partner', label: 'Partner' },
  { key: 'colleague', label: 'Colleague' },
  { key: 'acquaintance', label: 'Acquaintance' },
  { key: 'mentor', label: 'Mentor' },
  { key: 'neighbor', label: 'Neighbor' },
  { key: 'ex', label: 'Ex' },
];

const ENERGY_OPTIONS: { key: EnergyTag; label: string; color: string }[] = [
  { key: 'energizing', label: 'Energizing', color: '#10B981' },
  { key: 'neutral', label: 'Neutral', color: '#9F8E81' },
  { key: 'draining', label: 'Draining', color: '#EF4444' },
  { key: 'complicated', label: 'Complicated', color: '#F59E0B' },
];

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

export default function AddPersonPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('friend');
  const [howMet, setHowMet] = useState('');
  const [whereMet, setWhereMet] = useState('');
  const [whenMet, setWhenMet] = useState('');
  const [birthday, setBirthday] = useState('');
  const [city, setCity] = useState('');
  const [interestsText, setInterestsText] = useState('');
  const [energyTag, setEnergyTag] = useState<EnergyTag | null>(null);
  const [frequencyDays, setFrequencyDays] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    setError('');
    setSaving(true);

    try {
      const interests = interestsText.split(',').map((t) => t.trim()).filter(Boolean);

      const input: PersonInput = {
        display_name: trimmedName,
        relationship_type: relationshipType,
        how_met: howMet.trim() || undefined,
        where_met: whereMet.trim() || undefined,
        when_met: whenMet.trim() || undefined,
        birthday: birthday.trim() || undefined,
        city: city.trim() || undefined,
        interests: interests.length > 0 ? interests : undefined,
        energy_tag: energyTag ?? undefined,
        frequency_goal_days: frequencyDays ? parseInt(frequencyDays, 10) || undefined : undefined,
      };

      const person = await addPerson(input);
      router.push(`/friends/${person.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [name, relationshipType, howMet, whereMet, whenMet, birthday, city, interestsText, energyTag, frequencyDays, router]);

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <Link href="/friends" style={{ color: TEXT_SEC, textDecoration: 'none', fontSize: 14 }}>
          &larr; Back
        </Link>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Add a friend</h1>
        <div style={{ width: 60 }} />
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: `${DANGER}15`, color: DANGER, fontSize: 14, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Name */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Who is this person?"
          style={{ ...inputStyle, fontSize: 20, fontWeight: 600, padding: '14px 16px' }}
          autoFocus
        />
      </div>

      {/* Relationship type */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Who is this person to you?</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {RELATIONSHIP_OPTIONS.map((opt) => {
            const active = relationshipType === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRelationshipType(opt.key)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
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

      {/* How did you meet */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>How did you meet?</label>
        <textarea
          value={howMet}
          onChange={(e) => setHowMet(e.target.value)}
          placeholder="Through a friend, at work, online..."
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Where/when */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div>
          <label style={labelStyle}>Where?</label>
          <input
            type="text"
            value={whereMet}
            onChange={(e) => setWhereMet(e.target.value)}
            placeholder="City, venue..."
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>When?</label>
          <input
            type="text"
            value={whenMet}
            onChange={(e) => setWhenMet(e.target.value)}
            placeholder="2024, last summer..."
            style={inputStyle}
          />
        </div>
      </div>

      {/* Birthday */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Birthday</label>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* City */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>City</label>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Where do they live?"
          style={inputStyle}
        />
      </div>

      {/* Interests */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Interests</label>
        <input
          type="text"
          value={interestsText}
          onChange={(e) => setInterestsText(e.target.value)}
          placeholder="hiking, cooking, music (comma-separated)"
          style={inputStyle}
        />
      </div>

      {/* More options toggle */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          style={{
            background: 'none',
            border: 'none',
            color: ACCENT,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {showMore ? 'Less options' : 'More options'}
        </button>
      </div>

      {showMore && (
        <>
          {/* Energy tag */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Energy</label>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9F8E81' }}>How does time with this person feel?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ENERGY_OPTIONS.map((opt) => {
                const active = energyTag === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setEnergyTag(active ? null : opt.key)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: `1px solid ${active ? opt.color : BORDER}`,
                      backgroundColor: active ? opt.color : 'transparent',
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

          {/* Frequency goal */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Catch-up goal</label>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9F8E81' }}>How often do you want to see them? (days)</p>
            <input
              type="number"
              value={frequencyDays}
              onChange={(e) => setFrequencyDays(e.target.value)}
              placeholder="e.g. 14"
              style={{ ...inputStyle, maxWidth: 120 }}
            />
          </div>
        </>
      )}

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
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
