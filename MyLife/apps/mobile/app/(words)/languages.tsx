import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  browseWordsAlphabetically,
  getMyWordsLanguages,
  type MyWordsLanguage,
} from '@mylife/words';
import { Text, colors, spacing, glass } from '@mylife/ui';

const WORDS_ACCENT = colors.modules.words;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function LanguagesScreen() {
  const router = useRouter();
  const [languages, setLanguages] = useState<MyWordsLanguage[]>([]);
  const [search, setSearch] = useState('');
  const [defaultLangCode, setDefaultLangCode] = useState('en');
  const [loadingLangs, setLoadingLangs] = useState(true);

  // Alphabetical browse modal state
  const [browseLetter, setBrowseLetter] = useState<string | null>(null);
  const [browseWords, setBrowseWords] = useState<string[]>([]);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void getMyWordsLanguages()
      .then((langs) => {
        if (!active) return;
        setLanguages(langs);
      })
      .catch(() => {
        // fallback silently
      })
      .finally(() => {
        if (active) setLoadingLangs(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const defaultLanguage = useMemo(
    () => languages.find((lang) => lang.code === defaultLangCode),
    [languages, defaultLangCode],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return languages;
    const q = search.trim().toLocaleLowerCase();
    return languages.filter(
      (lang) =>
        lang.name.toLocaleLowerCase().includes(q) ||
        lang.code.toLocaleLowerCase().includes(q),
    );
  }, [languages, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => b.words - a.words);
  }, [filtered]);

  const onSelectDefault = useCallback(
    async (code: string) => {
      setDefaultLangCode(code);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [],
  );

  const onOpenLetter = useCallback(async (letter: string) => {
    setBrowseLetter(letter);
    setBrowseWords([]);
    setBrowsePage(1);
    setBrowseTotal(0);
    setBrowseLoading(true);

    try {
      const result = await browseWordsAlphabetically({
        languageCode: 'en',
        letter,
        page: 1,
        pageSize: 60,
      });
      setBrowseWords(result.words);
      setBrowseTotal(result.total);
    } catch {
      // fallback
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const onLoadMore = useCallback(async () => {
    if (!browseLetter || browseLoading) return;
    const nextPage = browsePage + 1;
    setBrowseLoading(true);

    try {
      const result = await browseWordsAlphabetically({
        languageCode: 'en',
        letter: browseLetter,
        page: nextPage,
        pageSize: 60,
      });
      setBrowseWords((prev) => [...prev, ...result.words]);
      setBrowsePage(nextPage);
    } catch {
      // fallback
    } finally {
      setBrowseLoading(false);
    }
  }, [browseLetter, browsePage, browseLoading]);

  const onWordPress = useCallback(
    (word: string) => {
      setBrowseLetter(null);
      router.push({ pathname: '/(words)/word/[id]', params: { id: word } });
    },
    [router],
  );

  const hasMore = browseWords.length < browseTotal;

  const renderLanguageItem = useCallback(
    ({ item }: { item: MyWordsLanguage }) => {
      const isDefault = item.code === defaultLangCode;
      return (
        <Pressable
          style={styles.langRow}
          onPress={() => void onSelectDefault(item.code)}
        >
          <View style={styles.langInfo}>
            <View style={styles.langNameRow}>
              <Text variant="body">{item.name}</Text>
              <View style={styles.codeBadge}>
                <Text variant="caption" color={colors.textSecondary}>
                  {item.code.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.langRight}>
            <Text variant="caption" color={colors.textSecondary}>
              {item.words.toLocaleString()} words
            </Text>
            {isDefault ? (
              <Text variant="caption" color={WORDS_ACCENT}>
                {'\u2713'}
              </Text>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [defaultLangCode, onSelectDefault],
  );

  const ListHeader = useMemo(
    () => (
      <View style={styles.headerContainer}>
        {/* Search Bar */}
        <View style={styles.glassCard}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or code..."
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Default Language Card */}
        {defaultLanguage ? (
          <View style={styles.glassStrong}>
            <Text variant="label" color={colors.textSecondary}>
              Default Language
            </Text>
            <View style={styles.defaultLangRow}>
              <Text variant="subheading">{defaultLanguage.name}</Text>
              <View style={styles.codeBadge}>
                <Text variant="caption" color={colors.textSecondary}>
                  {defaultLanguage.code.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text variant="caption" color={colors.textSecondary}>
              {defaultLanguage.words.toLocaleString()} words
            </Text>
          </View>
        ) : null}
      </View>
    ),
    [search, defaultLanguage],
  );

  const ListFooter = useMemo(
    () => (
      <View style={styles.footerContainer}>
        {/* Alphabetical Browse (English only) */}
        <View style={styles.section}>
          <Text variant="subheading">Browse English Dictionary</Text>
          <View style={styles.letterGrid}>
            {LETTERS.map((letter) => (
              <Pressable
                key={letter}
                style={styles.letterCard}
                onPress={() => void onOpenLetter(letter)}
              >
                <Text variant="heading" color={WORDS_ACCENT}>
                  {letter}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text variant="caption" color={colors.textTertiary}>
            Only English supports alphabetical browsing
          </Text>
        </View>
      </View>
    ),
    [onOpenLetter],
  );

  return (
    <View style={styles.screen}>
      {loadingLangs ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={WORDS_ACCENT} />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.code}
          renderItem={renderLanguageItem}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Alphabetical Browse Modal */}
      <Modal
        visible={browseLetter !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBrowseLetter(null)}
      >
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text variant="subheading">
              Words starting with "{browseLetter}"
            </Text>
            <Pressable onPress={() => setBrowseLetter(null)}>
              <Text variant="label" color={WORDS_ACCENT}>
                Done
              </Text>
            </Pressable>
          </View>

          {browseLoading && browseWords.length === 0 ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator color={WORDS_ACCENT} />
            </View>
          ) : (
            <FlatList
              data={browseWords}
              keyExtractor={(item, idx) => `${item}-${idx}`}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.browseWordRow}
                  onPress={() => onWordPress(item)}
                >
                  <Text variant="body">{item}</Text>
                </Pressable>
              )}
              contentContainerStyle={styles.modalListContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListFooterComponent={
                hasMore ? (
                  <Pressable
                    style={styles.loadMoreButton}
                    onPress={() => void onLoadMore()}
                  >
                    {browseLoading ? (
                      <ActivityIndicator color={WORDS_ACCENT} size="small" />
                    ) : (
                      <Text variant="label" color={WORDS_ACCENT}>
                        Load More
                      </Text>
                    )}
                  </Pressable>
                ) : null
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  headerContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  footerContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  glassCard: {
    ...glass.card,
    padding: spacing.sm,
  },
  glassStrong: {
    ...glass.strong,
    padding: spacing.md,
    gap: spacing.xs,
  },
  searchInput: {
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  defaultLangRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  langInfo: {
    flex: 1,
  },
  langNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  langRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  section: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  letterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  letterCard: {
    ...glass.card,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal styles
  modalScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalListContent: {
    paddingBottom: spacing.xxl,
  },
  browseWordRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
});
