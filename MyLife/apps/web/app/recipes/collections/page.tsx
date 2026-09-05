'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  fetchCollections,
  addCollection,
  editCollection,
  removeCollection,
  fetchRecipeCount,
} from '../actions';

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
  textMuted: 'rgba(228,225,233,0.4)',
  textFaint: 'rgba(228,225,233,0.3)',
  accent: '#22C55E',
  accentDim: 'rgba(34,197,94,0.15)',
  accentBorder: 'rgba(34,197,94,0.25)',
  gold: '#C9894D',
  goldLight: '#FFB877',
  goldDim: 'rgba(201,137,77,0.1)',
  border: 'rgba(255,255,255,0.06)',
  borderSubtle: 'rgba(255,255,255,0.05)',
  glass: 'rgba(19,19,24,0.7)',
  danger: '#FFB4AB',
  success: '#30D158',
} as const;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Collection {
  id: string;
  name: string;
  description: string | null;
  cover_recipe_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Deterministic gradient from collection name */
function gradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 35%, 18%) 0%, hsl(${hue2}, 25%, 12%) 100%)`;
}

function fmtDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [totalRecipes, setTotalRecipes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Hover state for cards
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredCreate, setHoveredCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [cols, count] = await Promise.all([fetchCollections(), fetchRecipeCount()]);
      setCollections(cols as Collection[]);
      setTotalRecipes(count);
    } catch (err) {
      console.error('[collections] load failed:', err);
      setError('Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await addCollection({ name: createName.trim(), description: createDesc.trim() || undefined });
      setCreateName('');
      setCreateDesc('');
      setShowCreate(false);
      await load();
    } catch (err) {
      console.error('[collections] create failed:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await editCollection(id, { name: editName.trim(), description: editDesc.trim() || undefined });
      setEditId(null);
      await load();
    } catch (err) {
      console.error('[collections] edit failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeCollection(id);
      await load();
    } catch (err) {
      console.error('[collections] delete failed:', err);
    }
  };

  const startEdit = (col: Collection) => {
    setEditId(col.id);
    setEditName(col.name);
    setEditDesc(col.description ?? '');
  };

  /* ---------------------------------------------------------------- */
  /*  Styles                                                           */
  /* ---------------------------------------------------------------- */

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    padding: '48px',
  };

  const breadcrumbStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.3em',
    color: C.textMuted,
    marginBottom: 8,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 48,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: C.text,
    marginTop: 8,
    lineHeight: 1.1,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 14,
    color: C.textSecondary,
    marginTop: 12,
    maxWidth: 480,
    lineHeight: 1.6,
    opacity: 0.8,
  };

  const superLabelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: C.gold,
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 32,
  };

  const cardStyle = (isHovered: boolean): React.CSSProperties => ({
    background: isHovered ? C.surfaceHigh : C.surfaceLow,
    borderRadius: 16,
    overflow: 'hidden',
    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: isHovered ? 'scale(1.02)' : 'scale(1)',
    cursor: 'pointer',
    position: 'relative',
  });

  const gradientAreaStyle = (name: string): React.CSSProperties => ({
    aspectRatio: '4/5',
    background: gradientForName(name),
    position: 'relative',
    overflow: 'hidden',
  });

  const gradientOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `linear-gradient(to top, ${C.surfaceLow}, transparent, transparent)`,
    opacity: 0.8,
  };

  const actionButtonsStyle = (isHovered: boolean): React.CSSProperties => ({
    position: 'absolute',
    top: 16,
    right: 16,
    display: 'flex',
    gap: 8,
    opacity: isHovered ? 1 : 0,
    transition: 'opacity 0.3s',
  });

  const iconBtnStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'rgba(53,52,58,0.8)',
    backdropFilter: 'blur(12px)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: C.text,
    fontSize: 14,
    transition: 'color 0.2s',
  };

  const cardBodyStyle: React.CSSProperties = {
    padding: 32,
  };

  const cardTitleRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  };

  const cardTitleStyle = (isHovered: boolean): React.CSSProperties => ({
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: isHovered ? C.goldLight : C.text,
    transition: 'color 0.3s',
  });

  const cardDescStyle: React.CSSProperties = {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 1.6,
    marginBottom: 24,
    opacity: 0.6,
  };

  const cardDateStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 500,
    textTransform: 'uppercase',
    color: C.textMuted,
    letterSpacing: '0.05em',
  };

  const createCardStyle = (isHovered: boolean): React.CSSProperties => ({
    border: `2px dashed ${isHovered ? 'rgba(201,137,77,0.5)' : 'rgba(82,68,58,0.3)'}`,
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    transition: 'all 0.3s',
    background: isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
    cursor: 'pointer',
    aspectRatio: undefined,
    minHeight: 320,
  });

  const createIconCircleStyle: React.CSSProperties = {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: C.surfaceHighest,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    fontSize: 28,
    color: '#9F8E81',
    transition: 'transform 0.3s',
  };

  const createLabelStyle = (isHovered: boolean): React.CSSProperties => ({
    fontSize: 16,
    fontWeight: 700,
    color: isHovered ? C.goldLight : C.textSecondary,
    transition: 'color 0.3s',
  });

  const createSubStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: C.textMuted,
    marginTop: 8,
  };

  const newBtnStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`,
    color: '#4B2700',
    border: 'none',
    borderRadius: 999,
    padding: '12px 32px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'transform 0.2s',
    boxShadow: `0 4px 16px rgba(201,137,77,0.1)`,
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  };

  const modalStyle: React.CSSProperties = {
    background: C.surfaceHigh,
    borderRadius: 20,
    padding: 40,
    width: '100%',
    maxWidth: 480,
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: C.surfaceLow,
    border: `1px solid ${C.borderSubtle}`,
    borderRadius: 12,
    padding: '14px 16px',
    color: C.text,
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: 100,
    resize: 'vertical' as const,
  };

  const modalBtnRow: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 24,
  };

  const cancelBtnStyle: React.CSSProperties = {
    background: C.surfaceHighest,
    color: C.text,
    border: 'none',
    borderRadius: 999,
    padding: '12px 24px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  };

  const saveBtnStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`,
    color: '#4B2700',
    border: 'none',
    borderRadius: 999,
    padding: '12px 28px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  };

  const footerStyle: React.CSSProperties = {
    marginTop: 96,
    paddingTop: 48,
    borderTop: `1px solid ${C.borderSubtle}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 24,
  };

  const statStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: 'rgba(201,137,77,0.6)',
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: 14,
    color: C.text,
    fontWeight: 500,
  };

  /* ---------------------------------------------------------------- */
  /*  Loading / Error states                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.5 }}>&#x1F4D6;</div>
          <p style={{ color: C.textSecondary, fontSize: 14 }}>Loading collections...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: C.danger, fontSize: 14, marginBottom: 16 }}>{error}</p>
          <button
            onClick={() => { setLoading(true); load(); }}
            style={{ ...cancelBtnStyle, color: C.goldLight }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div style={pageStyle}>
      {/* Breadcrumb */}
      <div style={breadcrumbStyle}>Library / Collections</div>

      {/* Header */}
      <section style={headerStyle}>
        <div>
          <span style={superLabelStyle}>Curated Archives</span>
          <h2 style={titleStyle}>Web Collections</h2>
          <p style={subtitleStyle}>
            A cinematic overview of your digital culinary acquisitions.
            Organized by theme, texture, and inspiration.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={() => setShowCreate(true)}
            style={newBtnStyle}
            onMouseEnter={(e) => { (e.currentTarget.style.transform = 'scale(1.02)'); }}
            onMouseLeave={(e) => { (e.currentTarget.style.transform = 'scale(1)'); }}
          >
            <span style={{ fontSize: 18, fontWeight: 700 }}>+</span>
            New Collection
          </button>
        </div>
      </section>

      {/* Collections Grid */}
      <div style={gridStyle}>
        {collections.map((col) => {
          const isHovered = hoveredId === col.id;
          const isEditing = editId === col.id;

          return (
            <div
              key={col.id}
              style={cardStyle(isHovered)}
              onMouseEnter={() => setHoveredId(col.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Gradient Area */}
              <Link
                href={`/recipes/library?collection=${col.id}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div style={gradientAreaStyle(col.name)}>
                  <div style={gradientOverlayStyle} />
                </div>
              </Link>

              {/* Action Buttons (hover) */}
              <div style={actionButtonsStyle(isHovered)}>
                <button
                  style={iconBtnStyle}
                  onClick={(e) => { e.stopPropagation(); startEdit(col); }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = C.goldLight; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = C.text; }}
                  title="Edit"
                >
                  &#9998;
                </button>
                <button
                  style={iconBtnStyle}
                  onClick={(e) => { e.stopPropagation(); handleDelete(col.id); }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = C.danger; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = C.text; }}
                  title="Delete"
                >
                  &#128465;
                </button>
              </div>

              {/* Card Body */}
              <div style={cardBodyStyle}>
                {isEditing ? (
                  /* Inline Edit Form */
                  <div>
                    <input
                      style={{ ...inputStyle, marginBottom: 12 }}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Collection name"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(col.id); if (e.key === 'Escape') setEditId(null); }}
                    />
                    <textarea
                      style={{ ...textareaStyle, marginBottom: 12, minHeight: 60 }}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Description (optional)"
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={cancelBtnStyle} onClick={() => setEditId(null)}>Cancel</button>
                      <button
                        style={{ ...saveBtnStyle, opacity: saving ? 0.6 : 1 }}
                        onClick={() => handleEdit(col.id)}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal Display */
                  <Link
                    href={`/recipes/library?collection=${col.id}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={cardTitleRowStyle}>
                      <h3 style={cardTitleStyle(isHovered)}>{col.name}</h3>
                    </div>
                    {col.description && (
                      <p style={cardDescStyle}>{col.description}</p>
                    )}
                    <div style={cardDateStyle}>
                      Created {fmtDate(col.created_at)}
                    </div>
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {/* Create New Archive Placeholder Card */}
        <button
          style={createCardStyle(hoveredCreate)}
          onMouseEnter={() => setHoveredCreate(true)}
          onMouseLeave={() => setHoveredCreate(false)}
          onClick={() => setShowCreate(true)}
        >
          <div style={createIconCircleStyle}>
            &#43;
          </div>
          <span style={createLabelStyle(hoveredCreate)}>Create New Archive</span>
          <span style={createSubStyle}>Start a new journey</span>
        </button>
      </div>

      {/* Footer Stats */}
      <footer style={footerStyle}>
        <div style={{ display: 'flex', gap: 48 }}>
          <div style={statStyle}>
            <span style={statLabelStyle}>Total Recipes</span>
            <span style={statValueStyle}>{totalRecipes.toLocaleString()}</span>
          </div>
          <div style={statStyle}>
            <span style={statLabelStyle}>Active Collections</span>
            <span style={statValueStyle}>{collections.length}</span>
          </div>
        </div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', color: C.textMuted, fontWeight: 700 }}>
          BestChef Obsidian Edition
        </div>
      </footer>

      {/* Create Collection Modal */}
      {showCreate && (
        <div
          style={modalOverlayStyle}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div style={modalStyle}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: C.text }}>
              New Collection
            </h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textSecondary, display: 'block', marginBottom: 8 }}>
                Name
              </label>
              <input
                style={inputStyle}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Mediterranean Secrets"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && createName.trim()) handleCreate(); }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textSecondary, display: 'block', marginBottom: 8 }}>
                Description
              </label>
              <textarea
                style={textareaStyle}
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Handpicked coastal recipes from Tuscany to the Greek Islands..."
              />
            </div>
            <div style={modalBtnRow}>
              <button style={cancelBtnStyle} onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                style={{ ...saveBtnStyle, opacity: creating || !createName.trim() ? 0.5 : 1 }}
                onClick={handleCreate}
                disabled={creating || !createName.trim()}
              >
                {creating ? 'Creating...' : 'Create Collection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
