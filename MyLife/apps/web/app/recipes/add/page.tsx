'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addRecipe, parseRecipeText } from '../actions';

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

interface ParsedIngredient {
  name: string;
  quantity: string;
  unit: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CreateRecipePage() {
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('4');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [description, setDescription] = useState('');

  // Ingredient parser state
  const [ingredientText, setIngredientText] = useState('');
  const [ingredients, setIngredients] = useState<ParsedIngredient[]>([]);
  const [parsing, setParsing] = useState(false);

  // Steps state
  const [steps, setSteps] = useState<string[]>(['']);

  // Save state
  const [saving, setSaving] = useState(false);

  /* -- Ingredient parsing ------------------------------------------ */

  async function handleParse() {
    if (!ingredientText.trim()) return;
    setParsing(true);
    try {
      const result = await parseRecipeText(ingredientText);
      if (result && result.ingredients.length > 0) {
        const parsed: ParsedIngredient[] = result.ingredients.map((raw) => {
          const match = raw.match(/^([\d./\s]+)?\s*([\w]+)?\s+(.+)$/);
          if (match) {
            return {
              quantity: (match[1] ?? '').trim(),
              unit: (match[2] ?? '').trim(),
              name: (match[3] ?? raw).trim(),
            };
          }
          return { quantity: '', unit: '', name: raw };
        });
        setIngredients((prev) => [...prev, ...parsed]);
      }
    } catch {
      // silent
    } finally {
      setParsing(false);
    }
  }

  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  }

  function addEmptyIngredient() {
    setIngredients((prev) => [...prev, { name: '', quantity: '', unit: '' }]);
  }

