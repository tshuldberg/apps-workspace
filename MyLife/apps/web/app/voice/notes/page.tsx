'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchVoiceNotesAction,
  createVoiceNoteAction,
  updateVoiceNoteAction,
  deleteVoiceNoteAction,
  toggleFavoriteAction,
} from '../actions';
import {
  ACCENT,
  TEXT,
  TEXT_SEC,
  BORDER,
  SURFACE,
  DANGER,
  heroStyle,
  glassCard,
  pillButton,
  primaryButton,
  emptyState as emptyStyleFn,
  formatDateShort,
} from '../ui';

interface VoiceNote {
  id: string;
  title: string;
  transcriptionId: string | null;
  tags: string | null;
  isFavorite: boolean;
  createdAt: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTags, setNewTags] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchVoiceNotesAction({ limit: 200 });
      setNotes(data as VoiceNote[]);
    } catch {
      setError('Could not load voice notes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = filterFavorites ? notes.filter((n) => n.isFavorite) : notes;
  const favCount = notes.filter((n) => n.isFavorite).length;

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await createVoiceNoteAction({ title: newTitle.trim(), tags: newTags.trim() || null });
      setNewTitle('');
      setNewTags('');
      setShowCreate(false);
      await load();
    } catch { /* stay on form */ }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const updated = await toggleFavoriteAction(id);
      if (updated) {
        setNotes((prev) => prev.map((n) => n.id === id ? { ...n, isFavorite: (updated as VoiceNote).isFavorite } : n));
      }
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteVoiceNoteAction(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch { /* silent */ }
  };

  const handleStartEdit = (note: VoiceNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditTags(note.tags ?? '');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;
    try {
      await updateVoiceNoteAction(editingId, { title: editTitle.trim(), tags: editTags.trim() || null });
      setEditingId(null);
      await load();
    } catch { /* stay editing */ }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ ...heroStyle(), height: 80 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ ...glassCard(), height: 120, opacity: 0.6, animation: 'pulse 2s infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...glassCard(), textAlign: 'center', padding: 48 }}>
        <p style={{ color: DANGER, fontSize: 16, margin: 0 }}>{error}</p>
        <button type="button" onClick={() => void load()} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT_SEC, cursor: 'pointer', fontWeight: 600 }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={heroStyle()}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, color: TEXT }}>Voice Notes</h1>
          <p style={{ margin: '10px 0 0', color: TEXT_SEC, fontSize: 15 }}>
            {notes.length} notes{favCount > 0 ? `, ${favCount} favorites` : ''}
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} style={primaryButton()}>
          + New Note
        </button>
      </div>

      {showCreate && (
        <div style={glassCard()}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: TEXT }}>New Voice Note</h3>
          <input
            type="text"
            placeholder="Note title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
          />
          <input
            type="text"
            placeholder="Tags (comma-separated)..."
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, marginBottom: 12, outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => void handleCreate()} style={primaryButton()}>Create</button>
            <button type="button" onClick={() => { setShowCreate(false); setNewTitle(''); setNewTags(''); }} style={{ ...pillButton(false), cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setFilterFavorites(false)} style={pillButton(!filterFavorites)}>All</button>
        <button type="button" onClick={() => setFilterFavorites(true)} style={pillButton(filterFavorites)}>Favorites</button>
      </div>

      {filtered.length === 0 ? (
        <div style={emptyStyleFn()}>
          <p style={{ margin: 0, fontSize: 32 }}>📝</p>
          <h2 style={{ margin: '12px 0 0', fontSize: 24, color: TEXT }}>
            {filterFavorites ? 'No favorites yet' : 'Organize your voice notes'}
          </h2>
          <p style={{ margin: '12px auto 0', maxWidth: 480, color: TEXT_SEC }}>
            {filterFavorites
              ? 'Star your important notes to find them quickly.'
              : 'Create notes from your transcriptions to keep important thoughts organized and easily findable.'}
          </p>
          {!filterFavorites && (
            <button type="button" onClick={() => setShowCreate(true)} style={{ ...primaryButton(), marginTop: 16 }}>
              Create First Note
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map((note) => (
            <div key={note.id} style={glassCard()}>
              {editingId === note.id ? (
                <div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="Tags..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => void handleSaveEdit()} style={{ ...primaryButton(), padding: '6px 12px', fontSize: 13 }}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} style={{ ...pillButton(false), cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT }}>{note.title}</h3>
                    <button
                      type="button"
                      onClick={() => void handleToggleFavorite(note.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: note.isFavorite ? ACCENT : TEXT_SEC, padding: 0, lineHeight: 1 }}
                      title={note.isFavorite ? 'Unfavorite' : 'Favorite'}
                    >
                      {note.isFavorite ? '★' : '☆'}
                    </button>
                  </div>
                  {note.tags && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {note.tags.split(',').map((tag) => (
                        <span key={tag} style={{ padding: '2px 8px', borderRadius: 999, border: `1px solid ${BORDER}`, fontSize: 12, color: TEXT_SEC }}>
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <span style={{ color: TEXT_SEC, fontSize: 13 }}>{formatDateShort(note.createdAt)}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => handleStartEdit(note)} style={{ background: 'none', border: 'none', color: TEXT_SEC, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Edit</button>
                      <button type="button" onClick={() => void handleDelete(note.id)} style={{ background: 'none', border: 'none', color: DANGER, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Delete</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
