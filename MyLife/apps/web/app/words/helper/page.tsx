'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMyWordsLanguagesAction, suggestWordReplacementsAction } from '../actions';
import type { MyWordsLanguage, MyWordsWordHelperResult, MyWordsWordHelperSuggestion } from '@mylife/words';
import { ACCENT, TEXT, TEXT_SEC, TEXT_TER, SURFACE, BORDER, GLASS, SUCCESS, WARNING, DANGER } from '../ui';

type Token = { text: string; tappable: boolean };

function tokenize(sentence: string): Token[] {
  const matches = sentence.match(/[\w'-]+|[^\w\s]+|\s+/g);
  if (!matches) return [];
  return matches.map((text) => ({ text, tappable: /[\w'-]+/.test(text) }));
}

function RelevanceDot({ relevance }: { relevance: 'high' | 'medium' | 'related' }) {
  const color = relevance === 'high' ? SUCCESS : relevance === 'medium' ? WARNING : TEXT_TER;
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

export default function WordHelperPage() {
  const [sentence, setSentence] = useState('');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [languageCode, setLanguageCode] = useState('en');
  const [languages, setLanguages] = useState<MyWordsLanguage[]>([]);
  const [result, setResult] = useState<MyWordsWordHelperResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const tokens = useMemo(() => tokenize(sentence), [sentence]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const langs = await fetchMyWordsLanguagesAction();
        if (!cancelled) setLanguages(langs);
      } catch { /* */ }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const onSelectWord = useCallback(async (word: string) => {
    setSelectedWord(word);
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const data = await suggestWordReplacementsAction({ languageCode, sentence: sentence.trim(), targetWord: word });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get replacements.');
    } finally {
      setLoading(false);
    }
  }, [languageCode, sentence]);

  const onCopy = useCallback(async (suggestion: MyWordsWordHelperSuggestion, index: number) => {
    try {
      await navigator.clipboard.writeText(suggestion.replacedSentence);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch { /* */ }
  }, []);

  const grouped = useMemo(() => {
    if (!result) return { high: [], medium: [], related: [] };
    const high: MyWordsWordHelperSuggestion[] = [];
    const medium: MyWordsWordHelperSuggestion[] = [];
    const related: MyWordsWordHelperSuggestion[] = [];
    for (const s of result.suggestions) {
      if (s.relevance === 'high') high.push(s);
      else if (s.relevance === 'medium') medium.push(s);
      else related.push(s);
    }
    return { high, medium, related };
  }, [result]);

  const hasSentence = sentence.trim().length > 0;
  const selectedLanguage = languages.find((l) => l.code === languageCode);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Word Helper</h1>
        <p style={{ margin: '6px 0 0', color: TEXT_SEC, fontSize: 15 }}>Find the perfect word for your sentence</p>
      </div>

      {/* Sentence Input */}
      <div style={{ padding: 16, borderRadius: 16, backgroundColor: GLASS, border: `1px solid ${BORDER}`, display: 'grid', gap: 8 }}>
        <div style={{ position: 'relative' }}>
          <textarea
            value={sentence}
            onChange={(e) => { setSentence(e.target.value); setSelectedWord(null); setResult(null); setError(null); }}
            placeholder="Paste or type a sentence..."
            rows={4}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: TEXT, fontSize: 15, lineHeight: 1.5, resize: 'vertical', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box', paddingRight: 32 }}
          />
          {hasSentence && (
            <button type="button" onClick={() => { setSentence(''); setSelectedWord(null); setResult(null); setError(null); }} style={{ position: 'absolute', top: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: SURFACE, border: 'none', color: TEXT_SEC, cursor: 'pointer', fontSize: 12 }}>X</button>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: TEXT_TER }}>{sentence.length} chars</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: TEXT_SEC }}>{selectedLanguage?.name ?? languageCode.toUpperCase()}</span>
            <select
              value={languageCode}
              onChange={(e) => { setLanguageCode(e.target.value); setSelectedWord(null); setResult(null); }}
              style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none' }}
            >
              {languages.slice(0, 12).map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.code.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Word Selector */}
      {hasSentence && (
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_SEC }}>Tap a word to find replacements:</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            {tokens.map((token, i) => {
              if (!token.tappable) return <span key={`t-${i}`} style={{ color: TEXT_SEC }}>{token.text}</span>;
              const isSelected = selectedWord !== null && token.text.toLowerCase() === selectedWord.toLowerCase();
              return (
                <button key={`t-${i}`} type="button" onClick={() => void onSelectWord(token.text)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${isSelected ? ACCENT : BORDER}`, backgroundColor: isSelected ? ACCENT : GLASS, color: isSelected ? '#0A0A0F' : TEXT, cursor: 'pointer', fontSize: 15, fontFamily: 'Inter, system-ui, sans-serif' }}>
                  {token.text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <div style={{ textAlign: 'center', padding: 16, color: ACCENT }}>Finding replacements...</div>}

      {/* Error */}
      {error && <div style={{ padding: 16, borderRadius: 12, backgroundColor: GLASS, border: `1px solid ${BORDER}` }}><p style={{ margin: 0, color: DANGER, fontSize: 14 }}>{error}</p></div>}

      {/* Results */}
      {result && !loading && (
        <div style={{ display: 'grid', gap: 16 }}>
          {result.suggestions.length === 0 ? (
            <div style={{ padding: 16, borderRadius: 12, backgroundColor: GLASS, border: `1px solid ${BORDER}` }}>
              <p style={{ margin: 0, color: TEXT_SEC }}>No replacements found for &ldquo;{result.targetWord}&rdquo;</p>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_SEC }}>
                Replacements for &lsquo;{result.targetWord}&rsquo;
              </span>

              {result.message && languageCode !== 'en' && <p style={{ margin: 0, fontSize: 13, color: TEXT_TER }}>{result.message}</p>}

              {grouped.high.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><RelevanceDot relevance="high" /><span style={{ fontSize: 13, color: SUCCESS }}>High relevance</span></div>
                  {grouped.high.map((s, i) => (
                    <SuggestionCard key={`h-${i}`} suggestion={s} index={i} copied={copiedIndex === i} onCopy={onCopy} />
                  ))}
                </div>
              )}

              {grouped.medium.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><RelevanceDot relevance="medium" /><span style={{ fontSize: 13, color: WARNING }}>Good alternatives</span></div>
                  {grouped.medium.map((s, i) => {
                    const gi = grouped.high.length + i;
                    return <SuggestionCard key={`m-${i}`} suggestion={s} index={gi} copied={copiedIndex === gi} onCopy={onCopy} />;
                  })}
                </div>
              )}

              {grouped.related.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><RelevanceDot relevance="related" /><span style={{ fontSize: 13, color: TEXT_TER }}>Broader suggestions</span></div>
                  {grouped.related.map((s, i) => {
                    const gi = grouped.high.length + grouped.medium.length + i;
                    return <SuggestionCard key={`r-${i}`} suggestion={s} index={gi} copied={copiedIndex === gi} onCopy={onCopy} />;
                  })}
                </div>
              )}
            </>
          )}

          {(result.attributions ?? []).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {result.attributions.map((attr, i) => (
                <span key={`attr-${i}`} style={{ fontSize: 12, color: TEXT_TER }}>{attr.name}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty */}
      {!hasSentence && (
        <div style={{ textAlign: 'center', padding: 32, color: TEXT_SEC, fontSize: 15 }}>
          Type or paste a sentence above, then click any word to discover better alternatives.
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ suggestion, index, copied, onCopy }: { suggestion: MyWordsWordHelperSuggestion; index: number; copied: boolean; onCopy: (s: MyWordsWordHelperSuggestion, i: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => void onCopy(suggestion, index)}
      style={{ display: 'grid', gap: 4, padding: 12, borderRadius: 12, backgroundColor: GLASS, border: `1px solid ${BORDER}`, textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', color: TEXT, width: '100%' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{suggestion.replacement}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RelevanceDot relevance={suggestion.relevance} />
          <span style={{ fontSize: 12, color: TEXT_TER }}>{suggestion.score > 0 ? suggestion.score.toLocaleString() : '--'}</span>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, lineHeight: 1.4 }}>{suggestion.replacedSentence}</p>
      {copied && <span style={{ fontSize: 12, color: SUCCESS }}>Copied!</span>}
    </button>
  );
}
