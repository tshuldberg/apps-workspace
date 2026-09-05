'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { searchDishesAction, getDishBySlugAction } from '../cloud-actions';
import { fetchRecipes } from '../actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DishSummary {
  id: string;
  name: string;
  slug: string;
  nativeName: string | null;
  category: string;
  cuisine: string;
}

interface LocalRecipe {
  id: string;
  title: string;
  description: string | null;
  image_uri: string | null;
  difficulty: string | null;
}

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const T = {
  bg: '#131318',
  surfaceLow: '#1B1B20',
  surface: '#1F1F25',
  surfaceHigh: '#2A292F',
  surfaceHighest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#22C55E',
  accentLight: '#4ADE80',
  gold: '#C9894D',
  goldLight: '#FFB877',
  dimText: 'rgba(228,225,233,0.45)',
  danger: '#FFB4AB',
} as const;

const MAX_SUBMISSIONS = 3;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function SubmitPageContent() {
  const searchParams = useSearchParams();
  const preselectedDish = searchParams.get('dish');

  // Steps: 1=select dish, 2=select recipe, 3=photos, 4=location, 5=review, 6=success
  const [step, setStep] = useState(preselectedDish ? 2 : 1);
  const [selectedDish, setSelectedDish] = useState<DishSummary | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<LocalRecipe | null>(null);
  const [chefLocation, setChefLocation] = useState('');
  const [chefOrigin, setChefOrigin] = useState('');

  // Dish search
  const [dishQuery, setDishQuery] = useState('');
  const [dishResults, setDishResults] = useState<DishSummary[]>([]);
  const [dishLoading, setDishLoading] = useState(false);

  // Local recipes
  const [localRecipes, setLocalRecipes] = useState<LocalRecipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Load preselected dish
  useEffect(() => {
    if (preselectedDish) {
      getDishBySlugAction(preselectedDish).then((result) => {
        if (result.ok && result.data) {
          setSelectedDish(result.data as unknown as DishSummary);
          setStep(2);
        }
      });
    }
  }, [preselectedDish]);

  // Dish search
  useEffect(() => {
    if (!dishQuery.trim()) {
      setDishResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setDishLoading(true);
      try {
        const result = await searchDishesAction(dishQuery);
        if (result.ok && result.data) {
          setDishResults(result.data as unknown as DishSummary[]);
        }
      } finally {
        setDishLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [dishQuery]);

  // Load local recipes when on step 2
  useEffect(() => {
    if (step === 2 && localRecipes.length === 0) {
      setRecipesLoading(true);
      fetchRecipes().then((data) => {
        setLocalRecipes((data ?? []) as LocalRecipe[]);
        setRecipesLoading(false);
      });
    }
  }, [step]);

  const handleSubmit = async () => {
    if (!selectedDish || !selectedRecipe) return;
    setSubmitting(true);
    try {
      // In production this would call publishRecipeToCloud via a server action.
      // For now, simulate success after a brief delay.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSubmitted(true);
      setStep(6);
    } catch {
      // Error handling in production
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Shared styles                                                    */
  /* ---------------------------------------------------------------- */

  const cardStyle: React.CSSProperties = {
    background: T.surfaceLow,
    borderRadius: 16,
    padding: 32,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 12,
    border: 'none',
    background: T.surfaceHigh,
    color: T.text,
    fontSize: 14,
    outline: 'none',
  };

  const stepIndicatorStyle = (active: boolean, completed: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: 9999,
    background: completed ? T.accent : active ? T.surfaceHighest : T.surfaceHigh,
    color: completed ? '#131318' : active ? T.text : T.dimText,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  });

  const stepLabelStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 11,
    fontWeight: 600,
    color: active ? T.text : T.dimText,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  });

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Link
          href="/recipes/dishes"
          style={{
            color: T.textSecondary,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            marginBottom: 16,
            display: 'inline-block',
          }}
        >
          &#x2190; Back to Dishes
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Submit Your Recipe
        </h1>
        <p style={{ fontSize: 14, color: T.textSecondary }}>
          Share your recipe with the world and compete for the top spot.
        </p>
      </div>

      {/* Step indicators */}
      <div style={{
        display: 'flex',
        gap: 24,
        marginBottom: 40,
        alignItems: 'center',
      }}>
        {[
          { num: 1, label: 'Dish' },
          { num: 2, label: 'Recipe' },
          { num: 3, label: 'Photos' },
          { num: 4, label: 'Location' },
          { num: 5, label: 'Review' },
        ].map((s, i) => (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={stepIndicatorStyle(step === s.num, step > s.num)}>
              {step > s.num ? '\u2713' : s.num}
            </div>
            <span style={stepLabelStyle(step >= s.num)}>{s.label}</span>
            {i < 4 && (
              <div style={{
                width: 32,
                height: 1,
                background: step > s.num ? T.accent : 'rgba(255,255,255,0.1)',
                marginLeft: 8,
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select dish */}
      {step === 1 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
            Which dish are you submitting for?
          </h2>
          <input
            type="text"
            placeholder="Search for a dish (e.g., Pad Thai, Ramen, Tacos)..."
            value={dishQuery}
            onChange={(e) => setDishQuery(e.target.value)}
            style={inputStyle}
          />

          {dishLoading && (
            <div style={{ padding: '16px 0', color: T.dimText, fontSize: 14 }}>
              Searching...
            </div>
          )}

          {dishResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              {dishResults.map((dish) => (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => {
                    setSelectedDish(dish);
                    setStep(2);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: 'none',
                    background: T.surfaceHigh,
                    color: T.text,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s',
                    width: '100%',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {dish.name}
                      {dish.nativeName && (
                        <span style={{ fontWeight: 400, color: T.textSecondary, fontStyle: 'italic', marginLeft: 8 }}>
                          {dish.nativeName}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: T.textSecondary }}>
                      {dish.cuisine} - {dish.category}
                    </div>
                  </div>
                  <span style={{ color: T.accent, fontSize: 14 }}>&#x2192;</span>
                </button>
              ))}
            </div>
          )}

          {dishQuery.trim() && !dishLoading && dishResults.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
              No dishes found. Try a different search term.
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select recipe */}
      {step === 2 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                Select a recipe
              </h2>
              {selectedDish && (
                <p style={{ fontSize: 13, color: T.textSecondary }}>
                  Submitting for: <strong style={{ color: T.accent }}>{selectedDish.name}</strong>
                </p>
              )}
            </div>
            <span style={{
              padding: '6px 14px',
              borderRadius: 9999,
              background: T.surfaceHighest,
              fontSize: 11,
              fontWeight: 700,
              color: T.goldLight,
            }}>
              0 of {MAX_SUBMISSIONS} used
            </span>
          </div>

          {recipesLoading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: T.dimText, fontSize: 14 }}>
              Loading your recipes...
            </div>
          ) : localRecipes.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: T.dimText }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u{1F4D6}'}</div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No recipes in your library.</div>
              <Link
                href="/recipes/add"
                style={{ color: T.accent, fontSize: 14, textDecoration: 'none', fontWeight: 600 }}
              >
                Add a recipe first
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {localRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => {
                    setSelectedRecipe(recipe);
                    setStep(3);
                  }}
                  style={{
                    background: selectedRecipe?.id === recipe.id ? T.surfaceHighest : T.surfaceHigh,
                    borderRadius: 12,
                    border: selectedRecipe?.id === recipe.id
                      ? `2px solid ${T.accent}`
                      : '2px solid transparent',
                    padding: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: T.text,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    aspectRatio: '1',
                    borderRadius: 8,
                    overflow: 'hidden',
                    marginBottom: 8,
                    background: T.surfaceHighest,
                  }}>
                    {recipe.image_uri ? (
                      <img
                        src={recipe.image_uri}
                        alt={recipe.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 32,
                      }}>
                        {'\u{1F373}'}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {recipe.title}
                  </div>
                  {recipe.difficulty && (
                    <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>
                      {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                padding: '12px 24px',
                borderRadius: 9999,
                border: 'none',
                background: T.surfaceHigh,
                color: T.textSecondary,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Photos */}
      {step === 3 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
            Upload photos
          </h2>
          <p style={{ fontSize: 14, color: T.textSecondary, marginBottom: 20 }}>
            Add photos of your finished dish. Real photos only. AI-generated images will be flagged.
          </p>

          <div style={{
            border: '2px dashed rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: '48px 24px',
            textAlign: 'center',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u{1F4F7}'}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
              Drag photos here or click to upload
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary }}>
              JPG, PNG, HEIC. Max 10 MB each.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                padding: '12px 24px',
                borderRadius: 9999,
                border: 'none',
                background: T.surfaceHigh,
                color: T.textSecondary,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              style={{
                padding: '12px 24px',
                borderRadius: 9999,
                border: 'none',
                background: T.accent,
                color: '#131318',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {selectedRecipe?.image_uri ? 'Next' : 'Skip for now'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Location */}
      {step === 4 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
            Location info
          </h2>
          <p style={{ fontSize: 14, color: T.textSecondary, marginBottom: 24 }}>
            Optional: let voters know where you are cooking from and your culinary background.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
            <div>
              <label style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: T.textSecondary,
                marginBottom: 8,
                display: 'block',
              }}>
                Where are you cooking from?
              </label>
              <input
                type="text"
                placeholder="e.g., Brooklyn, NY"
                value={chefLocation}
                onChange={(e) => setChefLocation(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: T.textSecondary,
                marginBottom: 8,
                display: 'block',
              }}>
                Culinary background / origin
              </label>
              <input
                type="text"
                placeholder="e.g., Third-generation Italian chef"
                value={chefOrigin}
                onChange={(e) => setChefOrigin(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', marginTop: 24 }}>
            <button
              type="button"
              onClick={() => setStep(3)}
              style={{
                padding: '12px 24px',
                borderRadius: 9999,
                border: 'none',
                background: T.surfaceHigh,
                color: T.textSecondary,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(5)}
              style={{
                padding: '12px 24px',
                borderRadius: 9999,
                border: 'none',
                background: T.accent,
                color: '#131318',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>
            Review your submission
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Dish */}
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: 16 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: T.accent,
                marginBottom: 4,
              }}>
                Dish
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {selectedDish?.name ?? 'Not selected'}
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary }}>
                {selectedDish?.cuisine} - {selectedDish?.category}
              </div>
            </div>

            {/* Recipe */}
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: 16 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: T.goldLight,
                marginBottom: 4,
              }}>
                Recipe
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {selectedRecipe?.title ?? 'Not selected'}
              </div>
            </div>

            {/* Location */}
            {(chefLocation || chefOrigin) && (
              <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: 16 }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  color: T.textSecondary,
                  marginBottom: 4,
                }}>
                  Location
                </div>
                {chefLocation && (
                  <div style={{ fontSize: 14, color: T.text }}>{chefLocation}</div>
                )}
                {chefOrigin && (
                  <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>{chefOrigin}</div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', marginTop: 24 }}>
            <button
              type="button"
              onClick={() => setStep(4)}
              style={{
                padding: '12px 24px',
                borderRadius: 9999,
                border: 'none',
                background: T.surfaceHigh,
                color: T.textSecondary,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !selectedDish || !selectedRecipe}
              style={{
                padding: '14px 32px',
                borderRadius: 9999,
                border: 'none',
                background: submitting ? T.surfaceHigh : `linear-gradient(135deg, ${T.accent}, ${T.accentLight})`,
                color: submitting ? T.dimText : '#131318',
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? 'default' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Recipe'}
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Success */}
      {step === 6 && submitted && (
        <div style={{
          ...cardStyle,
          textAlign: 'center',
          padding: '60px 32px',
        }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>{'\u{1F389}'}</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
            Recipe submitted!
          </h2>
          <p style={{ fontSize: 14, color: T.textSecondary, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Your recipe for <strong style={{ color: T.text }}>{selectedDish?.name}</strong> is
            now live on the leaderboard. Share it and ask friends to vote!
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link
              href={`/recipes/dishes/${selectedDish?.slug}`}
              style={{
                padding: '14px 28px',
                borderRadius: 9999,
                background: T.accent,
                color: '#131318',
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              View Leaderboard
            </Link>
            <Link
              href="/recipes/dishes"
              style={{
                padding: '14px 28px',
                borderRadius: 9999,
                background: T.surfaceHigh,
                color: T.text,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Browse More Dishes
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubmitPage() {
  return (
    <Suspense fallback={null}>
      <SubmitPageContent />
    </Suspense>
  );
}
