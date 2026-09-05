'use client';

import type { CSSProperties } from 'react';
import { Suspense, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { addDish, fetchRestaurant, logMealMacrosFromDishes } from '../../actions';
import { COMMON_ALLERGENS } from '@mylife/dining';

const ACCENT = '#DC2626';
const ACCENT_DIM = 'rgba(220,38,38,0.15)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const DANGER = 'var(--danger)';

const COURSES = ['appetizer', 'main', 'dessert', 'side', 'drink', 'other'] as const;

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

function AddDishPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get('restaurantId') ?? '';
  const visitId = searchParams.get('visitId');

  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [wouldOrderAgain, setWouldOrderAgain] = useState(false);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [logToNutrition, setLogToNutrition] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [macroNotice, setMacroNotice] = useState<string | null>(null);

  const toggleAllergen = useCallback((allergen: string) => {
    setSelectedAllergens((prev) =>
      prev.includes(allergen) ? prev.filter((a) => a !== allergen) : [...prev, allergen],
    );
  }, []);

  const parsedCalories = calories ? parseFloat(calories) : NaN;
  const hasMacros = Number.isFinite(parsedCalories) && parsedCalories > 0;

  const handleSave = useCallback(async () => {
    if (!restaurantId || !name.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);
    setMacroNotice(null);

    try {
      const priceCents = price ? Math.round(parseFloat(price) * 100) : null;
      await addDish({
        restaurant_id: restaurantId,
        name: name.trim(),
        visit_id: visitId || null,
        course: (course || null) as 'appetizer' | 'main' | 'dessert' | 'side' | 'drink' | 'other' | null,
        rating,
        price_cents: priceCents,
        would_order_again: wouldOrderAgain ? 1 : 0,
        allergens: selectedAllergens.length > 0 ? JSON.stringify(selectedAllergens) : null,
        notes: notes.trim() || null,
      });

      if (logToNutrition && hasMacros) {
        const restaurant = await fetchRestaurant(restaurantId);
        const restaurantName = restaurant?.name ?? 'Restaurant';
        await logMealMacrosFromDishes({
          restaurantName,
          visitDate: new Date().toISOString().slice(0, 10),
          dishes: [
            {
              name: name.trim(),
              course: course || null,
              macros: {
                calories: parsedCalories,
                proteinG: protein ? parseFloat(protein) || 0 : 0,
                carbsG: carbs ? parseFloat(carbs) || 0 : 0,
                fatG: fat ? parseFloat(fat) || 0 : 0,
              },
            },
          ],
        });
      }

      if (visitId) {
        router.push(`/dining/visit/${visitId}`);
      } else {
        router.push(`/dining/restaurant/${restaurantId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dish');
    } finally {
      setIsSaving(false);
    }
  }, [
    restaurantId, name, visitId, course, rating, price, wouldOrderAgain,
    selectedAllergens, notes, isSaving, router, logToNutrition, hasMacros,
    parsedCalories, protein, carbs, fat,
  ]);

  const canSave = restaurantId && name.trim() && !isSaving;

  if (!restaurantId) {
    return (
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 24, color: TEXT }}>Missing restaurant</h1>
        <p style={{ margin: '10px 0 0', color: TEXT_SEC }}>
          A restaurant ID is required to add a dish.
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
        <span style={{ color: TEXT }}>Add Dish</span>
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
          Add a Dish
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
        {/* Name */}
        <div>
          <label style={labelStyle}>Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Margherita Pizza"
            style={inputStyle}
          />
        </div>

        {/* Course */}
        <div>
          <label style={labelStyle}>Course</label>
          <select
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">Select course...</option>
            {COURSES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Rating */}
        <StarPicker label="Rating" value={rating} onChange={setRating} />

        {/* Price + Would Order Again */}
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
            <label style={labelStyle}>Would Order Again</label>
            <button
              type="button"
              onClick={() => setWouldOrderAgain((prev) => !prev)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: `1px solid ${wouldOrderAgain ? ACCENT : 'var(--border)'}`,
                backgroundColor: wouldOrderAgain ? ACCENT_DIM : 'var(--surface)',
                color: wouldOrderAgain ? TEXT : TEXT_SEC,
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxSizing: 'border-box' as const,
              }}
            >
              {wouldOrderAgain ? 'Yes' : 'No'}
            </button>
          </div>
        </div>

        {/* Allergens */}
        <div>
          <label style={labelStyle}>Allergens</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COMMON_ALLERGENS.map((allergen) => {
              const selected = selectedAllergens.includes(allergen);
              return (
                <button
                  key={allergen}
                  type="button"
                  onClick={() => toggleAllergen(allergen)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: `1px solid ${selected ? '#F59E0B' : 'var(--border)'}`,
                    backgroundColor: selected ? 'rgba(245,158,11,0.15)' : 'var(--surface)',
                    color: selected ? '#F59E0B' : TEXT_SEC,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {allergen}
                </button>
              );
            })}
          </div>
        </div>

        {/* Macros */}
        <div>
          <label style={labelStyle}>Macros</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <div>
              <span style={macroLabelStyle}>Calories</span>
              <input
                type="number"
                min={0}
                step={1}
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div>
              <span style={macroLabelStyle}>Protein (g)</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div>
              <span style={macroLabelStyle}>Carbs (g)</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>
            <div>
              <span style={macroLabelStyle}>Fat (g)</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Log macros for this meal -> MyNutrition */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${logToNutrition ? ACCENT : 'var(--border)'}`,
            backgroundColor: logToNutrition ? ACCENT_DIM : 'var(--surface)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={logToNutrition}
            onChange={(e) => {
              setLogToNutrition(e.target.checked);
              setMacroNotice(e.target.checked && !hasMacros ? 'Add a calorie value to log this meal in MyNutrition.' : null);
            }}
            style={{ accentColor: ACCENT, width: 18, height: 18 }}
          />
          <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>
            Log macros for this meal
          </span>
          <span style={{ flex: 1, fontSize: 12, color: TEXT_SEC, textAlign: 'right' }}>
            Save to MyNutrition diary
          </span>
        </label>
        {macroNotice && (
          <p style={{ margin: '-12px 0 0', fontSize: 13, color: '#F59E0B' }}>{macroNotice}</p>
        )}

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Preparation style, flavor notes, modifications..."
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
          {isSaving ? 'Saving...' : 'Save Dish'}
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

const macroLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  marginBottom: 6,
  display: 'block',
};

const cardStyle: CSSProperties = {
  padding: 24,
  borderRadius: 20,
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
};

export default function AddDishPage() {
  return (
    <Suspense fallback={null}>
      <AddDishPageContent />
    </Suspense>
  );
}
