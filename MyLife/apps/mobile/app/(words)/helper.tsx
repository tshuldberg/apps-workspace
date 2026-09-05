import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  getMyWordsLanguages,
  suggestWordReplacements,
  type MyWordsLanguage,
  type MyWordsWordHelperResult,
  type MyWordsWordHelperSuggestion,
} from '@mylife/words';
import { Text, colors, spacing, glass } from '@mylife/ui';

const WORDS_ACCENT = colors.modules.words;

type Token = { text: string; tappable: boolean };

function tokenize(sentence: string): Token[] {
  const matches = sentence.match(/[\w'-]+|[^\w\s]+|\s+/g);
  if (!matches) return [];
  return matches.map((text) => ({
    text,
    tappable: /[\w'-]+/.test(text),
  }));
}

function RelevanceDot({ relevance }: { relevance: 'high' | 'medium' | 'related' }) {
  const dotColor =
    relevance === 'high'
      ? colors.success
      : relevance === 'medium'
        ? colors.warning
        : colors.textTertiary;
  return <View style={[styles.dot, { backgroundColor: dotColor }]} />;
}

export default function HelperScreen() {
  const [sentence, setSentence] = useState('');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [languageCode, setLanguageCode] = useState('en');
  const [languages, setLanguages] = useState<MyWordsLanguage[]>([]);
  const [result, setResult] = useState<MyWordsWordHelperResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const selectedLanguage = useMemo(
    () => languages.find((lang) => lang.code === languageCode),
    [languages, languageCode],
  );

  const tokens = useMemo(() => tokenize(sentence), [sentence]);

  useEffect(() => {
    let active = true;
    void getMyWordsLanguages()
      .then((langs) => {
        if (!active) return;
        setLanguages(langs);
      })
      .catch(() => {
        // fallback silently
      });
    return () => {
      active = false;
    };
  }, []);

  const onSelectWord = useCallback(
    async (word: string) => {
      setSelectedWord(word);
      setResult(null);
      setError(null);
      setLoading(true);

      try {
        const data = await suggestWordReplacements({
          languageCode,
          sentence: sentence.trim(),
          targetWord: word,
        });
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get replacements.');
      } finally {
        setLoading(false);
      }
    },
    [languageCode, sentence],
  );

  const onCopySuggestion = useCallback(
    async (suggestion: MyWordsWordHelperSuggestion, index: number) => {
      await Clipboard.setStringAsync(suggestion.replacedSentence);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    },
    [],
  );

  const onClearSentence = useCallback(() => {
    setSentence('');
    setSelectedWord(null);
    setResult(null);
    setError(null);
  }, []);

  const groupedSuggestions = useMemo(() => {
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text variant="subheading">Word Helper</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Find the perfect word for your sentence
        </Text>
      </View>

      {/* Sentence Input */}
      <View style={styles.glassCard}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.sentenceInput}
            value={sentence}
            onChangeText={(text) => {
              setSentence(text);
              setSelectedWord(null);
              setResult(null);
              setError(null);
            }}
            placeholder="Paste or type a sentence..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {hasSentence ? (
            <Pressable style={styles.clearButton} onPress={onClearSentence}>
              <Text variant="caption" color={colors.textSecondary}>
                X
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text variant="caption" color={colors.textTertiary} style={styles.charCount}>
          {sentence.length} chars
        </Text>
      </View>

      {/* Word Selector */}
      {hasSentence ? (
        <View style={styles.section}>
          <Text variant="label" color={colors.textSecondary}>
            Tap a word to find replacements:
          </Text>
          <View style={styles.chipGrid}>
            {tokens.map((token, i) => {
              if (!token.tappable) {
                return (
                  <Text key={`token-${i}`} variant="body" color={colors.textSecondary}>
                    {token.text}
                  </Text>
                );
              }
              const isSelected =
                selectedWord !== null &&
                token.text.toLocaleLowerCase() === selectedWord.toLocaleLowerCase();
              return (
                <Pressable
                  key={`token-${i}`}
                  style={[styles.wordChip, isSelected ? styles.wordChipSelected : null]}
                  onPress={() => void onSelectWord(token.text)}
                >
                  <Text
                    variant="body"
                    color={isSelected ? colors.background : colors.text}
                  >
                    {token.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Language Selector */}
      {hasSentence ? (
        <View style={styles.langRow}>
          <Pressable
            style={styles.langPill}
            onPress={() => setShowLangPicker(!showLangPicker)}
          >
            <Text variant="caption" color={colors.text}>
              {selectedLanguage?.name ?? languageCode.toUpperCase()} ({languageCode.toUpperCase()})
            </Text>
          </Pressable>
          <Pressable onPress={() => setShowLangPicker(!showLangPicker)}>
            <Text variant="caption" color={WORDS_ACCENT}>
              change
            </Text>
          </Pressable>
        </View>
      ) : null}

      {showLangPicker ? (
        <View style={styles.glassCard}>
          <View style={styles.chipGrid}>
            {languages.slice(0, 12).map((lang) => {
              const selected = lang.code === languageCode;
              return (
                <Pressable
                  key={lang.code}
                  style={[styles.langChip, selected ? styles.langChipSelected : null]}
                  onPress={() => {
                    setLanguageCode(lang.code);
                    setShowLangPicker(false);
                    setSelectedWord(null);
                    setResult(null);
                  }}
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
          </View>
        </View>
      ) : null}

      {/* Loading */}
      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={WORDS_ACCENT} />
        </View>
      ) : null}

      {/* Error */}
      {error ? (
        <View style={styles.glassCard}>
          <Text variant="caption" color={colors.danger}>
            {error}
          </Text>
        </View>
      ) : null}

      {/* Results */}
      {result && !loading ? (
        <View style={styles.section}>
          {result.suggestions.length === 0 ? (
            <View style={styles.glassCard}>
              <Text variant="body" color={colors.textSecondary}>
                No replacements found for "{result.targetWord}"
              </Text>
            </View>
          ) : (
            <>
              <Text variant="label" color={colors.textSecondary}>
                Replacements for '{result.targetWord}'
              </Text>

              {result.message && languageCode !== 'en' ? (
                <Text variant="caption" color={colors.textTertiary}>
                  {result.message}
                </Text>
              ) : null}

              {groupedSuggestions.high.length > 0 ? (
                <View style={styles.tierGroup}>
                  <View style={styles.tierHeader}>
                    <RelevanceDot relevance="high" />
                    <Text variant="caption" color={colors.success}>
                      High relevance
                    </Text>
                  </View>
                  {groupedSuggestions.high.map((s, i) => (
                    <SuggestionRow
                      key={`high-${i}`}
                      suggestion={s}
                      index={i}
                      copied={copiedIndex === i}
                      onCopy={onCopySuggestion}
                    />
                  ))}
                </View>
              ) : null}

              {groupedSuggestions.medium.length > 0 ? (
                <View style={styles.tierGroup}>
                  <View style={styles.tierHeader}>
                    <RelevanceDot relevance="medium" />
                    <Text variant="caption" color={colors.warning}>
                      Good alternatives
                    </Text>
                  </View>
                  {groupedSuggestions.medium.map((s, i) => {
                    const globalIndex = groupedSuggestions.high.length + i;
                    return (
                      <SuggestionRow
                        key={`med-${i}`}
                        suggestion={s}
                        index={globalIndex}
                        copied={copiedIndex === globalIndex}
                        onCopy={onCopySuggestion}
                      />
                    );
                  })}
                </View>
              ) : null}

              {groupedSuggestions.related.length > 0 ? (
                <View style={styles.tierGroup}>
                  <View style={styles.tierHeader}>
                    <RelevanceDot relevance="related" />
                    <Text variant="caption" color={colors.textTertiary}>
                      Broader suggestions
                    </Text>
                  </View>
                  {groupedSuggestions.related.map((s, i) => {
                    const globalIndex =
                      groupedSuggestions.high.length + groupedSuggestions.medium.length + i;
                    return (
                      <SuggestionRow
                        key={`rel-${i}`}
                        suggestion={s}
                        index={globalIndex}
                        copied={copiedIndex === globalIndex}
                        onCopy={onCopySuggestion}
                      />
                    );
                  })}
                </View>
              ) : null}
            </>
          )}

          {/* Attribution */}
          {result.attributions.length > 0 ? (
            <View style={styles.attributionWrap}>
              {result.attributions.map((attr, i) => (
                <Text key={`attr-${i}`} variant="caption" color={colors.textTertiary}>
                  {attr.name}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Empty state */}
      {!hasSentence ? (
        <View style={styles.emptyWrap}>
          <Text variant="body" color={colors.textSecondary}>
            Type or paste a sentence above, then tap any word to discover better alternatives.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function SuggestionRow({
  suggestion,
  index,
  copied,
  onCopy,
}: {
  suggestion: MyWordsWordHelperSuggestion;
  index: number;
  copied: boolean;
  onCopy: (s: MyWordsWordHelperSuggestion, i: number) => void;
}) {
  return (
    <Pressable
      style={styles.suggestionRow}
      onPress={() => void onCopy(suggestion, index)}
    >
      <View style={styles.suggestionHeader}>
        <Text variant="body" style={styles.boldText}>
          {suggestion.replacement}
        </Text>
        <View style={styles.scoreWrap}>
          <RelevanceDot relevance={suggestion.relevance} />
          <Text variant="caption" color={colors.textTertiary}>
            {suggestion.score > 0 ? suggestion.score.toLocaleString() : '--'}
          </Text>
        </View>
      </View>
      <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
        {suggestion.replacedSentence}
      </Text>
      {copied ? (
        <Text variant="caption" color={colors.success}>
          Copied!
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  headerSection: {
    gap: spacing.xs,
  },
  glassCard: {
    ...glass.card,
    padding: spacing.md,
  },
  inputWrap: {
    position: 'relative',
  },
  sentenceInput: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 88,
    paddingRight: spacing.lg,
    textAlignVertical: 'top',
  },
  clearButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charCount: {
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  wordChip: {
    ...glass.card,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  wordChipSelected: {
    backgroundColor: WORDS_ACCENT,
    borderColor: WORDS_ACCENT,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  langPill: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  langChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  langChipSelected: {
    borderColor: WORDS_ACCENT,
    backgroundColor: WORDS_ACCENT,
  },
  centerWrap: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  tierGroup: {
    gap: spacing.xs,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  suggestionRow: {
    ...glass.card,
    padding: spacing.sm,
    gap: 4,
    minHeight: 44,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boldText: {
    fontWeight: '700',
  },
  scoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  attributionWrap: {
    marginTop: spacing.md,
    gap: 2,
  },
  emptyWrap: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});
