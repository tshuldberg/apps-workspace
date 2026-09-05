'use client';

import type { CSSProperties } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  parseEmailAction,
  addReservation,
  fetchRestaurants,
} from '../../actions';

interface RestaurantOption {
  id: string;
  name: string;
}

interface ParsedData {
  restaurantName: string | null;
  date: string | null;
  time: string | null;
  partySize: number | null;
  confirmationCode: string | null;
  platform: string | null;
}

const ACCENT = '#DC2626';
const ACCENT_DIM = 'rgba(220,38,38,0.15)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const DANGER = 'var(--danger)';

const PLATFORM_LABELS: Record<string, string> = {
  resy: 'Resy',
  opentable: 'OpenTable',
  tock: 'Tock',
  yelp: 'Yelp',
  phone: 'Phone',
  walkin: 'Walk-in',
  other: 'Other',
};

export default function ImportReservationPage() {
  const router = useRouter();

  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [emailText, setEmailText] = useState('');
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields after parsing
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [partySize, setPartySize] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [platform, setPlatform] = useState('');

  useEffect(() => {
    void fetchRestaurants({ sort_by: 'name', sort_dir: 'ASC', limit: 500 }).then((data) => {
      setRestaurants(
        (data as RestaurantOption[]).map((r) => ({ id: r.id, name: r.name })),
      );
    });
  }, []);

  const handleParse = useCallback(async () => {
    if (!emailText.trim() || isParsing) return;
    setIsParsing(true);
    setError(null);

    try {
      const result = await parseEmailAction(emailText);
      const data = result as ParsedData;
      setParsed(data);
      setRestaurantName(data.restaurantName ?? '');
      setDate(data.date ?? '');
      setTime(data.time ?? '');
      setPartySize(data.partySize != null ? String(data.partySize) : '2');
      setConfirmationCode(data.confirmationCode ?? '');
      setPlatform(data.platform ?? '');

      // Try to match restaurant name
      if (data.restaurantName) {
        const lowerName = data.restaurantName.toLowerCase();
        const match = restaurants.find((r) => r.name.toLowerCase() === lowerName);
        if (match) setRestaurantId(match.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse email');
    } finally {
      setIsParsing(false);
    }
  }, [emailText, isParsing, restaurants]);

  const handleCreate = useCallback(async () => {
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
        notes: null,
      });
      if (result && typeof result === 'object' && 'id' in result) {
        router.push(`/dining/reservation/${(result as { id: string }).id}`);
      } else {
        router.push('/dining/reservations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reservation');
    } finally {
      setIsSaving(false);
    }
  }, [restaurantId, date, time, partySize, confirmationCode, platform, isSaving, router]);

  const handleDismiss = () => {
    setParsed(null);
    setEmailText('');
    setRestaurantName('');
    setRestaurantId('');
    setDate('');
    setTime('');
    setPartySize('');
    setConfirmationCode('');
    setPlatform('');
  };

  const canCreate = restaurantId && date && time && partySize && parseInt(partySize, 10) > 0 && !isSaving;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC, marginBottom: 24 }}>
        <Link href="/dining" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Restaurants</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        <Link href="/dining/reservations" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Reservations</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        <span style={{ color: TEXT }}>Import from Email</span>
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
          Back
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: TEXT }}>
          Import from Email
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

      {!parsed ? (
        <div style={{ display: 'grid', gap: 24 }}>
          <div>
            <label style={labelStyle}>Paste Confirmation Email</label>
            <textarea
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="Paste the full text of your reservation confirmation email here..."
              rows={12}
              style={{
                ...inputStyle,
                resize: 'vertical' as const,
                minHeight: 200,
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => void handleParse()}
            disabled={!emailText.trim() || isParsing}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 14,
              border: 'none',
              backgroundColor: emailText.trim() && !isParsing ? ACCENT : ACCENT_DIM,
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight: 700,
              cursor: emailText.trim() && !isParsing ? 'pointer' : 'default',
              fontFamily: 'inherit',
              opacity: emailText.trim() && !isParsing ? 1 : 0.5,
            }}
          >
            {isParsing ? 'Parsing...' : 'Parse Email'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          {/* Parsed results */}
          <div style={cardStyle}>
            <h2 style={sectionHeading}>Extracted Details</h2>
            <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
              {/* Restaurant name (read-only info) */}
              {restaurantName && (
                <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC }}>
                  Detected restaurant: <span style={{ color: TEXT, fontWeight: 600 }}>{restaurantName}</span>
                </p>
              )}
              {platform && (
                <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC }}>
                  Platform: <span style={{ color: TEXT, fontWeight: 600 }}>{PLATFORM_LABELS[platform] ?? platform}</span>
                </p>
              )}
            </div>
          </div>

          {/* Editable form */}
          <div>
            <label style={labelStyle}>Match to Restaurant *</label>
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
            {!restaurantId && restaurantName && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: TEXT_SEC }}>
                No match found for &quot;{restaurantName}&quot;. Select the closest match or add the restaurant first.
              </p>
            )}
          </div>

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Party Size *</label>
              <input
                type="number"
                min={1}
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirmation Code</label>
              <input
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!canCreate}
              style={{
                flex: 1,
                padding: '16px',
                borderRadius: 14,
                border: 'none',
                backgroundColor: canCreate ? ACCENT : ACCENT_DIM,
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: 700,
                cursor: canCreate ? 'pointer' : 'default',
                fontFamily: 'inherit',
                opacity: canCreate ? 1 : 0.5,
              }}
            >
              {isSaving ? 'Creating...' : 'Create Reservation'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                padding: '16px 24px',
                borderRadius: 14,
                border: `1px solid ${BORDER}`,
                backgroundColor: 'transparent',
                color: TEXT_SEC,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const BORDER = 'var(--border)';

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

const cardStyle: CSSProperties = {
  padding: 24,
  borderRadius: 20,
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
};

const sectionHeading: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
};
