'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { lookupWordAction, fetchSavedWordByWordAndLangAction, saveWordAction, unsaveWordAction, cacheLookupAction } from '../actions';
import type { MyWordsLookupResult, MyWordsSense, MyWordsEntry } from '@mylife/words';
import { ACCENT, TEXT, TEXT_SEC, TEXT_TER, SURFACE, BORDER, GLASS, GLASS_STRONG, GLASS_BORDER, DANGER } from '../ui';

function groupEntriesByPos(entries: MyWordsEntry[]): Array<{ pos: string; entries: MyWordsEntry[] }> {
  const map = new Map<string, MyWordsEntry[]>();
  for (const entry of entries) {
    const pos = entry.partOfSpeech || 'other';
    const group = map.get(pos);
    if (group) group.push(entry);
    else map.set(pos, [entry]);
  }
  return Array.from(map.entries()).map(([pos, grouped]) => ({ pos, entries: grouped }));
}

function SenseItem({ sense, index, depth }: { sense: MyWordsSense; index: number; depth: number }) {
  const synonyms = sense.synonyms ?? [];
  const antonyms = sense.antonyms ?? [];
  const examples = sense.examples ?? [];
  const subsenses = sense.subsenses ?? [];

  return (
    <div style={{ marginLeft: depth > 0 ? depth * 16 : 0, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ color: TEXT_TER, fontSize: 13, minWidth: 18, marginTop: 2 }}>
          {depth > 0 ? '\u25E6' : `${index + 1}.`}
        </span>
        <span style={{ color: TEXT, fontSize: 16, lineHeight: 1.6 }}>{sense.definition}</span>
      </div>

      {examples.map((ex, i) => (
        <p key={`ex-${i}`} style={{ margin: '4px 0 0 26px', color: TEXT_SEC, fontSize: 14, fontStyle: 'italic', lineHeight: 1.5 }}>
          {ex}
        </p>
      ))}

      {synonyms.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 26, marginTop: 6, alignItems: 'center' }}>
          <span style={{ color: TEXT_TER, fontSize: 12 }}>Syn:</span>
          {synonyms.map((w, i) => (
            <Link key={`syn-${i}`} href={`/words/${encodeURIComponent(w)}?lang=en`} style={{ color: ACCENT, fontSize: 13, textDecoration: 'none', backgroundColor: GLASS, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '2px 8px' }}>
              {w}
            </Link>
          ))}
        </div>
      )}

      {antonyms.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 26, marginTop: 4, alignItems: 'center' }}>
          <span style={{ color: TEXT_TER, fontSize: 12 }}>Ant:</span>
          {antonyms.map((w, i) => (
            <Link key={`ant-${i}`} href={`/words/${encodeURIComponent(w)}?lang=en`} style={{ color: TEXT_SEC, fontSize: 13, textDecoration: 'none', backgroundColor: GLASS, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '2px 8px' }}>
              {w}
            </Link>
          ))}
        </div>
      )}

      {subsenses.map((sub, i) => (
        <SenseItem key={`sub-${i}`} sense={sub} index={i} depth={depth + 1} />
      ))}
    </div>
  );
}

function WordDetailPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const word = decodeURIComponent(String(params.word ?? ''));
  const lang = searchParams.get('lang') ?? 'en';

  const [result, setResult] = useState<MyWordsLookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savedWordId, setSavedWordId] = useState<string | null>(null);

  const loadWord = useCallback(async () => {
    if (!word) return;
    setLoading(true);
    setError(null);
    try {
      const data = await lookupWordAction({ languageCode: lang, word });
      if (!data) {
        setError(`No entry found for "${word}" in ${lang.toUpperCase()}.`);
      } else {
        setResult(data);
        try { await cacheLookupAction(data.word, data.language.code, data); } catch { /* */ }
        try {
          const saved = await fetchSavedWordByWordAndLangAction(data.word, data.language.code);
          setIsSaved(!!saved);
          setSavedWordId(saved?.id ?? null);
        } catch { /* */ }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this word.');
    } finally {
      setLoading(false);
    }
  }, [word, lang]);

  useEffect(() => { void loadWord(); }, [loadWord]);

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
    } catch { /* non-critical */ }
  }, [result, isSaved, savedWordId]);

  const posGroups = useMemo(() => result ? groupEntriesByPos(result.entries) : [], [result]);
  const allSynonyms = result?.synonyms ?? [];
  const allAntonyms = result?.antonyms ?? [];
  const wordHistory = result?.wordHistory ?? [];
  const wordFamily = result?.wordFamily ?? [];
  const rhymes = (result?.rhymes ?? []).slice(0, 24);
  const nearbyWords = result?.nearbyWords ?? [];

  const pronunciations = useMemo(() => {
    if (!result) return [];
    const seen = new Set<string>();
    const out: Array<{ text: string; type?: string }> = [];
    for (const entry of result.entries) {
      for (const pron of entry.pronunciations ?? []) {
        const key = pron.text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(pron);
      }
    }
    return out;
  }, [result]);

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ width: '40%', height: 28, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '25%', height: 16, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 16 }} />
        <div style={{ width: '100%', height: 14, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '90%', height: 14, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: '75%', height: 14, borderRadius: 8, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }`}</style>
      </div>
    );
  }

  // Error
  if (error || !result) {
    return (
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center', padding: '64px 0' }}>
        <p style={{ color: DANGER, fontSize: 15 }}>{error ?? 'Could not load this word.'}</p>
        <button
          type="button"
          onClick={() => void loadWord()}
          style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${ACCENT}`, backgroundColor: 'transparent', color: ACCENT, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const chipStyle = { backgroundColor: GLASS, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '4px 10px', fontSize: 13, textDecoration: 'none' as const };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Back link */}
      <Link href="/words" style={{ color: TEXT_SEC, fontSize: 13, textDecoration: 'none' }}>&larr; Back to Lookup</Link>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 24, alignItems: 'start' }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'grid', gap: 24 }}>
          {/* Header Card */}
          <div style={{ padding: 20, borderRadius: 16, backgroundColor: GLASS_STRONG, border: `1px solid ${GLASS_BORDER}`, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>{result.word}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ color: TEXT_SEC }}>{result.language.name}</span>
                  <span style={{ backgroundColor: SURFACE, borderRadius: 4, padding: '2px 6px', fontSize: 12, color: TEXT_TER }}>{result.language.code.toUpperCase()}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" onClick={() => void toggleSave()} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', padding: 8, color: isSaved ? ACCENT : TEXT_SEC }} title={isSaved ? 'Unsave' : 'Save'}>
                  {isSaved ? '\uD83D\uDD16' : '\uD83D\uDD17'}
                </button>
              </div>
            </div>

            {pronunciations.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pronunciations.map((pron, i) => (
                  <span key={`pron-${i}`} style={{ color: TEXT, fontSize: 15 }}>{pron.text}</span>
                ))}
              </div>
            )}
          </div>

          {/* Definitions by POS */}
          {posGroups.map((group) => {
            let senseCounter = 0;
            return (
              <div key={group.pos} style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: ACCENT }}>{group.pos}</span>
                {group.entries.map((entry, eIdx) => (
                  <div key={`entry-${eIdx}`}>
                    {(entry.senses ?? []).map((sense, sIdx) => {
                      const currentIndex = senseCounter++;
                      return <SenseItem key={`sense-${eIdx}-${sIdx}`} sense={sense} index={currentIndex} depth={0} />;
                    })}
                  </div>
                ))}
              </div>
            );
          })}

          {/* Word History / Etymology */}
          {wordHistory.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_SEC }}>Word History</span>
              {wordHistory.map((line, i) => (
                <p key={`hist-${i}`} style={{ margin: 0, color: TEXT_SEC, fontSize: 15, lineHeight: 1.5 }}>{line}</p>
              ))}
              {result.firstKnownUse && (
                <div style={{ padding: 12, borderRadius: 12, backgroundColor: GLASS, border: `1px solid ${BORDER}`, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: TEXT_TER }}>First Known Use</span>
                  <p style={{ margin: '4px 0 0', color: TEXT_SEC, fontSize: 14 }}>{result.firstKnownUse}</p>
                </div>
              )}
              {result.didYouKnow && (
                <div style={{ padding: 12, borderRadius: 12, backgroundColor: GLASS, border: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 12, color: TEXT_TER }}>Did You Know?</span>
                  <p style={{ margin: '4px 0 0', color: TEXT_SEC, fontSize: 14 }}>{result.didYouKnow}</p>
                </div>
              )}
            </div>
          )}

          {/* Sources */}
          {(result.attributions ?? []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {result.attributions.map((attr, i) => (
                <div key={`attr-${i}`} style={{ padding: '8px 12px', borderRadius: 12, backgroundColor: GLASS, border: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 12, color: TEXT_TER }}>{attr.name}</span>
                  <br />
                  <span style={{ fontSize: 11, color: TEXT_TER }}>{attr.license}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'grid', gap: 20, position: 'sticky', top: 24 }}>
          {/* Thesaurus */}
          {(allSynonyms.length > 0 || allAntonyms.length > 0) && (
            <div style={{ padding: 16, borderRadius: 16, backgroundColor: GLASS_STRONG, border: `1px solid ${GLASS_BORDER}`, display: 'grid', gap: 16 }}>
              {allSynonyms.length > 0 && (
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_SEC }}>Synonyms</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {allSynonyms.map((w, i) => (
                      <Link key={`syn-${i}`} href={`/words/${encodeURIComponent(w)}?lang=${result.language.code}`} style={{ ...chipStyle, color: ACCENT }}>{w}</Link>
                    ))}
                  </div>
                </div>
              )}
              {allAntonyms.length > 0 && (
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_SEC }}>Antonyms</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {allAntonyms.map((w, i) => (
                      <Link key={`ant-${i}`} href={`/words/${encodeURIComponent(w)}?lang=${result.language.code}`} style={{ ...chipStyle, color: TEXT_SEC }}>{w}</Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Word Family */}
          {wordFamily.length > 0 && (
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_SEC }}>Word Family</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {wordFamily.map((w, i) => (
                  <Link key={`fam-${i}`} href={`/words/${encodeURIComponent(w)}?lang=${result.language.code}`} style={{ ...chipStyle, color: TEXT_SEC }}>{w}</Link>
                ))}
              </div>
            </div>
          )}

          {/* Rhymes */}
          {rhymes.length > 0 && (
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_SEC }}>Rhymes</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {rhymes.map((w, i) => (
                  <Link key={`rhy-${i}`} href={`/words/${encodeURIComponent(w)}?lang=${result.language.code}`} style={{ ...chipStyle, color: TEXT_SEC }}>{w}</Link>
                ))}
              </div>
            </div>
          )}

          {/* Nearby Words */}
          {nearbyWords.length > 0 && (
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_SEC }}>Nearby Words</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {nearbyWords.map((w, i) => (
                  <Link key={`near-${i}`} href={`/words/${encodeURIComponent(w)}?lang=${result.language.code}`} style={{ ...chipStyle, color: TEXT_SEC }}>{w}</Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WordDetailPage() {
  return (
    <Suspense fallback={null}>
      <WordDetailPageContent />
    </Suspense>
  );
}
