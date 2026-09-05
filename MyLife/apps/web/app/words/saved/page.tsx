'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchSavedWordsLightweightAction,
  fetchSavedWordCountAction,
  fetchSavedWordCountByLanguageAction,
  fetchWordListsAction,
} from '../actions';
import { computeMastery } from '../ui';
import type { SavedWordSortBy } from '@mylife/words';
import { ACCENT, ACCENT_DIM, ACCENT_BORDER, TEXT, TEXT_SEC, TEXT_TER, SURFACE, BORDER, GLASS, DANGER } from '../ui';

interface SavedWordLight {
  id: string;
  word: string;
  languageCode: string;
  languageName: string;
  definitionSummary: string | null;
  partOfSpeech: string | null;
  masteryLevel: number;
  isFavorite: boolean;
  lookedUpCount: number;
  lastLookedUpAt: string;
  flashCardId: string | null;
}

const SORT_OPTIONS: Array<{ key: SavedWordSortBy; label: string }> = [
  { key: 'recent', label: 'Recent' },
  { key: 'alphabetical', label: 'A-Z' },
  { key: 'mostLookedUp', label: 'Lookups' },
  { key: 'mastery', label: 'Mastery' },
];

const PAGE_SIZE = 50;

export default function SavedWordsPage() {
  const [words, setWords] = useState<SavedWordLight[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [languageCounts, setLanguageCounts] = useState<Array<{ languageCode: string; count: number }>>([]);
  const [listsCount, setListsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SavedWordSortBy>('recent');
  const [searchText, setSearchText] = useState('');
  const [languageFilter, setLanguageFilter] = useState<string | undefined>(undefined);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ws, count, langCounts, lists] = await Promise.all([
        fetchSavedWordsLightweightAction({
          sortBy,
          search: searchText || undefined,
          languageCode: languageFilter,
          favoritesOnly: favoritesOnly || undefined,
          limit: PAGE_SIZE,
          offset: 0,
        }),
        fetchSavedWordCountAction(),
        fetchSavedWordCountByLanguageAction(),
        fetchWordListsAction(),
      ]);
      setWords(ws as SavedWordLight[]);
      setTotalCount(count);
      setLanguageCounts(langCounts);
      setListsCount(lists.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load saved words.');
    } finally {
      setLoading(false);
    }
  }, [sortBy, searchText, languageFilter, favoritesOnly]);

  useEffect(() => { void loadData(); }, [loadData]);

  const favCount = useMemo(() => words.filter((w) => w.isFavorite).length, [words]);
  const flashCount = useMemo(() => words.filter((w) => w.flashCardId).length, [words]);

  const chipStyle = (active: boolean) => ({
    borderRadius: 999,
    border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
    backgroundColor: active ? ACCENT : GLASS,
    color: active ? '#0A0A0F' : TEXT_SEC,
    padding: '6px 14px',
    fontWeight: 600 as const,
    fontSize: 13,
    cursor: 'pointer' as const,
    fontFamily: 'Inter, system-ui, sans-serif',
  });

  // Loading skeleton
  if (loading && words.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {[1,2,3,4,5].map((i) => (
          <div key={i} style={{ height: 56, borderRadius: 12, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div style={{ padding: 32, borderRadius: 16, backgroundColor: GLASS, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
        <p style={{ color: DANGER, fontSize: 15 }}>{error}</p>
        <button type="button" onClick={() => void loadData()} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: `1px solid ${ACCENT}`, backgroundColor: 'transparent', color: ACCENT, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Hero */}
      <section style={{ padding: 24, borderRadius: 24, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, color: TEXT }}>Your Vocabulary</h1>
          <p style={{ margin: '10px 0 0', color: TEXT_SEC, fontSize: 15 }}>{totalCount} words in your collection</p>
        </div>
        <Link href="/words" style={{ borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 16px', fontWeight: 700, textDecoration: 'none', alignSelf: 'flex-start' }}>
          + Lookup
        </Link>
      </section>

      {/* Stats Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 16px', borderRadius: 16, backgroundColor: GLASS, border: `1px solid ${BORDER}` }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 700 }}>{totalCount}</div><div style={{ fontSize: 13, color: TEXT_SEC }}>Saved</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 700 }}>{favCount}</div><div style={{ fontSize: 13, color: TEXT_SEC }}>Favorites</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 700 }}>{listsCount}</div><div style={{ fontSize: 13, color: TEXT_SEC }}>Lists</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 700 }}>{flashCount}</div><div style={{ fontSize: 13, color: TEXT_SEC }}>Flash</div></div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Search saved words..."
        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box' }}
      />

      {/* Sort */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SORT_OPTIONS.map((opt) => (
          <button key={opt.key} type="button" onClick={() => setSortBy(opt.key)} style={chipStyle(opt.key === sortBy)}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => { setFavoritesOnly(false); setLanguageFilter(undefined); }} style={chipStyle(!favoritesOnly && !languageFilter)}>All</button>
        <button type="button" onClick={() => { setFavoritesOnly(!favoritesOnly); setLanguageFilter(undefined); }} style={chipStyle(favoritesOnly)}>Favorites</button>
        {languageCounts.map((lc) => (
          <button key={lc.languageCode} type="button" onClick={() => { setLanguageFilter(languageFilter === lc.languageCode ? undefined : lc.languageCode); setFavoritesOnly(false); }} style={chipStyle(languageFilter === lc.languageCode)}>
            {lc.languageCode.toUpperCase()} ({lc.count})
          </button>
        ))}
      </div>

      {/* Data Table */}
      {words.length === 0 ? (
        <section style={{ padding: 32, borderRadius: 24, border: `1px dashed ${ACCENT_BORDER}`, backgroundColor: GLASS, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 24, color: TEXT }}>Your vocabulary starts here</h2>
          <p style={{ margin: '12px auto 0', maxWidth: 480, color: TEXT_SEC }}>Look up words and tap the bookmark to save them.</p>
          <Link href="/words" style={{ display: 'inline-block', marginTop: 20, color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Start looking up words</Link>
        </section>
      ) : (
        <div style={{ display: 'grid', gap: 0 }}>
          {words.map((item, idx) => {
            const mastery = computeMastery(item.lookedUpCount, item.lastLookedUpAt);
            return (
              <Link
                key={item.id}
                href={`/words/saved/${item.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: idx < words.length - 1 ? `1px solid ${BORDER}` : 'none',
                  textDecoration: 'none',
                  color: TEXT,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mastery.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{item.word}</span>
                    <span style={{ backgroundColor: GLASS, borderRadius: 4, padding: '2px 6px', fontSize: 11, color: TEXT_TER }}>{item.languageCode.toUpperCase()}</span>
                    {item.partOfSpeech && <span style={{ fontSize: 11, color: ACCENT, border: `1px solid rgba(14,165,233,0.25)`, borderRadius: 999, padding: '1px 6px' }}>{item.partOfSpeech}</span>}
                  </div>
                  {item.definitionSummary && <p style={{ margin: '2px 0 0', fontSize: 13, color: TEXT_SEC, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.definitionSummary}</p>}
                </div>
                <span style={{ fontSize: 12, color: TEXT_TER, whiteSpace: 'nowrap' }}>{item.lookedUpCount}x</span>
                <span style={{ fontSize: 14, opacity: item.isFavorite ? 1 : 0.3 }}>{item.isFavorite ? '\u2764\uFE0F' : '\u2661'}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