  function updateIngredient(idx: number, field: keyof ParsedIngredient, value: string) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing))
    );
  }

  /* -- Steps ------------------------------------------------------- */

  function addStep() {
    setSteps((prev) => [...prev, '']);
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateStep(idx: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? value : s)));
  }

  /* -- Save -------------------------------------------------------- */

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await addRecipe({
        title: title.trim(),
        description: description.trim() || undefined,
        difficulty: difficulty || undefined,
        prep_time_mins: prepTime ? parseInt(prepTime, 10) : undefined,
        cook_time_mins: cookTime ? parseInt(cookTime, 10) : undefined,
        servings: servings ? parseInt(servings, 10) : undefined,
      });
      router.push('/recipes');
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  /* -- Styles ------------------------------------------------------ */

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    padding: '0 0 80px 0',
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: 800,
    margin: '0 auto',
    padding: '40px 24px',
  };

  const breadcrumbStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    marginBottom: 32,
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 48,
    gap: 24,
    flexWrap: 'wrap',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    fontWeight: 700,
    color: C.gold,
    marginBottom: 8,
    display: 'block',
  };

  const metaLabelStyle: React.CSSProperties = {
    ...labelStyle,
    color: C.textSecondary,
  };

  const inputBaseStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${C.outlineVariant}`,
    color: C.text,
    fontSize: 24,
    fontWeight: 500,
    padding: '16px 0',
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  };

  const metaInputWrapStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: C.surfaceLow,
    padding: '12px 16px',
    borderRadius: 12,
    border: `1px solid ${C.glassBorder}`,
  };

  const metaInputStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: C.text,
    fontSize: 14,
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const sectionCardStyle: React.CSSProperties = {
    background: C.surfaceLow,
    borderRadius: 16,
    padding: 32,
    border: `1px solid ${C.glassBorder}`,
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: C.text,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    height: 128,
    background: C.surfaceLowest,
    border: `1px solid rgba(82, 68, 58, 0.3)`,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: C.text,
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
    marginBottom: 24,
    transition: 'border-color 0.2s',
  };

  const tableHeaderStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: C.textSecondary,
    padding: '12px 24px',
    textAlign: 'left' as const,
  };

  const tableCellStyle: React.CSSProperties = {
    padding: '16px 24px',
    color: C.text,
    fontSize: 14,
    borderTop: `1px solid ${C.glassBorder}`,
  };

  const tableCellInputStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: C.text,
    fontSize: 14,
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const stepCardStyle: React.CSSProperties = {
    display: 'flex',
    gap: 24,
    background: C.surface,
    padding: 24,
    borderRadius: 16,
    border: `1px solid ${C.glassBorder}`,
    transition: 'border-color 0.2s',
  };

  const stepNumberStyle: React.CSSProperties = {
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(201, 137, 77, 0.2)',
    border: '1px solid rgba(255, 184, 119, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: C.goldLight,
    fontWeight: 700,
    fontSize: 14,
  };

  const stepTextareaStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: C.text,
    fontSize: 14,
    lineHeight: 1.7,
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 56,
  };

  const btnPrimaryStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 32px',
    borderRadius: 9999,
    background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`,
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    border: 'none',
    cursor: 'pointer',
    transition: 'filter 0.2s',
    boxShadow: '0 4px 16px rgba(34, 197, 94, 0.2)',
  };

  const btnSecondaryStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 24px',
    borderRadius: 9999,
    background: C.surfaceHigh,
    color: C.text,
    fontSize: 10,
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
    color: C.gold,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  };

  const deleteButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: C.textSecondary,
    cursor: 'pointer',
    fontSize: 18,
    padding: 4,
    transition: 'color 0.2s',
  };

  const selectStyle: React.CSSProperties = {
    background: C.surfaceLow,
    border: `1px solid ${C.glassBorder}`,
    borderRadius: 12,
    padding: '12px 16px',
    color: C.text,
    fontSize: 14,
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
    appearance: 'none' as const,
    cursor: 'pointer',
  };

  /* -- Render ------------------------------------------------------ */

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {/* Breadcrumb */}
        <div style={breadcrumbStyle}>
          <span style={{ color: C.textSecondary, cursor: 'pointer' }} onClick={() => router.push('/recipes')}>Library</span>
          <span style={{ color: C.textSecondary }}>&#8250;</span>
          <span style={{ color: C.gold }}>Create New Recipe</span>
        </div>

        {/* Header + Actions */}
        <div style={headerRowStyle}>
          <div>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              New Masterpiece
            </h2>
            <p style={{ color: C.textSecondary, marginTop: 8, fontSize: 14 }}>
              Document your culinary evolution with precision.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              style={btnSecondaryStyle}
              onClick={() => router.push('/recipes')}
            >
              Cancel
            </button>
            <button
              style={{ ...btnPrimaryStyle, opacity: saving || !title.trim() ? 0.5 : 1 }}
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? 'Saving...' : 'Save Recipe'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {/* Cover Photo Placeholder */}
          <section
            style={{
              position: 'relative',
              height: 384,
              width: '100%',
              borderRadius: 16,
              overflow: 'hidden',
              background: C.surfaceLow,
              border: `2px dashed ${C.outlineVariant}`,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'border-color 0.2s',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: C.surfaceHigh,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}
            >
              <span style={{ fontSize: 28, color: C.goldLight }}>+</span>
            </div>
            <p style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Upload Cover Art
            </p>
            <p style={{ color: C.textSecondary, fontSize: 10, marginTop: 4 }}>
              Recommended: 16:9 Cinema Aspect
            </p>
          </section>

          {/* Basic Info */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={labelStyle}>Recipe Title</label>
              <input
                style={inputBaseStyle}
                placeholder="e.g. Saffron Infused Wild Risotto"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label style={metaLabelStyle}>Description</label>
              <textarea
                style={{
                  ...textareaStyle,
                  height: 72,
                  marginBottom: 0,
                  background: C.surfaceLow,
                }}
                placeholder="A brief description of this recipe..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
              <div>
                <label style={metaLabelStyle}>Prep Time</label>
                <div style={metaInputWrapStyle}>
                  <span style={{ color: C.goldLight, fontSize: 16 }}>&#9202;</span>
                  <input
                    style={metaInputStyle}
                    placeholder="20 min"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
              <div>
                <label style={metaLabelStyle}>Cook Time</label>
                <div style={metaInputWrapStyle}>
                  <span style={{ color: C.goldLight, fontSize: 16 }}>&#9832;</span>
                  <input
                    style={metaInputStyle}
                    placeholder="45 min"
                    value={cookTime}
                    onChange={(e) => setCookTime(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
              <div>
                <label style={metaLabelStyle}>Servings</label>
                <div style={metaInputWrapStyle}>
                  <span style={{ color: C.goldLight, fontSize: 16 }}>&#128101;</span>
                  <input
                    style={metaInputStyle}
                    placeholder="4"
                    value={servings}
                    onChange={(e) => setServings(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
              <div>
                <label style={metaLabelStyle}>Difficulty</label>
                <select
                  style={selectStyle}
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
          </section>

          {/* Smart Ingredient Parser */}
          <section style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <div style={sectionTitleStyle}>
                <span style={{ color: C.goldLight }}>&#10024;</span>
                Smart Ingredient Parser
              </div>
              <span style={{ fontSize: 10, color: C.textSecondary, fontStyle: 'italic' }}>
                Paste your list, we'll organize it.
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 24 }}>
              <textarea
                style={{ ...textareaStyle, marginBottom: 0, flex: 1 }}
                placeholder="e.g. 2 cups of Arborio rice, 1 pinch of saffron threads, 500ml vegetable broth..."
                value={ingredientText}
                onChange={(e) => setIngredientText(e.target.value)}
              />
              <button
                style={{
                  ...btnPrimaryStyle,
                  padding: '12px 24px',
                  flexShrink: 0,
                  alignSelf: 'flex-end',
                  opacity: parsing || !ingredientText.trim() ? 0.5 : 1,
                  background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`,
                  color: '#000',
                }}
                onClick={handleParse}
                disabled={parsing || !ingredientText.trim()}
              >
                {parsing ? 'Parsing...' : 'Parse'}
              </button>
            </div>

            {/* Ingredient Table */}
            {ingredients.length > 0 && (
              <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.glassBorder}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: C.surfaceHigh }}>
                      <th style={tableHeaderStyle}>Ingredient</th>
                      <th style={{ ...tableHeaderStyle, width: 80 }}>Qty</th>
                      <th style={{ ...tableHeaderStyle, width: 100 }}>Unit</th>
                      <th style={{ ...tableHeaderStyle, width: 48 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map((ing, idx) => (
                      <tr key={idx}>
                        <td style={tableCellStyle}>
                          <input
                            style={tableCellInputStyle}
                            value={ing.name}
                            onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                            placeholder="Ingredient name"
                          />
                        </td>
                        <td style={tableCellStyle}>
                          <input
                            style={{ ...tableCellInputStyle, width: 60 }}
                            value={ing.quantity}
                            onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)}
                            placeholder="--"
                          />
                        </td>
                        <td style={tableCellStyle}>
                          <input
                            style={{ ...tableCellInputStyle, width: 80 }}
                            value={ing.unit}
                            onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                            placeholder="--"
                          />
                        </td>
                        <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                          <button
                            style={deleteButtonStyle}
                            onClick={() => removeIngredient(idx)}
                            title="Remove"
                          >
                            &#10005;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <button style={btnTextStyle} onClick={addEmptyIngredient}>
                + Add Ingredient Manually
              </button>
            </div>
          </section>

          {/* Preparation Steps */}
          <section>
            <div style={sectionHeaderStyle}>
              <div style={sectionTitleStyle}>
                <span style={{ color: C.goldLight }}>&#9776;</span>
                Preparation Steps
              </div>
              <button style={btnTextStyle} onClick={addStep}>
                + Add Step
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {steps.map((step, idx) => (
                <div key={idx} style={stepCardStyle}>
                  <div style={stepNumberStyle}>{idx + 1}</div>
                  <div style={{ flex: 1 }}>
                    <textarea
                      style={stepTextareaStyle}
                      placeholder="Describe this action..."
                      rows={2}
                      value={step}
                      onChange={(e) => updateStep(idx, e.target.value)}
                    />
                    {steps.length > 1 && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          style={{ ...deleteButtonStyle, fontSize: 12, color: C.danger }}
                          onClick={() => removeStep(idx)}
                        >
                          Remove step
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            marginTop: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            borderTop: `1px solid ${C.glassBorder}`,
            paddingTop: 48,
          }}
        >
          <button
            style={btnTextStyle}
            onClick={() => router.push('/recipes')}
          >
            Discard Draft
          </button>
        </div>
      </div>
    </div>
  );
}
