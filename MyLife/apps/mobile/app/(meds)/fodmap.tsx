import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import {
  createFoodDiaryEntry,
  createStoolLog,
  deleteFoodDiaryEntry,
  deleteStoolLog,
  getFoodDiary,
  getFodmapFoods,
  getFodmapInsights,
  getStoolLogs,
  searchFodmapFoods,
  type FODMAPFood,
  type FoodMealType,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { ErrorState } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const MEAL_TYPES: FoodMealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const FODMAP_META = {
  low: { label: 'Safe', color: '#30D158' },
  moderate: { label: 'Caution', color: '#FFB877' },
  high: { label: 'High', color: '#FF453A' },
  unknown: { label: 'Unknown', color: '#9F8E81' },
} as const;

const BRISTOL_OPTIONS = [
  { value: 1, label: 'Hard lumps', tone: '#FF453A' },
  { value: 2, label: 'Lumpy sausage', tone: '#FF7A59' },
  { value: 3, label: 'Cracked sausage', tone: '#FFB877' },
  { value: 4, label: 'Ideal', tone: MD_ACCENT_LIGHT },
  { value: 5, label: 'Soft blobs', tone: '#8BCFF0' },
  { value: 6, label: 'Mushy', tone: '#7AD7F0' },
  { value: 7, label: 'Liquid', tone: '#5ABBD7' },
] as const;

function BristolGlyph({ type, color }: { type: number; color: string }) {
  if (type === 1) {
    return (
      <View style={styles.glyphRow}>
        {[0, 1, 2].map((item) => (
          <View key={item} style={[styles.glyphDot, { backgroundColor: color }]} />
        ))}
      </View>
    );
  }

  if (type === 2) {
    return (
      <View style={styles.glyphColumn}>
        <View style={[styles.glyphDot, { backgroundColor: color }]} />
        <View style={[styles.glyphCapsuleShort, { backgroundColor: color }]} />
      </View>
    );
  }

  if (type === 3) {
    return <View style={[styles.glyphCapsuleMedium, { backgroundColor: color }]} />;
  }

  if (type === 4) {
    return <View style={[styles.glyphCapsuleLong, { backgroundColor: color }]} />;
  }

  if (type === 5) {
    return (
      <View style={styles.glyphRow}>
        {[0, 1].map((item) => (
          <View key={item} style={[styles.glyphBlob, { backgroundColor: color }]} />
        ))}
      </View>
    );
  }

  if (type === 6) {
    return (
      <View style={styles.glyphColumn}>
        <View style={[styles.glyphBlobWide, { backgroundColor: color }]} />
        <View style={[styles.glyphBlobWide, { backgroundColor: color, opacity: 0.75 }]} />
      </View>
    );
  }

  return (
    <View style={styles.glyphRow}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={[styles.glyphDrop, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

function SmallPill({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: active ? withAlpha(color, 0.18) : MD_SURFACES.high,
        },
      ]}
    >
      <RNText
        style={[
          styles.pillText,
          { color: active ? color : MD_TEXT_SECONDARY },
        ]}
      >
        {label}
      </RNText>
    </Pressable>
  );
}

export default function FodmapScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [foodQuery, setFoodQuery] = useState('');
  const [mealType, setMealType] = useState<FoodMealType>('dinner');
  const [portionSize, setPortionSize] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [selectedBristol, setSelectedBristol] = useState(4);
  const [urgency, setUrgency] = useState(2);
  const [painLevel, setPainLevel] = useState(0);
  const [hasBlood, setHasBlood] = useState(false);

  const data = useMemo(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const diary = getFoodDiary(db, { limit: 30 });
      const stoolLogs = getStoolLogs(db, { limit: 14 });
      return {
        error: null,
        guide: {
          low: getFodmapFoods(db, { rating: 'low', limit: 5 }),
          moderate: getFodmapFoods(db, { rating: 'moderate', limit: 5 }),
          high: getFodmapFoods(db, { rating: 'high', limit: 5 }),
        },
        insights: getFodmapInsights(db),
        searchResults: foodQuery.trim() ? searchFodmapFoods(db, foodQuery, 8) : [],
        todayDiary: diary.filter((entry) => entry.eatenAt.startsWith(today)),
        todayStools: stoolLogs.filter((entry) => entry.loggedAt.startsWith(today)),
      };
    } catch {
      return {
        error: 'Failed to load digestive tracking.',
        guide: { low: [], moderate: [], high: [] },
        insights: null,
        searchResults: [] as FODMAPFood[],
        todayDiary: [],
        todayStools: [],
      };
    }
  }, [db, foodQuery, tick]);

  const refresh = () => setTick((value) => value + 1);

  const handleAddFood = (name?: string) => {
    const foodItems = (name ?? foodQuery).trim();
    if (!foodItems) {
      return;
    }

    try {
      createFoodDiaryEntry(db, {
        mealType,
        foodItems,
        portionSize: portionSize.trim() || undefined,
      });
      setFoodQuery('');
      setPortionSize('');
      refresh();
    } catch {
      Alert.alert('Unable to save meal', 'Please try again.');
    }
  };

  const handleDeleteFood = (entryId: string) => {
    Alert.alert('Delete meal entry', 'Remove this meal from today’s diary?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteFoodDiaryEntry(db, entryId);
          refresh();
        },
      },
    ]);
  };

  const handleLogStool = () => {
    try {
      createStoolLog(db, {
        bristolType: selectedBristol,
        urgency,
        painLevel,
        blood: hasBlood,
      });
      setSelectedBristol(4);
      setUrgency(2);
      setPainLevel(0);
      setHasBlood(false);
      refresh();
    } catch {
      Alert.alert('Unable to save stool log', 'Please try again.');
    }
  };

  const handleDeleteStool = (logId: string) => {
    Alert.alert('Delete stool log', 'Remove this digestive log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteStoolLog(db, logId);
          refresh();
        },
      },
    ]);
  };

  if (data.error || !data.insights) {
    return (
      <View style={styles.errorShell}>
        <ErrorState message={data.error ?? 'Failed to load FODMAP tracker.'} onRetry={refresh} />
      </View>
    );
  }

  const loadMeta = {
    safe: { color: '#30D158', eyebrow: 'Balanced day' },
    caution: { color: '#FFB877', eyebrow: 'Watch your intake' },
    high: { color: '#FF453A', eyebrow: 'Potential flare risk' },
  }[data.insights.todayLoad.tone];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCopy}>
        <RNText style={styles.eyebrow}>Digestive Insight</RNText>
        <RNText style={styles.heroTitle}>FODMAP</RNText>
        <RNText style={styles.heroBody}>
          Track meals, stool quality, and symptom patterns without leaving the
          MyMeds command surface.
        </RNText>
      </View>

      <GlassCard padding={20} style={styles.loadCard}>
        <View style={styles.loadHeader}>
          <View>
            <RNText style={[styles.metricEyebrow, { color: loadMeta.color }]}>
              {loadMeta.eyebrow}
            </RNText>
            <RNText style={styles.metricValue}>
              {data.insights.todayLoad.label}
            </RNText>
          </View>
          <View
            style={[
              styles.loadBadge,
              { backgroundColor: withAlpha(loadMeta.color, 0.14) },
            ]}
          >
            <MaterialSymbol color={loadMeta.color} name="restaurant_menu" size={18} />
            <RNText style={[styles.loadBadgeText, { color: loadMeta.color }]}>
              {data.insights.todayLoad.mealCount} meals
            </RNText>
          </View>
        </View>

        <View style={styles.loadStatsRow}>
          <View style={styles.loadStat}>
            <RNText style={styles.loadStatNumber}>
              {data.insights.todayLoad.lowCount}
            </RNText>
            <RNText style={styles.loadStatLabel}>Safe</RNText>
          </View>
          <View style={styles.loadStat}>
            <RNText style={styles.loadStatNumber}>
              {data.insights.todayLoad.moderateCount}
            </RNText>
            <RNText style={styles.loadStatLabel}>Caution</RNText>
          </View>
          <View style={styles.loadStat}>
            <RNText style={styles.loadStatNumber}>
              {data.insights.todayLoad.highCount}
            </RNText>
            <RNText style={styles.loadStatLabel}>High</RNText>
          </View>
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader title="Food Search + Add" />
        <View style={styles.formStack}>
          <TextInput
            onChangeText={setFoodQuery}
            placeholder="Search Monash-style food names"
            placeholderTextColor={MD_TEXT_TERTIARY}
            style={styles.input}
            value={foodQuery}
          />
          <TextInput
            onChangeText={setPortionSize}
            placeholder="Serving or portion"
            placeholderTextColor={MD_TEXT_TERTIARY}
            style={styles.input}
            value={portionSize}
          />
          <View style={styles.pillRow}>
            {MEAL_TYPES.map((type) => (
              <SmallPill
                key={type}
                active={mealType === type}
                color={MD_ACCENT_LIGHT}
                label={type.replace('_', ' ')}
                onPress={() => setMealType(type)}
              />
            ))}
          </View>

          {data.searchResults.length > 0 ? (
            <View style={styles.searchList}>
              {data.searchResults.map((food) => {
                const meta = FODMAP_META[food.fodmapRating];
                return (
                  <Pressable
                    key={food.id}
                    onPress={() => handleAddFood(food.name)}
                    style={styles.searchRow}
                  >
                    <View style={styles.searchCopy}>
                      <RNText style={styles.searchTitle}>{food.name}</RNText>
                      <RNText style={styles.searchMeta}>
                        {food.category.replace('_', ' ')}
                        {food.servingSize ? ` • ${food.servingSize}` : ''}
                      </RNText>
                    </View>
                    <View
                      style={[
                        styles.ratingPill,
                        { backgroundColor: withAlpha(meta.color, 0.16) },
                      ]}
                    >
                      <RNText style={[styles.ratingPillText, { color: meta.color }]}>
                        {meta.label}
                      </RNText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : foodQuery.trim() ? (
            <Pressable onPress={() => handleAddFood()} style={styles.customAddRow}>
              <View>
                <RNText style={styles.searchTitle}>Add custom meal</RNText>
                <RNText style={styles.searchMeta}>
                  Saves as {mealType}. FODMAP load will be inferred if possible.
                </RNText>
              </View>
              <MaterialSymbol color={MD_ACCENT_LIGHT} name="add" size={22} />
            </Pressable>
          ) : null}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader title="Food Diary" />
        <View style={styles.sectionList}>
          {data.todayDiary.length === 0 ? (
            <RNText style={styles.emptyCopy}>
              No meals logged today. Add your first meal above to start building
              trigger correlations.
            </RNText>
          ) : (
            data.todayDiary.map((entry) => {
              const meta = FODMAP_META[entry.fodmapRating];
              return (
                <View key={entry.id} style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: meta.color }]} />
                  <View style={styles.timelineCard}>
                    <View style={styles.timelineHeader}>
                      <View style={styles.searchCopy}>
                        <RNText style={styles.searchTitle}>{entry.foodItems}</RNText>
                        <RNText style={styles.searchMeta}>
                          {entry.mealType} • {new Date(entry.eatenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </RNText>
                      </View>
                      <Pressable onPress={() => handleDeleteFood(entry.id)}>
                        <MaterialSymbol color={MD_TEXT_TERTIARY} name="delete" size={18} />
                      </Pressable>
                    </View>
                    <View style={styles.pillRow}>
                      <View
                        style={[
                          styles.ratingPill,
                          { backgroundColor: withAlpha(meta.color, 0.16) },
                        ]}
                      >
                        <RNText style={[styles.ratingPillText, { color: meta.color }]}>
                          {meta.label}
                        </RNText>
                      </View>
                      {entry.portionSize ? (
                        <SmallPill color={MD_TEXT_SECONDARY} label={entry.portionSize} />
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader
          action={
            <Pressable onPress={handleLogStool} style={styles.primaryAction}>
              <MaterialSymbol color="#001F2A" name="check" size={18} />
              <RNText style={styles.primaryActionText}>Quick log</RNText>
            </Pressable>
          }
          title="Stool Log"
        />

        <View style={styles.bristolGrid}>
          {BRISTOL_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setSelectedBristol(option.value)}
              style={[
                styles.bristolCard,
                selectedBristol === option.value
                  ? { backgroundColor: withAlpha(option.tone, 0.16) }
                  : null,
              ]}
            >
              <BristolGlyph color={option.tone} type={option.value} />
              <RNText style={styles.bristolNumber}>Type {option.value}</RNText>
              <RNText style={styles.bristolLabel}>{option.label}</RNText>
            </Pressable>
          ))}
        </View>

        <View style={styles.inlineControls}>
          <View style={styles.sliderLike}>
            <RNText style={styles.controlLabel}>Urgency</RNText>
            <View style={styles.pillRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <SmallPill
                  key={value}
                  active={urgency === value}
                  color={MD_ACCENT_LIGHT}
                  label={String(value)}
                  onPress={() => setUrgency(value)}
                />
              ))}
            </View>
          </View>
          <View style={styles.sliderLike}>
            <RNText style={styles.controlLabel}>Pain</RNText>
            <View style={styles.pillRow}>
              {[0, 1, 2, 3, 4, 5].map((value) => (
                <SmallPill
                  key={value}
                  active={painLevel === value}
                  color="#FFB877"
                  label={String(value)}
                  onPress={() => setPainLevel(value)}
                />
              ))}
            </View>
          </View>
          <Pressable onPress={() => setHasBlood((value) => !value)} style={styles.booleanRow}>
            <MaterialSymbol
              color={hasBlood ? '#FF453A' : MD_TEXT_TERTIARY}
              filled={hasBlood}
              name={hasBlood ? 'check_circle' : 'favorite'}
              size={18}
            />
            <RNText style={styles.booleanCopy}>Visible blood</RNText>
          </Pressable>
        </View>

        {data.todayStools.length > 0 ? (
          <View style={styles.sectionList}>
            {data.todayStools.map((entry) => {
              const option = BRISTOL_OPTIONS.find((item) => item.value === entry.bristolType);
              return (
                <View key={entry.id} style={styles.logRow}>
                  <View style={[styles.logIcon, { backgroundColor: withAlpha(option?.tone ?? MD_ACCENT, 0.16) }]}>
                    <BristolGlyph color={option?.tone ?? MD_ACCENT} type={entry.bristolType} />
                  </View>
                  <View style={styles.searchCopy}>
                    <RNText style={styles.searchTitle}>
                      Type {entry.bristolType} • {option?.label}
                    </RNText>
                    <RNText style={styles.searchMeta}>
                      Urgency {entry.urgency} • Pain {entry.painLevel} • {new Date(entry.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </RNText>
                  </View>
                  <Pressable onPress={() => handleDeleteStool(entry.id)}>
                    <MaterialSymbol color={MD_TEXT_TERTIARY} name="delete" size={18} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader title="Recent Symptoms" />
        <View style={styles.sectionList}>
          {data.insights.recentSymptoms.length === 0 ? (
            <RNText style={styles.emptyCopy}>
              Symptom logs will appear here once you connect digestive symptoms
              inside Mood or Wellness tracking.
            </RNText>
          ) : (
            data.insights.recentSymptoms.map((symptom) => (
              <View key={symptom.id} style={styles.symptomCard}>
                <View style={styles.timelineHeader}>
                  <RNText style={styles.searchTitle}>{symptom.name}</RNText>
                  <RNText style={styles.severityPill}>Severity {symptom.severity}/5</RNText>
                </View>
                <RNText style={styles.searchMeta}>
                  {new Date(symptom.loggedAt).toLocaleString()}
                </RNText>
                {symptom.relatedMeals.length > 0 ? (
                  <View style={styles.pillRow}>
                    {symptom.relatedMeals.map((meal) => (
                      <SmallPill
                        key={`${symptom.id}-${meal}`}
                        color={MD_ACCENT_LIGHT}
                        label={meal}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader title="Insights" />
        <View style={styles.insightsGrid}>
          <View style={styles.insightColumn}>
            <RNText style={styles.insightTitle}>Trigger foods</RNText>
            {data.insights.triggerFoods.length === 0 ? (
              <RNText style={styles.emptyCopy}>
                Keep logging for a few more days to reveal symptom-linked foods.
              </RNText>
            ) : (
              data.insights.triggerFoods.map((item) => {
                const meta = FODMAP_META[item.fodmapRating as keyof typeof FODMAP_META] ?? FODMAP_META.unknown;
                return (
                  <View key={item.foodName} style={styles.insightRow}>
                    <RNText style={styles.searchTitle}>{item.foodName}</RNText>
                    <RNText style={[styles.searchMeta, { color: meta.color }]}>
                      {Math.round(item.correlationRate * 100)}% correlation
                    </RNText>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.insightColumn}>
            <RNText style={styles.insightTitle}>Safe foods for you</RNText>
            {data.insights.safeFoods.length === 0 ? (
              <RNText style={styles.emptyCopy}>
                Safe-food recommendations appear after enough low-FODMAP meals.
              </RNText>
            ) : (
              data.insights.safeFoods.map((item) => (
                <View key={item.name} style={styles.insightRow}>
                  <RNText style={styles.searchTitle}>{item.name}</RNText>
                  <RNText style={styles.searchMeta}>{item.servings} calm meals</RNText>
                </View>
              ))
            )}
          </View>
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader
          action={
            <Pressable onPress={() => setShowGuide((value) => !value)}>
              <RNText style={styles.guideAction}>
                {showGuide ? 'Hide guide' : 'Open guide'}
              </RNText>
            </Pressable>
          }
          title="FODMAP Guide"
        />
        {showGuide ? (
          <View style={styles.guideColumns}>
            {(['low', 'moderate', 'high'] as const).map((rating) => {
              const meta = FODMAP_META[rating];
              const foods = data.guide[rating];
              return (
                <View key={rating} style={styles.guideColumn}>
                  <RNText style={[styles.guideTitle, { color: meta.color }]}>
                    {meta.label}
                  </RNText>
                  {foods.map((food) => (
                    <RNText key={food.id} style={styles.guideFood}>
                      {food.name}
                    </RNText>
                  ))}
                </View>
              );
            })}
          </View>
        ) : (
          <RNText style={styles.emptyCopy}>
            Keep a quick reference of low, moderate, and high FODMAP foods right
            inside MyMeds.
          </RNText>
        )}
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 140,
  },
  errorShell: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  heroCopy: {
    gap: 6,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroTitle: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 40,
    lineHeight: 44,
  },
  heroBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  loadCard: {
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
  },
  loadHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  metricValue: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
    fontSize: 30,
    lineHeight: 34,
  },
  loadBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loadBadgeText: {
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  loadStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  loadStat: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 2,
    padding: 14,
  },
  loadStatNumber: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 22,
  },
  loadStatLabel: {
    color: MD_TEXT_TERTIARY,
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
  },
  formStack: {
    gap: 12,
    marginTop: 18,
  },
  input: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    color: MD_TEXT,
    fontFamily: MD_FONTS.regular,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  searchList: {
    gap: 10,
  },
  searchRow: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  searchCopy: {
    flex: 1,
    gap: 2,
  },
  searchTitle: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 15,
  },
  searchMeta: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
  },
  ratingPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ratingPillText: {
    fontFamily: MD_FONTS.bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  customAddRow: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
  },
  sectionList: {
    gap: 12,
    marginTop: 18,
  },
  emptyCopy: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineDot: {
    borderRadius: 999,
    marginTop: 6,
    minHeight: 10,
    width: 10,
  },
  timelineCard: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 10,
    padding: 14,
  },
  timelineHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryActionText: {
    color: '#001F2A',
    fontFamily: MD_FONTS.bold,
    fontSize: 12,
  },
  bristolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  bristolCard: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 20,
    gap: 8,
    minWidth: '30%',
    paddingHorizontal: 10,
    paddingVertical: 14,
    width: '31%',
  },
  bristolNumber: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  bristolLabel: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 11,
    textAlign: 'center',
  },
  inlineControls: {
    gap: 14,
    marginTop: 18,
  },
  sliderLike: {
    gap: 8,
  },
  controlLabel: {
    color: MD_TEXT_TERTIARY,
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  booleanRow: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  booleanCopy: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.medium,
    fontSize: 13,
  },
  logRow: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  logIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  symptomCard: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    gap: 8,
    padding: 14,
  },
  severityPill: {
    color: '#FFB877',
    fontFamily: MD_FONTS.bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  insightsGrid: {
    gap: 12,
    marginTop: 18,
  },
  insightColumn: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    gap: 12,
    padding: 14,
  },
  insightTitle: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 15,
  },
  insightRow: {
    gap: 2,
  },
  guideAction: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  guideColumns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  guideColumn: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 8,
    padding: 14,
  },
  guideTitle: {
    fontFamily: MD_FONTS.bold,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  guideFood: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
  },
  glyphRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  glyphColumn: {
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },
  glyphDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  glyphBlob: {
    borderRadius: 999,
    height: 12,
    width: 14,
  },
  glyphBlobWide: {
    borderRadius: 999,
    height: 8,
    width: 24,
  },
  glyphDrop: {
    borderRadius: 999,
    height: 14,
    transform: [{ scaleY: 1.1 }],
    width: 8,
  },
  glyphCapsuleShort: {
    borderRadius: 999,
    height: 10,
    width: 24,
  },
  glyphCapsuleMedium: {
    borderRadius: 999,
    height: 10,
    width: 30,
  },
  glyphCapsuleLong: {
    borderRadius: 999,
    height: 10,
    width: 38,
  },
});
