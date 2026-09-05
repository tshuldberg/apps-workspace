'use client';

import type { CSSProperties } from 'react';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { addVisit, fetchRestaurants } from '../../actions';

interface RestaurantOption {
  id: string;
  name: string;
}

const ACCENT = '#DC2626';
const ACCENT_DIM = 'rgba(220,38,38,0.15)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const DANGER = 'var(--danger)';

const OCCASIONS = ['Birthday', 'Anniversary', 'Date Night', 'Business', 'Casual', 'Special'] as const;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function StarPicker({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
        {required && ' *'}
      </label>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n && !required ? null : n)}
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
        {value != null && !required && (
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

function AddVisitPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRestaurantId = searchParams.get('restaurantId');

  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [restaurantId, setRestaurantId] = useState(preselectedRestaurantId ?? '');
  const [visitedAt, setVisitedAt] = useState(todayISO());
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [vibeRating, setVibeRating] = useState<number | null>(null);
  const [foodRating, setFoodRating] = useState<number | null>(null);
  const [serviceRating, setServiceRating] = useState<number | null>(null);
  const [partySize, setPartySize] = useState('');
  const [occasion, setOccasion] = useState('');
  const [notes, setNotes] = useState('');
  const [companionInput, setCompanionInput] = useState('');
  const [companions, setCompanions] = useState<string[]>([]);
  const [totalCost, setTotalCost] = useState('');
  const [linkToBudget, setLinkToBudget] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchRestaurants({ sort_by: 'name', sort_dir: 'ASC', limit: 500 }).then((data) => {
      setRestaurants(
        (data as RestaurantOption[]).map((r) => ({ id: r.id, name: r.name })),
      );
    });
  }, []);

  const addCompanion = useCallback(() => {
    const trimmed = companionInput.trim();
    if (!trimmed) return;
    if (companions.includes(trimmed)) return;
    setCompanions((prev) => [...prev, trimmed]);
    setCompanionInput('');
  }, [companionInput, companions]);

  const removeCompanion = useCallback((name: string) => {
    setCompanions((prev) => prev.filter((c) => c !== name));
  }, []);

  const handleSave = useCallback(async () => {
    if (!restaurantId || !overallRating || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const totalCostCents = totalCost ? Math.round(parseFloat(totalCost) * 100) || null : null;
      const selectedRestaurantName = restaurants.find((r) => r.id === restaurantId)?.name ?? '';

      await addVisit(
        {
          restaurant_id: restaurantId,
          visited_at: visitedAt,
          overall_rating: overallRating,
          vibe_rating: vibeRating,
          food_rating: foodRating,
          service_rating: serviceRating,
          party_size: partySize ? parseInt(partySize, 10) : null,
          occasion: (occasion || null) as 'Birthday' | 'Anniversary' | 'Date Night' | 'Business' | 'Casual' | 'Special' | null,
          notes_md: notes.trim() || null,
          total_cost_cents: totalCostCents,
        },
        companions,
      );

      if (linkToBudget) {
        const desc = encodeURIComponent(selectedRestaurantName);
        router.push(`/budget/add?category=Dining+Out&amount=${totalCostCents ?? ''}&desc=${desc}&date=${visitedAt}&source=dining`);
      } else if (preselectedRestaurantId) {
        router.push(`/dining/restaurant/${preselectedRestaurantId}`);
      } else {
        router.push('/dining/visits');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save visit');
    } finally {
      setIsSaving(false);
    }
  }, [
    restaurantId, visitedAt, overallRating, vibeRating, foodRating,
    serviceRating, partySize, occasion, notes, totalCost, companions,
    linkToBudget, restaurants, isSaving, router, preselectedRestaurantId,
  ]);

  const canSave = restaurantId && overallRating && !isSaving;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC, marginBottom: 24 }}>
        <Link href="/dining" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Restaurants</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        <Link href="/dining/visits" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Visits</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        <span style={{ color: TEXT }}>Log Visit</span>
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
          Log a Visit
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
            style={{
              ...inputStyle,
              cursor: 'pointer',
            }}
          >
            <option value="">Select a restaurant...</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label style={labelStyle}>Date *</label>
          <input
            type="date"
            value={visitedAt}
            onChange={(e) => setVisitedAt(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Overall Rating */}
        <StarPicker
          label="Overall Rating"
          value={overallRating}
          onChange={setOverallRating}
          required
        />

        {/* Sub-ratings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <StarPicker label="Vibe" value={vibeRating} onChange={setVibeRating} />
          <StarPicker label="Food" value={foodRating} onChange={setFoodRating} />
          <StarPicker label="Service" value={serviceRating} onChange={setServiceRating} />
        </div>

        {/* Party Size + Occasion */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Party Size</label>
            <input
              type="number"
              min={1}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              placeholder="2"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Occasion</label>
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">None</option>
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Companions */}
        <div>
          <label style={labelStyle}>Companions</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={companionInput}
              onChange={(e) => setCompanionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCompanion();
                }
              }}
              placeholder="Add a dining companion..."
              style={{ ...inputStyle, flex: 1 }}
            />
            {companionInput.trim().length > 0 && (
              <button
                type="button"
                onClick={addCompanion}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  backgroundColor: ACCENT,
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                Add
              </button>
            )}
          </div>
          {companions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {companions.map((name) => (
                <span
                  key={name}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 999,
                    backgroundColor: ACCENT_DIM,
                    color: TEXT,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => removeCompanion(name)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: TEXT_SEC,
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    {'\u00D7'}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Total Cost */}
        <div>
          <label style={labelStyle}>Total Cost ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value)}
            placeholder="0.00"
            style={inputStyle}
          />
        </div>

        {/* Link to Budget */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={linkToBudget}
            onChange={(e) => setLinkToBudget(e.target.checked)}
            style={{ accentColor: ACCENT, width: 18, height: 18 }}
          />
          <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>
            Link to Budget
          </span>
          <span style={{ flex: 1, fontSize: 12, color: TEXT_SEC, textAlign: 'right' }}>
            Log as &quot;Dining Out&quot; expense
          </span>
        </label>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What you ordered, highlights, things to remember..."
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
          {isSaving ? 'Saving...' : 'Save Visit'}
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

export default function AddVisitPage() {
  return (
    <Suspense fallback={null}>
      <AddVisitPageContent />
    </Suspense>
  );
}
