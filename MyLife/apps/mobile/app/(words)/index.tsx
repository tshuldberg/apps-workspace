import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getMyWordsLanguages,
  lookupWord,
  getCachePrefixMatches,
  clearCache,
  getSavedWordByWordAndLang,
  saveWord,
  unsaveWord,
  cacheAfterLookup,
  type MyWordsLanguage,
  type MyWordsLookupResult,
} from '@mylife/words';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import * as Haptics from 'expo-haptics';

const ACCENT = colors.modules.words;
const DEBOUNCE_MS = 150;
const STARTER_WORDS = ['ephemeral', 'serendipity', 'ubiquitous'];

// ── Component ────────────────────────────────────────────────────────

export default function LookupScreen() {
  const db = useDatabase();
  const router = useRouter();

  // Languages
  const [languages, setLanguages] = useState<MyWordsLanguage[]>([]);
  const [languageCode, setLanguageCode] = useState('en');

  // Search
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MyWordsLookupResult | null>(null);
  const [hasEverSearched, setHasEverSearched] = useState(false);

  // Type-ahead
  const [typeAheadResults, setTypeAheadResults] = useState<string[]>([]);
  const [showTypeAhead, setShowTypeAhead] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recent lookups
  const [recentLookups, setRecentLookups] = useState<Array<{ word: string; languageCode: string }>>([]);

  // Save state
  const [isSaved, setIsSaved] = useState(false);
  const [savedWordId, setSavedWordId] = useState<string | null>(null);
  const bookmarkScale = useRef(new Animated.Value(1)).current;

  const selectedLanguage = useMemo(
    () => languages.find((lang) => lang.code === languageCode),
    [languages, languageCode],
  );

  // ── Load languages ───────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    void getMyWordsLanguages()
      .then((langs) => {
        if (!active) return;
        setLanguages(langs);
        if (!langs.some((lang) => lang.code === 'en') && langs[0]) {
          setLanguageCode(langs[0].code);
        }
      })
      .catch(() => {
        if (active) setError('Could not load languages.');
      });
    return () => { active = false; };
  }, []);

  // ── Load recent lookups ──────────────────────────────────────────

  const loadRecent = useCallback(() => {
    try {
      const rows = db.query<{ word: string; language_code: string }>(
        'SELECT word, language_code FROM wd_lookup_cache ORDER BY last_accessed_at DESC LIMIT 10',
      );
      setRecentLookups(rows.map((r) => ({ word: r.word, languageCode: r.language_code })));
    } catch {
      setRecentLookups([]);
    }
  }, [db]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // ── Check if current result is saved ─────────────────────────────

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

  // ── Type-ahead ───────────────────────────────────────────────────

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (text.trim().length < 2) {
        setTypeAheadResults([]);
        setShowTypeAhead(false);
        return;
      }

      debounceRef.current = setTimeout(() => {
        try {
          const matches = getCachePrefixMatches(
            db,
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
    [db, languageCode],
  );

  // ── Lookup ───────────────────────────────────────────────────────

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
        const data = await lookupWord({ languageCode, word: trimmed });
        if (!data) {
          setError(`No entry found for "${trimmed}" in ${selectedLanguage?.name ?? languageCode}.`);
        } else {
          setResult(data);
          setHasEverSearched(true);
          checkSavedStatus(data.word, data.language.code);
          // Cache for offline use
          try {
            cacheAfterLookup(db, data.word, data.language.code, data);
          } catch {
            // Non-critical cache write failure
          }
          loadRecent();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lookup failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [languageCode, selectedLanguage, db, checkSavedStatus, loadRecent],
  );

  // ── Save/unsave bookmark ─────────────────────────────────────────

  const toggleSave = useCallback(() => {
    if (!result) return;

    // Animate bookmark
    Animated.sequence([
      Animated.spring(bookmarkScale, { toValue: 1.15, useNativeDriver: true, speed: 40, bounciness: 12 }),
      Animated.spring(bookmarkScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 12 }),
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
  }, [result, isSaved, savedWordId, db, bookmarkScale]);

  // ── Clear history ────────────────────────────────────────────────

  const handleClearHistory = useCallback(() => {
    clearCache(db);
    setRecentLookups([]);
  }, [db]);

  // ── Navigate to detail ───────────────────────────────────────────

  const navigateToDetail = useCallback(
    (word: string, lang: string) => {
      const compositeId = `${encodeURIComponent(word)}::${encodeURIComponent(lang)}`;
      router.push(`/(words)/word/${compositeId}` as never);
    },
    [router],
  );

  // ── Render ───────────────────────────────────────────────────────

  const firstDef = result?.entries[0]?.senses?.[0]?.definition ?? '';
  const firstPos = result?.entries[0]?.partOfSpeech ?? '';

  const showStarter = !hasEverSearched && recentLookups.length === 0;
  const showRecent = !result && !loading && recentLookups.length > 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Search Section ─────────────────────────────────── */}
        <View style={styles.searchSection}>
          <View style={styles.searchInputWrap}>
            <Text variant="caption" color={ACCENT} style={styles.searchIcon}>
              {loading ? '' : '\uD83D\uDD0D'}
            </Text>
            {loading && (
              <ActivityIndicator size="small" color={ACCENT} style={styles.searchSpinner} />
            )}
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={handleQueryChange}
              onSubmitEditing={() => void runLookup(query)}
              placeholder="Search any word..."
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="search"
            />
          </View>

          {/* Language pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.langPillRow}
          >
            {languages.slice(0, 8).map((lang) => {
              const selected = lang.code === languageCode;
              return (
                <Pressable
                  key={lang.code}
                  style={[styles.langPill, selected && styles.langPillSelected]}
                  onPress={() => setLanguageCode(lang.code)}
                >
                  <Text
                    variant="caption"
                    color={selected ? colors.background : colors.textSecondary}
                  >
                    {lang.code.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={styles.langPill}
              onPress={() => router.push('/(words)/languages' as never)}
            >
              <Text variant="caption" color={colors.textSecondary}>
                All 270+
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* ── Type-ahead dropdown ────────────────────────────── */}
        {showTypeAhead && (
          <View style={styles.typeAheadWrap}>
            {typeAheadResults.map((item, idx) => (
              <Pressable
                key={`${item}-${idx}`}
                style={styles.typeAheadRow}
                onPress={() => {
                  setQuery(item);
                  setShowTypeAhead(false);
                  void runLookup(item);
                }}
              >
                <Text variant="body" style={styles.flex}>{item}</Text>
                <View style={styles.langBadgeSmall}>
                  <Text variant="caption" color={colors.textTertiary}>
                    {languageCode.toUpperCase()}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Error ──────────────────────────────────────────── */}
        {error && (
          <View style={[glass.card, styles.errorCard]}>
            <Text variant="body" color={colors.danger}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => void runLookup(query)}
            >
              <Text variant="label" color={ACCENT}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* ── Compact Result Preview ─────────────────────────── */}
        {result && (
          <View style={[glass.strong, styles.resultCard]}>
            <View style={styles.resultHeader}>
              <Text variant="heading" style={styles.resultWord}>{result.word}</Text>
              <Pressable
                onPress={toggleSave}
                style={styles.bookmarkButton}
                hitSlop={8}
              >
                <Animated.Text
                  style={[
                    styles.bookmarkIcon,
                    { transform: [{ scale: bookmarkScale }] },
                    isSaved && styles.bookmarkSaved,
                  ]}
                >
                  {isSaved ? '\uD83D\uDD16' : '\uD83D\uDD17'}
                </Animated.Text>
              </Pressable>
            </View>

            {firstPos ? (
              <View style={styles.posPill}>
                <Text variant="caption" color={colors.textSecondary}>
                  {firstPos}
                </Text>
              </View>
            ) : null}

            {firstDef ? (
              <Text
                variant="body"
                color={colors.textSecondary}
                numberOfLines={2}
                style={styles.defPreview}
              >
                {firstDef}
              </Text>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                style={styles.actionButton}
                onPress={() => navigateToDetail(result.word, result.language.code)}
              >
                <Text variant="label" color={ACCENT}>Full Entry</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Recent Lookups ─────────────────────────────────── */}
        {showRecent && (
          <View style={styles.recentSection}>
            <Text variant="label" color={colors.textSecondary} style={styles.sectionHeading}>
              Recent
            </Text>
            {recentLookups.map((item, idx) => (
              <Pressable
                key={`${item.word}-${item.languageCode}-${idx}`}
                style={styles.recentRow}
                onPress={() => {
                  setQuery(item.word);
                  setLanguageCode(item.languageCode);
                  void runLookup(item.word);
                }}
              >
                <Text variant="body" style={styles.flex}>{item.word}</Text>
                <View style={styles.langBadgeSmall}>
                  <Text variant="caption" color={colors.textTertiary}>
                    {item.languageCode.toUpperCase()}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Pressable onPress={handleClearHistory} style={styles.clearLink}>
              <Text variant="caption" color={colors.textTertiary}>Clear History</Text>
            </Pressable>
          </View>
        )}

        {/* ── First-run starter words ────────────────────────── */}
        {showStarter && (
          <View style={styles.starterSection}>
            <Text variant="caption" color={colors.textSecondary} style={styles.starterCaption}>
              Look up any word in 270+ languages
            </Text>
            <View style={styles.starterRow}>
              {STARTER_WORDS.map((word) => (
                <Pressable
                  key={word}
                  style={[glass.card, styles.starterChip]}
                  onPress={() => {
                    setQuery(word);
                    void runLookup(word);
                  }}
                >
                  <Text variant="body" color={ACCENT}>{word}</Text>
                </Pressable>
              ))}
            </View>
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

  // Search section
  searchSection: {
    gap: spacing.sm,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  searchSpinner: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter',
  },
  langPillRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  langPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    minHeight: 32,
    justifyContent: 'center',
  },
  langPillSelected: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },

  // Type-ahead
  typeAheadWrap: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  typeAheadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Error card
  errorCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT,
    minHeight: 44,
    justifyContent: 'center',
  },

  // Result preview
  resultCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultWord: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  bookmarkButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkIcon: {
    fontSize: 24,
  },
  bookmarkSaved: {
    color: ACCENT,
  },
  posPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  defPreview: {
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT,
    minHeight: 44,
    justifyContent: 'center',
  },

  // Recent
  recentSection: {
    gap: spacing.xs,
  },
  sectionHeading: {
    marginBottom: spacing.xs,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  langBadgeSmall: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },

  // Starter
  starterSection: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  starterCaption: {
    textAlign: 'center',
  },
  starterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  starterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
});
