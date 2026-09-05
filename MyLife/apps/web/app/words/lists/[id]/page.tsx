'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchWordListAction, fetchSavedWordsAction, updateSavedWordAction, updateWordListAction } from '../../actions';
import { computeMastery } from '../../ui';
import type { SavedWord, WordList } from '@mylife/words';
import { ACCENT, TEXT, TEXT_SEC, TEXT_TER, SURFACE, BORDER, GLASS, DANGER } from '../../ui';

export default function WordListDetailPage() {
  const params = useParams();
  const id = String(params.id ?? '');

  const [list, setList] = useState<WordList | null>(null);
  const [words, setWords] = useState<SavedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const listData = await fetchWordListAction(id);
      setList(listData);
      if (listData) {
        const listWords = await fetchSavedWordsAction({ listId: id, limit: 500 });
        setWords(listWords);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load list.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleRemoveFromList = useCallback(async (wordId: string, wordText: string) => {
    if (!confirm(`Remove "${wordText}" from this list?`)) return;
    try {
      await updateSavedWordAction(wordId, { listId: null });
      void loadData();
    } catch { /* */ }
  }, [loadData]);

  const handleSaveEdit = useCallback(async () => {
    if (!list || !editName.trim()) return;
    try {
      await updateWordListAction(list.id, { name: editName.trim(), description: editDesc.trim() || undefined });
      setEditing(false);
      void loadData();
    } catch { /* */ }
  }, [list, editName, editDesc, loadData]);

  const favCount = useMemo(() => words.filter((w) => w.isFavorite).length, [words]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ width: '40%', height: 24, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '60%', height: 14, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        {[1,2,3].map((i) => <div key={i} style={{ height: 48, borderRadius: 12, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center', padding: '64px 0' }}>
        <p style={{ color: DANGER, fontSize: 15 }}>{error ?? 'List not found.'}</p>
        <Link href="/words/lists" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>&larr; Back to Lists</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link href="/words/lists" style={{ color: TEXT_SEC, fontSize: 13, textDecoration: 'none' }}>&larr; Back to Lists</Link>

      {/* Header */}
      {editing ? (
        <div style={{ display: 'grid', gap: 10, padding: 16, borderRadius: 16, backgroundColor: GLASS, border: `1px solid ${BORDER}` }}>
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 16, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none' }} />
          <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Optional description" style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => void handleSaveEdit()} disabled={!editName.trim()} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: editName.trim() ? ACCENT : SURFACE, color: editName.trim() ? '#0A0A0F' : TEXT_TER, fontWeight: 600, fontSize: 13, cursor: editName.trim() ? 'pointer' : 'default', fontFamily: 'Inter, system-ui, sans-serif' }}>Save</button>
            <button type="button" onClick={() => setEditing(false)} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: TEXT_SEC, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT }}>{list.name}</h1>
            {list.description && <p style={{ margin: '4px 0 0', color: TEXT_SEC, fontSize: 14 }}>{list.description}</p>}
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13, color: TEXT_TER }}>
              <span>{words.length} word{words.length === 1 ? '' : 's'}</span>
              <span>{favCount} favorite{favCount === 1 ? '' : 's'}</span>
              {list.languageCode && <span>{list.languageCode.toUpperCase()}</span>}
            </div>
          </div>
          <button type="button" onClick={() => { setEditName(list.name); setEditDesc(list.description ?? ''); setEditing(true); }} style={{ background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', padding: 8, color: TEXT_SEC }}>
            Edit
          </button>
        </div>
      )}

      {/* Word rows */}
      {words.length === 0 ? (
        <section style={{ padding: 32, borderRadius: 24, border: `1px dashed rgba(14,165,233,0.25)`, backgroundColor: GLASS, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20, color: TEXT }}>This list is waiting</h2>
          <p style={{ margin: '12px auto 0', maxWidth: 480, color: TEXT_SEC }}>Save words and assign them here.</p>
          <Link href="/words" style={{ display: 'inline-block', marginTop: 20, color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Go to Lookup</Link>
        </section>
      ) : (
        <div style={{ display: 'grid', gap: 0 }}>
          {words.map((item, idx) => {
            const mastery = computeMastery(item.lookedUpCount, item.lastLookedUpAt);
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: idx < words.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mastery.color, flexShrink: 0 }} />
                <Link href={`/words/saved/${item.id}`} style={{ flex: 1, textDecoration: 'none', color: TEXT, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{item.word}</span>
                    <span style={{ backgroundColor: GLASS, borderRadius: 4, padding: '2px 6px', fontSize: 11, color: TEXT_TER }}>{item.languageCode.toUpperCase()}</span>
                    {item.partOfSpeech && <span style={{ fontSize: 11, color: ACCENT, border: `1px solid rgba(14,165,233,0.25)`, borderRadius: 999, padding: '1px 6px' }}>{item.partOfSpeech}</span>}
                  </div>
                  {item.definitionSummary && <p style={{ margin: '2px 0 0', fontSize: 13, color: TEXT_SEC, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.definitionSummary}</p>}
                </Link>
                <span style={{ fontSize: 14, opacity: item.isFavorite ? 1 : 0.3 }}>{item.isFavorite ? '\u2764\uFE0F' : '\u2661'}</span>
                <button type="button" onClick={() => void handleRemoveFromList(item.id, item.word)} style={{ background: 'transparent', border: 'none', color: DANGER, cursor: 'pointer', fontSize: 14, padding: 4 }} title="Remove from list">&times;</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
