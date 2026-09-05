import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getAdherenceMoodCorrelation,
  getMedicationInsights,
  getMedications,
  getMoodMedicationCorrelation,
  getSymptomMedicationCorrelation,
} from '@mylife/meds';
import {
  GlassCard,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  SectionHeader,
  withAlpha,
} from '@mylife/meds/ui';
import {
  EmptyGlassState,
  FilterChip,
  ProgressBar,
  ScreenTitleBlock,
  SectionStack,
} from '../../../components/meds/phase1';
import { useDatabase } from '../../../components/DatabaseProvider';

type InsightCategoryKey = 'all' | 'medication' | 'vitals' | 'mood' | 'pain' | 'weather' | 'food';

type InsightCard = {
  category: InsightCategoryKey;
  id: string;
  label: string;
  strength: number;
  strengthLabel: string;
  subtitle: string;
  title: string;
};

function strengthLabel(value: number) {
  if (value >= 75) {
    return 'Strong';
  }
  if (value >= 45) {
    return 'Moderate';
  }
  return 'Early';
}

export default function CorrelationScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<InsightCategoryKey>('all');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const insightState = useMemo(() => {
    try {
      const medications = getMedications(db, { isActive: true });
      const cards: InsightCard[] = [];

      for (const medication of medications) {
        const mood = getMoodMedicationCorrelation(db, medication.id);
        if (mood && mood.changePercent != null) {
          const strength = Math.min(100, Math.abs(mood.changePercent));
          cards.push({
            category: 'mood',
            id: `mood-${medication.id}`,
            label: strengthLabel(strength),
            strength,
            strengthLabel: strengthLabel(strength),
            subtitle: `${mood.beforeDataPoints} before · ${mood.afterDataPoints} after`,
            title: `${medication.name} mood impact ${mood.changePercent > 0 ? 'improved' : 'declined'} ${Math.abs(mood.changePercent)}%`,
          });
        }

        const symptoms = getSymptomMedicationCorrelation(db, medication.id);
        const topSymptom = symptoms?.symptoms
          .slice()
          .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))[0];
        if (topSymptom) {
          const strength = Math.min(100, Math.abs(topSymptom.changePercent));
          cards.push({
            category: 'pain',
            id: `symptom-${medication.id}-${topSymptom.symptomName}`,
            label: strengthLabel(strength),
            strength,
            strengthLabel: strengthLabel(strength),
            subtitle: `${topSymptom.beforeCount} before · ${topSymptom.afterCount} after`,
            title: `${topSymptom.symptomName} shifted ${topSymptom.changePercent > 0 ? 'up' : 'down'} ${Math.abs(topSymptom.changePercent)}% after ${medication.name}`,
          });
        }

        const adherence = getAdherenceMoodCorrelation(db, medication.id, 90);
        const coefficientStrength = Math.min(100, Math.round(Math.abs(adherence.correlationCoefficient) * 100));
        if (coefficientStrength > 0) {
          cards.push({
            category: 'medication',
            id: `adherence-${medication.id}`,
            label: strengthLabel(coefficientStrength),
            strength: coefficientStrength,
            strengthLabel: strengthLabel(coefficientStrength),
            subtitle: `Adherent days ${adherence.adherentDaysMoodAvg?.toFixed(1) ?? '--'} vs missed ${adherence.missedDaysMoodAvg?.toFixed(1) ?? '--'}`,
            title: `${medication.name} adherence and mood move together`,
          });
        }
      }

      const systemInsights = getMedicationInsights(db);
      for (const insight of systemInsights) {
        const category: InsightCategoryKey =
          insight.category === 'vitals_trend'
            ? 'vitals'
            : insight.category === 'symptom_correlation'
              ? 'pain'
              : 'medication';

        cards.push({
          category,
          id: insight.id,
          label: insight.severity.toUpperCase(),
          strength: Math.min(100, Math.abs(Number(insight.value ?? 40))),
          strengthLabel: strengthLabel(Math.min(100, Math.abs(Number(insight.value ?? 40)))),
          subtitle: insight.description,
          title: insight.title,
        });
      }

      const sorted = cards.sort((left, right) => right.strength - left.strength);
      return {
        cards: sorted,
        error: null,
      };
    } catch (error) {
      console.error('CorrelationScreen load failed', error);
      return {
        cards: [] as InsightCard[],
        error: 'Unable to load insights.',
      };
    }
  }, [db, refreshKey]);

  if (insightState.error) {
    return (
      <View style={styles.screen}>
        <EmptyGlassState
          actionLabel="Retry"
          message={insightState.error}
          onPress={onRefresh}
          title="Insights unavailable"
        />
      </View>
    );
  }

  const filteredCards = selectedCategory === 'all'
    ? insightState.cards
    : insightState.cards.filter((card) => card.category === selectedCategory);
  const heroCard = filteredCards[0] ?? insightState.cards[0] ?? null;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[MD_ACCENT_LIGHT]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={MD_ACCENT_LIGHT}
        />
      }
      style={styles.screen}
    >
      <SectionStack>
        <ScreenTitleBlock
          subtitle="Pattern detection across meds, mood, symptoms, and vitals."
          title="Insights"
        />

        {heroCard ? (
          <GlassCard padding={20} style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Top insight</Text>
            <Text style={styles.heroTitle}>{heroCard.title}</Text>
            <Text style={styles.heroSubtitle}>{heroCard.subtitle}</Text>
            <View style={styles.heroFooter}>
              <Text style={styles.heroStrength}>
                {heroCard.strengthLabel} signal · {heroCard.strength}%
              </Text>
              <ProgressBar value={heroCard.strength} />
            </View>
          </GlassCard>
        ) : (
          <EmptyGlassState
            message="Log meds, vitals, mood, or symptoms for a few days to generate correlations."
            title="No insights yet"
          />
        )}

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Categories" />
          <View style={styles.chipRail}>
            {(['all', 'medication', 'vitals', 'mood', 'pain', 'weather', 'food'] as InsightCategoryKey[]).map((category) => (
              <FilterChip
                key={category}
                label={category}
                onPress={() => setSelectedCategory(category)}
                selected={selectedCategory === category}
              />
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader
            action={
              <Pressable onPress={() => router.push('/(meds)/adherence')}>
                <Text style={styles.linkText}>Adherence</Text>
              </Pressable>
            }
            title="Insight cards"
          />
          <View style={styles.cardStack}>
            {filteredCards.length > 0 ? (
              filteredCards.map((card) => (
                <View key={card.id} style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <Text style={styles.insightTitle}>{card.title}</Text>
                    <View style={styles.insightBadge}>
                      <Text style={styles.insightBadgeText}>{card.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.insightBody}>{card.subtitle}</Text>
                  <ProgressBar
                    tone={card.category === 'vitals' ? MD_CHROME_GOLD : MD_ACCENT_LIGHT}
                    value={card.strength}
                  />
                </View>
              ))
            ) : (
              <Text style={styles.emptyBody}>
                There are no insight cards in this category yet. Keep tracking to unlock them.
              </Text>
            )}
          </View>
        </GlassCard>
      </SectionStack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
  },
  heroCard: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.92),
    gap: 12,
  },
  heroEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroTitle: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
  },
  heroSubtitle: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  heroFooter: {
    gap: 8,
  },
  heroStrength: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_CHROME_GOLD,
    fontFamily: MD_FONTS.semiBold,
  },
  panel: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  chipRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_CHROME_GOLD,
  },
  cardStack: {
    gap: 12,
  },
  insightCard: {
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    borderRadius: 18,
    gap: 10,
    padding: 14,
  },
  insightHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  insightTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    flex: 1,
    fontFamily: MD_FONTS.bold,
  },
  insightBadge: {
    backgroundColor: withAlpha(MD_ACCENT_LIGHT, 0.16),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  insightBadgeText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  insightBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  emptyBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
});
