'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  fetchNote,
  updateNoteAction,
  deleteNoteAction,
  fetchBacklinks,
  fetchTagsForNoteAction,
  fetchNotes,
} from '../actions';
import type { Note, NoteTag, NoteLink } from '@mylife/notes';
import { extractHeadings, countChecklistItems } from '@mylife/notes';

const ACCENT = 'var(--accent-notes)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const SURFACE_ELEV = 'var(--surface-elevated)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const DANGER = '#FF453A';
const SUCCESS = '#30D158';

export default function NoteEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [backlinks, setBacklinks] = useState<NoteLink[]>([]);
  const [noteTags, setNoteTags] = useState<NoteTag[]>([]);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
  const [showPreview, setShowPreview] = useState(true);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchNote(id),
      fetchBacklinks(id),
      fetchTagsForNoteAction(id),
      fetchNotes({ limit: 200 }),
    ])
      .then(([n, bl, tags, notes]) => {
        if (cancelled) return;
        if (!n) { setError('Note not found.'); return; }
        setNote(n);
        setTitle(n.title);
        setBody(n.body);
        setBacklinks(bl);
        setNoteTags(tags);
        setAllNotes(notes);
      })
      .catch(() => { if (!cancelled) setError('Failed to load note.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  const save = useCallback(async (newTitle: string, newBody: string) => {
    setSaveStatus('saving');
    try {
      await updateNoteAction(id, { title: newTitle, body: newBody });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [id]);

  const debouncedSave = useCallback((newTitle: string, newBody: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(newTitle, newBody), 500);
  }, [save]);

  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    debouncedSave(newTitle, body);
  }

  function handleBodyChange(newBody: string) {
    setBody(newBody);
    debouncedSave(title, newBody);
  }

  async function handleDelete() {
    if (!confirm('Delete this note?')) return;
    try {
      await deleteNoteAction(id);
      router.push('/notes');
    } catch {
      setError('Failed to delete.');
    }
  }

  async function handlePin() {
    if (!note) return;
    try {
      await updateNoteAction(id, { isPinned: !note.isPinned });
      setNote({ ...note, isPinned: !note.isPinned });
    } catch { /* silent */ }
  }

  async function handleFav() {
    if (!note) return;
    try {
      await updateNoteAction(id, { isFavorite: !note.isFavorite });
      setNote({ ...note, isFavorite: !note.isFavorite });
    } catch { /* silent */ }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (saveTimer.current) clearTimeout(saveTimer.current);
        save(title, body);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title, body, save]);

  const wordCount = useMemo(() => body.split(/\s+/).filter(Boolean).length, [body]);
  const charCount = body.length;
  const headings = useMemo(() => extractHeadings(body), [body]);
  const checklist = useMemo(() => countChecklistItems(body), [body]);
  const preview = useMemo(() => renderMarkdown(body), [body]);

  if (error) {
    return (
      <div style={{ padding: 32, borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, textAlign: 'center' }}>
        <p style={{ color: TEXT, fontSize: 18, fontWeight: 600, margin: 0 }}>{error}</p>
        <Link href="/notes" style={{ display: 'inline-block', marginTop: 16, color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Back to Notes</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ height: 48, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 400, borderRadius: 16, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/notes" style={{ color: TEXT_SEC, textDecoration: 'none', fontSize: 14 }}>&larr; Back</Link>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled"
            style={{ background: 'transparent', border: 'none', color: TEXT, fontSize: 22, fontWeight: 700, outline: 'none', width: 300 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: TEXT_SEC }}>{wordCount}w / {charCount}c</span>
          {checklist.total > 0 && (
            <span style={{ fontSize: 12, color: checklist.checked === checklist.total ? SUCCESS : ACCENT }}>{checklist.checked}/{checklist.total}</span>
          )}
          <span style={{ fontSize: 12, color: saveStatus === 'saved' ? SUCCESS : saveStatus === 'error' ? DANGER : TEXT_SEC }}>
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Save failed' : ''}
          </span>
          <ToolbarBtn label="Pin" active={note?.isPinned} onClick={handlePin} />
          <ToolbarBtn label="Fav" active={note?.isFavorite} onClick={handleFav} />
          <ToolbarBtn label={showPreview ? 'Hide Preview' : 'Show Preview'} onClick={() => setShowPreview((v) => !v)} />
          <ToolbarBtn label="Delete" onClick={handleDelete} danger />
        </div>
      </div>

      {/* Tags */}
      {noteTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {noteTags.map((tag) => (
            <span key={tag.id} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, backgroundColor: SURFACE_ELEV, color: ACCENT, border: `1px solid ${BORDER}` }}>#{tag.name}</span>
          ))}
        </div>
      )}

      {/* Editor + Preview split pane */}
      <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr', gap: 16, minHeight: 500 }}>
        <textarea
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          placeholder="Start typing or use / for commands..."
          style={{
            width: '100%', minHeight: 500, padding: 20, borderRadius: 16,
            border: `1px solid ${BORDER}`, backgroundColor: SURFACE,
            color: TEXT, fontSize: 15, lineHeight: 1.7,
            fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
            resize: 'vertical', outline: 'none',
          }}
        />
        {showPreview && (
          <div
            style={{
              padding: 20, borderRadius: 16, border: `1px solid ${BORDER}`,
              backgroundColor: SURFACE, overflow: 'auto', maxHeight: 700,
              fontSize: 15, lineHeight: 1.7, color: TEXT,
            }}
          >
            <PreviewRenderer html={preview} />
          </div>
        )}
      </div>

      {/* Backlinks */}
      {backlinks.length > 0 && (
        <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT_SEC }}>Backlinks ({backlinks.length})</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {backlinks.map((link) => {
              const source = allNotes.find((n) => n.id === link.sourceNoteId);
              return (
                <Link key={link.id} href={`/notes/${link.sourceNoteId}`}
                  style={{ fontSize: 13, color: ACCENT, textDecoration: 'none', padding: '4px 10px', borderRadius: 8, backgroundColor: GLASS, border: `1px solid ${BORDER}` }}>
                  {source?.title || 'Untitled'}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Table of Contents */}
      {headings.length > 0 && (
        <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT_SEC }}>Table of Contents</p>
          <div style={{ marginTop: 8 }}>
            {headings.map((h, i) => (
              <p key={i} style={{ margin: '2px 0', fontSize: 13, color: TEXT_SEC, paddingLeft: (h.level - 1) * 16 }}>{h.text}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({ label, active, onClick, danger }: { label: string; active?: boolean | null; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        padding: '6px 10px', borderRadius: 8, border: `1px solid ${BORDER}`,
        backgroundColor: active ? ACCENT : GLASS,
        color: danger ? DANGER : active ? '#0A0A0F' : TEXT_SEC,
        cursor: 'pointer', fontSize: 12, fontWeight: 600,
      }}>
      {label}
    </button>
  );
}

/**
 * Renders HTML produced by `renderMarkdown` below. The renderer sanitizes
 * user markdown defensively (HTML-escapes body, allowlists URL protocols,
 * escapes attribute values) so even local-first notes stay XSS-safe if they
 * ever become multi-user, synced, or imported from external sources.
 */
function PreviewRenderer({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Escape a string for safe inclusion inside an HTML attribute value. Covers
 * both quote characters plus the `<`, `>`, and `&` trio. Markdown URL values
 * flow through here before landing inside `href="..."` to defeat attribute
 * quote-breakout XSS like `[text](x" onmouseover="alert(1))`.
 */
function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Protocols allowed for markdown links. Everything else is rendered as plain text. */
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  // Treat relative URLs as safe -- they cannot set a javascript: context.
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed, 'https://placeholder.invalid/');
    // Relative inputs resolve to the placeholder host; covered above, so here
    // a placeholder hostname means we accepted a relative form we already
    // allowed. Any other hostname means an explicit protocol must be allowlisted.
    if (parsed.hostname === 'placeholder.invalid') return true;
    return ALLOWED_URL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:rgba(255,255,255,0.04);padding:12px;border-radius:8px;overflow-x:auto;font-size:13px"><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;font-size:13px">$1</code>');
  html = html.replace(/^######\s+(.+)$/gm, '<h6 style="margin:16px 0 8px;font-size:13px;color:var(--text)">$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 style="margin:16px 0 8px;font-size:14px;color:var(--text)">$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 style="margin:16px 0 8px;font-size:15px;color:var(--text)">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 style="margin:18px 0 8px;font-size:17px;font-weight:600;color:var(--text)">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 style="margin:20px 0 8px;font-size:20px;font-weight:700;color:var(--text)">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 style="margin:20px 0 10px;font-size:24px;font-weight:700;color:var(--text)">$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^-\s+\[x\]\s*(.*)$/gim, '<div style="display:flex;gap:8px;align-items:center"><input type="checkbox" checked disabled />$1</div>');
  html = html.replace(/^-\s+\[\s\]\s*(.*)$/gm, '<div style="display:flex;gap:8px;align-items:center"><input type="checkbox" disabled />$1</div>');
  html = html.replace(/^-\s+(.+)$/gm, '<li style="margin:2px 0;margin-left:20px">$1</li>');
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote style="border-left:3px solid var(--accent-notes);padding-left:12px;margin:8px 0;color:var(--text-secondary)">$1</blockquote>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text: string, url: string) => {
    // Reject anything that isn't an http(s), mailto, tel, or relative URL.
    // The protocol check catches javascript:, data:, vbscript:, file:, etc.
    if (!isSafeUrl(url)) {
      return text;
    }
    // HTML-escape the URL attribute value so a URL like `x" onmouseover="...`
    // cannot break out of the href attribute and inject event handlers.
    const safeHref = escapeHtmlAttribute(url.trim());
    return `<a href="${safeHref}" style="color:var(--accent-notes);text-decoration:underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<span style="color:var(--accent-notes);font-weight:600;cursor:pointer">$1</span>');
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:16px 0" />');
  html = html.replace(/\n\n/g, '</p><p style="margin:8px 0">');
  html = '<p style="margin:8px 0">' + html + '</p>';

  return html;
}
