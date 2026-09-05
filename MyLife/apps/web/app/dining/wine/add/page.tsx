'use client';

import type { CSSProperties } from 'react';
import { Suspense, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { addWine } from '../../actions';

const ACCENT = '#DC2626';
const ACCENT_DIM = 'rgba(220,38,38,0.15)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const DANGER = 'var(--danger)';

const WINE_COLORS = ['red', 'white', 'rose', 'sparkling', 'orange', 'dessert'] as const;
const COLOR_LABELS: Record<string, string> = {
  red: 'Red',
  white: 'White',
  rose: 'Ros\u00e9',
  sparkling: 'Sparkling',
  orange: 'Orange',
  dessert: 'Dessert',
};

function StarPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 28,
              color: value != null && n <= value ? '#FFB877' : 'rgba(255,255,255,0.15)',
              padding: '2px 4px',
            }}
          >
            {'\u2605'}
          </button>
        ))}
        {value != null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: TEXT_SEC,
              padding: '2px 8px',
              fontFamily: 'inherit',
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function AddWinePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get('restaurantId') ?? '';
  const visitId = searchParams.get('visitId');

  const [producer, setProducer] = useState('');
  const [name, setName] = useState('');
  const [vintage, setVintage] = useState('');
  const [region, setRegion] = useState('');
  const [varietal, setVarietal] = useState('');
  const [color, setColor] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [byGlass, setByGlass] = useState(false);
  const [pairingNotes, setPairingNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!restaurantId || !producer.trim() || !name.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const priceCents = price ? Math.round(parseFloat(price) * 100) : null;
      await addWine({
        restaurant_id: restaurantId,
        producer: producer.trim(),
        name: name.trim(),
        visit_id: visitId || null,
        vintage: vintage ? parseInt(vintage, 10) : null,
        region: region.trim() || null,
        varietal: varietal.trim() || null,
        color: (color || null) as 'red' | 'white' | 'rose' | 'sparkling' | 'orange' | 'dessert' | null,
        rating,
        price_cents: priceCents,
        by_glass: byGlass ? 1 : 0,
        pairing_notes: pairingNotes.trim() || null,
      });
      if (visitId) {
        router.push(`/dining/visit/${visitId}`);
      } else {
        router.push(`/dining/restaurant/${restaurantId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save wine');
    } finally {
      setIsSaving(false);
    }
  }, [restaurantId, producer, name, visitId, vintage, region, varietal, color, rating, price, byGlass, pairingNotes, isSaving, router]);

  const canSave = restaurantId && producer.trim() && name.trim() && !isSaving;

  if (!restaurantId) {
    return (
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 24, color: TEXT }}>Missing restaurant</h1>
        <p style={{ margin: '10px 0 0', color: TEXT_SEC }}>
          A restaurant ID is required to add a wine.
        </p>
        <Link href="/dining" style={{ display: 'inline-block', marginTop: 16, color: ACCENT, fontWeight: 700 }}>
          Back to Restaurants
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC, marginBottom: 24 }}>
        <Link href="/dining" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Restaurants</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        <span style={{ color: TEXT }}>Add Wine</span>
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
          Add a Wine
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
        {/* Producer + Name */}
        <div>
          <label style={labelStyle}>Producer *</label>
          <input
            type="text"
            value={producer}
            onChange={(e) => setProducer(e.target.value)}
            placeholder="e.g. Chateau Margaux"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Wine Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grand Vin 2015"
            style={inputStyle}
          />
        </div>

        {/* Vintage + Region */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Vintage</label>
            <input
              type="number"
              min={1900}
              max={2099}
              value={vintage}
              onChange={(e) => setVintage(e.target.value)}
              placeholder="2020"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Region</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Bordeaux"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Varietal + Color */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Varietal</label>
            <input
              type="text"
              value={varietal}
              onChange={(e) => setVarietal(e.target.value)}
              placeholder="e.g. Cabernet Sauvignon"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Color</label>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select color...</option>
              {WINE_COLORS.map((c) => (
                <option key={c} value={c}>
                  {COLOR_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rating */}
        <StarPicker label="Rating" value={rating} onChange={setRating} />

        {/* Price + By Glass */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Price ($)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>By the Glass</label>
            <button
              type="button"
              onClick={() => setByGlass((prev) => !prev)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: `1px solid ${byGlass ? ACCENT : 'var(--border)'}`,
                backgroundColor: byGlass ? ACCENT_DIM : 'var(--surface)',
                color: byGlass ? TEXT : TEXT_SEC,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxSizing: 'border-box' as const,
              }}
            >
              {byGlass ? 'Glass' : 'Bottle'}
            </button>
          </div>
        </div>

        {/* Pairing Notes */}
        <div>
          <label style={labelStyle}>Pairing Notes</label>
          <textarea
            value={pairingNotes}
            onChange={(e) => setPairingNotes(e.target.value)}
            placeholder="What did this pair well with?"
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
          {isSaving ? 'Saving...' : 'Save Wine'}
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

const cardStyle: CSSProperties = {
  padding: 24,
  borderRadius: 20,
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
};

export default function AddWinePage() {
  return (
    <Suspense fallback={null}>
      <AddWinePageContent />
    </Suspense>
  );
}
