import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  lookupWord,
  getSavedWord,
  getSavedWordByWordAndLang,
  getCachedLookup,
  saveWord,
  unsaveWord,
  cacheAfterLookup,
  type MyWordsLookupResult,
  type MyWordsSense,
  type MyWordsEntry,
} from '@mylife/words';
import { Text, colors, spacing, glass, LoadingState, ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

const ACCENT = colors.modules.words;

// ── Helpers ──────────────────────────────────────────────────────────

function dedupeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    const normalized = label.trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function getPronunciationLabels(result: MyWordsLookupResult): Array<{ text: string; type?: string; tags: string[] }> {
  const seen = new Set<string>();
  const out: Array<{ text: string; type?: string; tags: string[] }> = [];
  for (const entry of result.entries) {
    for (const pron of entry.pronunciations ?? []) {
      const key = pron.text.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(pron);
    }
  }
  return out;
}

function getFormLabels(result: MyWordsLookupResult): string[] {
  return dedupeLabels(
    result.entries.flatMap((entry) =>
      (entry.forms ?? []).map((form) => {
        const details = (form.tags ?? []).join(', ');
        return details ? `${form.word} (${details})` : form.word;
      }),
    ),
  );
}

function groupEntriesByPos(entries: MyWordsEntry[]): Array<{ pos: string; entries: MyWordsEntry[] }> {
  const map = new Map<string, MyWordsEntry[]>();
  for (const entry of entries) {
    const pos = entry.partOfSpeech || 'other';
    const group = map.get(pos);
    if (group) {
      group.push(entry);
    } else {
      map.set(pos, [entry]);
    }
  }
  return Array.from(map.entries()).map(([pos, grouped]) => ({ pos, entries: grouped }));
}

// ── Parse route ID ───────────────────────────────────────────────────

function parseRouteId(rawId: string): { type: 'composite'; word: string; lang: string } | { type: 'id'; id: string } {
  // Composite key: word::lang (URL-encoded parts)
  const parts = rawId.split('::');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return {
      type: 'composite',
      word: decodeURIComponent(parts[0]),
      lang: decodeURIComponent(parts[1]),
    };
  }
  return { type: 'id', id: rawId };
}

// ── Sense Renderer ───────────────────────────────────────────────────

