import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Animated,
} from 'react-native';
import { Stack } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import { Activity } from 'lucide-react-native';
import {
  listPeople,
  listActiveNudges,
  dismissNudge,
  snoozeNudge,
  actOnNudge,
  listHangoutsForPerson,
  getLastHangoutDate,
  calculateDaysSinceLastSeen,
  getFrequencyStatus,
  getFrequencyColor,
  generateLastSeenLabel,
  getNudgeUrgency,
  detectDrift,
  type NudgeRecord,
  type DriftInfo,
  type FrequencyStatus,
  type NudgeUrgency,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SURFACE = '#2A292F';

// ── Urgency colors ──────────────────────────────────────────────────

const URGENCY_COLORS: Record<NudgeUrgency, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

const URGENCY_LABELS: Record<NudgeUrgency, string> = {
  high: 'Overdue',
  medium: 'Due soon',
  low: 'Gentle reminder',
};

// ── Avatar helpers (shared with index.tsx) ──────────────────────────

const GRADIENT_PAIRS: [string, string][] = [
  ['#EC4899', '#F472B6'],
  ['#8B5CF6', '#A78BFA'],
  ['#06B6D4', '#22D3EE'],
  ['#F59E0B', '#FBBF24'],
  ['#10B981', '#34D399'],
  ['#EF4444', '#F87171'],
  ['#6366F1', '#818CF8'],
  ['#E879A1', '#F0ABAF'],
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getGradient(name: string): string {
  return GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length][0];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ── Data types ──────────────────────────────────────────────────────

interface NudgeWithPerson extends NudgeRecord {
  personName: string;
  urgency: NudgeUrgency;
  daysSince: number | null;
  message: string;
}

interface FrequencyBar {
  personId: string;
  personName: string;
  daysSince: number | null;
  goalDays: number;
  status: FrequencyStatus;
  color: string;
  label: string;
}

// ── Main component ──────────────────────────────────────────────────

export default function FriendsHealthScreen() {
  const db = useDatabase();

  const [nudges, setNudges] = useState<NudgeWithPerson[]>([]);
  const [frequencyBars, setFrequencyBars] = useState<FrequencyBar[]>([]);
  const [drifts, setDrifts] = useState<DriftInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actedNudgeIds, setActedNudgeIds] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const loadData = useCallback(() => {
    const people = listPeople(db, { is_archived: false });
    const personMap = new Map(people.map((p) => [p.id, p]));

    // Active nudges
    const rawNudges = listActiveNudges(db);
    const enrichedNudges: NudgeWithPerson[] = rawNudges
      .map((n) => {
        const person = personMap.get(n.person_id);
        if (!person) return null;
        const lastDate = getLastHangoutDate(db, person.id);
        const daysSince = calculateDaysSinceLastSeen(lastDate);
        const goalDays = person.frequency_goal_days ?? 30;
        const urgency = daysSince !== null ? getNudgeUrgency(daysSince, goalDays) : ('medium' as NudgeUrgency);
        const label = generateLastSeenLabel(daysSince);
        return {
          ...n,
          personName: person.display_name,
          urgency,
          daysSince,
          message: daysSince !== null
            ? `Haven't seen ${person.display_name} in a while. ${label}.`
            : `You haven't hung out with ${person.display_name} yet.`,
        };
      })
      .filter((n): n is NudgeWithPerson => n !== null);
    setNudges(enrichedNudges);

    // Frequency bars
    const bars: FrequencyBar[] = [];
    for (const person of people) {
      if (person.frequency_goal_days === null) continue;
      const lastDate = getLastHangoutDate(db, person.id);
      const daysSince = calculateDaysSinceLastSeen(lastDate);
      const status = getFrequencyStatus(daysSince, person.frequency_goal_days);
      bars.push({
        personId: person.id,
        personName: person.display_name,
        daysSince,
        goalDays: person.frequency_goal_days,
        status,
        color: getFrequencyColor(status),
        label: generateLastSeenLabel(daysSince),
      });
    }
    // Sort: overdue first, then approaching, then on-track
    const statusOrder: Record<FrequencyStatus, number> = {
      overdue: 0,
      approaching: 1,
      'on-track': 2,
      'no-goal': 3,
    };
    bars.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    setFrequencyBars(bars);

    // Drift detection
    const driftResults: DriftInfo[] = [];
    for (const person of people) {
      const hangouts = listHangoutsForPerson(db, person.id);
      const dates = hangouts.map((h) => h.happened_at);
      const drift = detectDrift(person.display_name, person.id, dates);
      if (drift) driftResults.push(drift);
    }
    driftResults.sort((a, b) => b.driftRatio - a.driftRatio);
    setDrifts(driftResults);

    setLoading(false);
  }, [db]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDismiss = useCallback(
    (nudgeId: string) => {
      dismissNudge(db, nudgeId);
      setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
    },
    [db],
  );

  const handleSnooze = useCallback(
    (nudgeId: string) => {
      const until = new Date();
      until.setDate(until.getDate() + 7);
      snoozeNudge(db, nudgeId, until.toISOString());
      setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
    },
    [db],
  );

  const handleActOn = useCallback(
    (nudgeId: string) => {
      actOnNudge(db, nudgeId);
      setActedNudgeIds((prev) => new Set(prev).add(nudgeId));
      setTimeout(() => {
        setNudges((prev) => prev.filter((n) => n.id !== nudgeId));
        setActedNudgeIds((prev) => {
          const next = new Set(prev);
          next.delete(nudgeId);
          return next;
        });
      }, 2000);
    },
    [db],
  );

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const isEmpty = nudges.length === 0 && frequencyBars.length === 0 && drifts.length === 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptySubtitle}>Loading...</Text>
          </View>
        ) : isEmpty ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Activity size={48} color={ACCENT} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>All good!</Text>
            <Text style={styles.emptySubtitle}>
              No nudges or alerts right now. Your relationships are looking healthy.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={ACCENT}
              />
            }
          >
            {/* Active Nudges */}
            {nudges.length > 0 && (
              <Section
                title="Active Nudges"
                count={nudges.length}
                collapsed={collapsedSections.has('nudges')}
                onToggle={() => toggleSection('nudges')}
              >
                {nudges.map((nudge) => (
                  <NudgeCard
                    key={nudge.id}
                    nudge={nudge}
                    acted={actedNudgeIds.has(nudge.id)}
                    onDismiss={() => handleDismiss(nudge.id)}
                    onSnooze={() => handleSnooze(nudge.id)}
                    onAct={() => handleActOn(nudge.id)}
                  />
                ))}
              </Section>
            )}

            {/* Frequency Overview */}
            {frequencyBars.length > 0 && (
              <Section
                title="Frequency Overview"
                count={frequencyBars.length}
                collapsed={collapsedSections.has('frequency')}
                onToggle={() => toggleSection('frequency')}
              >
                {frequencyBars.map((bar) => (
                  <FrequencyBarCard key={bar.personId} bar={bar} />
                ))}
              </Section>
            )}

            {/* Drift Alerts */}
            {drifts.length > 0 && (
              <Section
                title="Drift Alerts"
                count={drifts.length}
                collapsed={collapsedSections.has('drift')}
                onToggle={() => toggleSection('drift')}
              >
                {drifts.map((drift) => (
                  <DriftCard key={drift.personId} drift={drift} />
                ))}
              </Section>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────

function Section({
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable onPress={onToggle} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionRight}>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
          <Text style={styles.chevron}>{collapsed ? '\u25BC' : '\u25B2'}</Text>
        </View>
      </Pressable>
      {!collapsed && children}
    </View>
  );
}

// ── Nudge card ──────────────────────────────────────────────────────

function NudgeCard({
  nudge,
  acted,
  onDismiss,
  onSnooze,
  onAct,
}: {
  nudge: NudgeWithPerson;
  acted: boolean;
  onDismiss: () => void;
  onSnooze: () => void;
  onAct: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (acted) {
      Animated.timing(fadeAnim, {
        toValue: 0.4,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [acted, fadeAnim]);

  const urgencyColor = URGENCY_COLORS[nudge.urgency];
  const urgencyLabel = URGENCY_LABELS[nudge.urgency];
  const initials = getInitials(nudge.personName);
  const bgColor = getGradient(nudge.personName);

  return (
    <Animated.View style={[styles.nudgeCard, { opacity: fadeAnim }]}>
      <View style={[styles.nudgeAccent, { backgroundColor: urgencyColor }]} />
      <View style={styles.nudgeBody}>
        {/* Top row */}
        <View style={styles.nudgeTopRow}>
          <View style={[styles.miniAvatar, { backgroundColor: bgColor }]}>
            <Text style={styles.miniAvatarText}>{initials}</Text>
          </View>
          <View style={styles.nudgeInfo}>
            <Text style={styles.nudgeName}>{nudge.personName}</Text>
            <View style={styles.nudgeMetaRow}>
              <View style={[styles.urgencyBadge, { backgroundColor: `${urgencyColor}20` }]}>
                <View style={[styles.urgencyDot, { backgroundColor: urgencyColor }]} />
                <Text style={[styles.urgencyText, { color: urgencyColor }]}>{urgencyLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Message */}
        {acted ? (
          <Text style={styles.actedMessage}>Nice! Hope it went well.</Text>
        ) : (
          <Text style={styles.nudgeMessage}>{nudge.message}</Text>
        )}

        {/* Actions */}
        {!acted && (
          <View style={styles.nudgeActions}>
            <Pressable onPress={onDismiss} style={styles.actionButton}>
              <Text style={styles.actionDismiss}>Dismiss</Text>
            </Pressable>
            <Pressable onPress={onSnooze} style={styles.actionButton}>
              <Text style={styles.actionSnooze}>Snooze 7d</Text>
            </Pressable>
            <Pressable onPress={onAct} style={[styles.actionButton, styles.actionActButton]}>
              <Text style={styles.actionAct}>Reached out!</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ── Frequency bar card ──────────────────────────────────────────────

function FrequencyBarCard({ bar }: { bar: FrequencyBar }) {
  const fill = bar.daysSince !== null
    ? Math.min(bar.daysSince / bar.goalDays, 1)
    : 1;
  const daysLabel =
    bar.daysSince !== null ? `${bar.daysSince}/${bar.goalDays}d` : `?/${bar.goalDays}d`;

  return (
    <View style={styles.freqCard}>
      <View style={styles.freqTopRow}>
        <View style={styles.freqNameRow}>
          <View style={[styles.miniAvatar, { backgroundColor: getGradient(bar.personName), width: 28, height: 28, borderRadius: 14 }]}>
            <Text style={[styles.miniAvatarText, { fontSize: 11 }]}>{getInitials(bar.personName)}</Text>
          </View>
          <Text style={styles.freqName} numberOfLines={1}>{bar.personName}</Text>
        </View>
        <Text style={[styles.freqDays, { color: bar.color }]}>{daysLabel}</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.max(fill * 100, 2)}%`, backgroundColor: bar.color },
          ]}
        />
      </View>
      <Text style={styles.freqLabel}>{bar.label}</Text>
    </View>
  );
}

// ── Drift card ──────────────────────────────────────────────────────

function DriftCard({ drift }: { drift: DriftInfo }) {
  return (
    <View style={styles.driftCard}>
      <View style={[styles.driftAccent, { backgroundColor: '#F59E0B' }]} />
      <View style={styles.driftBody}>
        <Text style={styles.driftMessage}>{drift.message}</Text>
        <Text style={styles.driftMeta}>
          Pattern: every ~{drift.historicalAvgDays}d | Current gap: {drift.currentGapDays}d | {drift.driftRatio}x usual
        </Text>
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    backgroundColor: `${ACCENT}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: ACCENT,
  },
  chevron: {
    fontSize: 10,
    color: TEXT_SECONDARY,
  },

  // Nudge card
  nudgeCard: {
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 10,
    overflow: 'hidden',
  },
  nudgeAccent: {
    width: 4,
  },
  nudgeBody: {
    flex: 1,
    padding: 14,
  },
  nudgeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nudgeInfo: {
    flex: 1,
    gap: 4,
  },
  nudgeName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  nudgeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  urgencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  nudgeMessage: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
    marginBottom: 12,
  },
  actedMessage: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 4,
  },
  nudgeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS,
  },
  actionActButton: {
    backgroundColor: `${ACCENT}15`,
    borderColor: `${ACCENT}40`,
  },
  actionDismiss: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9F8E81',
  },
  actionSnooze: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
  },
  actionAct: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },

  // Frequency bars
  freqCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 8,
  },
  freqTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  freqNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  freqName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    flex: 1,
  },
  freqDays: {
    fontSize: 13,
    fontWeight: '700',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: SURFACE,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  freqLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 6,
  },

  // Drift card
  driftCard: {
    flexDirection: 'row',
    borderRadius: 14,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 8,
    overflow: 'hidden',
  },
  driftAccent: {
    width: 3,
  },
  driftBody: {
    flex: 1,
    padding: 14,
  },
  driftMessage: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
    marginBottom: 6,
  },
  driftMeta: {
    fontSize: 11,
    color: '#9F8E81',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
});
