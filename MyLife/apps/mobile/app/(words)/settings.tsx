import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  clearCache,
  evictStaleEntries,
  getCacheStats,
  getMyWordsLanguages,
  getSavedWordCount,
  getSavedWordCountByLanguage,
  getWordLists,
  type CacheStats,
  type MyWordsLanguage,
} from '@mylife/words';
import { Text, colors, spacing, glass } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const WORDS_ACCENT = colors.modules.words;

export default function SettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [languages, setLanguages] = useState<MyWordsLanguage[]>([]);
  const [defaultLangCode, _setDefaultLangCode] = useState('en');
  const [cacheStats, setCacheStats] = useState<CacheStats>({ wordCount: 0, totalSizeBytes: 0 });
  const [savedCount, setSavedCount] = useState(0);
  const [listsCount, setListsCount] = useState(0);
  const [langBreakdown, setLangBreakdown] = useState<Array<{ languageCode: string; count: number }>>([]);

  const defaultLanguage = useMemo(
    () => languages.find((lang) => lang.code === defaultLangCode),
    [languages, defaultLangCode],
  );

  const cacheMb = useMemo(
    () => (cacheStats.totalSizeBytes / 1024 / 1024).toFixed(1) + ' MB',
    [cacheStats.totalSizeBytes],
  );

  const refreshStats = useCallback(() => {
    try {
      setCacheStats(getCacheStats(db));
      setSavedCount(getSavedWordCount(db));
      setListsCount(getWordLists(db).length);
      setLangBreakdown(getSavedWordCountByLanguage(db));
    } catch {
      // silently handle if tables don't exist yet
    }
  }, [db]);

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

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const onClearCache = useCallback(() => {
    Alert.alert(
      'Clear Cache',
      'Clear all cached lookups? Saved words are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearCache(db);
            refreshStats();
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ],
    );
  }, [db, refreshStats]);

  const onEvictStale = useCallback(async () => {
    const removed = evictStaleEntries(db, 30);
    refreshStats();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Done', `Removed ${removed} stale ${removed === 1 ? 'entry' : 'entries'}.`);
  }, [db, refreshStats]);

  const langNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const lang of languages) {
      map.set(lang.code, lang.name);
    }
    return map;
  }, [languages]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Default Language */}
      <Pressable
        style={styles.glassCard}
        onPress={() => router.push('/(words)/languages')}
      >
        <Text variant="label" color={colors.textSecondary}>
          Default Language
        </Text>
        <View style={styles.langRow}>
          <Text variant="subheading">
            {defaultLanguage?.name ?? 'English'}
          </Text>
          <View style={styles.codeBadge}>
            <Text variant="caption" color={colors.textSecondary}>
              {defaultLangCode.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text variant="caption" color={colors.textTertiary}>
          Used for all new lookups unless you change it
        </Text>
      </Pressable>

      {/* Offline Cache */}
      <View style={styles.glassCard}>
        <Text variant="label" color={colors.textSecondary}>
          Offline Cache
        </Text>
        <View style={styles.statsRow}>
          <Text variant="body">
            {cacheStats.wordCount.toLocaleString()} words cached
          </Text>
          <Text variant="body" color={colors.textSecondary}>
            {cacheMb} used
          </Text>
        </View>
        <Text variant="caption" color={colors.textTertiary}>
          50 MB max (LRU eviction)
        </Text>

        <View style={styles.buttonGroup}>
          <Pressable style={styles.dangerOutlineButton} onPress={onClearCache}>
            <Text variant="label" color={colors.danger}>
              Clear Cache
            </Text>
          </Pressable>
          <Pressable
            style={styles.outlineButton}
            onPress={() => void onEvictStale()}
          >
            <Text variant="label" color={colors.text}>
              Remove Stale Entries
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Flash Bridge */}
      <View style={styles.glassCard}>
        <Text variant="label" color={colors.textSecondary}>
          Flashcard Integration
        </Text>
        <Text variant="body" color={colors.textSecondary}>
          Flash module coming soon
        </Text>
      </View>

      {/* Saved Words Stats */}
      <View style={styles.glassCard}>
        <Text variant="label" color={colors.textSecondary}>
          Saved Words
        </Text>
        <View style={styles.statLine}>
          <Text variant="body">Total saved</Text>
          <Text variant="body" color={WORDS_ACCENT}>
            {savedCount.toLocaleString()}
          </Text>
        </View>
        <View style={styles.statLine}>
          <Text variant="body">Word lists</Text>
          <Text variant="body" color={WORDS_ACCENT}>
            {listsCount}
          </Text>
        </View>
        {langBreakdown.length > 0 ? (
          <View style={styles.breakdownWrap}>
            <Text variant="caption" color={colors.textSecondary}>
              By language:
            </Text>
            {langBreakdown.map((entry) => (
              <View key={entry.languageCode} style={styles.breakdownRow}>
                <Text variant="caption" color={colors.textSecondary}>
                  {langNameMap.get(entry.languageCode) ?? entry.languageCode.toUpperCase()}
                </Text>
                <Text variant="caption" color={colors.textTertiary}>
                  {entry.count.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* About */}
      <View style={styles.glassCard}>
        <Text variant="caption" color={colors.textSecondary}>
          MyWords v0.2.0
        </Text>
        <Text variant="caption" color={colors.textTertiary}>
          Free Dictionary API, Datamuse API, Wiktionary API
        </Text>
        <Text variant="caption" color={colors.textTertiary}>
          Dictionary and thesaurus content is provided by third-party APIs under their respective licenses. Word definitions sourced from Wiktionary under CC BY-SA 4.0.
        </Text>
      </View>
    </ScrollView>
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
  glassCard: {
    ...glass.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  langRow: {
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dangerOutlineButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownWrap: {
    marginTop: spacing.xs,
    gap: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: spacing.sm,
  },
});
