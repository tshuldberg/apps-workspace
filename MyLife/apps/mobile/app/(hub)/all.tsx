import React, { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { icons } from 'lucide-react-native';
import {
  MODULE_METADATA,
  MODULE_ICONS,
  isUserVisibleModule,
  type ModuleId,
  aggregateDashboardData,
  type ModuleSummary,
} from '@mylife/module-registry';
import { useEnabledModules } from '@mylife/module-registry';
import { useDatabase } from '../../components/DatabaseProvider';
import { getVisibleDashboardCards, type DashboardCard } from '@mylife/db';
import { Text, colors, surfaceTiers, spacing, glassFills, glassBorders } from '@mylife/ui';
import { useOnboardingComplete } from '../../hooks/use-onboarding';
import { HUB_TAB_BAR_CLEARANCE } from './_layout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = spacing.md;
const GRID_COLUMNS = 4;
const ICON_GAP = spacing.sm;
const ICON_SIZE =
  (SCREEN_WIDTH - GRID_PADDING * 2 - ICON_GAP * (GRID_COLUMNS - 1)) /
  GRID_COLUMNS;
const ICON_BOX = Math.min(ICON_SIZE, 72);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('');
}

function getIcon(name: string) {
  const key = toPascalCase(name);
  return (icons as Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>>)[key] ?? null;
}

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

function formatStatValue(key: string, value: number | string): string {
  if (typeof value === 'string') return value;
  if (key.includes('balance') || key.includes('spent') || key.includes('budget') || key.includes('remaining') || key.includes('income')) {
    const abs = Math.abs(value);
    const dollars = Math.floor(abs / 100);
    const cents = abs % 100;
    return `$${dollars.toLocaleString()}.${String(cents).padStart(2, '0')}`;
  }
  if (key.includes('rating') || key.includes('avg')) return value.toFixed(1);
  return value.toLocaleString();
}

function getStatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

// ---------------------------------------------------------------------------
// Quick action definitions
// ---------------------------------------------------------------------------

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  route: string;
  moduleId: ModuleId;
  accentColor: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'mood', label: 'Mood', icon: 'smile', route: '/(mood)', moduleId: 'mood', accentColor: colors.modules.mood },
  { id: 'fast', label: 'Fast', icon: 'timer', route: '/(fast)', moduleId: 'fast', accentColor: colors.modules.fast },
  { id: 'budget', label: 'Budget', icon: 'plus-circle', route: '/(budget)/transaction/create', moduleId: 'budget', accentColor: colors.modules.budget },
  { id: 'journal', label: 'Journal', icon: 'pen-line', route: '/(journal)/today', moduleId: 'journal', accentColor: colors.modules.journal },
  { id: 'workouts', label: 'Workouts', icon: 'dumbbell', route: '/(workouts)', moduleId: 'workouts', accentColor: colors.modules.workouts },
];


// ---------------------------------------------------------------------------
// Module Summary Card (Bento style)
// ---------------------------------------------------------------------------

