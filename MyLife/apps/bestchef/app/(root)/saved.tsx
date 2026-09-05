/**
 * Saved recipes (plan 33 Phase 5.6, F-010): the viewing surface for cloud
 * bookmarks. Cloud truth reconciles into the local cache on load; offline
 * the cached ids render as navigable rows.
 */

import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bookmark } from 'lucide-react-native';
import { JAKARTA_FONTS, type SavedSubmissionSummary } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { useBestChefCloud } from './providers/BestChefCloudProvider';
import { useDatabase } from './providers/DatabaseProvider';
import { useI18n } from './i18n/I18nProvider';
import { BackArrow } from './components/DirectionalIcons';
import { loadSavedSubmissions, toggleSaved } from './data/saved-submissions';

export default function SavedScreen() {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const db = useDatabase();
  const cloud = useBestChefCloud();

  const [items, setItems] = useState<SavedSubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await loadSavedSubmissions(db, cloud);
    setItems(result.items);
  }, [cloud, db]);

  useEffect(() => {
    let cancelled = false;
    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [load]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  const handleUnsave = useCallback((submissionId: string) => {
    setItems((current) => current.filter((item) => item.submissionId !== submissionId));
    void toggleSaved(db, submissionId, cloud).catch(() => {});
  }, [cloud, db]);

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Saved Recipes')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? null : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Bookmark size={32} color={tc.textTertiary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('No saved recipes yet')}</Text>
          <Text style={[styles.emptyMessage, { color: tc.textSecondary }]}>
            {t('Tap the bookmark on any recipe or video to keep it here.')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.submissionId}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tc.accent} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.submissionId } })}
              accessibilityRole="button"
            >
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: tc.surface }]}>
                  <Bookmark size={18} color={tc.textTertiary} strokeWidth={2} />
                </View>
              )}
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: tc.text }]} numberOfLines={1}>
                  {item.title ?? item.dishName ?? t('Saved recipe')}
                </Text>
                <Text style={[styles.rowMeta, { color: tc.textSecondary }]} numberOfLines={1}>
                  {item.chefHandle ? `@${item.chefHandle}` : ''}
                  {item.chefHandle && item.dishName ? ' · ' : ''}
                  {item.dishName ?? ''}
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() => handleUnsave(item.submissionId)}
                accessibilityRole="button"
                accessibilityLabel={t('Remove from saved')}
              >
                <Bookmark size={20} color="#F5C451" fill="#F5C451" strokeWidth={2} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 16,
  },
  topBarTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 17 },
  list: { paddingHorizontal: 20, paddingBottom: 48, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },
  rowMeta: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40, paddingBottom: 80 },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  emptyMessage: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center' },
});
