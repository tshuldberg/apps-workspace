'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWordListsAction, createWordListAction, fetchSavedWordCountByListAction } from '../actions';
import type { WordList } from '@mylife/words';
import { ACCENT, ACCENT_DIM, ACCENT_BORDER, TEXT, TEXT_SEC, TEXT_TER, SURFACE, BORDER, GLASS, DANGER } from '../ui';

export default function WordListsPage() {
  const [lists, setLists] = useState<Array<WordList & { wordCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [rawLists, listCounts] = await Promise.all([
        fetchWordListsAction(),
        fetchSavedWordCountByListAction(),
      ]);
      const countMap = new Map(listCounts.map((lc) => [lc.listId, lc.count]));
      const enriched = rawLists.map((list) => ({
        ...list,
        wordCount: countMap.get(list.id) ?? 0,
      }));
      setLists(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lists.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createWordListAction({ name, description: newDesc.trim() || undefined });
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      void loadData();
    } catch { /* */ }
  }, [newName, newDesc, loadData]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {[1,2,3].map((i) => (
            <div key={i} style={{ height: 100, borderRadius: 16, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32, borderRadius: 16, backgroundColor: GLASS, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
        <p style={{ color: DANGER, fontSize: 15 }}>{error}</p>
        <button type="button" onClick={() => void loadData()} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: `1px solid ${ACCENT}`, backgroundColor: 'transparent', color: ACCENT, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Hero */}
      <section style={{ padding: 24, borderRadius: 24, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, color: TEXT }}>Word Lists</h1>
          <p style={{ margin: '10px 0 0', color: TEXT_SEC, fontSize: 15 }}>Organize your vocabulary into collections</p>
        </div>
        <button type="button" onClick={() => setShowCreate(!showCreate)} style={{ borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 16px', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif', alignSelf: 'flex-start' }}>
          + New List
        </button>
      </section>

      {/* Create Form */}
      {showCreate && (
        <div style={{ padding: 16, borderRadius: 16, backgroundColor: GLASS, border: `1px solid ${BORDER}`, display: 'grid', gap: 10 }}>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="List name" style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none' }} />
          <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional description" style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => void handleCreate()} disabled={!newName.trim()} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: newName.trim() ? ACCENT : SURFACE, color: newName.trim() ? '#0A0A0F' : TEXT_TER, fontWeight: 600, fontSize: 13, cursor: newName.trim() ? 'pointer' : 'default', fontFamily: 'Inter, system-ui, sans-serif' }}>Create</button>
            <button type="button" onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: TEXT_SEC, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* List Cards */}
      {lists.length === 0 ? (
        <section style={{ padding: 32, borderRadius: 24, border: `1px dashed ${ACCENT_BORDER}`, backgroundColor: GLASS, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 24, color: TEXT }}>Create your first word list</h2>
          <p style={{ margin: '12px auto 0', maxWidth: 480, color: TEXT_SEC }}>Group related words for focused study.</p>
          <button type="button" onClick={() => setShowCreate(true)} style={{ marginTop: 20, color: ACCENT, fontWeight: 700, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, fontFamily: 'Inter, system-ui, sans-serif' }}>+ Create List</button>
        </section>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/words/lists/${list.id}`}
              style={{ display: 'grid', gap: 8, padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, textDecoration: 'none', color: TEXT }}
            >
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{list.name}</h3>
              {list.description && <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>{list.description}</p>}
              <div style={{ display: 'flex', gap: 12, fontSize: 13, color: TEXT_TER }}>
                <span>{list.wordCount} word{list.wordCount === 1 ? '' : 's'}</span>
                {list.languageCode && <span>{list.languageCode.toUpperCase()}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
