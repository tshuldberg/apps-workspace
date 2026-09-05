import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getChallengeTemplates,
  getSeasonalChallenges,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  type ChallengeTemplate,
  type Season,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { EmptyState, Text, colors } from '@mylife/ui';

type SeasonTab = 'all' | 'spring' | 'summer' | 'fall' | 'winter';

const SEASON_TABS: { key: SeasonTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'spring', label: 'Spring' },
  { key: 'summer', label: 'Summer' },
  { key: 'fall', label: 'Fall' },
  { key: 'winter', label: 'Winter' },
];

export default function ChallengesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SeasonTab>('all');
  const [templates, setTemplates] = useState<ChallengeTemplate[]>([]);

  const load = useCallback(() => {
    if (activeTab === 'all') {
      setTemplates(getChallengeTemplates());
    } else {
      setTemplates(getSeasonalChallenges(activeTab as Season));
    }
  }, [activeTab]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.screen}>
      {/* Season filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {SEASON_TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <Pressable
              key={key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Challenge cards */}
      {templates.length === 0 ? (
        <View style={styles.stateWrap}>
          <EmptyState
            icon="trophy"
            title="No challenges"
            message="No challenges available for this season"
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {templates.map((template) => (
            <GlassCard key={template.id} level={2} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>{template.icon}</Text>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{template.name}</Text>
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardSeason}>
                      {template.season === 'any' ? 'Year-round' : template.season.charAt(0).toUpperCase() + template.season.slice(1)}
                    </Text>
                    <Text style={styles.cardDot}>{'\u00B7'}</Text>
                    <Text style={styles.cardDuration}>{template.durationDays} days</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.cardDescription} numberOfLines={2}>
                {template.description}
              </Text>

              {/* Goals preview */}
              <View style={styles.goalsSection}>
                {template.goals.map((goal, idx) => (
                  <View key={idx} style={styles.goalRow}>
                    <View style={styles.goalBullet} />
                    <Text style={styles.goalText} numberOfLines={1}>
                      {goal.description}
                    </Text>
                  </View>
                ))}
              </View>

              <Pressable style={styles.joinButton}>
                <Text style={styles.joinButtonText}>Join Challenge</Text>
              </Pressable>
            </GlassCard>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  tabRow: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: RECIPES_SURFACES.lift,
  },
  tabActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  tabText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: RECIPES_ACCENT,
  },
  stateWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 120,
    gap: 16,
  },
  card: {
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  cardIcon: {
    fontSize: 32,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 17,
    color: colors.text,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardSeason: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    color: RECIPES_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardDot: {
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.3)',
  },
  cardDuration: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  cardDescription: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(228, 225, 233, 0.7)',
    marginBottom: 12,
  },
  goalsSection: {
    gap: 6,
    marginBottom: 14,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RECIPES_ACCENT,
  },
  goalText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  joinButton: {
    backgroundColor: RECIPES_ACCENT,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: '#131318',
  },
});
