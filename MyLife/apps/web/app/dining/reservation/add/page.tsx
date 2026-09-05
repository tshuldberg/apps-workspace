'use client';

import type { CSSProperties } from 'react';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { addReservation, fetchRestaurants } from '../../actions';

interface RestaurantOption {
  id: string;
  name: string;
}

const ACCENT = '#DC2626';
const ACCENT_DIM = 'rgba(220,38,38,0.15)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const DANGER = 'var(--danger)';

const PLATFORMS = ['resy', 'opentable', 'tock', 'yelp', 'phone', 'walkin', 'other'] as const;
const PLATFORM_LABELS: Record<string, string> = {
  resy: 'Resy',
  opentable: 'OpenTable',
  tock: 'Tock',
  yelp: 'Yelp',
  phone: 'Phone',
  walkin: 'Walk-in',
  other: 'Other',
};

const REMINDER_OPTIONS = [
  { label: 'None', value: '' },
  { label: '90 min before', value: '90' },
  { label: '1 day before', value: '1440' },
  { label: '1 week before', value: '10080' },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function AddReservationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRestaurantId = searchParams.get('restaurantId');

  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantId, setRestaurantId] = useState(preselectedRestaurantId ?? '');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('19:00');
  const [partySize, setPartySize] = useState('2');
  const [platform, setPlatform] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [reminder, setReminder] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchRestaurants({ sort_by: 'name', sort_dir: 'ASC', limit: 500 }).then((data) => {
      setRestaurants(
        (data as RestaurantOption[]).map((r) => ({ id: r.id, name: r.name })),
      );
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!restaurantId || !date || !time || !partySize || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const reservedAt = `${date}T${time}:00`;
      const result = await addReservation({
        restaurant_id: restaurantId,
        reserved_at: reservedAt,
        party_size: parseInt(partySize, 10),
        confirmation_code: confirmationCode.trim() || null,
        platform: (platform || null) as 'resy' | 'opentable' | 'tock' | 'yelp' | 'phone' | 'walkin' | 'other' | null,
        reminder_minutes: reminder ? parseInt(reminder, 10) : null,
        notes: notes.trim() || null,
      });
      if (result && typeof result === 'object' && 'id' in result) {
        router.push(`/dining/reservation/${(result as { id: string }).id}`);
      } else {
        router.push('/dining/reservations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save reservation');
    } finally {
      setIsSaving(false);
    }
  }, [restaurantId, date, time, partySize, platform, confirmationCode, reminder, notes, isSaving, router]);

  const canSave = restaurantId && date && time && partySize && parseInt(partySize, 10) > 0 && !isSaving;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC, marginBottom: 24 }}>
        <Link href="/dining" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Restaurants</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        <Link href="/dining/reservations" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Reservations</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        <span style={{ color: TEXT }}>Add Reservation</span>
      </nav>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            color: ACCENT,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: 0,
          }}
        >
          Cancel
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: TEXT }}>
          Add Reservation
        </h1>
        <div style={{ width: 50 }} />
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: `1px solid ${DANGER}`,
            backgroundColor: 'rgba(220,38,38,0.08)',
            color: DANGER,
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: 24 }}>
        {/* Restaurant picker */}
        <div>
          <label style={labelStyle}>Restaurant *</label>
          <select
            value={restaurantId}
            onChange={(e) => setRestaurantId(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">Select a restaurant...</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date + Time */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Time *</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Party Size */}
        <div>
          <label style={labelStyle}>Party Size *</label>
          <input
            type="number"
            min={1}
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
            placeholder="2"
            style={inputStyle}
          />
        </div>

        {/* Platform */}
        <div>
          <label style={labelStyle}>Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">Select platform...</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        {/* Confirmation Code */}
        <div>
          <label style={labelStyle}>Confirmation Code</label>
          <input
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            placeholder="e.g. ABC123"
            style={inputStyle}
          />
        </div>

        {/* Reminder */}
        <div>
          <label style={labelStyle}>Reminder</label>
          <select
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {REMINDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special requests, dietary needs, occasion..."
            rows={4}
            style={{
              ...inputStyle,
              resize: 'vertical' as const,
              minHeight: 100,
            }}
          />
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 14,
            border: 'none',
            backgroundColor: canSave ? ACCENT : ACCENT_DIM,
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: 700,
            cursor: canSave ? 'pointer' : 'default',
            fontFamily: 'inherit',
            opacity: canSave ? 1 : 0.5,
            marginBottom: 40,
          }}
        >
          {isSaving ? 'Saving...' : 'Save Reservation'}
        </button>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  backgroundColor: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.2,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  marginBottom: 8,
  display: 'block',
};

export default function AddReservationPage() {
  return (
    <Suspense fallback={null}>
      <AddReservationPageContent />
    </Suspense>
  );
}
