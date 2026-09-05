'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchRecipeWithDetails } from '@/app/recipes/actions';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RecipeHeader {
  id: string;
  title: string;
  image_uri: string | null;
}

interface Ingredient {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  sort_order: number;
  section?: string | null;
  is_optional?: number;
}

interface CookingStep {
  id: string;
  step_number: number;
  instruction: string;
  timer_minutes: number | null;
  inferred_timer_minutes: number | null;
  section?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtIngredient(i: Ingredient): string {
  const parts: string[] = [];
  if (i.quantity) parts.push(i.quantity);
  if (i.unit) parts.push(i.unit);
  parts.push(i.name);
  return parts.join(' ');
}

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function deriveStepTitle(instruction: string): string {
  const first = instruction.split(/[.!?]/)[0]?.trim() ?? '';
  if (first.length > 0 && first.length <= 50) return first;
  return instruction.slice(0, 50) + (instruction.length > 50 ? '...' : '');
}

/** Extract heat-level keywords from step text */
function extractHeatLevel(text: string): string | null {
  const lower = text.toLowerCase();
  if (/high\s*heat/i.test(lower)) return 'High';
  if (/medium[- ]high/i.test(lower)) return 'Medium-High';
  if (/medium[- ]low/i.test(lower)) return 'Medium-Low';
  if (/medium\s*heat/i.test(lower) || /over\s*medium/i.test(lower)) return 'Medium';
  if (/low\s*heat/i.test(lower) || /simmer/i.test(lower) || /gentle/i.test(lower)) return 'Low';
  return null;
}

/** Extract stir frequency from step text */
function extractStirFrequency(text: string): string | null {
  const lower = text.toLowerCase();
  if (/stir\s*constantly|continuous/i.test(lower)) return 'Constant';
  if (/stir\s*occasionally|stir\s*from\s*time/i.test(lower)) return 'Occasional';
  if (/stir\s*frequently/i.test(lower)) return 'Frequent';
  if (/stir/i.test(lower)) return 'As Needed';
  return null;
}

/* ------------------------------------------------------------------ */
/*  Design tokens                                                      */
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
  accent: '#FFB877',
  accentContainer: '#C9894D',
  green: '#22C55E',
  glass: 'rgba(19,19,24,0.7)',
  outlineVariant: '#52443A',
  outline: '#9F8E81',
  font: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CookingModePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  /* Data state */
  const [recipe, setRecipe] = useState<RecipeHeader | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [steps, setSteps] = useState<CookingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* UI state */
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());

  /* Timer state */
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerInitial, setTimerInitial] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Total elapsed */
  const [totalElapsed, setTotalElapsed] = useState(0);
  const totalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---- Data fetch ---- */
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
        setRecipe(detail.recipe as RecipeHeader);
        setIngredients(detail.ingredients as Ingredient[]);
        const sorted = (detail.steps as CookingStep[])
          .slice()
          .sort((a, b) => a.step_number - b.step_number);
        setSteps(sorted);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load.');
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  /* ---- Sync timer to current step ---- */
  useEffect(() => {
    if (steps.length === 0) return;
    const step = steps[currentStep];
    if (!step) return;
    const mins = step.timer_minutes ?? step.inferred_timer_minutes ?? 0;
    const secs = mins * 60;
    setTimerSeconds(secs);
    setTimerInitial(secs);
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [currentStep, steps]);

  /* ---- Timer tick ---- */
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, timerSeconds]);

  /* ---- Total elapsed timer ---- */
  useEffect(() => {
    if (!loading && steps.length > 0) {
      totalRef.current = setInterval(() => {
        setTotalElapsed((p) => p + 1);
      }, 1000);
    }
    return () => {
      if (totalRef.current) clearInterval(totalRef.current);
    };
  }, [loading, steps.length]);

  /* ---- Navigation ---- */
  const goNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  const goPrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  /* ---- Keyboard ---- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === ' ') {
        e.preventDefault();
        if (timerInitial > 0) {
          setTimerRunning((r) => !r);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, timerInitial]);

  /* ---- Toggle ingredient ---- */
  const toggleIngredient = (ingredientId: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  };

  /* ---- Timer controls ---- */
  const toggleTimer = () => {
    if (timerSeconds > 0) setTimerRunning((r) => !r);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerSeconds(timerInitial);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  /* ---- Loading / Error ---- */
  if (loading) {
    return (
      <div style={{
        height: '100vh', background: T.bg, color: T.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.font,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: `3px solid ${T.surfaceHigh}`,
            borderTopColor: T.accent,
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: 14, color: T.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Preparing Cooking Mode...
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !recipe || steps.length === 0) {
    return (
      <div style={{
        height: '100vh', background: T.bg, color: T.text,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, fontFamily: T.font, padding: 24,
      }}>
        <span style={{ fontSize: 48, marginBottom: 8 }}>&#x1F373;</span>
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          {error ?? (steps.length === 0 ? 'This recipe has no cooking steps.' : 'Recipe not available.')}
        </div>
        <button
          onClick={() => router.push(`/recipes/library/${id}`)}
          style={{
            color: T.accent, background: 'none', border: 'none',
            fontSize: 14, cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          Back to recipe
        </button>
      </div>
    );
  }

  /* ---- Derived state ---- */
  const step = steps[currentStep]!;
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const nextStep = currentStep < totalSteps - 1 ? steps[currentStep + 1] : null;
  const prevStep = currentStep > 0 ? steps[currentStep - 1] : null;
  const heatLevel = extractHeatLevel(step.instruction);
  const stirFreq = extractStirFrequency(step.instruction);
  const hasTimer = timerInitial > 0;
  const timerProgress = timerInitial > 0 ? ((timerInitial - timerSeconds) / timerInitial) : 0;
  const circumference = 2 * Math.PI * 88;

  return (
    <div style={{
      height: '100vh', width: '100vw', overflow: 'hidden',
      background: T.bg, color: T.text, fontFamily: T.font,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ====== TOP NAV ====== */}
      <nav style={{
        height: 80, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 40px',
        background: T.glass, backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        position: 'relative', zIndex: 50, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <button
            onClick={() => router.push(`/recipes/library/${id}`)}
            title="Exit cooking mode"
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: T.surfaceHigh, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.text, fontSize: 18, cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = T.surfaceHighest; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = T.surfaceHigh; }}
          >
            &#x2715;
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em' }}>
              BestChef
            </span>
            <span style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em',
              color: T.accent,
            }}>
              Cooking Mode &bull; Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          width: '33%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <div style={{
            width: '100%', height: 4, background: T.surfaceHighest,
            borderRadius: 9999, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: `linear-gradient(135deg, ${T.accent} 0%, ${T.accentContainer} 100%)`,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Elapsed timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', background: T.surfaceLow,
            borderRadius: 9999,
          }}>
            <span style={{ color: T.accent, fontSize: 18 }}>&#x23F1;</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {fmtTime(totalElapsed)}
            </span>
          </div>
        </div>
      </nav>

      {/* ====== MAIN 3-PANEL ====== */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ---- LEFT: Ingredients ---- */}
        <aside style={{
          width: 320, height: '100%', background: T.surfaceLowest,
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          borderRight: `1px solid rgba(255,255,255,0.04)`,
        }}>
          <div style={{ padding: 32, flex: 1, overflowY: 'auto' }}>
            <h3 style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em',
              color: T.textSecondary, marginBottom: 24, fontWeight: 600,
            }}>
              Ingredients Needed
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ingredients.map((ing) => {
                const checked = checkedIngredients.has(ing.id);
                return (
                  <div
                    key={ing.id}
                    onClick={() => toggleIngredient(ing.id)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 16,
                      cursor: 'pointer', userSelect: 'none',
                    }}
                  >
                    <div style={{
                      marginTop: 2, width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                      border: checked ? 'none' : `2px solid ${T.outlineVariant}`,
                      background: checked
                        ? `linear-gradient(135deg, ${T.accent} 0%, ${T.accentContainer} 100%)`
                        : T.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}>
                      {checked && (
                        <span style={{ color: '#4B2700', fontSize: 14, fontWeight: 700 }}>
                          &#x2713;
                        </span>
                      )}
                    </div>
                    <div style={{
                      display: 'flex', flexDirection: 'column',
                      opacity: checked ? 0.4 : 1,
                      textDecoration: checked ? 'line-through' : 'none',
                      transition: 'opacity 0.2s',
                    }}>
                      <span style={{ color: T.text, fontWeight: 500, fontSize: 14 }}>
                        {fmtIngredient(ing)}
                      </span>
                      {ing.is_optional === 1 && (
                        <span style={{ fontSize: 11, color: T.outline }}>Optional</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom tip area */}
          <div style={{
            padding: 32, background: `rgba(27,27,32,0.3)`,
          }}>
            <p style={{
              fontSize: 10, color: T.textSecondary,
              lineHeight: 1.6, margin: 0,
            }}>
              TIP: Check off ingredients as you use them to keep track of your progress.
            </p>
          </div>
        </aside>

        {/* ---- CENTER: Active Step ---- */}
        <section style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          position: 'relative', padding: '80px 80px 120px',
          textAlign: 'center', overflow: 'hidden',
        }}>
          {/* Decorative glow */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 800, height: 800,
            background: 'rgba(255,184,119,0.04)',
            filter: 'blur(120px)', borderRadius: '50%',
            pointerEvents: 'none',
          }} />

          <div style={{ maxWidth: 720, zIndex: 10, width: '100%' }}>
            <span style={{
              fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.3em',
              color: T.accent, marginBottom: 32, display: 'block',
            }}>
              Active Instruction
            </span>

            <h1 style={{
              fontSize: 'clamp(28px, 4vw, 56px)',
              fontWeight: 700, lineHeight: 1.15, marginBottom: 48,
              color: T.text, letterSpacing: '-0.01em',
            }}>
              {step.instruction}
            </h1>

            {/* Timer */}
            {hasTimer && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
                marginBottom: 48,
              }}>
                <div style={{
                  position: 'relative', width: 192, height: 192,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg
                    width={192}
                    height={192}
                    style={{
                      position: 'absolute', inset: 0,
                      transform: 'rotate(-90deg)',
                    }}
                  >
                    <circle
                      cx={96} cy={96} r={88}
                      fill="transparent"
                      stroke={T.surfaceHighest}
                      strokeWidth={4}
                    />
                    <circle
                      cx={96} cy={96} r={88}
                      fill="transparent"
                      stroke={timerSeconds === 0 && timerInitial > 0 ? T.green : T.accent}
                      strokeWidth={4}
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - timerProgress)}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                    />
                  </svg>
                  <span style={{
                    fontSize: 48, fontWeight: 300, letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                    color: timerSeconds === 0 && timerInitial > 0 ? T.green : T.text,
                    transition: 'color 0.3s',
                  }}>
                    {fmtTime(timerSeconds)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 16 }}>
                  <button
                    onClick={toggleTimer}
                    style={{
                      padding: '12px 32px', borderRadius: 9999,
                      background: T.surfaceHigh, border: 'none',
                      color: T.text, fontWeight: 600, fontSize: 14,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = T.surfaceHighest; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = T.surfaceHigh; }}
                  >
                    <span style={{ fontSize: 16 }}>
                      {timerRunning ? '\u23F8' : '\u25B6'}
                    </span>
                    {timerRunning ? 'Pause' : 'Start'}
                  </button>
                  <button
                    onClick={resetTimer}
                    style={{
                      padding: '12px 32px', borderRadius: 9999,
                      background: 'transparent',
                      border: `1px solid rgba(82,68,58,0.3)`,
                      color: T.textSecondary, fontWeight: 600, fontSize: 14,
                      cursor: 'pointer', transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(82,68,58,0.3)'; }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ---- Bottom Step Navigation ---- */}
          <div style={{
            position: 'absolute', bottom: 48, left: 48, right: 48,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            {prevStep ? (
              <button
                onClick={goPrev}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '16px 24px', borderRadius: 9999,
                  background: T.surfaceLow, border: 'none',
                  color: T.textSecondary, cursor: 'pointer',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = T.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = T.textSecondary; }}
              >
                <span style={{ fontSize: 20, transition: 'transform 0.2s' }}>&#x2190;</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>
                    Previous
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {deriveStepTitle(prevStep.instruction)}
                  </span>
                </div>
              </button>
            ) : (
              <div />
            )}

            {nextStep ? (
              <button
                onClick={goNext}
                style={{
                  display: 'flex', alignItems: 'center', gap: 24,
                  padding: '16px 16px 16px 32px', borderRadius: 9999,
                  background: `linear-gradient(135deg, ${T.accent} 0%, ${T.accentContainer} 100%)`,
                  border: 'none', color: '#4B2700', fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8 }}>
                    Next Step
                  </span>
                  <span style={{ fontSize: 13 }}>
                    {deriveStepTitle(nextStep.instruction)}
                  </span>
                </div>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(75,39,0,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 18 }}>&#x2192;</span>
                </div>
              </button>
            ) : (
              <button
                onClick={() => router.push(`/recipes/library/${id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '16px 32px', borderRadius: 9999,
                  background: `linear-gradient(135deg, ${T.green} 0%, #16a34a 100%)`,
                  border: 'none', color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: 'pointer', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                &#x2713; Finish Cooking
              </button>
            )}
          </div>
        </section>

        {/* ---- RIGHT: Technique Reference ---- */}
        <aside style={{
          width: 384, height: '100%', background: T.surfaceLow,
          padding: 32, flexShrink: 0, overflowY: 'auto',
          borderLeft: `1px solid rgba(255,255,255,0.04)`,
        }}>
          <h3 style={{
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em',
            color: T.textSecondary, marginBottom: 24, fontWeight: 600,
          }}>
            Technique Reference
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Chef's Tip */}
            <div style={{
              padding: 24, borderRadius: 16,
              background: T.surfaceHighest,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
              }}>
                <span style={{ color: T.accent, fontSize: 20 }}>&#x1F4A1;</span>
                <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>
                  Chef&apos;s Tip
                </span>
              </div>
              <p style={{
                fontSize: 14, color: T.textSecondary, lineHeight: 1.6, margin: 0,
              }}>
                {step.section
                  ? `Section: ${step.section}. `
                  : ''}
                {step.timer_minutes
                  ? `This step has a ${step.timer_minutes}-minute timer. `
                  : step.inferred_timer_minutes
                    ? `Estimated time: ~${step.inferred_timer_minutes} minutes. `
                    : ''}
                {heatLevel
                  ? `Use ${heatLevel.toLowerCase()} heat for best results. `
                  : ''}
                {stirFreq
                  ? `Stir ${stirFreq.toLowerCase()} throughout this step.`
                  : 'Follow the instruction carefully and adjust to your setup.'}
              </p>
            </div>

            {/* Heat & Stir Indicators */}
            {(heatLevel || stirFreq) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {heatLevel && (
                  <div style={{
                    padding: 16, borderRadius: 16, background: T.surfaceLow,
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <span style={{
                      fontSize: 10, color: T.textSecondary,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                    }}>
                      Heat Level
                    </span>
                    <span style={{ color: T.text, fontWeight: 700 }}>
                      {heatLevel}
                    </span>
                  </div>
                )}
                {stirFreq && (
                  <div style={{
                    padding: 16, borderRadius: 16, background: T.surfaceLow,
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <span style={{
                      fontSize: 10, color: T.textSecondary,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                    }}>
                      Stir Frequency
                    </span>
                    <span style={{ color: T.text, fontWeight: 700 }}>
                      {stirFreq}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Coming Up Next */}
            {(nextStep || (currentStep < totalSteps - 2 && steps[currentStep + 2])) && (
              <div>
                <h4 style={{
                  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em',
                  color: T.textSecondary, marginBottom: 16, fontWeight: 600,
                }}>
                  Coming Up Next
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {nextStep && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: 12, borderRadius: 12, background: 'rgba(19,19,24,0.5)',
                    }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 8,
                        background: T.surfaceHighest,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: T.textSecondary,
                        flexShrink: 0,
                      }}>
                        {nextStep.step_number}
                      </div>
                      <span style={{ fontSize: 13, color: T.textSecondary }}>
                        {deriveStepTitle(nextStep.instruction)}
                      </span>
                    </div>
                  )}
                  {currentStep < totalSteps - 2 && steps[currentStep + 2] && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: 12, borderRadius: 12,
                      background: 'rgba(19,19,24,0.5)',
                      opacity: 0.4,
                    }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 8,
                        background: T.surfaceHighest,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: T.textSecondary,
                        flexShrink: 0,
                      }}>
                        {steps[currentStep + 2]!.step_number}
                      </div>
                      <span style={{ fontSize: 13, color: T.textSecondary }}>
                        {deriveStepTitle(steps[currentStep + 2]!.instruction)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* All steps mini-map */}
            <div>
              <h4 style={{
                fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em',
                color: T.textSecondary, marginBottom: 16, fontWeight: 600,
              }}>
                All Steps
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setCurrentStep(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '8px 12px', borderRadius: 8,
                      background: i === currentStep ? T.surfaceHighest : 'transparent',
                      border: 'none', color: i === currentStep ? T.text : T.textSecondary,
                      cursor: 'pointer', textAlign: 'left', fontSize: 12,
                      opacity: i < currentStep ? 0.4 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: i === currentStep
                        ? `linear-gradient(135deg, ${T.accent}, ${T.accentContainer})`
                        : i < currentStep ? T.surfaceHigh : T.surface,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                      color: i === currentStep ? '#4B2700' : T.textSecondary,
                    }}>
                      {i < currentStep ? '\u2713' : s.step_number}
                    </span>
                    <span style={{
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', fontWeight: i === currentStep ? 600 : 400,
                    }}>
                      {deriveStepTitle(s.instruction)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
