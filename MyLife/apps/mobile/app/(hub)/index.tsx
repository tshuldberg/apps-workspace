import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  aggregateTodayCards,
  dismissCardToday,
  getDismissedCardIds,
  getQuickActionsForClusters,
  isUserVisibleModule,
  useEnabledModules,
  type QuickAction,
  type TodayCard as TodayCardModel,
} from '@mylife/module-registry';
import { getPreference } from '@mylife/db';
import {
  Text,
  colors,
  glassBorders,
  glassFills,
  spacing,
  useThemeColors,
  useThemeLayout,
  useTheme,
} from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { useOnboardingComplete } from '../../hooks/use-onboarding';
import { TodaySection } from '../../components/today/TodaySection';
import { QuickActions } from '../../components/today/QuickActions';
import { HUB_TAB_BAR_CLEARANCE } from './_layout';

/** All seven clusters -- fallback when the user has not picked any yet. */
const DEFAULT_PRIMARY_CLUSTERS: readonly string[] = [
  'body',
  'mind',
  'home',
  'money',
  'social',
  'outdoor',
  'knowledge',
];

const ACTION_KINDS = new Set<TodayCardModel['kind']>([
  'action',
  'reminder',
  'event',
]);

const PROGRESS_KINDS = new Set<TodayCardModel['kind']>([
  'progress',
  'insight',
]);

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date()
    .toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    .toUpperCase();
}

/**
 * Parse the `today.primary_clusters` preference value. Expected to be a JSON
 * array of cluster ids. Returns the default cluster list if the value is
 * missing or malformed so the Today surface is never blank at onboarding.
 */
function parseClustersPreference(raw: string | undefined): readonly string[] {
  if (!raw) return DEFAULT_PRIMARY_CLUSTERS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PRIMARY_CLUSTERS;
    const clusters = parsed.filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    );
    return clusters.length > 0 ? clusters : DEFAULT_PRIMARY_CLUSTERS;
  } catch {
    return DEFAULT_PRIMARY_CLUSTERS;
  }
}

