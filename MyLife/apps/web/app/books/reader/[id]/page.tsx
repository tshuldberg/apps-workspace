'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  fetchReaderDocumentAction,
  fetchReaderNotesAction,
  fetchReaderPreferencesAction,
  saveReaderPreferencesAction,
} from '../../actions';

interface ReaderDocumentDetail {
  id: string;
  title: string;
  author?: string | null;
  progress_percent?: number | null;
  total_words?: number | null;
  text_content?: string;
}

interface ReaderNote {
  id: string;
  note_type?: string | null;
  selected_text?: string | null;
  note_text?: string | null;
  selection_start?: number;
  selection_end?: number;
  color?: string | null;
}

interface ReaderPrefs {
  document_id: string;
  font_size: number;
  line_height: number;
  font_family: string;
  theme: 'dark' | 'sepia' | 'light';
  margin_size: number;
}

const ACCENT = 'var(--accent-books)';
const ACCENT_DIM = 'rgba(201,137,77,0.15)';
const ACCENT_BORDER = 'rgba(201,137,77,0.25)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const SURFACE_EL = 'var(--surface-elevated)';
const BORDER = 'var(--border)';

const DEFAULT_PREFS: Omit<ReaderPrefs, 'document_id'> = {
  font_size: 20,
  line_height: 1.6,
  font_family: 'serif',
  theme: 'dark',
  margin_size: 20,
};

const THEME_STYLES: Record<
  string,
  { bg: string; text: string; label: string; dot: string }
> = {
  light: {
    bg: '#F5F1EB',
    text: '#2C2520',
    label: 'Light',
    dot: '#F5F1EB',
  },
  dark: {
    bg: '#131318',
    text: '#E4E1E9',
    label: 'Dark',
    dot: '#1B1B20',
  },
  sepia: {
    bg: '#3A2F25',
    text: '#D6C3B5',
    label: 'Sepia',
    dot: '#3A2F25',
  },
};

