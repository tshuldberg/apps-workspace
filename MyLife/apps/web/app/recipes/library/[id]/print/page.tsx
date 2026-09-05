'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchRecipeWithDetails } from '@/app/recipes/actions';
import { fetchRecipeNutritionAction } from './nutrition-action';

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
}

interface Ingredient {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  sort_order: number;
}

interface CookingStep {
  id: string;
  step_number: number;
  instruction: string;
}

interface NutritionView {
  calories: number | null;
  fat_g: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  sodium_mg: number | null;
  coverage: number;
}

function fmtIngredient(i: Ingredient): string {
  const parts: string[] = [];
  if (i.quantity) parts.push(i.quantity);
  if (i.unit) parts.push(i.unit);
  parts.push(i.name);
  return parts.join(' ');
}

function deriveStepTitle(instruction: string, stepNumber: number): string {
  const firstSentence = instruction.split(/[.!?]/)[0]?.trim() ?? '';
  if (firstSentence.length > 0 && firstSentence.length <= 40) return firstSentence;
  return `Step ${stepNumber}`;
}

function fmtNum(n: number | null, suffix = ''): string {
  if (n === null || Number.isNaN(n)) return '--';
  const rounded = Math.round(n * 10) / 10;
  return `${rounded}${suffix}`;
}