export default function TodayScreen() {
  const router = useRouter();
  const db = useDatabase();
  const allEnabledModules = useEnabledModules();
  const onboardingComplete = useOnboardingComplete();
  const themeColors = useThemeColors();
  const themeLayout = useThemeLayout();
  const theme = useTheme();
  const themeSpacing = themeLayout.spacing;
  const styles = useMemo(
    () => makeStyles(themeColors, themeSpacing, theme.glass.cardFill, theme.glass.cardBorder),
    [themeColors, themeSpacing, theme.glass.cardFill, theme.glass.cardBorder],
  );

  // Recompute trigger. Pull-to-refresh + dismissal both bump this.
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (onboardingComplete === false) {
      router.replace('/(onboarding)');
    }
  }, [onboardingComplete, router]);

  // Filter out modules that are registry-hidden or merged. Same filter the
  // relocated /all grid uses, so the Today aggregator stays consistent with
  // the rest of the hub shell.
  const enabledModules = useMemo(
    () => allEnabledModules.filter((m) => isUserVisibleModule(m.id)),
    [allEnabledModules],
  );

  const enabledIdsKey = enabledModules.map((m) => m.id).join(',');

  const { cards, quickActions } = useMemo(() => {
    try {
      const now = new Date();
      const clustersRaw = getPreference(db, 'today.primary_clusters');
      const primaryClusters = parseClustersPreference(clustersRaw);
      const dismissedIds = getDismissedCardIds(db, now);
      const aggregated = aggregateTodayCards(db, enabledModules, {
        now,
        primaryClusters: [...primaryClusters],
        dismissedIds,
      });
      const enabledIdSet = new Set(enabledModules.map((m) => m.id));
      const actions = getQuickActionsForClusters(
        primaryClusters,
        enabledIdSet,
        5,
      );
      return { cards: aggregated, quickActions: actions };
    } catch {
      return {
        cards: [] as TodayCardModel[],
        quickActions: [] as QuickAction[],
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, enabledIdsKey, refreshTick]);

  const { dayCards, weekCards } = useMemo(() => {
    const day: TodayCardModel[] = [];
    const week: TodayCardModel[] = [];
    for (const card of cards) {
      if (ACTION_KINDS.has(card.kind)) day.push(card);
      else if (PROGRESS_KINDS.has(card.kind)) week.push(card);
    }
    return { dayCards: day, weekCards: week };
  }, [cards]);

  const handleDismiss = useCallback(
    (cardId: string) => {
      try {
        dismissCardToday(db, cardId, new Date());
      } catch {
        // Swallow -- the UI still hides the card locally on next refresh.
      }
      setRefreshTick((t) => t + 1);
    },
    [db],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshTick((t) => t + 1);
    // Let the aggregator recompute on the next render tick, then release the
    // spinner. We don't await anything heavy here because the aggregator is
    // synchronous; this just gives the RefreshControl a short visual lifespan.
    setTimeout(() => setRefreshing(false), 300);
  }, []);

  const hasAnything =
    dayCards.length > 0 || weekCards.length > 0 || quickActions.length > 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={themeColors.primaryContainer}
          />
        }
      >
        {/* Hero: greeting + date */}
        <View style={styles.hero}>
          <Text style={styles.heroGreeting}>{getGreeting()}</Text>
          <Text style={styles.heroDate}>{formatDate()}</Text>
        </View>

        {!hasAnything ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              Enable a module to see your day
            </Text>
            <Text style={styles.emptySubtitle}>
              Turn on any module and your Today view will surface reminders,
              progress, and quick actions here.
            </Text>
            <Pressable onPress={() => router.push('/(hub)/discover')}>
              <LinearGradient
                colors={[themeColors.primary, themeColors.primaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                <Text style={styles.ctaText}>Browse Modules</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.sections}>
            <TodaySection
              label="YOUR DAY"
              cards={dayCards}
              onDismiss={handleDismiss}
            />
            <TodaySection
              label="THIS WEEK"
              cards={weekCards}
              onDismiss={handleDismiss}
            />
            <QuickActions actions={quickActions} />
            <Pressable
              style={styles.allModulesLink}
              onPress={() => router.push('/(hub)/all')}
              accessibilityRole="button"
              accessibilityLabel="View all modules"
            >
              <Text style={styles.allModulesLabel}>VIEW ALL MODULES</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// Fallback static references retained per "backward-compat fallback" rule.
void colors;
void glassFills;
void glassBorders;
void spacing;

type ThemeColors = ReturnType<typeof useThemeColors>;
type ThemeSpacing = ReturnType<typeof useThemeLayout>['spacing'];

function makeStyles(
  themeColors: ThemeColors,
  themeSpacing: ThemeSpacing,
  glassCardFill: string,
  glassCardBorder: string,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    scrollContent: {
      paddingBottom: HUB_TAB_BAR_CLEARANCE,
    },
    hero: {
      paddingHorizontal: themeSpacing.md,
      paddingTop: themeSpacing.lg,
      paddingBottom: themeSpacing.lg,
    },
    heroGreeting: {
      fontSize: 32,
      fontWeight: '800',
      lineHeight: 40,
      color: themeColors.text,
      letterSpacing: -0.5,
    },
    heroDate: {
      fontSize: 11,
      fontWeight: '500',
      color: `${themeColors.textSecondary}B3`,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginTop: 6,
    },
    sections: {
      gap: themeSpacing.lg,
    },
    emptyState: {
      marginHorizontal: themeSpacing.md,
      backgroundColor: glassCardFill,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: glassCardBorder,
      borderStyle: 'dashed',
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: themeSpacing.md,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: themeColors.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: themeColors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 20,
      lineHeight: 20,
    },
    ctaGradient: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 999,
    },
    ctaText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#4B2700',
    },
    allModulesLink: {
      alignSelf: 'center',
      marginTop: themeSpacing.md,
      paddingVertical: themeSpacing.sm,
      paddingHorizontal: themeSpacing.md,
    },
    allModulesLabel: {
      color: themeColors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 2,
    },
  });
}
