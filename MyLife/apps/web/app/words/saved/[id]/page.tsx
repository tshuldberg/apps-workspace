'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchSavedWordAction, updateSavedWordAction, unsaveWordAction, fetchWordListsAction, createWordListAction } from '../../actions';
import { computeMastery, formatDaysAgo, formatDate } from '../../ui';
import type { SavedWord, WordList } from '@mylife/words';
import { ACCENT, TEXT, TEXT_SEC, TEXT_TER, SURFACE, BORDER, GLASS, GLASS_STRONG, DANGER } from '../../ui';
export default function SavedWordDetailPage() {
  const params = useParams();
  const id = String(params.id ?? '');

  const [word, setWord] = useState<SavedWord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [lists, setLists] = useState<WordList[]>([]);
  const [showListPicker, setShowListPicker] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [notesTimer, setNotesTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const loadWord = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const result = await fetchSavedWordAction(id);
      setWord(result);
      if (result) setNotes(result.notes ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load word.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadWord(); }, [loadWord]);
  useEffect(() => {
    const load = async () => { try { setLists(await fetchWordListsAction()); } catch { /* */ } };
    void load();
  }, []);

  const mastery = useMemo(() => word ? computeMastery(word.lookedUpCount, word.lastLookedUpAt) : null, [word]);
  const currentList = useMemo(() => word?.listId ? lists.find((l) => l.id === word.listId) : null, [word?.listId, lists]);

  const handleNotesBlur = useCallback(() => {
    if (!word) return;
    if (notesTimer) clearTimeout(notesTimer);
    const timer = setTimeout(async () => {
      try { await updateSavedWordAction(word.id, { notes: notes || null }); } catch { /* */ }
    }, 300);
    setNotesTimer(timer);
  }, [word, notes, notesTimer]);

  const handleToggleFavorite = useCallback(async () => {
    if (!word) return;
    try {
      await updateSavedWordAction(word.id, { isFavorite: !word.isFavorite });
      void loadWord();
    } catch { /* */ }
  }, [word, loadWord]);

  const handleDelete = useCallback(async () => {
    if (!word) return;
    if (!confirm(`Remove "${word.word}" from your saved words?`)) return;
    try {
      await unsaveWordAction(word.id);
      window.history.back();
    } catch { /* */ }
  }, [word]);

  const handleAssignList = useCallback(async (listId: string | null) => {
    if (!word) return;
    try {
      await updateSavedWordAction(word.id, { listId });
      setShowListPicker(false);
      void loadWord();
    } catch { /* */ }
  }, [word, loadWord]);

  const handleCreateList = useCallback(async () => {
    const name = newListName.trim();
    if (!name) return;
    try {
      const newList = await createWordListAction({ name });
      setNewListName('');
      if (newList) {
        setLists((prev) => [...prev, newList]);
        await handleAssignList(newList.id);
      }
    } catch { /* */ }
  }, [newListName, handleAssignList]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ width: '40%', height: 28, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '25%', height: 16, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 16 }} />
        <div style={{ width: '100%', height: 80, borderRadius: 12, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
      </div>
    );
  }

  if (error || !word) {
    return (
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center', padding: '64px 0' }}>
        <p style={{ color: DANGER, fontSize: 15 }}>{error ?? 'Word not found.'}</p>
        <Link href="/words/saved" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>&larr; Back to Saved Words</Link>
      </div>
    );
  }

  const cardStyle = { padding: 16, borderRadius: 16, backgroundColor: GLASS, border: `1px solid ${BORDER}`, display: 'grid' as const, gap: 8 };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link href="/words/saved" style={{ color: TEXT_SEC, fontSize: 13, textDecoration: 'none' }}>&larr; Back to Saved Words</Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>{word.word}</h1>
          {word.pronunciationText && <p style={{ margin: '4px 0 0', color: TEXT_SEC }}>{word.pronunciationText}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ color: TEXT_SEC, fontSize: 14 }}>{word.languageName}</span>
            <span style={{ backgroundColor: GLASS, borderRadius: 4, padding: '2px 6px', fontSize: 12, color: TEXT_TER }}>{word.languageCode.toUpperCase()}</span>
            {word.partOfSpeech && <span style={{ fontSize: 12, color: ACCENT, border: `1px solid rgba(14,165,233,0.25)`, borderRadius: 999, padding: '1px 6px' }}>{word.partOfSpeech}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => void handleToggleFavorite()} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', padding: 8 }}>
            {word.isFavorite ? '\u2764\uFE0F' : '\u2661'}
          </button>
        </div>
      </div>

      {/* Definition */}
      {word.definitionSummary && (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: TEXT, fontSize: 15, lineHeight: 1.5 }}>{word.definitionSummary}</p>
          {word.lookupData && (
            <Link href={`/words/${encodeURIComponent(word.word)}?lang=${word.languageCode}`} style={{ color: ACCENT, fontSize: 13, textDecoration: 'none', marginTop: 4 }}>
              View Full Entry
            </Link>
          )}
        </div>
      )}

      {/* Mastery */}
      {mastery && (
        <div style={cardStyle}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_SEC }}>Mastery</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: mastery.color }} />
            <span style={{ fontWeight: 600 }}>{mastery.label}</span>
          </div>
          <span style={{ fontSize: 13, color: TEXT_SEC }}>
            Looked up {word.lookedUpCount} time{word.lookedUpCount === 1 ? '' : 's'}, last {formatDaysAgo(word.lastLookedUpAt)}
          </span>
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
        <span style={{ fontSize: 13, color: TEXT_SEC }}>Looked up {word.lookedUpCount} time{word.lookedUpCount === 1 ? '' : 's'}</span>
        <span style={{ fontSize: 13, color: TEXT_SEC }}>Last: {formatDaysAgo(word.lastLookedUpAt)}</span>
        <span style={{ fontSize: 13, color: TEXT_SEC }}>Saved: {formatDate(word.createdAt)}</span>
      </div>

      {/* Notes */}
      <div style={cardStyle}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_SEC }}>Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add notes about this word..."
          rows={3}
          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: TEXT, fontSize: 14, resize: 'vertical', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
        />
      </div>

      {/* List Assignment */}
      <div style={cardStyle}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_SEC }}>List</span>
        <button type="button" onClick={() => setShowListPicker(!showListPicker)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', color: TEXT, cursor: 'pointer', padding: 0, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14 }}>
          {currentList ? (
            <span style={{ backgroundColor: GLASS_STRONG, borderRadius: 999, padding: '4px 10px', fontSize: 13 }}>{currentList.name}</span>
          ) : (
            <span style={{ color: TEXT_TER }}>No list</span>
          )}
          <span style={{ color: TEXT_SEC }}>&rsaquo;</span>
        </button>
        {showListPicker && (
          <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
            <button type="button" onClick={() => void handleAssignList(null)} style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: 'none', background: !word.listId ? `rgba(14,165,233,0.1)` : 'transparent', color: !word.listId ? ACCENT : TEXT, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14 }}>
              No list {!word.listId && '\u2713'}
            </button>
            {lists.map((list) => (
              <button key={list.id} type="button" onClick={() => void handleAssignList(list.id)} style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: 'none', background: word.listId === list.id ? `rgba(14,165,233,0.1)` : 'transparent', color: word.listId === list.id ? ACCENT : TEXT, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14 }}>
                {list.name} {word.listId === list.id && '\u2713'}
              </button>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
              <input type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Create new list..." style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none' }} />
              <button type="button" onClick={() => void handleCreateList()} disabled={!newListName.trim()} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', backgroundColor: newListName.trim() ? ACCENT : SURFACE, color: newListName.trim() ? '#0A0A0F' : TEXT_TER, fontWeight: 600, fontSize: 13, cursor: newListName.trim() ? 'pointer' : 'default', fontFamily: 'Inter, system-ui, sans-serif' }}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete */}
      <button type="button" onClick={() => void handleDelete()} style={{ padding: '10px 0', borderRadius: 12, border: `1px solid #FF453A`, backgroundColor: 'transparent', color: DANGER, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
        Remove from Saved
      </button>
    </div>
  );
}
