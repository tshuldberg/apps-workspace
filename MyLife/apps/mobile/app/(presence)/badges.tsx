import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BADGE_DEFS,
  BadgeChip,
  buildBadgeStatsSnapshot,
  computeEarnedBadges,
  getBadgeCurrentValue,
  getBadgeProgress,
  GlassPanel,
  GoalRing,
  MaterialSymbol,
  PR_ACCENT,
  PR_ACCENT_LIGHT,
  PR_CYAN_GLOW_STYLE,
  PR_FONTS,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TEXT_TERTIARY,
  PR_TYPOGRAPHY,
  SectionHeader,
  type BadgeDef,
  type BadgeStatsSnapshot,
  type PresenceMaterialSymbolName,
} from '@mylife/presence';
import { useDatabase } from '../../components/DatabaseProvider';

type LoadedState = {
  stats: BadgeStatsSnapshot | null;
  errorMessage: string | null;
};

const CATEGORY_ORDER = ['Streaks', 'Sessions', 'Screen Time', 'Milestones', 'Special'] as const;

export default function PresenceBadgesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);

  const [data, setData] = useState<LoadedState>(() => {
    try {
      return {
        stats: buildBadgeStatsSnapshot(db),
        errorMessage: null,
      };
    } catch (error) {
      console.error('Failed to load presence badges', error);
      return {
        stats: null,
        errorMessage: 'We could not load your badge progress right now.',
      };
    }
  });

  const refreshData = useCallback(() => {
    setRefreshing(true);
    try {
      setData({
        stats: buildBadgeStatsSnapshot(db),
        errorMessage: null,
      });
    } catch (error) {
      console.error('Failed to refresh presence badges', error);
      setData({
        stats: null,
        errorMessage: 'Refresh failed. Pull again in a moment.',
      });
    } finally {
      setRefreshing(false);
    }
  }, [db]);

  const earnedBadges = useMemo(() => {
    if (data.stats == null) {
      return [];
    }
    return computeEarnedBadges(data.stats);
  }, [data.stats]);
  const earnedBadgeIds = useMemo(() => new Set(earnedBadges.map((badge) => badge.id)), [earnedBadges]);
  const lockedBadges = useMemo(() => {
    if (data.stats == null) {
      return [] as BadgeDef[];
    }
    return BADGE_DEFS
      .filter((badge) => !earnedBadgeIds.has(badge.id))
      .sort((left, right) => getBadgeProgress(right, data.stats!) - getBadgeProgress(left, data.stats!));
  }, [data.stats, earnedBadgeIds]);
  const upcomingBadge = lockedBadges[0] ?? null;
  const progressFraction = BADGE_DEFS.length === 0 ? 0 : earnedBadges.length / BADGE_DEFS.length;
  const selectedBadge = BADGE_DEFS.find((badge) => badge.id === selectedBadgeId) ?? null;
  const stats = data.stats;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} tintColor={PR_ACCENT_LIGHT} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <MaterialSymbol name="arrow_back" size={22} color={PR_TEXT} />
          </Pressable>
          <Text style={styles.topBarTitle}>Achievements</Text>
          <Pressable style={styles.iconButton} onPress={() => router.push('/(presence)/settings' as never)}>
            <MaterialSymbol name="settings" size={20} color={PR_TEXT} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialSymbol name="diamond" size={24} color={PR_ACCENT_LIGHT} filled />
          </View>
          <Text style={styles.heroTitle}>{`${earnedBadges.length} of ${BADGE_DEFS.length} badges earned`}</Text>
          <Text style={styles.heroCopy}>Your mastery journey is tracked across streaks, sessions, screen-time wins, and longer-term milestones.</Text>
        </View>

        {data.errorMessage ? (
          <GlassPanel padding={18} style={styles.errorCard}>
            <Text style={styles.errorTitle}>Badge progress unavailable</Text>
            <Text style={styles.errorCopy}>{data.errorMessage}</Text>
          </GlassPanel>
        ) : null}

        {stats == null ? null : (
          <>
            <GlassPanel padding={20} style={styles.heroPanel}>
              <View style={styles.heroPanelRow}>
                <GoalRing progress={progressFraction} size={168} strokeWidth={12}>
                  <View style={styles.goalRingContent}>
                    <Text style={styles.goalRingCount}>{String(earnedBadges.length)}</Text>
                    <Text style={styles.goalRingLabel}>{`of ${BADGE_DEFS.length}`}</Text>
                  </View>
                </GoalRing>
                <View style={styles.heroPanelMeta}>
                  <Text style={styles.heroPanelEyebrow}>Achievements</Text>
                  <Text style={styles.heroPanelTitle}>Badge progress</Text>
                  <Text style={styles.heroPanelCopy}>
                    Earn new states by building goal streaks, stacking focus sessions, and tightening your intentional opens.
                  </Text>
                </View>
              </View>
            </GlassPanel>

            {upcomingBadge ? (
              <GlassPanel padding={18} style={styles.upcomingCard}>
                <Text style={styles.cardLabel}>Upcoming Milestone</Text>
                <View style={styles.upcomingHeader}>
                  <Text style={styles.upcomingTitle}>{upcomingBadge.name}</Text>
                  <Text style={styles.upcomingPercent}>
                    {`${Math.round(getBadgeProgress(upcomingBadge, stats) * 100)}%`}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.max(8, getBadgeProgress(upcomingBadge, stats) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.upcomingCopy}>
                  {`${getBadgeCurrentValue(upcomingBadge, stats)} / ${upcomingBadge.target} ${upcomingBadge.unit}`}
                </Text>
              </GlassPanel>
            ) : null}

            {CATEGORY_ORDER.map((category) => {
              const categoryBadges = BADGE_DEFS.filter((badge) => badge.category === category);
              const earnedCount = categoryBadges.filter((badge) => earnedBadgeIds.has(badge.id)).length;
              return (
                <View key={category} style={styles.sectionBlock}>
                  <SectionHeader
                    title={`${category}`}
                    accent={category === 'Sessions' ? '#8BCFF0' : '#FFB877'}
                    action={<Text style={styles.sectionMeta}>{`${earnedCount} / ${categoryBadges.length}`}</Text>}
                  />
                  <View style={styles.badgeGrid}>
                    {categoryBadges.map((badge) => {
                      const earned = earnedBadgeIds.has(badge.id);
                      const progress = getBadgeProgress(badge, stats);
                      return (
                        <Pressable key={badge.id} style={styles.badgeGridItem} onPress={() => setSelectedBadgeId(badge.id)}>
                          <GlassPanel padding={12} style={[styles.badgeTile, earned && styles.badgeTileEarned]}>
                            <View style={styles.badgeChipWrap}>
                              <BadgeChip
                                icon={badge.icon as PresenceMaterialSymbolName}
                                label={badge.name}
                                earned={earned}
                                glow={earned}
                              />
                            </View>
                            <View style={styles.tileTrack}>
                              <View style={[styles.tileFill, { width: `${Math.max(6, progress * 100)}%` }]} />
                            </View>
                            <Text style={styles.tileMeta}>
                              {earned ? 'Earned' : `${getBadgeCurrentValue(badge, stats)} / ${badge.target}`}
                            </Text>
                          </GlassPanel>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={selectedBadge != null && stats != null}
        onRequestClose={() => setSelectedBadgeId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedBadgeId(null)}>
          <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
            {selectedBadge != null && stats != null ? (
              <>
                <View style={styles.modalHandle} />
                <View style={styles.modalIcon}>
                  <MaterialSymbol
                    name={selectedBadge.icon as PresenceMaterialSymbolName}
                    size={28}
                    color={earnedBadgeIds.has(selectedBadge.id) ? PR_ACCENT_LIGHT : PR_TEXT_TERTIARY}
                    filled={earnedBadgeIds.has(selectedBadge.id)}
                  />
                </View>
                <Text style={styles.modalTitle}>{selectedBadge.name}</Text>
                <Text style={styles.modalCopy}>{selectedBadge.description}</Text>

                <View style={styles.modalProgressTrack}>
                  <View
                    style={[
                      styles.modalProgressFill,
                      { width: `${Math.max(6, getBadgeProgress(selectedBadge, stats) * 100)}%` },
                    ]}
                  />
                </View>

                <Text style={styles.modalProgressText}>
                  {earnedBadgeIds.has(selectedBadge.id)
                    ? 'Earned in your current local history.'
                    : `${getBadgeCurrentValue(selectedBadge, stats)} / ${selectedBadge.target} ${selectedBadge.unit}`}
                </Text>

                {!earnedBadgeIds.has(selectedBadge.id) ? (
                  <Text style={styles.modalHint}>
                    Keep stacking the underlying behavior and this badge will light up automatically.
                  </Text>
                ) : null}

                <Pressable style={styles.closeButton} onPress={() => setSelectedBadgeId(null)}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PR_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  hero: {
    alignItems: 'center',
    gap: 10,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.10)',
  },
  heroTitle: {
    fontFamily: PR_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1,
    color: PR_TEXT,
    textAlign: 'center',
  },
  heroCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
    maxWidth: 320,
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  errorTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
    marginBottom: 6,
  },
  errorCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  heroPanel: {
    gap: 18,
  },
  heroPanelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  goalRingContent: {
    alignItems: 'center',
    gap: 2,
  },
  goalRingCount: {
    fontFamily: PR_FONTS.extraBold,
    fontSize: 36,
    lineHeight: 40,
    color: PR_TEXT,
  },
  goalRingLabel: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_SECONDARY,
  },
  heroPanelMeta: {
    flex: 1,
    gap: 6,
  },
  heroPanelEyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  heroPanelTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
  },
  heroPanelCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  upcomingCard: {
    gap: 10,
  },
  cardLabel: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_TERTIARY,
  },
  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  upcomingTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
  },
  upcomingPercent: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: '#FFB877',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFB877',
  },
  upcomingCopy: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionMeta: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_ACCENT_LIGHT,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeGridItem: {
    width: '31%',
  },
  badgeTile: {
    minHeight: 156,
    alignItems: 'center',
    gap: 10,
  },
  badgeTileEarned: {
    backgroundColor: 'rgba(8, 145, 178, 0.10)',
  },
  badgeChipWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  tileTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tileFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: PR_ACCENT,
  },
  tileMeta: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: PR_SURFACES.base,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 14,
  },
  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.10)',
    alignSelf: 'center',
    marginTop: 6,
  },
  modalTitle: {
    fontFamily: PR_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    color: PR_TEXT,
    textAlign: 'center',
  },
  modalCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  modalProgressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 4,
  },
  modalProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: PR_ACCENT,
    ...PR_CYAN_GLOW_STYLE,
  },
  modalProgressText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
    textAlign: 'center',
  },
  modalHint: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_TERTIARY,
    textAlign: 'center',
  },
  closeButton: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
    marginTop: 4,
  },
  closeButtonText: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
});
