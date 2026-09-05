import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChefHat, ChevronDown, ChevronUp, Play, Plus, Star, Trophy } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import { useDatabase } from '../providers/DatabaseProvider';
import {
  getDemoSubmissionsForDish,
  type DemoDish,
  type DemoSubmission,
  type DishVariant,
} from '../data/demo';
import { loadDishRecord } from '../data/cloud-dishes';
import { getLocalSubmissionsForDish } from '../data/local-submissions';
import { useI18n } from '../i18n/I18nProvider';
import { shouldShowDemoContent } from '../data/public-render-policy';
import { DishIdParam } from '../utils/validation';
import { HealthSummary } from '../components/HealthSummary';
import { NutritionPanel } from '../components/NutritionPanel';
import { getDishNutrition } from '../data/kitchen';
import { BackArrow } from '../components/DirectionalIcons';

export default function DishDetailScreen() {
  const rawParams = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const parsed = DishIdParam.safeParse(rawParams);
  const id = parsed.ok ? parsed.value.id : '';
  useEffect(() => {
    if (!parsed.ok) {
      Alert.alert(t('Invalid dish'), t('This dish link is malformed.'));
      router.replace('/');
    }
  }, [parsed.ok, router]);
  const tc = useThemeColors();
  const theme = useTheme();
  const db = useDatabase();
  const { t, formatNumber } = useI18n();
  const [dish, setDish] = useState<DemoDish | null>(null);
  const [submissions, setSubmissions] = useState<DemoSubmission[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantNative, setNewVariantNative] = useState('');
  const [newVariantDesc, setNewVariantDesc] = useState('');
  const [newVariantTraits, setNewVariantTraits] = useState('');
  const [localVariants, setLocalVariants] = useState<DishVariant[]>([]);
  const [variantsExpanded, setVariantsExpanded] = useState(true);
  const [showNutrition, setShowNutrition] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    // Dish record resolves cloud-first (bc_dishes), demo only when policy allows.
    void loadDishRecord(id ?? '').then(({ dish: found }) => {
      if (cancelled) return;
      setDish(found);
      if (found?.variants) setLocalVariants(found.variants);
    });
    const showDemo = shouldShowDemoContent();
    const demoSubs = showDemo ? getDemoSubmissionsForDish(id ?? '') : [];
    const localSubs = getLocalSubmissionsForDish(db, id ?? '');
    setSubmissions([...localSubs, ...demoSubs]);
    return () => {
      cancelled = true;
    };
  }, [id, db]);

  useEffect(() => load(), [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    setRefreshing(false);
  }, [load]);

  const allVariants = localVariants;
  const nutritionBundle = useMemo(() => {
    if (!dish) return null;
    return getDishNutrition(db, {
      dishId: dish.id,
      title: dish.name,
      submissions: submissions.map((submission) => ({
        id: submission.id,
        title: submission.title,
        ingredients: submission.ingredients,
      })),
    });
  }, [db, dish, submissions]);

  const handleAddVariant = () => {
    if (!newVariantName.trim()) return;
    const variant: DishVariant = {
      id: `${id}-${Date.now()}`,
      name: newVariantName.trim(),
      nativeName: newVariantNative.trim() || undefined,
      description: newVariantDesc.trim() || `A variant of ${dish?.name}`,
      distinguishingTraits: newVariantTraits.split(',').map((t) => t.trim()).filter(Boolean),
      submissionCount: 0,
      tags: [],
    };
    setLocalVariants((prev) => [...prev, variant]);
    setNewVariantName('');
    setNewVariantNative('');
    setNewVariantDesc('');
    setNewVariantTraits('');
    setShowAddVariant(false);
    Alert.alert(
      t('Variant Added'),
      t('"{variantName}" has been added as a sub-type of {dishName}.', {
        variantName: variant.name,
        dishName: dish?.name ?? '',
      }),
    );
  };

  if (!dish) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <BackArrow size={24} color={tc.text} strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('Dish not found')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]} numberOfLines={1}>{dish.name}</Text>
        <Pressable
          onPress={() => router.push({ pathname: '/feed', params: { dishId: dish.id, dishName: dish.name } })}
          hitSlop={12}
        >
          <Play size={20} color={tc.accent} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tc.accent} />}
      >
        <View style={styles.dishHeader}>
          <View style={styles.dishMeta}>
            <Text style={[styles.dishName, { color: tc.text }]}>{dish.name}</Text>
            {dish.nativeName && <Text style={[styles.dishNative, { color: tc.textSecondary }]}>{dish.nativeName}</Text>}
            <View style={styles.tagRow}>
              <View style={[styles.tag, { backgroundColor: `${tc.accent}1F` }]}><Text style={[styles.tagText, { color: tc.accent }]}>{dish.cuisine}</Text></View>
              <View style={[styles.tag, { backgroundColor: `${tc.accent}1F` }]}><Text style={[styles.tagText, { color: tc.accent }]}>{t(dish.category)}</Text></View>
            </View>
          </View>
          <View style={styles.submissionCountBox}>
            <Text style={[styles.submissionCountValue, { color: tc.primaryContainer }]}>{formatNumber(dish.submissionCount)}</Text>
            <Text style={[styles.submissionCountLabel, { color: tc.textTertiary }]}>{t('RECIPES')}</Text>
          </View>
        </View>

        {nutritionBundle ? (
          <>
            <HealthSummary
              detail={nutritionBundle.detail}
              onPressDetails={() => setShowNutrition((value) => !value)}
            />
            {showNutrition ? <NutritionPanel detail={nutritionBundle.detail} /> : null}
          </>
        ) : null}

        <View style={styles.variantSection}>
          <Pressable style={styles.variantHeader} onPress={() => setVariantsExpanded(!variantsExpanded)}>
            <Text style={[styles.sectionTitle, { color: tc.text }]}>
              {t('Sub-types')} {allVariants.length > 0 ? `(${formatNumber(allVariants.length)})` : ''}
            </Text>
            {variantsExpanded
              ? <ChevronUp size={18} color={tc.textSecondary} strokeWidth={2} />
              : <ChevronDown size={18} color={tc.textSecondary} strokeWidth={2} />
            }
          </Pressable>

          {variantsExpanded && (
            <>
              {allVariants.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variantChipRow}>
                  <Pressable
                    style={[styles.variantChip, { backgroundColor: tc.surface }, selectedVariant === null && { backgroundColor: `${tc.accent}24` }]}
                    onPress={() => setSelectedVariant(null)}
                  >
                    <Text style={[styles.variantChipText, { color: tc.textSecondary }, selectedVariant === null && { color: tc.accent }]}>
                      {t('All')}
                    </Text>
                  </Pressable>
                  {allVariants.map((v) => (
                    <Pressable
                      key={v.id}
                      style={[styles.variantChip, { backgroundColor: tc.surface }, selectedVariant === v.id && { backgroundColor: `${tc.accent}24` }]}
                      onPress={() => setSelectedVariant(selectedVariant === v.id ? null : v.id)}
                    >
                      <Text style={[styles.variantChipText, { color: tc.textSecondary }, selectedVariant === v.id && { color: tc.accent }]}>
                        {v.name}
                      </Text>
                      <Text style={[styles.variantChipCount, { color: tc.textTertiary }]}>{formatNumber(v.submissionCount)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {selectedVariant && (() => {
                const v = allVariants.find((vr) => vr.id === selectedVariant);
                if (!v) return null;
                return (
                  <View style={[styles.variantDetail, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
                    <View style={styles.variantDetailHeader}>
                      <Text style={[styles.variantDetailName, { color: tc.text }]}>{v.name}</Text>
                      {v.nativeName && <Text style={[styles.variantDetailNative, { color: tc.textTertiary }]}>{v.nativeName}</Text>}
                    </View>
                    <Text style={[styles.variantDetailDesc, { color: tc.textSecondary }]}>{v.description}</Text>
                    {v.distinguishingTraits.length > 0 && (
                      <View style={styles.traitList}>
                        {v.distinguishingTraits.map((trait, i) => (
                          <View key={i} style={styles.traitRow}>
                            <View style={[styles.traitDot, { backgroundColor: tc.accent }]} />
                            <Text style={[styles.traitText, { color: tc.textSecondary }]}>{trait}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })()}

              {!showAddVariant ? (
                <Pressable style={[styles.addVariantButton, { borderColor: `${tc.accent}4D` }]} onPress={() => setShowAddVariant(true)}>
                  <Plus size={16} color={tc.accent} strokeWidth={2} />
                  <Text style={[styles.addVariantText, { color: tc.accent }]}>{t('Add a sub-type')}</Text>
                </Pressable>
              ) : (
                <View style={[styles.addVariantForm, { backgroundColor: theme.glass.cardFill, borderColor: `${tc.accent}26` }]}>
                  <Text style={[styles.addVariantFormTitle, { color: tc.text }]}>
                    {t('New sub-type of {dishName}', { dishName: dish.name })}
                  </Text>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Name')}</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface }]}
                      placeholder={t('e.g. Tonkotsu, Nigiri, al Pastor')}
                      placeholderTextColor={tc.textTertiary}
                      value={newVariantName}
                      onChangeText={setNewVariantName}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Native Name (optional)')}</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface }]}
                      placeholder={t('Original language name')}
                      placeholderTextColor={tc.textTertiary}
                      value={newVariantNative}
                      onChangeText={setNewVariantNative}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Description')}</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface, minHeight: 60 }]}
                      placeholder={t('What makes this sub-type distinct?')}
                      placeholderTextColor={tc.textTertiary}
                      value={newVariantDesc}
                      onChangeText={setNewVariantDesc}
                      multiline
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: tc.textSecondary }]}>{t('Distinguishing Traits (comma-separated)')}</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: tc.text, backgroundColor: tc.surface }]}
                      placeholder={t('e.g. Creamy broth, Thin noodles, Pork belly')}
                      placeholderTextColor={tc.textTertiary}
                      value={newVariantTraits}
                      onChangeText={setNewVariantTraits}
                    />
                  </View>
                  <View style={styles.addVariantActions}>
                    <Pressable style={[styles.cancelButton, { backgroundColor: tc.surface }]} onPress={() => { setShowAddVariant(false); setNewVariantName(''); }}>
                      <Text style={[styles.cancelButtonText, { color: tc.textSecondary }]}>{t('Cancel')}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.saveVariantButton, { backgroundColor: tc.accent }, !newVariantName.trim() && { opacity: 0.4 }]}
                      disabled={!newVariantName.trim()}
                      onPress={handleAddVariant}
                    >
                      <Text style={[styles.saveVariantText, { color: tc.background }]}>{t('Add Sub-type')}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.submitCta, { backgroundColor: tc.accent }, pressed && { opacity: 0.9 }]}
          onPress={() => router.push({
            pathname: '/submit',
            params: {
              dishId: dish.id,
              dishName: selectedVariant
                ? `${dish.name} (${allVariants.find((v) => v.id === selectedVariant)?.name})`
                : dish.name,
            },
          })}
        >
          <ChefHat size={20} color={tc.background} strokeWidth={2} />
          <Text style={[styles.submitCtaText, { color: tc.background }]}>
            {selectedVariant
              ? t('Submit Your {variantName} Recipe', { variantName: allVariants.find((v) => v.id === selectedVariant)?.name ?? '' })
              : t('Submit Your Recipe')}
          </Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: tc.text }]}>
          {t('Top Recipes')} {submissions.length > 0 ? `(${formatNumber(submissions.length)})` : ''}
        </Text>

        {submissions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            <Trophy size={28} color={tc.textTertiary} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: tc.text }]}>{t('No submissions yet')}</Text>
            <Text style={[styles.emptyMsg, { color: tc.textSecondary }]}>
              {t('Be the first to share your recipe for {dishName}', { dishName: dish.name })}
            </Text>
          </View>
        ) : (
          submissions.map((sub, idx) => (
            <Pressable
              key={sub.id}
              style={({ pressed }) => [styles.submissionCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/recipe/${sub.id}`)}
            >
              <View style={styles.submissionRow}>
                <View style={[styles.rankBadge, { backgroundColor: idx < 3 ? `${tc.primaryContainer}33` : tc.surfaceElevated }]}>
                  <Text style={[styles.rankText, { color: idx < 3 ? tc.primaryContainer : tc.textSecondary }]}>{idx + 1}</Text>
                </View>
                <View style={styles.submissionInfo}>
                  <Text style={[styles.submissionTitle, { color: tc.text }]} numberOfLines={1}>{sub.title}</Text>
                  <Pressable onPress={() => router.push(`/chef/${sub.chefId}`)}>
                    <Text style={[styles.chefName, { color: tc.accent }]}>{t('by {chefName}', { chefName: sub.chefName })}</Text>
                  </Pressable>
                </View>
                {sub.photoVerified && (
                  <View style={[styles.verifiedBadge, { backgroundColor: `${tc.accent}1F` }]}>
                    <Text style={[styles.verifiedText, { color: tc.accent }]}>{t('VERIFIED')}</Text>
                  </View>
                )}
                <View style={styles.scoreBox}>
                  <Star size={12} color={tc.primaryContainer} fill={tc.primaryContainer} strokeWidth={0} />
                  <Text style={[styles.scoreText, { color: tc.primaryContainer }]}>{formatNumber(sub.voteScore)}</Text>
                </View>
              </View>
              <Text style={[styles.submissionDesc, { color: tc.textSecondary }]} numberOfLines={2}>{sub.description}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 56, paddingBottom: 12, gap: 12,
  },
  topBarTitle: { flex: 1, fontFamily: JAKARTA_FONTS.bold, fontSize: 17, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  dishHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  dishMeta: { flex: 1, gap: 4 },
  dishName: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 28, letterSpacing: -0.5 },
  dishNative: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14, fontStyle: 'italic' },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tagText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 11, textTransform: 'capitalize' },
  submissionCountBox: { alignItems: 'center', gap: 2 },
  submissionCountValue: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 28 },
  submissionCountLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 9, letterSpacing: 1 },

  variantSection: { gap: 12 },
  variantHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  variantChipRow: { gap: 8 },
  variantChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  variantChipText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 12 },
  variantChipCount: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10 },

  variantDetail: {
    borderRadius: 18, padding: 16, gap: 8, borderWidth: 1,
  },
  variantDetailHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  variantDetailName: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  variantDetailNative: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, fontStyle: 'italic' },
  variantDetailDesc: { fontFamily: JAKARTA_FONTS.regular, fontSize: 13, lineHeight: 19 },
  traitList: { gap: 4, marginTop: 4 },
  traitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  traitDot: { width: 5, height: 5, borderRadius: 3 },
  traitText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },

  addVariantButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
  },
  addVariantText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },

  addVariantForm: {
    borderRadius: 20, padding: 20, gap: 14, borderWidth: 1,
  },
  addVariantFormTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 1.4 },
  fieldInput: {
    fontFamily: JAKARTA_FONTS.regular, fontSize: 14,
    borderRadius: 12, padding: 12, textAlignVertical: 'top',
  },
  addVariantActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 999 },
  cancelButtonText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },
  saveVariantButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 999 },
  saveVariantText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },

  submitCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 999, paddingVertical: 16,
  },
  submitCtaText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },

  sectionTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 18 },

  emptyCard: {
    borderRadius: 20, padding: 32,
    alignItems: 'center', gap: 8, borderWidth: 1,
  },
  emptyTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  emptyMsg: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, textAlign: 'center' },

  submissionCard: {
    borderRadius: 18, padding: 16, gap: 10, borderWidth: 1,
  },
  submissionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankBadge: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  rankText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
  submissionInfo: { flex: 1, gap: 2 },
  submissionTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 15 },
  chefName: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  verifiedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  verifiedText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 8, letterSpacing: 0.5 },
  scoreBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scoreText: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 16 },
  submissionDesc: { fontFamily: JAKARTA_FONTS.regular, fontSize: 13, lineHeight: 19 },
});