function SenseItem({
  sense,
  index,
  depth,
  onWordTap,
}: {
  sense: MyWordsSense;
  index: number;
  depth: number;
  onWordTap: (word: string) => void;
}) {
  const tags = sense.tags ?? [];
  const synonyms = sense.synonyms ?? [];
  const antonyms = sense.antonyms ?? [];
  const examples = sense.examples ?? [];
  const quotes = sense.quotes ?? [];
  const subsenses = sense.subsenses ?? [];

  return (
    <View style={[styles.senseWrap, depth > 0 && { marginLeft: depth * spacing.md }]}>
      <View style={styles.defRow}>
        <Text variant="caption" color={colors.textTertiary} style={styles.defNumber}>
          {depth > 0 ? '\u25E6' : `${index + 1}.`}
        </Text>
        <Text variant="body" style={styles.flex}>{sense.definition}</Text>
      </View>

      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.map((tag, i) => (
            <View key={`tag-${i}`} style={styles.tinyPill}>
              <Text variant="caption" color={colors.textTertiary} style={styles.tinyPillText}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}

      {examples.map((example, i) => (
        <Text
          key={`ex-${i}`}
          variant="caption"
          color={colors.textSecondary}
          style={styles.exampleText}
        >
          {example}
        </Text>
      ))}

      {quotes.map((quote, i) => (
        <View key={`q-${i}`} style={styles.quoteWrap}>
          <Text variant="caption" color={colors.textSecondary} style={styles.quoteText}>
            &ldquo;{quote.text}&rdquo;
          </Text>
          {quote.reference ? (
            <Text variant="caption" color={colors.textTertiary}>
              {quote.reference}
            </Text>
          ) : null}
        </View>
      ))}

      {synonyms.length > 0 && (
        <View style={styles.chipRow}>
          <Text variant="caption" color={colors.textTertiary} style={styles.chipLabel}>Syn:</Text>
          {synonyms.map((word, i) => (
            <Pressable
              key={`syn-${i}`}
              style={styles.wordChip}
              onPress={() => onWordTap(word)}
            >
              <Text variant="caption" color={ACCENT}>{word}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {antonyms.length > 0 && (
        <View style={styles.chipRow}>
          <Text variant="caption" color={colors.textTertiary} style={styles.chipLabel}>Ant:</Text>
          {antonyms.map((word, i) => (
            <Pressable
              key={`ant-${i}`}
              style={styles.wordChip}
              onPress={() => onWordTap(word)}
            >
              <Text variant="caption" color={colors.textSecondary}>{word}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {subsenses.map((sub, i) => (
        <SenseItem
          key={`sub-${i}`}
          sense={sub}
          index={i}
          depth={depth + 1}
          onWordTap={onWordTap}
        />
      ))}
    </View>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function WordDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();

  const [result, setResult] = useState<MyWordsLookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'api' | 'cache' | 'saved' | null>(null);

  // Save state
  const [isSaved, setIsSaved] = useState(false);
  const [savedWordId, setSavedWordId] = useState<string | null>(null);
  const bookmarkScale = useRef(new Animated.Value(1)).current;
  const borderFlash = useRef(new Animated.Value(0)).current;

  // Flash bridge placeholder
  const flashEnabled = false;

  // ── Load data ────────────────────────────────────────────────────

  const loadWord = useCallback(async () => {
    if (!rawId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const parsed = parseRouteId(rawId);

    try {
      if (parsed.type === 'composite') {
        // Try API first
        try {
          const apiResult = await lookupWord({ languageCode: parsed.lang, word: parsed.word });
          if (apiResult) {
            setResult(apiResult);
            setSource('api');
            try { cacheAfterLookup(db, apiResult.word, apiResult.language.code, apiResult); } catch { /* */ }
            checkSavedStatus(apiResult.word, apiResult.language.code);
            setLoading(false);
            return;
          }
        } catch {
          // API failed, try cache
        }

        // Try offline cache
        const cached = getCachedLookup(db, parsed.word, parsed.lang);
        if (cached) {
          setResult(cached.lookupData);
          setSource('cache');
          checkSavedStatus(parsed.word, parsed.lang);
          setLoading(false);
          return;
        }

        // Try saved words
        const saved = getSavedWordByWordAndLang(db, parsed.word, parsed.lang);
        if (saved?.lookupData) {
          setResult(saved.lookupData);
          setSource('saved');
          setIsSaved(true);
          setSavedWordId(saved.id);
          setLoading(false);
          return;
        }

        setError(`Could not load "${parsed.word}". Check your connection and try again.`);
      } else {
        // ID-based: try saved word first, then cache
        const saved = getSavedWord(db, parsed.id);
        if (saved?.lookupData) {
          setResult(saved.lookupData);
          setSource('saved');
          setIsSaved(true);
          setSavedWordId(saved.id);
          setLoading(false);
          return;
        }

        // If we have a saved word without lookup data, try a fresh lookup
        if (saved) {
          try {
            const apiResult = await lookupWord({ languageCode: saved.languageCode, word: saved.word });
            if (apiResult) {
              setResult(apiResult);
              setSource('api');
              setIsSaved(true);
              setSavedWordId(saved.id);
              setLoading(false);
              return;
            }
          } catch {
            // couldn't refresh
          }
        }

        setError("Couldn't load this word.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this word.");
    } finally {
      setLoading(false);
    }
  }, [rawId, db]);

  const checkSavedStatus = useCallback(
    (word: string, lang: string) => {
      try {
        const saved = getSavedWordByWordAndLang(db, word, lang);
        setIsSaved(!!saved);
        setSavedWordId(saved?.id ?? null);
      } catch {
        setIsSaved(false);
        setSavedWordId(null);
      }
    },
    [db],
  );

  useEffect(() => {
    void loadWord();
  }, [loadWord]);

  // ── Save/unsave ──────────────────────────────────────────────────

  const toggleSave = useCallback(() => {
    if (!result) return;

    // Micro-interaction: scale bounce
    Animated.sequence([
      Animated.spring(bookmarkScale, { toValue: 1.15, useNativeDriver: true, speed: 40, bounciness: 12 }),
      Animated.spring(bookmarkScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 12 }),
    ]).start();

    // Border flash
    Animated.sequence([
      Animated.timing(borderFlash, { toValue: 1, duration: 100, useNativeDriver: false }),
      Animated.timing(borderFlash, { toValue: 0, duration: 250, useNativeDriver: false }),
    ]).start();

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isSaved && savedWordId) {
      unsaveWord(db, savedWordId);
      setIsSaved(false);
      setSavedWordId(null);
    } else {
      const id = uuid();
      const firstEntry = result.entries[0];
      const firstDef = firstEntry?.senses?.[0]?.definition ?? null;
      const firstPos = firstEntry?.partOfSpeech ?? null;
      const firstPron = firstEntry?.pronunciations?.[0]?.text ?? null;
      saveWord(db, id, {
        word: result.word,
        languageCode: result.language.code,
        languageName: result.language.name,
        definitionSummary: firstDef,
        partOfSpeech: firstPos,
        pronunciationText: firstPron,
        lookupData: result,
      });
      setIsSaved(true);
      setSavedWordId(id);
    }
  }, [result, isSaved, savedWordId, db, bookmarkScale, borderFlash]);

  // ── Copy to clipboard ────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    if (!result) return;
    const text = `${result.word} (${result.language.name}): ${result.entries[0]?.senses?.[0]?.definition ?? ''}`;
    await Clipboard.setStringAsync(text);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [result]);

  // ── Navigate to related word ─────────────────────────────────────

  const navigateToWord = useCallback(
    (word: string) => {
      const lang = result?.language.code ?? 'en';
      const compositeId = `${encodeURIComponent(word)}::${encodeURIComponent(lang)}`;
      router.push(`/(words)/word/${compositeId}` as never);
    },
    [router, result],
  );

  // ── Derived data ─────────────────────────────────────────────────

  const pronunciations = useMemo(() => (result ? getPronunciationLabels(result) : []), [result]);
  const forms = useMemo(() => (result ? getFormLabels(result) : []), [result]);
  const posGroups = useMemo(() => (result ? groupEntriesByPos(result.entries) : []), [result]);
  const wordHistory = result?.wordHistory ?? [];
  const chronology = result?.chronology ?? [];
  const wordFamily = result?.wordFamily ?? [];
  const rhymes = (result?.rhymes ?? []).slice(0, 24);
  const nearbyWords = result?.nearbyWords ?? [];
  const allSynonyms = result?.synonyms ?? [];
  const allAntonyms = result?.antonyms ?? [];

  const headerBorderColor = borderFlash.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.10)', ACCENT],
  });

  // ── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <LoadingState rows={5} />
      </View>
    );
  }

  if (error || !result) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Error' }} />
        <ErrorState
          message={error ?? "Couldn't load this word."}
          onRetry={() => void loadWord()}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: result.word, headerTintColor: ACCENT }} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
      >
        {/* ── Word Header ──────────────────────────────────── */}
        <Animated.View style={[glass.strong, styles.headerCard, { borderColor: headerBorderColor }]}>
          <View style={styles.headerTop}>
            <View style={styles.flex}>
              <Text variant="heading" style={styles.heroWord}>{result.word}</Text>
              <View style={styles.langRow}>
                <Text variant="body" color={colors.textSecondary}>
                  {result.language.name}
                </Text>
                <View style={styles.langBadge}>
                  <Text variant="caption" color={colors.textTertiary}>
                    {result.language.code.toUpperCase()}
                  </Text>
                </View>
                {source === 'cache' && (
                  <View style={styles.cachedBadge}>
                    <Text variant="caption" color={colors.textTertiary}>Cached</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable onPress={toggleSave} style={styles.headerButton} hitSlop={8}>
                <Animated.Text
                  style={[
                    styles.headerIcon,
                    { transform: [{ scale: bookmarkScale }] },
                  ]}
                >
                  {isSaved ? '\uD83D\uDD16' : '\uD83D\uDD17'}
                </Animated.Text>
              </Pressable>
              <Pressable onPress={() => void handleShare()} style={styles.headerButton} hitSlop={8}>
                <Text style={styles.headerIcon}>{'\uD83D\uDCCB'}</Text>
              </Pressable>
            </View>
          </View>

          {/* Pronunciations */}
          {pronunciations.length > 0 && (
            <View style={styles.pronRow}>
              {pronunciations.map((pron, i) => (
                <View key={`pron-${i}`} style={styles.pronItem}>
                  <Text variant="body" color={colors.text}>{pron.text}</Text>
                  {(pron.type || (pron.tags && pron.tags.length > 0)) && (
                    <View style={styles.pronPillRow}>
                      {pron.type && (
                        <View style={styles.tinyPill}>
                          <Text variant="caption" color={colors.textTertiary} style={styles.tinyPillText}>
                            {pron.type}
                          </Text>
                        </View>
                      )}
                      {(pron.tags ?? []).map((tag, j) => (
                        <View key={`pron-tag-${j}`} style={styles.tinyPill}>
                          <Text variant="caption" color={colors.textTertiary} style={styles.tinyPillText}>
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Word forms */}
          {forms.length > 0 && (
            <View style={styles.formRow}>
              {forms.map((form, i) => (
                <View key={`form-${i}`} style={styles.formPill}>
                  <Text variant="caption" color={colors.textSecondary}>{form}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* ── Definitions (grouped by POS) ─────────────────── */}
        {posGroups.map((group) => {
          let senseCounter = 0;
          return (
            <View key={group.pos} style={styles.posSection}>
              <Text variant="label" color={ACCENT} style={styles.posHeader}>
                {group.pos}
              </Text>
              {group.entries.map((entry, eIdx) => (
                <View key={`entry-${eIdx}`}>
                  {(entry.senses ?? []).map((sense, sIdx) => {
                    const currentIndex = senseCounter++;
                    return (
                      <SenseItem
                        key={`sense-${eIdx}-${sIdx}`}
                        sense={sense}
                        index={currentIndex}
                        depth={0}
                        onWordTap={navigateToWord}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}

        {/* ── Thesaurus Section ─────────────────────────────── */}
        {(allSynonyms.length > 0 || allAntonyms.length > 0) && (
          <View style={[glass.strong, styles.thesaurusCard]}>
            {allSynonyms.length > 0 && (
              <View style={styles.thesaurusColumn}>
                <Text variant="label" color={colors.textSecondary}>Synonyms</Text>
                <View style={styles.chipGrid}>
                  {allSynonyms.map((word, i) => (
                    <Pressable
                      key={`syn-${i}`}
                      style={[glass.card, styles.thesaurusChip]}
                      onPress={() => navigateToWord(word)}
                    >
                      <Text variant="caption" color={ACCENT}>{word}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {allAntonyms.length > 0 && (
              <View style={styles.thesaurusColumn}>
                <Text variant="label" color={colors.textSecondary}>Antonyms</Text>
                <View style={styles.chipGrid}>
                  {allAntonyms.map((word, i) => (
                    <Pressable
                      key={`ant-${i}`}
                      style={[glass.card, styles.thesaurusChip]}
                      onPress={() => navigateToWord(word)}
                    >
                      <Text variant="caption" color={colors.textSecondary}>{word}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Etymology Section ─────────────────────────────── */}
        {wordHistory.length > 0 && (
          <View style={styles.section}>
            <Text variant="label" color={colors.textSecondary}>Word History</Text>
            {wordHistory.map((line, i) => (
              <Text key={`hist-${i}`} variant="body" color={colors.textSecondary} style={styles.historyLine}>
                {line}
              </Text>
            ))}

            {chronology.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chronRow}
              >
                {chronology.map((period, i) => (
                  <View key={`chron-${i}`} style={styles.chronPill}>
                    <Text variant="caption" color={colors.textSecondary}>{period}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {result.firstKnownUse && (
              <View style={[glass.card, styles.calloutCard]}>
                <Text variant="caption" color={colors.textTertiary}>First Known Use</Text>
                <Text variant="body" color={colors.textSecondary}>{result.firstKnownUse}</Text>
              </View>
            )}

            {result.didYouKnow && (
              <View style={[glass.card, styles.calloutCard]}>
                <Text variant="caption" color={colors.textTertiary}>Did You Know?</Text>
                <Text variant="body" color={colors.textSecondary}>{result.didYouKnow}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Word Family ───────────────────────────────────── */}
        {wordFamily.length > 0 && (
          <View style={styles.section}>
            <Text variant="label" color={colors.textSecondary}>Word Family</Text>
            <View style={styles.chipGrid}>
              {wordFamily.map((word, i) => (
                <Pressable
                  key={`fam-${i}`}
                  style={[glass.card, styles.chipItem]}
                  onPress={() => navigateToWord(word)}
                >
                  <Text variant="caption" color={colors.textSecondary}>{word}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Rhymes ────────────────────────────────────────── */}
        {rhymes.length > 0 && (
          <View style={styles.section}>
            <Text variant="label" color={colors.textSecondary}>Rhymes</Text>
            <View style={styles.chipGrid}>
              {rhymes.map((word, i) => (
                <Pressable
                  key={`rhy-${i}`}
                  style={[glass.card, styles.chipItem]}
                  onPress={() => navigateToWord(word)}
                >
                  <Text variant="caption" color={colors.textSecondary}>{word}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Nearby Words ──────────────────────────────────── */}
        {nearbyWords.length > 0 && (
          <View style={styles.section}>
            <Text variant="label" color={colors.textSecondary}>Nearby Words</Text>
            <View style={styles.chipGrid}>
              {nearbyWords.map((word, i) => (
                <Pressable
                  key={`near-${i}`}
                  style={[glass.card, styles.chipItem]}
                  onPress={() => navigateToWord(word)}
                >
                  <Text variant="caption" color={colors.textSecondary}>{word}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Add to Flashcards ─────────────────────────────── */}
        {isSaved && flashEnabled && (
          <Pressable style={styles.flashButton}>
            <Text variant="label" color={colors.background}>
              {'\u26A1'} Add to Flashcards
            </Text>
          </Pressable>
        )}

        {/* ── Sources Footer ────────────────────────────────── */}
        {(result.attributions ?? []).length > 0 && (
          <View style={styles.sourcesSection}>
            {(result.attributions ?? []).map((attr, i) => (
              <View key={`attr-${i}`} style={[glass.card, styles.sourceCard]}>
                <Text variant="caption" color={colors.textTertiary}>
                  {attr.name}
                </Text>
                <Text variant="caption" color={colors.textTertiary}>
                  {attr.license}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },

  // Header
  headerCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroWord: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  langBadge: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cachedBadge: {
    backgroundColor: colors.glassStrong,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 22,
  },
  pronRow: {
    gap: spacing.xs,
  },
  pronItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  pronPillRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  formPill: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },

  // POS / Definitions
  posSection: {
    gap: spacing.xs,
  },
  posHeader: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  senseWrap: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  defRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  defNumber: {
    marginTop: 2,
    minWidth: 18,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginLeft: spacing.sm + 18,
  },
  tinyPill: {
    backgroundColor: colors.glass,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tinyPillText: {
    fontSize: 11,
  },
  exampleText: {
    fontStyle: 'italic',
    marginLeft: spacing.sm + 18,
    lineHeight: 20,
  },
  quoteWrap: {
    marginLeft: spacing.sm + 18,
    gap: 2,
    marginTop: spacing.xs,
  },
  quoteText: {
    fontStyle: 'italic',
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.sm + 18,
    marginTop: spacing.xs,
  },
  chipLabel: {
    marginRight: 2,
  },
  wordChip: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minHeight: 28,
    justifyContent: 'center',
  },

  // Thesaurus
  thesaurusCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  thesaurusColumn: {
    gap: spacing.sm,
  },
  thesaurusChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: 'center',
  },

  // Sections
  section: {
    gap: spacing.sm,
  },
  historyLine: {
    lineHeight: 22,
  },
  chronRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  chronPill: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  calloutCard: {
    padding: spacing.sm + 2,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipItem: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: 'center',
  },

  // Flash button
  flashButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },

  // Sources
  sourcesSection: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sourceCard: {
    padding: spacing.sm + 2,
    gap: 2,
  },

});
