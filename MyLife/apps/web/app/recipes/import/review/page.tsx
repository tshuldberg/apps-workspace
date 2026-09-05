'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addRecipe, parseRecipeText } from '../../actions';

/* ------------------------------------------------------------------ */
/*  Design tokens                                                      */
/* ------------------------------------------------------------------ */

const C = {
  bg: '#131318',
  surfaceLowest: '#0E0E13',
  surfaceLow: '#1B1B20',
  surface: '#1F1F25',
  surfaceHigh: '#2A292F',
  surfaceHighest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  accent: '#22C55E',
  accentDark: '#166534',
  gold: '#C9894D',
  goldLight: '#FFB877',
  outline: '#9F8E81',
  outlineVariant: '#52443A',
  danger: '#FFB4AB',
  glass: 'rgba(255,255,255,0.03)',
  glassBorder: 'rgba(255,255,255,0.05)',
} as const;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ParsedData {
  title: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  difficulty: 'easy' | 'medium' | 'hard';
  sourceUrl: string;
  ingredients: string[];
  steps: string[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function ImportReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedData>({
    title: '',
    description: '',
    prepTime: '',
    cookTime: '',
    servings: '2',
    difficulty: 'medium',
    sourceUrl: '',
    ingredients: [],
    steps: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* -- Parse on mount ---------------------------------------------- */

  useEffect(() => {
    const text = searchParams.get('text') ?? '';
    const source = searchParams.get('source') ?? '';

    if (!text) {
      setLoading(false);
      setRawText('No text provided. Go back and paste recipe text to import.');
      return;
    }

    setRawText(text);

    async function doParse() {
      try {
        const result = await parseRecipeText(text);
        if (result) {
          setParsed({
            title: result.title || 'Untitled Recipe',
            description: result.description ?? '',
            prepTime: result.prep_time_min ? String(result.prep_time_min) : '',
            cookTime: result.cook_time_min ? String(result.cook_time_min) : '',
            servings: result.servings ? String(result.servings) : '2',
            difficulty: 'medium',
            sourceUrl: source,
            ingredients: result.ingredients ?? [],
            steps: result.steps ?? [],
          });
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }

    doParse();
  }, [searchParams]);

  /* -- Save -------------------------------------------------------- */

  async function handleSave() {
    if (!parsed.title.trim()) return;
    setSaving(true);
    try {
      await addRecipe({
        title: parsed.title.trim(),
        description: parsed.description.trim() || undefined,
        difficulty: parsed.difficulty || undefined,
        prep_time_mins: parsed.prepTime ? parseInt(parsed.prepTime, 10) : undefined,
        cook_time_mins: parsed.cookTime ? parseInt(parsed.cookTime, 10) : undefined,
        servings: parsed.servings ? parseInt(parsed.servings, 10) : undefined,
        source_url: parsed.sourceUrl.trim() || undefined,
      });
      router.push('/recipes');
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  /* -- Ingredient / Step editing ----------------------------------- */

  function updateIngredient(idx: number, value: string) {
    setParsed((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((item, i) => (i === idx ? value : item)),
    }));
  }

  function removeIngredient(idx: number) {
    setParsed((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx),
    }));
  }

  function addIngredient() {
    setParsed((prev) => ({ ...prev, ingredients: [...prev.ingredients, ''] }));
  }

  function updateStep(idx: number, value: string) {
    setParsed((prev) => ({
      ...prev,
      steps: prev.steps.map((item, i) => (i === idx ? value : item)),
    }));
  }

  function removeStep(idx: number) {
    setParsed((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== idx),
    }));
  }

  /* -- Styles ------------------------------------------------------ */

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  };

  const contentStyle: React.CSSProperties = {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '40px 32px 80px',
  };

  const breadcrumbStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: 32,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    fontWeight: 700,
    color: C.textSecondary,
    marginBottom: 4,
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    fontWeight: 700,
    color: C.gold,
    marginBottom: 24,
  };

  const cardStyle: React.CSSProperties = {
    background: C.surfaceLow,
    borderRadius: 12,
    border: `1px solid ${C.glassBorder}`,
    overflow: 'hidden',
  };

  const metaBarStyle: React.CSSProperties = {
    ...cardStyle,
    background: C.surfaceHigh,
    padding: 24,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 32,
  };

  const metaInputStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: C.text,
    fontSize: 14,
    fontWeight: 700,
    outline: 'none',
    fontFamily: 'inherit',
    width: 64,
  };

  const editInputStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: C.text,
    fontSize: 14,
    fontWeight: 500,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    padding: 0,
  };

  const selectStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: C.text,
    fontSize: 14,
    fontWeight: 700,
    outline: 'none',
    fontFamily: 'inherit',
    appearance: 'none' as const,
    cursor: 'pointer',
    paddingRight: 16,
  };

  const rawTextStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'rgba(214,195,181,0.7)',
    fontFamily: 'monospace',
    lineHeight: 1.7,
    maxHeight: 192,
    overflowY: 'auto' as const,
  };

  const ingredientRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '8px 0',
  };

  const dotStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: C.gold,
    flexShrink: 0,
    marginTop: 7,
  };

  const stepRowStyle: React.CSSProperties = {
    position: 'relative' as const,
    paddingLeft: 32,
    marginBottom: 24,
  };

  const stepNumStyle: React.CSSProperties = {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    fontSize: 10,
    fontWeight: 900,
    color: 'rgba(255,184,119,0.4)',
    letterSpacing: '-0.05em',
  };

  const stepTextareaStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: C.text,
    fontSize: 14,
    lineHeight: 1.7,
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'none' as const,
    minHeight: 40,
    overflow: 'hidden',
  };

  const btnPrimaryStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 40px',
    borderRadius: 9999,
    background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`,
    color: '#000',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.15s',
    boxShadow: `0 4px 16px rgba(201,137,77,0.1)`,
  };

  const btnDiscardStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 32px',
    borderRadius: 9999,
    background: 'rgba(255,255,255,0.05)',
    color: C.text,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.2s',
  };

  const btnTextStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'rgba(255,184,119,0.6)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    transition: 'color 0.2s',
  };

  const deleteButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'rgba(255,180,171,0.6)',
    cursor: 'pointer',
    fontSize: 14,
    padding: 2,
    opacity: 0,
    transition: 'opacity 0.2s',
  };

  /* -- Loading state ----------------------------------------------- */

  if (loading) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.textSecondary, fontSize: 14 }}>Parsing recipe...</p>
      </div>
    );
  }

  /* -- Render ------------------------------------------------------ */

  return (
    <div style={pageStyle}>
      <div style={contentStyle}>
        {/* Breadcrumb */}
        <div style={breadcrumbStyle}>
          <span style={{ color: C.gold, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.gold, display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Step 2: Review &amp; Refine
          </span>
        </div>

        {/* Header */}
        <div style={headerStyle}>
          <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>
            Importing &ldquo;{parsed.title}&rdquo;
          </h2>
          <p style={{ color: C.textSecondary, fontSize: 14, maxWidth: 640, lineHeight: 1.7 }}>
            We've parsed the source content into an editable format. Review the details below and make any
            necessary adjustments before committing to your permanent collection.
          </p>
        </div>

        {/* Bento Grid: 4-col left, 8-col right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
          {/* ---- Left Column: Source Image + Raw Text ---- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Source Image Placeholder */}
            <div style={{ ...cardStyle, position: 'relative' as const }}>
              <div
                style={{
                  aspectRatio: '1',
                  background: `linear-gradient(180deg, ${C.surfaceLow} 0%, ${C.surfaceLowest} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 48, opacity: 0.15 }}>&#127858;</span>
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: 16,
                  left: 16,
                }}
              >
                <span
                  style={{
                    background: 'rgba(255,184,119,0.2)',
                    backdropFilter: 'blur(12px)',
                    color: C.gold,
                    padding: '4px 12px',
                    borderRadius: 9999,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  Original Source
                </span>
              </div>
            </div>

            {/* Extracted Raw Text */}
            <div style={{ ...cardStyle, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={sectionLabelStyle}>Extracted Raw Text</h3>
              </div>
              <div style={rawTextStyle}>
                &ldquo;{rawText}&rdquo;
              </div>
            </div>
          </div>

          {/* ---- Right Column: Structured Content ---- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Metadata Bar */}
            <div style={metaBarStyle}>
              <div>
                <div style={labelStyle}>Prep Time</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: C.gold, fontSize: 14 }}>&#9202;</span>
                  <input
                    style={metaInputStyle}
                    value={parsed.prepTime ? `${parsed.prepTime} MIN` : '--'}
                    onChange={(e) => {
                      const num = e.target.value.replace(/\D/g, '');
                      setParsed((prev) => ({ ...prev, prepTime: num }));
                    }}
                  />
                </div>
              </div>
              <div>
                <div style={labelStyle}>Servings</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: C.gold, fontSize: 14 }}>&#128101;</span>
                  <input
                    style={{ ...metaInputStyle, width: 32, textAlign: 'center' }}
                    value={parsed.servings}
                    onChange={(e) => {
                      const num = e.target.value.replace(/\D/g, '');
                      setParsed((prev) => ({ ...prev, servings: num }));
                    }}
                  />
                </div>
              </div>
              <div>
                <div style={labelStyle}>Difficulty</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: C.gold, fontSize: 14 }}>&#9617;</span>
                  <select
                    style={selectStyle}
                    value={parsed.difficulty}
                    onChange={(e) =>
                      setParsed((prev) => ({ ...prev, difficulty: e.target.value as ParsedData['difficulty'] }))
                    }
                  >
                    <option value="easy">Beginner</option>
                    <option value="medium">Intermediate</option>
                    <option value="hard">Expert</option>
                  </select>
                </div>
              </div>
              {parsed.sourceUrl && (
                <div style={{ marginLeft: 'auto' }}>
                  <div style={labelStyle}>Source URL</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: C.gold, fontSize: 14 }}>&#128279;</span>
                    <input
                      style={{ ...metaInputStyle, width: 192, fontSize: 12, fontWeight: 500, color: C.textSecondary }}
                      value={parsed.sourceUrl}
                      onChange={(e) => setParsed((prev) => ({ ...prev, sourceUrl: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Ingredients + Instructions Side by Side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Ingredients */}
              <div style={{ ...cardStyle, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <h3 style={{ ...sectionLabelStyle, marginBottom: 0 }}>Ingredients</h3>
                  <button style={btnTextStyle} onClick={addIngredient}>
                    + Add
                  </button>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {parsed.ingredients.map((ing, idx) => (
                    <li
                      key={idx}
                      style={ingredientRowStyle}
                      onMouseEnter={(e) => {
                        const btn = e.currentTarget.querySelector('[data-delete]') as HTMLElement;
                        if (btn) btn.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget.querySelector('[data-delete]') as HTMLElement;
                        if (btn) btn.style.opacity = '0';
                      }}
                    >
                      <span style={dotStyle} />
                      <div style={{ flex: 1 }}>
                        <input
                          style={editInputStyle}
                          value={ing}
                          onChange={(e) => updateIngredient(idx, e.target.value)}
                          placeholder="Ingredient"
                        />
                      </div>
                      <button
                        data-delete
                        style={deleteButtonStyle}
                        onClick={() => removeIngredient(idx)}
                        title="Remove"
                      >
                        &#10005;
                      </button>
                    </li>
                  ))}
                </ul>
                {parsed.ingredients.length === 0 && (
                  <p style={{ color: C.textSecondary, fontSize: 13, fontStyle: 'italic' }}>
                    No ingredients parsed.
                  </p>
                )}
              </div>

              {/* Instructions */}
              <div style={{ ...cardStyle, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <h3 style={{ ...sectionLabelStyle, marginBottom: 0 }}>Instructions</h3>
                </div>
                <div>
                  {parsed.steps.map((step, idx) => (
                    <div
                      key={idx}
                      style={stepRowStyle}
                      onMouseEnter={(e) => {
                        const btn = e.currentTarget.querySelector('[data-delete-step]') as HTMLElement;
                        if (btn) btn.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget.querySelector('[data-delete-step]') as HTMLElement;
                        if (btn) btn.style.opacity = '0';
                      }}
                    >
                      <span style={stepNumStyle}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <textarea
                          style={stepTextareaStyle}
                          value={step}
                          onChange={(e) => updateStep(idx, e.target.value)}
                          rows={2}
                        />
                        <button
                          data-delete-step
                          style={{ ...deleteButtonStyle, flexShrink: 0 }}
                          onClick={() => removeStep(idx)}
                          title="Remove step"
                        >
                          &#10005;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {parsed.steps.length === 0 && (
                  <p style={{ color: C.textSecondary, fontSize: 13, fontStyle: 'italic' }}>
                    No steps parsed.
                  </p>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div
              style={{
                ...cardStyle,
                background: C.surfaceHigh,
                padding: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex' }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: C.gold,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 8,
                      fontWeight: 700,
                      border: `2px solid ${C.bg}`,
                      color: '#000',
                    }}
                  >
                    U
                  </div>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: C.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 8,
                      fontWeight: 700,
                      border: `2px solid ${C.bg}`,
                      marginLeft: -8,
                      color: '#000',
                    }}
                  >
                    AI
                  </div>
                </div>
                <span style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textSecondary, fontWeight: 500 }}>
                  Collaborative Draft
                </span>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <button
                  style={btnDiscardStyle}
                  onClick={() => router.push('/recipes')}
                >
                  Discard
                </button>
                <button
                  style={{
                    ...btnPrimaryStyle,
                    opacity: saving || !parsed.title.trim() ? 0.5 : 1,
                  }}
                  onClick={handleSave}
                  disabled={saving || !parsed.title.trim()}
                >
                  {saving ? 'Saving...' : 'Save to Library'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ImportReviewPage() {
  return (
    <Suspense fallback={null}>
      <ImportReviewPageContent />
    </Suspense>
  );
}
