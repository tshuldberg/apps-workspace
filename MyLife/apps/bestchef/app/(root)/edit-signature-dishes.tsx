import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, ChefHat } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Text } from '@mylife/ui';
import {
  JAKARTA_FONTS,
  RECIPES_TYPOGRAPHY,
  SIGNATURE_DISHES_MAX,
  getChefSubmissions,
  getSignatureDishes,
  setSignatureDishes,
  type Submission,
} from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { useBestChefCloud } from './providers/BestChefCloudProvider';
import { useI18n } from './i18n/I18nProvider';
import { BackArrow } from './components/DirectionalIcons';

export default function EditSignatureDishesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const theme = useTheme();
  const cloud = useBestChefCloud();
  const { t } = useI18n();

  const profileId = cloud.profile?.id ?? null;

  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Load submissions + current signatures.
  useEffect(() => {
    let cancelled = false;
    if (!cloud.supabase || !profileId) {
      setSubmissions([]);
      return () => {
        cancelled = true;
      };
    }
    void Promise.all([
      getChefSubmissions(profileId, { limit: 200, sortBy: 'vote_score' }),
      getSignatureDishes(cloud.supabase, { chefId: profileId }),
    ])
      .then(([subResult, sigResult]) => {
        if (cancelled) return;
        setSubmissions(subResult.ok ? subResult.data : []);
        if (sigResult.ok) {
          setSelectedIds(sigResult.data.map((d) => d.submissionId));
        }
      })
      .catch(() => {
        if (!cancelled) setSubmissions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cloud.supabase, profileId]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((x) => x !== id);
      }
      if (current.length >= SIGNATURE_DISHES_MAX) {
        return current; // Soft cap; show a toast/Alert below.
      }
      return [...current, id];
    });
  }, []);

  const onPressItem = useCallback(
    (id: string) => {
      const isSelected = selectedIds.includes(id);
      if (!isSelected && selectedIds.length >= SIGNATURE_DISHES_MAX) {
        Alert.alert(t('profile_pick_up_to_three'));
        return;
      }
      toggle(id);
    },
    [selectedIds, toggle, t],
  );

  const handleSave = useCallback(async () => {
    if (!cloud.supabase || saving) return;
    setSaving(true);
    const result = await setSignatureDishes(cloud.supabase, { submissionIds: selectedIds });
    setSaving(false);
    if (!result.ok) {
      Alert.alert(t('Update Failed'), result.error);
      return;
    }
    router.back();
  }, [cloud.supabase, router, saving, selectedIds, t]);

  const remaining = useMemo(
    () => Math.max(0, SIGNATURE_DISHES_MAX - selectedIds.length),
    [selectedIds.length],
  );

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={t('Back')}
        >
          <BackArrow size={20} color={tc.text} strokeWidth={2} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: tc.text }]}>
            {t('profile_edit_signature_dishes')}
          </Text>
          <Text style={[styles.subtitle, { color: tc.textSecondary }]}>
            {t('profile_pick_up_to_three')}
          </Text>
        </View>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: tc.accent },
            (saving || pressed) && { opacity: 0.6 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Save')}
        >
          <Text style={[styles.saveBtnText, { color: tc.background }]}>
            {saving ? t('Saving...') : t('Save')}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.counterBar, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
        <Text style={[styles.counterText, { color: tc.textSecondary }]}>
          {t('{count} selected', { count: selectedIds.length.toString() })}
          {`  ·  `}
          {t('{count} remaining', { count: remaining.toString() })}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {submissions === null ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('Loading')}</Text>
          </View>
        ) : submissions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <ChefHat size={32} color={tc.textTertiary} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: tc.text }]}>
              {t('profile_no_signatures_yet')}
            </Text>
            <Text style={[styles.emptyMessage, { color: tc.textSecondary }]}>
              {t('Submit a recipe to pick a signature dish.')}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {submissions.map((sub) => {
              const selected = selectedIds.includes(sub.id);
              return (
                <Pressable
                  key={sub.id}
                  onPress={() => onPressItem(sub.id)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: theme.glass.cardFill,
                      borderColor: selected ? tc.accent : theme.glass.cardBorder,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <View style={[styles.thumb, { backgroundColor: tc.surface }]}>
                    {sub.photoUrl ? (
                      <Image source={{ uri: sub.photoUrl }} style={styles.thumbImage} contentFit="cover" />
                    ) : (
                      <ChefHat size={20} color={tc.accent} strokeWidth={1.8} />
                    )}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, { color: tc.text }]} numberOfLines={1}>
                      {sub.dishId}
                    </Text>
                    <Text style={[styles.rowMeta, { color: tc.textSecondary }]} numberOfLines={1}>
                      {`${Math.round(sub.voteScore)} ↑${sub.rank != null ? `  ·  #${sub.rank}` : ''}`}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: selected ? tc.accent : 'transparent',
                        borderColor: selected ? tc.accent : tc.border,
                      },
                    ]}
                  >
                    {selected && <Check size={14} color={tc.background} strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, gap: 2 },
  title: { ...RECIPES_TYPOGRAPHY.headlineMd },
  subtitle: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  saveBtnText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },

  counterBar: {
    marginHorizontal: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  counterText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },

  content: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: '100%', height: '100%' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  rowMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16, marginTop: 4 },
  emptyMessage: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center' },
});