export default function RecipePrintPage() {
  const params = useParams();
  const id = params.id as string;

  const [recipe, setRecipe] = useState<RecipeSummary | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [steps, setSteps] = useState<CookingStep[]>([]);
  const [nutrition, setNutrition] = useState<NutritionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const detail = await fetchRecipeWithDetails(id);
        if (cancelled) return;
        if (!detail) {
          setError('Recipe not found.');
          setLoading(false);
          return;
        }
        setRecipe(detail.recipe as RecipeSummary);
        setIngredients(detail.ingredients as Ingredient[]);
        setSteps(detail.steps as CookingStep[]);

        try {
          const nut = await fetchRecipeNutritionAction(id);
          if (!cancelled && nut) {
            setNutrition({
              calories: nut.perServing.calories,
              fat_g: nut.perServing.fat_g,
              protein_g: nut.perServing.protein_g,
              carbs_g: nut.perServing.carbs_g,
              sodium_mg: nut.perServing.sodium_mg,
              coverage: nut.coverage,
            });
          }
        } catch {
          // nutrition is best-effort
        }
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load recipe.');
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const digitalUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/recipes/library/${id}`
      : `/recipes/library/${id}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${encodeURIComponent(
    digitalUrl,
  )}`;

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0e0e13',
          color: '#e4e1e9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Loading recipe...
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0e0e13',
          color: '#e4e1e9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
        }}
      >
        <div>{error ?? 'Recipe not available.'}</div>
        <Link
          href={`/recipes/library/${id}`}
          style={{
            color: '#FFB877',
            textDecoration: 'underline',
            fontSize: 14,
          }}
        >
          Back to recipe
        </Link>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-shell { background: white !important; padding: 0 !important; }
          .print-paper {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
          .print-photo { filter: grayscale(1) contrast(1.15) !important; }
          .qr-img { filter: grayscale(1) !important; }
        }
        .print-paper *::selection { background: rgba(255, 184, 119, 0.4); }
      `}</style>

      <div
        className="print-shell"
        style={{
          minHeight: '100vh',
          background: '#0e0e13',
          padding: '32px 16px 64px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontFamily:
            "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Header (hidden in print) */}
        <div
          className="no-print"
          style={{
            width: '100%',
            maxWidth: 896,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 32,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              href={`/recipes/library/${id}`}
              aria-label="Back to recipe"
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#E4E1E9',
                textDecoration: 'none',
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              {'<'}
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>&#x1F4D6;</span>
              <h1
                style={{
                  color: '#E4E1E9',
                  fontWeight: 800,
                  fontSize: 22,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                BestChef Print Preview
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: '#FFB877',
              color: '#4B2700',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.08em',
              padding: '12px 24px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              textTransform: 'uppercase',
            }}
          >
            <span aria-hidden>&#x1F5A8;</span>
            Print Recipe
          </button>
        </div>

        {/* Paper */}
        <article
          className="print-paper"
          style={{
            background: '#ffffff',
            color: '#000000',
            width: '100%',
            maxWidth: 896,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
            padding: '48px 56px',
            display: 'flex',
            flexDirection: 'column',
            gap: 48,
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {/* Title + Meta + QR */}
          <header
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 32,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 280 }}>
              <h2
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  margin: 0,
                  marginBottom: 16,
                  color: '#000',
                  lineHeight: 1.05,
                }}
              >
                {recipe.title}
              </h2>
              {recipe.description && (
                <p
                  style={{
                    color: '#4b5563',
                    fontSize: 14,
                    lineHeight: 1.5,
                    marginTop: 0,
                    marginBottom: 16,
                  }}
                >
                  {recipe.description}
                </p>
              )}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 24,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                }}
              >
                <MetaItem
                  label="Prep"
                  value={
                    recipe.prep_time_mins !== null
                      ? `${recipe.prep_time_mins} mins`
                      : '--'
                  }
                />
                <MetaItem
                  label="Cook"
                  value={
                    recipe.cook_time_mins !== null
                      ? `${recipe.cook_time_mins} mins`
                      : '--'
                  }
                />
                <MetaItem
                  label="Servings"
                  value={
                    recipe.servings !== null ? String(recipe.servings) : '--'
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 6,
                }}
              >
                {/* QR via api.qrserver.com (no new deps) */}
                <img
                  className="qr-img"
                  src={qrSrc}
                  alt="QR code linking to digital recipe"
                  width={84}
                  height={84}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  marginTop: 8,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                }}
              >
                Scan to Sync
              </span>
            </div>
          </header>

          {/* Photo */}
          {recipe.image_uri && (
            <div
              style={{
                width: '100%',
                height: 300,
                overflow: 'hidden',
                borderRadius: 12,
              }}
            >
              <img
                className="print-photo"
                src={recipe.image_uri}
                alt={recipe.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          )}

          {/* Two-column: Ingredients + Nutrition */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 48,
              alignItems: 'flex-start',
            }}
          >
            {/* Ingredients */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <SectionHeading title="Ingredients" />
              {ingredients.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
                  No ingredients listed.
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  {ingredients.map((ing) => (
                    <li
                      key={ing.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        borderBottom: '1px solid #f3f4f6',
                        paddingBottom: 8,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 18,
                          height: 18,
                          border: '1px solid #000',
                          flexShrink: 0,
                          marginTop: 2,
                          display: 'inline-block',
                        }}
                      />
                      <span
                        style={{
                          color: '#1f2937',
                          lineHeight: 1.5,
                          fontSize: 14,
                        }}
                      >
                        {fmtIngredient(ing)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Nutrition */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <SectionHeading
                title="Nutrition"
                subtitle="Per Serving"
              />
              <div
                style={{
                  background: '#f9fafb',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <NutritionRow
                  label="Calories"
                  value={
                    nutrition?.calories !== undefined && nutrition?.calories !== null
                      ? `${fmtNum(nutrition.calories)} kcal`
                      : '--'
                  }
                />
                <NutritionRow
                  label="Total Fat"
                  value={
                    nutrition?.fat_g !== undefined && nutrition?.fat_g !== null
                      ? fmtNum(nutrition.fat_g, 'g')
                      : '--'
                  }
                />
                <NutritionRow
                  label="Protein"
                  value={
                    nutrition?.protein_g !== undefined && nutrition?.protein_g !== null
                      ? fmtNum(nutrition.protein_g, 'g')
                      : '--'
                  }
                />
                <NutritionRow
                  label="Carbohydrates"
                  value={
                    nutrition?.carbs_g !== undefined && nutrition?.carbs_g !== null
                      ? fmtNum(nutrition.carbs_g, 'g')
                      : '--'
                  }
                />
                <NutritionRow
                  label="Sodium"
                  value={
                    nutrition?.sodium_mg !== undefined && nutrition?.sodium_mg !== null
                      ? fmtNum(nutrition.sodium_mg, 'mg')
                      : '--'
                  }
                  last
                />
              </div>
              <p
                style={{
                  fontStyle: 'italic',
                  color: '#6b7280',
                  fontSize: 11,
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                * Nutrition values are estimated based on ingredients. Consult a
                nutritionist for medical dietary planning.
              </p>
            </section>
          </div>

          {/* Instructions */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <SectionHeading title="Instructions" />
            {steps.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
                No instructions provided.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                {steps
                  .slice()
                  .sort((a, b) => a.step_number - b.step_number)
                  .map((step) => (
                    <div
                      key={step.id}
                      style={{
                        display: 'flex',
                        gap: 24,
                        alignItems: 'flex-start',
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          fontSize: 48,
                          fontWeight: 800,
                          color: '#f3f4f6',
                          userSelect: 'none',
                          lineHeight: 1,
                          minWidth: 60,
                        }}
                      >
                        {String(step.step_number).padStart(2, '0')}
                      </span>
                      <div>
                        <h4
                          style={{
                            fontWeight: 700,
                            fontSize: 18,
                            margin: 0,
                            marginBottom: 8,
                            color: '#000',
                          }}
                        >
                          {deriveStepTitle(step.instruction, step.step_number)}
                        </h4>
                        <p
                          style={{
                            color: '#374151',
                            lineHeight: 1.6,
                            margin: 0,
                            fontSize: 14,
                          }}
                        >
                          {step.instruction}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* Footer */}
          <footer
            style={{
              marginTop: 32,
              paddingTop: 32,
              borderTop: '1px solid #f3f4f6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  color: '#9ca3af',
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                Generated via BestChef Digital Curator
              </p>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  color: '#9ca3af',
                  margin: 0,
                  marginTop: 4,
                  textTransform: 'uppercase',
                }}
              >
                The Digital Library Project
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#d1d5db',
                  fontStyle: 'italic',
                  margin: 0,
                }}
              >
                &ldquo;Cooking is an art, but recipes are the history.&rdquo;
              </p>
            </div>
          </footer>
        </article>

        <div
          className="no-print"
          style={{
            marginTop: 48,
            color: 'rgba(228, 225, 233, 0.4)',
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          End of Print Preview &middot; All Styles Optimized for Paper
        </div>
      </div>
    </>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#C9894D' }}>{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ borderBottom: '2px solid #000', paddingBottom: 8 }}>
      <h3
        style={{
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: '-0.01em',
          margin: 0,
          color: '#000',
          textTransform: 'uppercase',
        }}
      >
        {title}
        {subtitle && (
          <span
            style={{
              color: '#9ca3af',
              fontWeight: 400,
              fontSize: 13,
              marginLeft: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {subtitle}
          </span>
        )}
      </h3>
    </div>
  );
}

function NutritionRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 13,
        borderBottom: last ? 'none' : '1px solid #e5e7eb',
        paddingBottom: last ? 0 : 8,
        color: '#000',
      }}
    >
      <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
