'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  lookupWordAction,
  fetchMyWordsLanguagesAction,
  fetchCachePrefixMatchesAction,
  fetchSavedWordByWordAndLangAction,
  saveWordAction,
  unsaveWordAction,
  cacheLookupAction,
} from './actions';
import type { MyWordsLanguage, MyWordsLookupResult } from '@mylife/words';
import { ACCENT, ACCENT_DIM, ACCENT_BORDER, TEXT, TEXT_SEC, TEXT_TER, SURFACE, BORDER, GLASS, GLASS_STRONG, GLASS_BORDER, DANGER } from './ui';

const DEBOUNCE_MS = 150;
const STARTER_WORDS = ['ephemeral', 'serendipity', 'ubiquitous'];

export default function WordsLookupPage() {
  const [languages, setLanguages] = useState<MyWordsLanguage[]>([]);
  const [languageCode, setLanguageCode] = useState('en');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MyWordsLookupResult | null>(null);
  const [hasEverSearched, setHasEverSearched] = useState(false);
  const [typeAheadResults, setTypeAheadResults] = useState<string[]>([]);
  const [showTypeAhead, setShowTypeAhead] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedWordId, setSavedWordId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLanguage = useMemo(
    () => languages.find((lang) => lang.code === languageCode),
    [languages, languageCode],
  );

  // Load languages
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const langs = await fetchMyWordsLanguagesAction();
        if (!cancelled) setLanguages(langs);
      } catch {
        // fallback silently
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // Keyboard shortcut: Cmd+K focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Type-ahead
  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (text.trim().length < 2) {
        setTypeAheadResults([]);
        setShowTypeAhead(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        try {
          const matches = await fetchCachePrefixMatchesAction(
            text.trim(),
            languageCode === 'all' ? null : languageCode,
            8,
          );
          setTypeAheadResults(matches);
          setShowTypeAhead(matches.length > 0);
        } catch {
          setTypeAheadResults([]);
          setShowTypeAhead(false);
        }
      }, DEBOUNCE_MS);
    },
    [languageCode],
  );

  // Lookup
  const runLookup = useCallback(
    async (word: string) => {
      const trimmed = word.trim();
      if (!trimmed) return;
      setShowTypeAhead(false);
      setLoading(true);
      setError(null);
      setResult(null);
      setIsSaved(false);
      setSavedWordId(null);
      try {
        const data = await lookupWordAction({ languageCode, word: trimmed });
        if (!data) {
          setError(`No entry found for "${trimmed}" in ${selectedLanguage?.name ?? languageCode}.`);
        } else {
          setResult(data);
          setHasEverSearched(true);
          // Check saved status
          try {
            const saved = await fetchSavedWordByWordAndLangAction(data.word, data.language.code);
            setIsSaved(!!saved);
            setSavedWordId(saved?.id ?? null);
          } catch { /* non-critical */ }
          // Cache for offline
          try {
            await cacheLookupAction(data.word, data.language.code, data);
          } catch { /* non-critical */ }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lookup failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [languageCode, selectedLanguage],
  );

  // Save/unsave
  const toggleSave = useCallback(async () => {
    if (!result) return;
    try {
      if (isSaved && savedWordId) {
        await unsaveWordAction(savedWordId);
        setIsSaved(false);
        setSavedWordId(null);
      } else {
        const firstEntry = result.entries[0];
        const saved = await saveWordAction({
          word: result.word,
          languageCode: result.language.code,
          languageName: result.language.name,
          definitionSummary: firstEntry?.senses?.[0]?.definition ?? null,
          partOfSpeech: firstEntry?.partOfSpeech ?? null,
          pronunciationText: firstEntry?.pronunciations?.[0]?.text ?? null,
          lookupData: result,
        });
        setIsSaved(true);
        setSavedWordId(saved.id);
      }
    } catch { /* non-critical save error */ }
  }, [result, isSaved, savedWordId]);

  const firstDef = result?.entries[0]?.senses?.[0]?.definition ?? '';
  const firstPos = result?.entries[0]?.partOfSpeech ?? '';
  const showStarter = !hasEverSearched && !loading;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Hero / Search Section */}
      <section
        style={{
          padding: 24,
          borderRadius: 24,
          background: ACCENT_DIM,
          border: `1px solid ${ACCENT_BORDER}`,
          display: 'grid',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, color: TEXT }}>
              Dictionary & Thesaurus
            </h1>
            <p style={{ margin: '10px 0 0', color: TEXT_SEC, fontSize: 15 }}>
              Look up any word in 270+ languages
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '0 16px',
          }}
        >
          <span style={{ fontSize: 16, marginRight: 8, color: TEXT_SEC }}>
            {loading ? '...' : '\uD83D\uDD0D'}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runLookup(query);
              if (e.key === 'Escape') {
                setShowTypeAhead(false);
                setQuery('');
              }
            }}
            placeholder="Search any word..."
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: TEXT,
              padding: '14px 0',
              fontSize: 16,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          />
          <span style={{ color: TEXT_TER, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {'\u2318'}K
          </span>
        </div>

        {/* Language Pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {languages.slice(0, 8).map((lang) => {
            const selected = lang.code === languageCode;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguageCode(lang.code)}
                style={{
                  borderRadius: 999,
                  border: selected ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                  backgroundColor: selected ? ACCENT : GLASS,
                  color: selected ? '#0A0A0F' : TEXT_SEC,
                  padding: '6px 14px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                {lang.code.toUpperCase()}
              </button>
            );
          })}
          <Link
            href="/words/languages"
            style={{
              borderRadius: 999,
              border: `1px solid ${BORDER}`,
              backgroundColor: GLASS,
              color: TEXT_SEC,
              padding: '6px 14px',
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            All 270+
          </Link>
        </div>
      </section>

      {/* Type-ahead Dropdown */}
      {showTypeAhead && (
        <div
          style={{
            backgroundColor: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {typeAheadResults.map((item, idx) => (
            <button
              key={`${item}-${idx}`}
              type="button"
              onClick={() => {
                setQuery(item);
                setShowTypeAhead(false);
                void runLookup(item);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: idx < typeAheadResults.length - 1 ? `1px solid ${BORDER}` : 'none',
                color: TEXT,
                cursor: 'pointer',
                fontSize: 15,
                fontFamily: 'Inter, system-ui, sans-serif',
                textAlign: 'left',
              }}
            >
              <span>{item}</span>
              <span
                style={{
                  backgroundColor: GLASS,
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 12,
                  color: TEXT_TER,
                }}
              >
                {languageCode.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: GLASS,
            border: `1px solid ${BORDER}`,
            display: 'grid',
            gap: 12,
          }}
        >
          <p style={{ margin: 0, color: DANGER, fontSize: 15 }}>{error}</p>
          <button
            type="button"
            onClick={() => void runLookup(query)}
            style={{
              alignSelf: 'flex-start',
              padding: '8px 16px',
              borderRadius: 8,
              border: `1px solid ${ACCENT}`,
              backgroundColor: 'transparent',
              color: ACCENT,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ display: 'grid', gap: 12, padding: 20, borderRadius: 16, backgroundColor: GLASS_STRONG, border: `1px solid ${GLASS_BORDER}` }}>
          <div style={{ width: '40%', height: 28, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: '25%', height: 16, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 16 }} />
          <div style={{ width: '100%', height: 14, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: '80%', height: 14, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
        </div>
      )}

      {/* Result Card */}
      {result && !loading && (
        <div
          style={{
            padding: 20,
            borderRadius: 16,
            backgroundColor: GLASS_STRONG,
            border: `1px solid ${GLASS_BORDER}`,
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>{result.word}</h2>
            <button
              type="button"
              onClick={() => void toggleSave()}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: 22,
                cursor: 'pointer',
                padding: 8,
                color: isSaved ? ACCENT : TEXT_SEC,
              }}
              title={isSaved ? 'Unsave word' : 'Save word'}
            >
              {isSaved ? '\uD83D\uDD16' : '\uD83D\uDD17'}
            </button>
          </div>

          {firstPos && (
            <span
              style={{
                alignSelf: 'flex-start',
                backgroundColor: GLASS,
                border: `1px solid ${BORDER}`,
                borderRadius: 999,
                padding: '3px 10px',
                fontSize: 13,
                color: TEXT_SEC,
              }}
            >
              {firstPos}
            </span>
          )}

          {firstDef && (
            <p style={{ margin: 0, color: TEXT_SEC, fontSize: 15, lineHeight: 1.5 }}>{firstDef}</p>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <Link
              href={`/words/${encodeURIComponent(result.word)}?lang=${result.language.code}`}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${ACCENT}`,
                color: ACCENT,
                fontWeight: 600,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              Full Entry
            </Link>
          </div>
        </div>
      )}

      {/* Starter Words (first run) */}
      {showStarter && !result && !error && (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <p style={{ color: TEXT_SEC, fontSize: 15, marginBottom: 16 }}>
            Look up any word in 270+ languages
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            {STARTER_WORDS.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => {
                  setQuery(word);
                  void runLookup(word);
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: 12,
                  backgroundColor: GLASS,
                  border: `1px solid ${BORDER}`,
                  color: ACCENT,
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
