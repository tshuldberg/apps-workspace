'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  fetchRecipeWithDetails,
  fetchCollections,
  toggleRecipeFavorite,
  setRecipeRating,
  logCookedRecipeAction,
} from '@/app/recipes/actions';
import { fetchRecipeNutritionAction } from './print/nutrition-action';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RecipeSummary {
  id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  prep_time_mins: number | null;
  cook_time_mins: number | null;
  total_time_mins: number | null;
  servings: number | null;
  is_favorite: number;
  rating: number;
  image_uri: string | null;
  source_url: string | null;
  notes: string | null;
}

interface Ingredient {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  sort_order: number;
  section?: string | null;
}

interface CookingStep {
  id: string;
  step_number: number;
  instruction: string;
  timer_minutes: number | null;
  inferred_timer_minutes?: number | null;
  section?: string | null;
}

interface RecipeTag {
  id: string;
  recipe_id: string;
  tag: string;
}

interface NutritionBreakdown {
  calories: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  protein_g: number | null;
  sodium_mg: number | null;
}

interface NutritionSummary {
  recipeId: string;
  servings: number;
  perServing: NutritionBreakdown;
  total: NutritionBreakdown;
  coverage: number;
  missingIngredients: string[];
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
}

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const T = {
  bg: '#131318',
  surfaceLowest: '#0E0E13',
  surfaceLow: '#1B1B20',
  surface: '#1F1F25',
  surfaceHigh: '#2A292F',
  surfaceHighest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#22C55E',
  gold: '#C9894D',
  goldLight: '#FFB877',
  tertiary: '#8BCFF0',
  glass: 'rgba(19,19,24,0.7)',
} as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(mins: number | null): string {
  if (mins === null || mins === 0) return '--';
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins} min`;
}

function fmtNutrient(val: number | null, suffix: string): string {
  if (val === null) return '--';
  return `${Math.round(val * 10) / 10} ${suffix}`;
}

function deriveStepTitle(instruction: string, stepNumber: number): string {
  const firstSentence = instruction.split(/[.!?]/)[0]?.trim() ?? '';
  if (firstSentence.length > 0 && firstSentence.length <= 40) return firstSentence;
  return `Step ${stepNumber}`;
}

function fmtTimer(mins: number): string {
  const m = Math.floor(mins);
  const s = Math.round((mins - m) * 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RecipeDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [recipe, setRecipe] = useState<RecipeSummary | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [steps, setSteps] = useState<CookingStep[]>([]);
  const [tags, setTags] = useState<RecipeTag[]>([]);
  const [nutrition, setNutrition] = useState<NutritionSummary | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [servings, setServings] = useState(4);
  const [cookedBusy, setCookedBusy] = useState(false);
  const [cookedMessage, setCookedMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'method'>('ingredients');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [details, allCollections] = await Promise.all([
          fetchRecipeWithDetails(id),
          fetchCollections(),
        ]);
        if (cancelled) return;
        if (!details) {
          setError('Recipe not found');
          setLoading(false);
          return;
        }
        setRecipe(details.recipe as RecipeSummary);
        setIngredients(details.ingredients as Ingredient[]);
        setSteps(details.steps as CookingStep[]);
        setTags((details.tags ?? []) as RecipeTag[]);
        setCollections((allCollections ?? []) as Collection[]);
        setServings(details.recipe.servings ?? 4);

        // Load nutrition async
        const nutri = await fetchRecipeNutritionAction(id);
        if (!cancelled && nutri) setNutrition(nutri as NutritionSummary);
      } catch (err) {
        if (!cancelled) setError('Failed to load recipe');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const baseServings = recipe?.servings ?? 4;
  const ratio = baseServings > 0 ? servings / baseServings : 1;

  const handleFavorite = async () => {
    if (!recipe) return;
    try {
      await toggleRecipeFavorite(recipe.id);
      setRecipe({ ...recipe, is_favorite: recipe.is_favorite ? 0 : 1 });
    } catch { /* ignore */ }
  };

  const handleRate = async (rating: number) => {
    if (!recipe) return;
    try {
      await setRecipeRating(recipe.id, rating);
      setRecipe({ ...recipe, rating });
    } catch { /* ignore */ }
  };

  const handleCooked = async () => {
    if (!recipe || cookedBusy) return;
    setCookedBusy(true);
    setCookedMessage(null);
    try {
      const outcome = await logCookedRecipeAction(recipe.id, servings);
      if (outcome.ok) {
        const parts: string[] = [];
        if (outcome.loggedToNutrition) {
          parts.push(`Logged ${outcome.calories ?? 0} kcal / ${outcome.proteinG ?? 0} g protein to MyNutrition`);
        }
        if ((outcome.pantryItemsDecremented ?? 0) > 0) {
          parts.push(`${outcome.pantryItemsDecremented} pantry item${outcome.pantryItemsDecremented === 1 ? '' : 's'} decremented`);
        }
        setCookedMessage(parts.length > 0 ? parts.join(' · ') : 'Recorded, but nothing needed updating.');
      } else {
        setCookedMessage(outcome.reason ?? 'Could not log this recipe.');
      }
    } catch (err) {
      setCookedMessage(err instanceof Error ? err.message : 'Could not log this recipe.');
    } finally {
      setCookedBusy(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Styles                                                           */
  /* ---------------------------------------------------------------- */

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: T.bg,
    color: T.text,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: 1400,
    margin: '0 auto',
    padding: 40,
    display: 'flex',
    gap: 48,
  };

  const leftColStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 48,
  };

  const rightColStyle: React.CSSProperties = {
    width: 380,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
  };

  const heroStyle: React.CSSProperties = {
    position: 'relative',
    height: 500,
    borderRadius: 12,
    overflow: 'hidden',
  };

  const heroImgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 0.7s',
  };

  const heroPlaceholderStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    background: `linear-gradient(135deg, ${T.surfaceLow} 0%, ${T.surfaceHigh} 50%, ${T.gold}33 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 80,
  };

  const heroOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to top, #131318 0%, rgba(19,19,24,0.2) 40%, transparent 100%)',
  };

  const heroContentStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 32,
    left: 32,
    right: 32,
  };

  const tagRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
  };

  const heroBadgeStyle = (color: string, textColor: string): React.CSSProperties => ({
    padding: '4px 12px',
    borderRadius: 9999,
    background: `${color}33`,
    color: textColor,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    backdropFilter: 'blur(12px)',
  });

  const heroTitleStyle: React.CSSProperties = {
    fontSize: 42,
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: '-0.02em',
    marginBottom: 8,
  };

  const heroDescStyle: React.CSSProperties = {
    fontSize: 14,
    lineHeight: 1.7,
    color: T.textSecondary,
    maxWidth: '80%',
  };

  const ingredientsSectionStyle: React.CSSProperties = {
    background: T.surfaceLow,
    borderRadius: 12,
    padding: 32,
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  };

  const servingsControlStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: T.surfaceHighest,
    borderRadius: 9999,
    padding: '8px 16px',
  };

  const servingsLabelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: T.textSecondary,
  };

  const servingsBtnStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: 9999,
    background: 'transparent',
    border: 'none',
    color: T.gold,
    fontSize: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  };

  const ingredientRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  };

  const ingredientGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: 48,
  };

  const methodSectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 40,
  };

  const stepStyle: React.CSSProperties = {
    position: 'relative',
    paddingLeft: 48,
  };

  const stepNumberStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 9999,
    background: T.surfaceHigh,
    border: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: T.gold,
  };

  const stepTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 12,
  };

  const stepTextStyle: React.CSSProperties = {
    fontSize: 14,
    lineHeight: 1.7,
    color: T.textSecondary,
    marginBottom: 12,
  };

  const timerBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 16px',
    background: T.surfaceHighest,
    borderRadius: 9999,
    border: '1px solid rgba(255,255,255,0.05)',
  };

  const ctaBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '20px 0',
    borderRadius: 9999,
    background: `linear-gradient(135deg, ${T.goldLight}, ${T.gold})`,
    color: '#1a1a1a',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    transition: 'transform 0.2s',
    textDecoration: 'none',
  };

  const nutritionCardStyle: React.CSSProperties = {
    background: T.surfaceHigh,
    borderRadius: 12,
    padding: 24,
    border: '1px solid rgba(255,255,255,0.05)',
  };

  const nutritionGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  };

  const nutrientBoxStyle: React.CSSProperties = {
    padding: 16,
    borderRadius: 12,
    background: T.surfaceLowest,
  };

  const nutrientLabelStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: T.textSecondary,
    marginBottom: 4,
    fontWeight: 700,
  };

  const nutrientValueStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 700,
  };

  const nutrientUnitStyle: React.CSSProperties = {
    fontSize: 10,
    color: T.gold,
  };

  const sidebarSectionLabelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    color: T.textSecondary,
    marginBottom: 16,
    padding: '0 8px',
  };

  const collectionPillStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: T.surface,
    borderRadius: 9999,
    fontSize: 12,
    border: '1px solid rgba(255,255,255,0.05)',
    transition: 'background 0.2s',
  };

  const tagPillStyle: React.CSSProperties = {
    padding: '4px 12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 9999,
    fontSize: 10,
    fontWeight: 500,
    color: T.textSecondary,
  };

  const backLinkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    color: T.textSecondary,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    textDecoration: 'none',
    marginBottom: 24,
    transition: 'color 0.2s',
  };

  const favBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 9999,
    background: 'rgba(53,52,58,0.6)',
    backdropFilter: 'blur(12px)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    zIndex: 2,
    transition: 'transform 0.2s',
  };

  const ratingRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 4,
    marginBottom: 16,
  };

  const ratingStarStyle = (filled: boolean): React.CSSProperties => ({
    fontSize: 18,
    color: filled ? T.gold : T.surfaceHighest,
    cursor: 'pointer',
    transition: 'color 0.15s',
  });

  const timeInfoStyle: React.CSSProperties = {
    display: 'flex',
    gap: 24,
    marginBottom: 8,
  };

  const timeInfoItemStyle: React.CSSProperties = {
    fontSize: 11,
    color: T.textSecondary,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };

  const loadingStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '120px 0',
    color: T.textSecondary,
    fontSize: 14,
  };

  const errorStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '120px 0',
    color: '#FFB4AB',
    fontSize: 16,
    fontWeight: 600,
  };

  const timelineBarStyle: React.CSSProperties = {
    position: 'absolute',
    left: 16,
    top: 40,
    bottom: 0,
    width: 1,
    background: 'rgba(255,255,255,0.05)',
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={loadingStyle}>Loading recipe...</div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div style={pageStyle}>
        <div style={errorStyle}>{error ?? 'Recipe not found'}</div>
      </div>
    );
  }

  const perServing = nutrition?.perServing;

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {/* Left Column */}
        <div style={leftColStyle}>
          <Link href="/recipes/library" style={backLinkStyle}>
            &#x2190; Back to Library
          </Link>

          {/* Hero */}
          <section style={heroStyle}>
            {recipe.image_uri ? (
              <img src={recipe.image_uri} alt={recipe.title} style={heroImgStyle} />
            ) : (
              <div style={heroPlaceholderStyle}>&#x1F372;</div>
            )}
            <div style={heroOverlayStyle} />
            <button
              style={favBtnStyle}
              onClick={handleFavorite}
              title={recipe.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {recipe.is_favorite ? '\u2764\uFE0F' : '\u2661'}
            </button>
            <div style={heroContentStyle}>
              {tags.length > 0 && (
                <div style={tagRowStyle}>
                  {tags.slice(0, 3).map((t, i) => (
                    <span key={t.id} style={heroBadgeStyle(i === 0 ? T.gold : T.tertiary, i === 0 ? T.gold : T.tertiary)}>
                      {t.tag}
                    </span>
                  ))}
                </div>
              )}
              <h1 style={heroTitleStyle}>{recipe.title}</h1>
              {recipe.description && (
                <p style={heroDescStyle}>{recipe.description}</p>
              )}
            </div>
          </section>

          {/* Time info + rating */}
          <div>
            <div style={timeInfoStyle}>
              {recipe.prep_time_mins != null && (
                <span style={timeInfoItemStyle}>
                  &#x23F1; Prep: {formatTime(recipe.prep_time_mins)}
                </span>
              )}
              {recipe.cook_time_mins != null && (
                <span style={timeInfoItemStyle}>
                  &#x1F525; Cook: {formatTime(recipe.cook_time_mins)}
                </span>
              )}
              {recipe.total_time_mins != null && (
                <span style={timeInfoItemStyle}>
                  &#x23F0; Total: {formatTime(recipe.total_time_mins)}
                </span>
              )}
              {recipe.difficulty && (
                <span style={timeInfoItemStyle}>
                  &#x2B50; {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
                </span>
              )}
            </div>
            <div style={ratingRowStyle}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  style={ratingStarStyle(star <= recipe.rating)}
                  onClick={() => handleRate(star)}
                  title={`Rate ${star}`}
                >
                  {star <= recipe.rating ? '\u2605' : '\u2606'}
                </span>
              ))}
              <span style={{ fontSize: 12, color: T.textSecondary, marginLeft: 8, alignSelf: 'center' }}>
                {recipe.rating > 0 ? recipe.rating.toFixed(1) : 'No rating'}
              </span>
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={handleCooked}
                disabled={cookedBusy}
                style={{
                  background: T.gold,
                  color: T.bg,
                  fontWeight: 700,
                  fontSize: 13,
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: cookedBusy ? 'wait' : 'pointer',
                }}
              >
                {cookedBusy ? 'Logging...' : `I cooked this (${servings} serving${servings === 1 ? '' : 's'})`}
              </button>
              <span style={{ fontSize: 12, color: T.textSecondary }}>
                Logs macros to MyNutrition and decrements matched pantry items.
              </span>
            </div>
            {cookedMessage && (
              <div style={{ marginTop: 8, fontSize: 13, color: T.textSecondary }}>
                {cookedMessage}
              </div>
            )}
          </div>

          {/* Ingredients */}
          <section style={ingredientsSectionStyle}>
            <div style={sectionHeaderStyle}>
              <h3 style={sectionTitleStyle}>
                &#x1F6D2; Ingredients
              </h3>
              <div style={servingsControlStyle}>
                <span style={servingsLabelStyle}>Servings</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    style={servingsBtnStyle}
                    onClick={() => setServings(Math.max(1, servings - 1))}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
                  >
                    &minus;
                  </button>
                  <span style={{ fontSize: 14, fontWeight: 700, width: 16, textAlign: 'center' }}>{servings}</span>
                  <button
                    style={servingsBtnStyle}
                    onClick={() => setServings(servings + 1)}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <div style={ingredientGridStyle}>
              {ingredients.map((ing) => {
                // Scale quantity if numeric
                let displayQty = ing.quantity ?? '';
                const numQty = parseFloat(displayQty);
                if (!isNaN(numQty) && numQty > 0) {
                  const scaled = Math.round(numQty * ratio * 100) / 100;
                  displayQty = scaled % 1 === 0 ? String(scaled) : scaled.toFixed(1);
                }
                const displayUnit = ing.unit ?? '';
                return (
                  <div key={ing.id} style={ingredientRowStyle}>
                    <span style={{ color: T.textSecondary }}>{ing.name}</span>
                    <span style={{ color: T.gold, fontWeight: 500 }}>
                      {displayQty}{displayUnit ? ` ${displayUnit}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Method */}
          <section>
            <h3 style={{ ...sectionTitleStyle, marginBottom: 40 }}>
              &#x1F374; Method
            </h3>
            <div style={{ ...methodSectionStyle, position: 'relative' }}>
              {steps.length > 1 && <div style={timelineBarStyle} />}
              {steps.map((step) => {
                const timerMins = step.timer_minutes ?? step.inferred_timer_minutes;
                return (
                  <div key={step.id} style={stepStyle}>
                    <div style={stepNumberStyle}>
                      {String(step.step_number).padStart(2, '0')}
                    </div>
                    <div>
                      <h4 style={stepTitleStyle}>{deriveStepTitle(step.instruction, step.step_number)}</h4>
                      <p style={stepTextStyle}>{step.instruction}</p>
                      {timerMins != null && timerMins > 0 && (
                        <div style={timerBadgeStyle}>
                          <span style={{ fontSize: 14, color: T.gold }}>&#x23F2;</span>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{fmtTimer(timerMins)}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: T.gold }}>
                            Start Timer
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Notes */}
          {recipe.notes && (
            <section style={{ background: T.surfaceLow, borderRadius: 12, padding: 24 }}>
              <h3 style={{ ...sectionTitleStyle, marginBottom: 12 }}>&#x1F4DD; Notes</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: T.textSecondary }}>{recipe.notes}</p>
            </section>
          )}
        </div>

        {/* Right Sidebar */}
        <div style={rightColStyle}>
          {/* Start Cooking CTA */}
          <Link href={`/recipes/library/${id}/cook`} style={ctaBtnStyle}>
            &#x25B6; START COOKING MODE
          </Link>

          {/* Nutrition */}
          {perServing && nutrition && nutrition.coverage > 0 && (
            <div style={nutritionCardStyle}>
              <h4 style={{ ...sidebarSectionLabelStyle, padding: 0, marginBottom: 24 }}>
                Nutrition Per Serving
              </h4>
              <div style={nutritionGridStyle}>
                <div style={nutrientBoxStyle}>
                  <p style={nutrientLabelStyle}>Calories</p>
                  <p style={nutrientValueStyle}>
                    {perServing.calories !== null ? Math.round(perServing.calories) : '--'}{' '}
                    <span style={nutrientUnitStyle}>kcal</span>
                  </p>
                </div>
                <div style={nutrientBoxStyle}>
                  <p style={nutrientLabelStyle}>Net Carbs</p>
                  <p style={nutrientValueStyle}>
                    {fmtNutrient(perServing.carbs_g, '')}{' '}
                    <span style={nutrientUnitStyle}>g</span>
                  </p>
                </div>
                <div style={nutrientBoxStyle}>
                  <p style={nutrientLabelStyle}>Fiber</p>
                  <p style={nutrientValueStyle}>
                    {fmtNutrient(perServing.fiber_g, '')}{' '}
                    <span style={nutrientUnitStyle}>g</span>
                  </p>
                </div>
                <div style={nutrientBoxStyle}>
                  <p style={nutrientLabelStyle}>Fat</p>
                  <p style={nutrientValueStyle}>
                    {fmtNutrient(perServing.fat_g, '')}{' '}
                    <span style={nutrientUnitStyle}>g</span>
                  </p>
                </div>
                <div style={nutrientBoxStyle}>
                  <p style={nutrientLabelStyle}>Protein</p>
                  <p style={nutrientValueStyle}>
                    {fmtNutrient(perServing.protein_g, '')}{' '}
                    <span style={nutrientUnitStyle}>g</span>
                  </p>
                </div>
                <div style={nutrientBoxStyle}>
                  <p style={nutrientLabelStyle}>Sodium</p>
                  <p style={nutrientValueStyle}>
                    {fmtNutrient(perServing.sodium_mg, '')}{' '}
                    <span style={nutrientUnitStyle}>mg</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <h4 style={sidebarSectionLabelStyle}>Key Tags</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tags.map((t) => (
                  <span key={t.id} style={tagPillStyle}>#{t.tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Collections */}
          {collections.length > 0 && (
            <div>
              <h4 style={sidebarSectionLabelStyle}>Collections</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {collections.map((c) => (
                  <span key={c.id} style={collectionPillStyle}>{c.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Print link */}
          <Link
            href={`/recipes/library/${id}/print`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 0',
              borderRadius: 9999,
              background: T.surfaceHigh,
              color: T.textSecondary,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              textDecoration: 'none',
              transition: 'background 0.2s',
            }}
          >
            &#x1F5A8; Print Recipe
          </Link>

          {/* Source */}
          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 0',
                borderRadius: 9999,
                background: T.surfaceHigh,
                color: T.textSecondary,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                textDecoration: 'none',
              }}
            >
              &#x1F517; View Source
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