function ModuleSummaryCard({
  moduleId,
  summary,
}: {
  moduleId: ModuleId;
  summary: ModuleSummary;
}) {
  const meta = MODULE_METADATA[moduleId];
  const iconName = MODULE_ICONS[moduleId] ?? 'circle';
  const IconComponent = getIcon(iconName);
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  const statEntries = Object.entries(summary.stats).slice(0, 3);
  const primaryStat = statEntries[0];

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  }, [scale]);

  return (
    <Pressable
      onPress={() => router.push(`/(${moduleId})` as never)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[s.bentoCard, { transform: [{ scale }] }]}>
        {/* Label + Icon */}
        <View style={s.bentoHeader}>
          <Text style={[s.bentoLabel, { color: colors.hubAccent }]}>
            {meta.name.toUpperCase()}
          </Text>
          {IconComponent && (
            <IconComponent size={18} color={`${colors.hubAccent}66`} strokeWidth={1.5} />
          )}
        </View>

        {/* Primary stat */}
        {primaryStat && (
          <Text style={s.bentoStat}>
            {formatStatValue(primaryStat[0], primaryStat[1])}
          </Text>
        )}

        {/* Secondary stats */}
        {statEntries.length > 1 && (
          <View style={s.bentoSecondary}>
            {statEntries.slice(1).map(([key, value]) => (
              <View key={key} style={s.bentoSecondaryItem}>
                <Text style={s.bentoSecondaryLabel}>
                  {getStatLabel(key)}
                </Text>
                <Text style={s.bentoSecondaryValue}>
                  {formatStatValue(key, value)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Items count */}
        {summary.totalItems > 0 && !primaryStat && (
          <Text style={s.bentoStat}>
            {summary.totalItems} {summary.totalItems === 1 ? 'item' : 'items'}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Quick Action Button (Circular)
// ---------------------------------------------------------------------------

function QuickActionButton({ action }: { action: QuickAction }) {
  const router = useRouter();
  const IconComponent = getIcon(action.icon);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  }, [scale]);

  return (
    <Pressable
      onPress={() => router.push(action.route as never)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={s.quickAction}
    >
      <Animated.View style={[s.quickActionCircle, { transform: [{ scale }] }]}>
        {IconComponent && <IconComponent size={20} color={colors.text} strokeWidth={1.8} />}
      </Animated.View>
      <Text style={s.quickActionLabel}>
        {action.label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Module Grid Item (compact)
// ---------------------------------------------------------------------------

function ModuleGridItem({ moduleId }: { moduleId: ModuleId }) {
  const meta = MODULE_METADATA[moduleId];
  const iconName = MODULE_ICONS[moduleId] ?? 'circle';
  const IconComponent = getIcon(iconName);
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const router = useRouter();

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.84, duration: 80, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => router.push(`/(${moduleId})` as never)}
      accessibilityLabel={meta.name}
      accessibilityHint={meta.tagline}
    >
      <Animated.View
        style={[s.gridItem, { transform: [{ scale }], opacity }]}
      >
        <View style={[s.iconBox, { backgroundColor: surfaceTiers.low }]}>
          {IconComponent ? (
            <IconComponent size={24} color={colors.textSecondary} strokeWidth={1.8} />
          ) : (
            <Text style={s.fallbackEmoji}>{meta.icon}</Text>
          )}
        </View>
        <Text style={s.iconLabel} numberOfLines={1}>
          {meta.name.replace('My', '')}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main Screen -- "All modules" grid (formerly the hub home)
// ---------------------------------------------------------------------------

export default function HubAllModulesScreen() {
  const router = useRouter();
  const allEnabledModules = useEnabledModules();
  const db = useDatabase();
  const onboardingComplete = useOnboardingComplete();

  React.useEffect(() => {
    if (onboardingComplete === false) {
      router.replace('/(onboarding)');
    }
  }, [onboardingComplete, router]);

  // Filter out modules whose release state is 'hidden' or 'merged'.
  // This keeps previously-enabled hidden modules from leaking onto the
  // dashboard while we ship the reduced test build. The registry row
  // stays in SQLite so we can reintroduce a module without data loss.
  const enabledModules = useMemo(
    () => allEnabledModules.filter((m) => isUserVisibleModule(m.id)),
    [allEnabledModules],
  );

  const enabledKey = enabledModules.map((m) => m.id).join(',');

  const { summaries, dashboardCards } = useMemo(() => {
    try {
      const cards = getVisibleDashboardCards(db);
      const data = aggregateDashboardData(enabledModules, db);
      return { summaries: data, dashboardCards: cards };
    } catch {
      return { summaries: new Map<string, ModuleSummary>(), dashboardCards: [] as DashboardCard[] };
    }
  }, [enabledKey, db]);

  const primaryModuleIds = useMemo(() => {
    const orderedIds: ModuleId[] = dashboardCards.length > 0
      ? dashboardCards
          .filter((c: DashboardCard) => summaries.has(c.module_id))
          .map((c: DashboardCard) => c.module_id as ModuleId)
      : enabledModules
          .filter((m) => summaries.has(m.id))
          .map((m) => m.id);
    return orderedIds.slice(0, 4);
  }, [dashboardCards, summaries, enabledModules]);

  const allEnabledIds = useMemo(() => {
    return enabledModules.map((m) => m.id);
  }, [enabledModules]);

  const availableActions = useMemo(() => {
    const enabledIds = new Set(enabledModules.map((m) => m.id));
    return QUICK_ACTIONS.filter((a) => enabledIds.has(a.moduleId));
  }, [enabledModules]);

  const hasEnabledModules = enabledModules.length > 0;

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO: Greeting + Date */}
        <View style={s.heroSection}>
          <Text style={s.heroGreeting}>
            {getGreeting()}
          </Text>
          <Text style={s.heroDate}>
            {formatDate()}
          </Text>
        </View>

        {!hasEnabledModules ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>{'  '}</Text>
            <Text style={s.emptyTitle}>
              Enable modules to see your day
            </Text>
            <Text style={s.emptySubtitle}>
              Choose the apps that matter to you. Your dashboard will show personalized summaries.
            </Text>
            <Pressable
              onPress={() => router.push('/(hub)/discover')}
            >
              <LinearGradient
                colors={[colors.hubAccentLight, colors.hubAccent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.ctaGradient}
              >
                <Text style={s.ctaText}>
                  Browse Modules
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <>
            {/* BENTO: Module Summary Cards (2x2 grid) */}
            {primaryModuleIds.length > 0 && (
              <View style={s.bentoGrid}>
                {primaryModuleIds.map((id) => {
                  const summary = summaries.get(id);
                  if (!summary) return null;
                  return (
                    <ModuleSummaryCard
                      key={id}
                      moduleId={id}
                      summary={summary}
                    />
                  );
                })}
              </View>
            )}

            {/* QUICK ACTIONS */}
            {availableActions.length > 0 && (
              <View style={s.quickActionsSection}>
                <Text style={s.sectionHeader}>
                  QUICK ACTIONS
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.quickActionsRow}
                >
                  {availableActions.map((action) => (
                    <QuickActionButton key={action.id} action={action} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* MODULE LIBRARY GRID -- all enabled modules not in bento cards */}
            <View style={s.librarySection}>
              <View style={s.libraryHeader}>
                <Text style={s.sectionHeader}>
                  LIBRARY MODULES
                </Text>
                <Text style={s.libraryCount}>
                  {enabledModules.length} ACTIVE
                </Text>
              </View>
              <View style={s.moduleGrid}>
                {allEnabledIds.map((id) => (
                  <ModuleGridItem key={id} moduleId={id} />
                ))}
                <Pressable
                  onPress={() => router.push('/(hub)/discover')}
                  style={s.gridItem}
                >
                  <View style={[s.iconBox, { backgroundColor: surfaceTiers.low }]}>
                    {(() => {
                      const PlusIcon = getIcon('plus');
                      return PlusIcon ? <PlusIcon size={24} color={`${colors.text}66`} strokeWidth={1.5} /> : null;
                    })()}
                  </View>
                  <Text style={s.iconLabel}>More</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* Footer spacer for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles -- Obsidian Noir
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    paddingBottom: HUB_TAB_BAR_CLEARANCE,
  },

  // Hero
  heroSection: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroGreeting: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    color: colors.text,
    letterSpacing: -0.5,
  },
  heroDate: {
    fontSize: 11,
    fontWeight: '500',
    color: `${colors.textSecondary}B3`,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 6,
  },

  // Bento summary grid
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: GRID_PADDING,
  },
  bentoCard: {
    width: (SCREEN_WIDTH - GRID_PADDING * 2 - spacing.sm) / 2,
    backgroundColor: glassFills.subtle,
    borderRadius: 16,
    padding: spacing.md,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  bentoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bentoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  bentoStat: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  bentoSecondary: {
    marginTop: spacing.xs,
    gap: 4,
  },
  bentoSecondaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bentoSecondaryLabel: {
    fontSize: 11,
    color: `${colors.text}99`,
  },
  bentoSecondaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },

  // Section header (reusable)
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: `${colors.hubAccent}99`,
    textTransform: 'uppercase',
  },

  // Quick actions
  quickActionsSection: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    paddingHorizontal: GRID_PADDING,
  },
  quickActionsRow: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  quickAction: {
    alignItems: 'center',
    gap: 6,
    minWidth: 64,
  },
  quickActionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: surfaceTiers.high,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: `${colors.text}99`,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Library modules
  librarySection: {
    marginTop: spacing.lg,
    paddingHorizontal: GRID_PADDING,
  },
  libraryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  libraryCount: {
    fontSize: 10,
    fontWeight: '500',
    color: `${colors.text}66`,
    letterSpacing: 1,
  },

  // Empty state
  emptyState: {
    marginHorizontal: GRID_PADDING,
    backgroundColor: glassFills.subtle,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
    borderStyle: 'dashed',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
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

  // Module grid
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ICON_GAP,
  },
  gridItem: {
    width: ICON_BOX,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  fallbackEmoji: {
    fontSize: 22,
  },
  iconLabel: {
    fontSize: 10,
    color: `${colors.text}80`,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});