export default function ReaderDocumentPage() {
  const params = useParams<{ id: string }>();
  const documentId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [document, setDocument] = useState<ReaderDocumentDetail | null | undefined>(undefined);
  const [notes, setNotes] = useState<ReaderNote[]>([]);
  const [prefs, setPrefs] = useState<Omit<ReaderPrefs, 'document_id'>>(DEFAULT_PREFS);
  const [showHighlights, setShowHighlights] = useState(true);
  const [showAppearance, setShowAppearance] = useState(false);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;

    void Promise.all([
      fetchReaderDocumentAction(documentId),
      fetchReaderNotesAction(documentId),
      fetchReaderPreferencesAction(documentId),
    ]).then(([nextDoc, nextNotes, nextPrefs]) => {
      if (cancelled) return;
      setDocument(nextDoc as ReaderDocumentDetail | null);
      setNotes(nextNotes as ReaderNote[]);
      if (nextPrefs) {
        const p = nextPrefs as ReaderPrefs;
        setPrefs({
          font_size: p.font_size,
          line_height: p.line_height,
          font_family: p.font_family,
          theme: p.theme,
          margin_size: p.margin_size,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const savePrefs = useCallback(
    (updates: Partial<Omit<ReaderPrefs, 'document_id'>>) => {
      if (!documentId) return;
      const next = { ...prefs, ...updates };
      setPrefs(next);
      void saveReaderPreferencesAction({
        document_id: documentId,
        ...next,
      });
    },
    [documentId, prefs],
  );

  const highlights = useMemo(
    () => notes.filter((n) => n.selected_text),
    [notes],
  );

  const themeStyle = THEME_STYLES[prefs.theme] ?? THEME_STYLES.dark;

  // Split text into paragraphs for rendering
  const paragraphs = useMemo(() => {
    if (!document?.text_content) return [];
    return document.text_content.split(/\n\n+/).filter((p) => p.trim());
  }, [document?.text_content]);

  // Derive a "chapter title" from the first line if it looks like a heading
  const chapterTitle = useMemo(() => {
    if (paragraphs.length === 0) return null;
    const first = paragraphs[0].trim();
    if (first.length < 80 && !first.includes('.')) return first;
    return null;
  }, [paragraphs]);

  const bodyParagraphs = chapterTitle ? paragraphs.slice(1) : paragraphs;

  if (document === undefined) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: TEXT_SEC }}>
        Loading reader document...
      </div>
    );
  }

  if (!document) {
    return (
      <section
        style={{
          padding: 32,
          borderRadius: 24,
          border: `1px solid ${BORDER}`,
          backgroundColor: SURFACE,
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>
          Document not found
        </h1>
        <p style={{ margin: '12px 0 0', color: TEXT_SEC }}>
          This manuscript may have been removed.
        </p>
        <Link
          href="/books/reader"
          style={{
            display: 'inline-block',
            marginTop: 20,
            color: ACCENT,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Back to Reader
        </Link>
      </section>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: showHighlights
          ? '280px 1fr'
          : '1fr',
        gap: 0,
        margin: '-32px -24px -48px',
        minHeight: '100vh',
      }}
    >
      {/* Highlights sidebar */}
      {showHighlights && (
        <aside
          style={{
            borderRight: `1px solid ${BORDER}`,
            backgroundColor: SURFACE,
            padding: '24px 20px',
            overflowY: 'auto',
            maxHeight: '100vh',
            position: 'sticky',
            top: 0,
          }}
        >
          <h3
            style={{
              margin: '0 0 16px',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: TEXT_SEC,
            }}
          >
            Highlights & Notes
          </h3>
          {highlights.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC, lineHeight: 1.5 }}>
              No highlights yet. Select text while reading to create highlights.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {highlights.map((note) => (
                <div
                  key={note.id}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: SURFACE_EL,
                    borderLeft: `3px solid ${note.color ?? ACCENT}`,
                    cursor: 'pointer',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: TEXT,
                      lineHeight: 1.5,
                      fontStyle: 'italic',
                    }}
                  >
                    &ldquo;{note.selected_text}&rdquo;
                  </p>
                  {note.note_text && (
                    <p
                      style={{
                        margin: '8px 0 0',
                        fontSize: 13,
                        color: TEXT_SEC,
                        lineHeight: 1.4,
                      }}
                    >
                      {note.note_text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      )}

      {/* Main reading area */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '14px 24px',
            borderBottom: `1px solid ${BORDER}`,
            backgroundColor: 'var(--glass-strong)',
            backdropFilter: 'blur(14px)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <Link
              href="/books/reader"
              style={{
                color: TEXT_SEC,
                textDecoration: 'none',
                fontSize: 20,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ←
            </Link>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: TEXT,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {document.title}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setShowHighlights((v) => !v)}
              style={{
                padding: '8px 16px',
                borderRadius: 12,
                border: `1px solid ${showHighlights ? ACCENT_BORDER : BORDER}`,
                backgroundColor: showHighlights ? ACCENT_DIM : 'transparent',
                color: showHighlights ? ACCENT : TEXT_SEC,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Highlights
            </button>
            <button
              type="button"
              onClick={() => setShowAppearance((v) => !v)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: `1px solid ${showAppearance ? ACCENT_BORDER : BORDER}`,
                backgroundColor: showAppearance ? ACCENT_DIM : 'transparent',
                color: showAppearance ? ACCENT : TEXT_SEC,
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ⚙
            </button>
          </div>
        </header>

        {/* Content + appearance panel */}
        <div style={{ display: 'flex', flex: 1 }}>
          {/* Reading content */}
          <article
            style={{
              flex: 1,
              padding: `40px ${24 + prefs.margin_size}px 80px`,
              backgroundColor: themeStyle.bg,
              color: themeStyle.text,
              fontFamily: prefs.font_family === 'serif'
                ? 'Georgia, "Times New Roman", serif'
                : '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: prefs.font_size,
              lineHeight: prefs.line_height,
              maxWidth: 780,
              margin: '0 auto',
              transition: 'background-color 0.2s, color 0.2s',
            }}
          >
            {chapterTitle && (
              <h1
                style={{
                  fontSize: prefs.font_size * 1.8,
                  lineHeight: 1.15,
                  fontWeight: 800,
                  marginBottom: 32,
                  color: themeStyle.text,
                }}
              >
                {chapterTitle}
              </h1>
            )}
            {bodyParagraphs.length > 0 ? (
              bodyParagraphs.map((para, i) => (
                <p key={i} style={{ margin: '0 0 1.2em' }}>
                  {para}
                </p>
              ))
            ) : (
              <p style={{ color: TEXT_SEC, fontStyle: 'italic' }}>
                This document has no text content to display.
              </p>
            )}
          </article>

          {/* Appearance panel */}
          {showAppearance && (
            <AppearancePanel
              prefs={prefs}
              onUpdate={savePrefs}
              onClose={() => setShowAppearance(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AppearancePanel({
  prefs,
  onUpdate,
  onClose,
}: {
  prefs: Omit<ReaderPrefs, 'document_id'>;
  onUpdate: (updates: Partial<Omit<ReaderPrefs, 'document_id'>>) => void;
  onClose: () => void;
}) {
  const sectionLabel: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: TEXT_SEC,
    margin: '0 0 10px',
  };

  return (
    <aside
      style={{
        width: 260,
        minWidth: 260,
        borderLeft: `1px solid ${BORDER}`,
        backgroundColor: SURFACE,
        padding: '24px 20px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: ACCENT,
          }}
        >
          Appearance
        </h3>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: TEXT_SEC,
            fontSize: 18,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          ×
        </button>
      </div>

      {/* Font Size */}
      <div style={{ marginBottom: 24 }}>
        <p style={sectionLabel}>Font Size</p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() =>
              onUpdate({ font_size: Math.max(12, prefs.font_size - 2) })
            }
            style={stepBtnStyle}
          >
            A−
          </button>
          <div
            style={{
              flex: 1,
              position: 'relative',
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${((prefs.font_size - 12) / (48 - 12)) * 100}%`,
                borderRadius: 2,
                backgroundColor: ACCENT,
              }}
            />
            <input
              type="range"
              min={12}
              max={48}
              value={prefs.font_size}
              onChange={(e) =>
                onUpdate({ font_size: Number(e.target.value) })
              }
              style={{
                position: 'absolute',
                left: 0,
                top: -6,
                width: '100%',
                height: 16,
                opacity: 0,
                cursor: 'pointer',
              }}
            />
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdate({ font_size: Math.min(48, prefs.font_size + 2) })
            }
            style={stepBtnStyle}
          >
            A+
          </button>
        </div>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 12,
            color: TEXT_SEC,
            textAlign: 'center',
          }}
        >
          {prefs.font_size}px
        </p>
      </div>

      {/* Font Family */}
      <div style={{ marginBottom: 24 }}>
        <p style={sectionLabel}>Font</p>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['serif', 'sans-serif'] as const).map((family) => {
            const active = prefs.font_family === family;
            return (
              <button
                key={family}
                type="button"
                onClick={() => onUpdate({ font_family: family })}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius:
                    family === 'serif'
                      ? '12px 0 0 12px'
                      : '0 12px 12px 0',
                  border: `1px solid ${active ? ACCENT : BORDER}`,
                  backgroundColor: active ? ACCENT_DIM : 'transparent',
                  color: active ? ACCENT : TEXT_SEC,
                  fontWeight: 600,
                  fontSize: 14,
                  fontFamily:
                    family === 'serif'
                      ? 'Georgia, serif'
                      : '-apple-system, sans-serif',
                  cursor: 'pointer',
                }}
              >
                {family === 'serif' ? 'Serif' : 'Sans'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme */}
      <div style={{ marginBottom: 24 }}>
        <p style={sectionLabel}>Background</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          {Object.entries(THEME_STYLES).map(([key, style]) => {
            const active = prefs.theme === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  onUpdate({ theme: key as 'light' | 'dark' | 'sepia' })
                }
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: style.dot,
                    border: active
                      ? `2px solid ${ACCENT}`
                      : '2px solid rgba(255,255,255,0.12)',
                    boxShadow: active
                      ? `0 0 0 3px ${ACCENT_DIM}`
                      : undefined,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: active ? ACCENT : TEXT_SEC,
                  }}
                >
                  {style.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={() => onUpdate({ ...DEFAULT_PREFS })}
        style={{
          display: 'block',
          width: '100%',
          padding: '10px 0',
          background: 'none',
          border: 'none',
          color: ACCENT,
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        Reset Defaults
      </button>
    </aside>
  );
}

const stepBtnStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  backgroundColor: 'transparent',
  color: TEXT_SEC,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
