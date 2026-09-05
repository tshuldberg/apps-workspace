'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchMyWordsLanguagesAction, browseAlphabeticalWordsAction } from '../actions';
import type { MyWordsLanguage } from '@mylife/words';
import { ACCENT, TEXT, TEXT_SEC, TEXT_TER, SURFACE, BORDER, GLASS, GLASS_STRONG, GLASS_BORDER, DANGER } from '../ui';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<MyWordsLanguage[]>([]);
  const [search, setSearch] = useState('');
  const [defaultLangCode, setDefaultLangCode] = useState('en');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A-Z browse state
  const [browseLetter, setBrowseLetter] = useState<string | null>(null);
  const [browseWords, setBrowseWords] = useState<string[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseLoading, setBrowseLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const langs = await fetchMyWordsLanguagesAction();
        if (!cancelled) setLanguages(langs);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load languages.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const defaultLanguage = useMemo(() => languages.find((l) => l.code === defaultLangCode), [languages, defaultLangCode]);

  const filtered = useMemo(() => {
    if (!search.trim()) return languages;
    const q = search.trim().toLowerCase();
    return languages.filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
  }, [languages, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.words - a.words), [filtered]);

  const onOpenLetter = useCallback(async (letter: string) => {
    setBrowseLetter(letter);
    setBrowseWords([]);
    setBrowsePage(1);
    setBrowseTotal(0);
    setBrowseLoading(true);
    try {
      const result = await browseAlphabeticalWordsAction({ languageCode: 'en', letter, page: 1, pageSize: 60 });
      setBrowseWords(result.words);
      setBrowseTotal(result.total);
    } catch { /* */ }
    finally { setBrowseLoading(false); }
  }, []);

  const onLoadMore = useCallback(async () => {
    if (!browseLetter || browseLoading) return;
    const nextPage = browsePage + 1;
    setBrowseLoading(true);
    try {
      const result = await browseAlphabeticalWordsAction({ languageCode: 'en', letter: browseLetter, page: nextPage, pageSize: 60 });
      setBrowseWords((prev) => [...prev, ...result.words]);
      setBrowsePage(nextPage);
    } catch { /* */ }
    finally { setBrowseLoading(false); }
  }, [browseLetter, browsePage, browseLoading]);

  const hasMore = browseWords.length < browseTotal;

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {[1,2,3,4,5,6].map((i) => (
          <div key={i} style={{ height: 44, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32, borderRadius: 16, backgroundColor: GLASS, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
        <p style={{ color: DANGER, fontSize: 15 }}>{error}</p>
        <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: `1px solid ${ACCENT}`, backgroundColor: 'transparent', color: ACCENT, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Search */}
      <div style={{ padding: 12, borderRadius: 12, backgroundColor: GLASS, border: `1px solid ${BORDER}` }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or code..."
          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: TEXT, fontSize: 15, fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
        />
      </div>

      {/* Default Language */}
      {defaultLanguage && (
        <div style={{ padding: 16, borderRadius: 12, backgroundColor: GLASS_STRONG, border: `1px solid ${GLASS_BORDER}`, display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_SEC }}>Default Language</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: TEXT }}>{defaultLanguage.name}</span>
            <span style={{ backgroundColor: SURFACE, borderRadius: 4, padding: '2px 6px', fontSize: 12, color: TEXT_TER }}>{defaultLanguage.code.toUpperCase()}</span>
          </div>
          <span style={{ fontSize: 13, color: TEXT_SEC }}>{defaultLanguage.words.toLocaleString()} words</span>
        </div>
      )}

      {/* Language List */}
      <div style={{ display: 'grid', gap: 0 }}>
        {sorted.map((lang, idx) => {
          const isDefault = lang.code === defaultLangCode;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setDefaultLangCode(lang.code)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: idx < sorted.length - 1 ? `1px solid ${BORDER}` : 'none',
                background: 'transparent',
                border: 'none',
                borderBottomStyle: 'solid' as const,
                borderBottomWidth: idx < sorted.length - 1 ? 1 : 0,
                borderBottomColor: BORDER,
                color: TEXT,
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 15,
                width: '100%',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{lang.name}</span>
                <span style={{ backgroundColor: SURFACE, borderRadius: 4, padding: '2px 6px', fontSize: 12, color: TEXT_TER }}>{lang.code.toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: TEXT_SEC }}>{lang.words.toLocaleString()} words</span>
                {isDefault && <span style={{ color: ACCENT, fontSize: 14 }}>{'\u2713'}</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* A-Z Browse */}
      <div style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT }}>Browse English Dictionary</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {LETTERS.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => void onOpenLetter(letter.toLowerCase())}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: browseLetter === letter.toLowerCase() ? ACCENT : GLASS,
                border: `1px solid ${browseLetter === letter.toLowerCase() ? ACCENT : BORDER}`,
                color: browseLetter === letter.toLowerCase() ? '#0A0A0F' : ACCENT,
                fontSize: 18,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {letter}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 13, color: TEXT_TER }}>Only English supports alphabetical browsing</span>
      </div>

      {/* Browse Results */}
      {browseLetter && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT }}>
              Words starting with &ldquo;{browseLetter.toUpperCase()}&rdquo;
            </h3>
            <button type="button" onClick={() => setBrowseLetter(null)} style={{ background: 'transparent', border: 'none', color: ACCENT, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif' }}>Done</button>
          </div>

          {browseLoading && browseWords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: ACCENT }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {browseWords.map((word, i) => (
                  <Link
                    key={`${word}-${i}`}
                    href={`/words/${encodeURIComponent(word)}?lang=en`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      backgroundColor: GLASS,
                      border: `1px solid ${BORDER}`,
                      color: TEXT,
                      fontSize: 14,
                      textDecoration: 'none',
                    }}
                  >
                    {word}
                  </Link>
                ))}
              </div>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => void onLoadMore()}
                  disabled={browseLoading}
                  style={{ alignSelf: 'center', padding: '8px 20px', borderRadius: 8, border: `1px solid ${ACCENT}`, backgroundColor: 'transparent', color: ACCENT, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  {browseLoading ? 'Loading...' : 'Load More'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
