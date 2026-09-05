import { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { Stack } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import { Heart } from 'lucide-react-native';
import {
  listPeople,
  listHangouts,
  getTimeDistribution,
  getInnerCircle,
  getTimeVsQualityQuadrant,
  getEnergyCorrelation,
  type PersonTimeShare,
  type QualityCorrelation,
  type TimeQualityQuadrant,
  type EnergyBreakdown,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const INNER_CIRCLE_PINK = '#F472B6';
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SURFACE = '#2A292F';

// Energy tag colors matching the existing pattern
const ENERGY_COLORS: Record<string, string> = {
  energizing: '#10B981',
  neutral: '#9F8E81',
  draining: '#EF4444',
  complicated: '#F59E0B',
};

const QUADRANT_LABELS: Record<TimeQualityQuadrant, { label: string; color: string }> = {
  'high-time-high-quality': { label: 'Core (high time, high quality)', color: '#10B981' },
  'high-time-low-quality': { label: 'Habitual (high time, lower quality)', color: '#F59E0B' },
  'low-time-high-quality': { label: 'Cherished (low time, high quality)', color: '#8BCFF0' },
  'low-time-low-quality': { label: 'Casual (low time, lower quality)', color: '#9F8E81' },
};

// ── Avatar helpers ──────────────────────────────────────────────────

const GRADIENT_PAIRS: string[] = [
  '#EC4899', '#8B5CF6', '#06B6D4', '#F59E0B',
  '#10B981', '#EF4444', '#6366F1', '#E879A1',
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getGradient(name: string): string {
  return GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ── Main component ──────────────────────────────────────────────────

export default function InsightsQualityScreen() {
  const db = useDatabase();

  const [timeDistribution, setTimeDistribution] = useState<PersonTimeShare[]>([]);
  const [innerCircle, setInnerCircle] = useState<QualityCorrelation[]>([]);
  const [quadrants, setQuadrants] = useState<Array<{ personId: string; personName: string; quadrant: TimeQualityQuadrant }>>([]);
  const [energyBreakdown, setEnergyBreakdown] = useState<EnergyBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revealedSections, setRevealedSections] = useState<Set<string>>(new Set());

  const loadData = useCallback(() => {
    const people = listPeople(db, { is_archived: false });
    const hangouts = listHangouts(db, {});

    const hangoutData = hangouts.map((h) => ({
      people_ids: h.people_ids,
      duration_minutes: h.duration_minutes,
      quality_rating: h.quality_rating,
    }));

    const peopleData = people.map((p) => ({
      id: p.id,
      display_name: p.display_name,
    }));

    const peopleWithEnergy = people.map((p) => ({
      id: p.id,
      display_name: p.display_name,
      energy_tag: p.energy_tag,
    }));

    // Time distribution (top 10)
    const dist = getTimeDistribution(hangoutData, peopleData);
    setTimeDistribution(dist.slice(0, 10));

    // Inner circle
    const circle = getInnerCircle(hangoutData, peopleData, 5);
    setInnerCircle(circle);

    // Quadrants
    const allStats = getTimeDistribution(hangoutData, peopleData);
    const quads = peopleData.map((p) => ({
      personId: p.id,
      personName: p.display_name,
      quadrant: getTimeVsQualityQuadrant(p.id, hangoutData, allStats),
    }));
    // Group by quadrant, filter out those without hangouts
    const withHangouts = quads.filter((q) =>
      allStats.some((s) => s.personId === q.personId),
    );
    setQuadrants(withHangouts);

    // Energy correlation
    const energy = getEnergyCorrelation(hangoutData, peopleWithEnergy);
    setEnergyBreakdown(energy);

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

  const toggleReveal = useCallback((section: string) => {
    setRevealedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const isEmpty =
    timeDistribution.length === 0 &&
    innerCircle.length === 0 &&
    energyBreakdown.length === 0;

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
              <Heart size={48} color={ACCENT} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySubtitle}>
              Log some hangouts with duration and quality ratings to see quality insights here.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
            }
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerLabel}>INSIGHTS</Text>
              <Text style={styles.headerTitle}>Quality of Time</Text>
              <Text style={styles.headerSubtitle}>
                Just for your awareness. A reflection on how you spend time with the people in your life.
              </Text>
            </View>

            {/* Where your time goes */}
            <OptInSection
              title="Where your time goes"
              subtitle="Top 10 people by total hangout time"
              revealed={revealedSections.has('time')}
              onToggle={() => toggleReveal('time')}
            >
              {timeDistribution.map((person) => (
                <TimeBar key={person.personId} person={person} maxMinutes={timeDistribution[0]?.totalMinutes ?? 1} />
              ))}
            </OptInSection>

            {/* Inner circle */}
            <OptInSection
              title="Your inner circle"
              subtitle="Top 5 by combined time + quality"
              revealed={revealedSections.has('circle')}
              onToggle={() => toggleReveal('circle')}
            >
              <View style={styles.circleRow}>
                {innerCircle.map((person) => (
                  <View key={person.personId} style={styles.circleItem}>
                    <View style={[styles.circleAvatar, { backgroundColor: getGradient(person.personName) }]}>
                      <Text style={styles.circleAvatarText}>{getInitials(person.personName)}</Text>
                    </View>
                    <Text style={styles.circleName} numberOfLines={1}>{person.personName}</Text>
                    <Text style={styles.circleStat}>
                      {Math.round(person.totalMinutes / 60)}h | {person.avgQuality.toFixed(1)}
                    </Text>
                  </View>
                ))}
              </View>
            </OptInSection>

            {/* Quality patterns */}
            <OptInSection
              title="Quality patterns"
              subtitle="Time vs quality quadrant per person"
              revealed={revealedSections.has('quadrants')}
              onToggle={() => toggleReveal('quadrants')}
            >
              {Object.entries(QUADRANT_LABELS).map(([quad, meta]) => {
                const inQuad = quadrants.filter((q) => q.quadrant === quad);
                if (inQuad.length === 0) return null;
                return (
                  <View key={quad} style={styles.quadrantGroup}>
                    <View style={styles.quadrantLabelRow}>
                      <View style={[styles.quadrantDot, { backgroundColor: meta.color }]} />
                      <Text style={styles.quadrantLabel}>{meta.label}</Text>
                      <Text style={styles.quadrantCount}>{inQuad.length}</Text>
                    </View>
                    <View style={styles.quadrantPeople}>
                      {inQuad.slice(0, 5).map((q) => (
                        <View key={q.personId} style={styles.quadrantChip}>
                          <Text style={styles.quadrantChipText}>{q.personName}</Text>
                        </View>
                      ))}
                      {inQuad.length > 5 && (
                        <Text style={styles.quadrantMore}>+{inQuad.length - 5} more</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </OptInSection>

            {/* Energy awareness */}
            <OptInSection
              title="Energy awareness"
              subtitle="How time breaks down by energy type"
              revealed={revealedSections.has('energy')}
              onToggle={() => toggleReveal('energy')}
            >
              {energyBreakdown.map((item) => (
                <View key={item.energyTag} style={styles.energyCard}>
                  <View style={[styles.energyDot, { backgroundColor: ENERGY_COLORS[item.energyTag] ?? '#9F8E81' }]} />
                  <View style={styles.energyInfo}>
                    <Text style={styles.energyTag}>{item.energyTag}</Text>
                    <Text style={styles.energyMeta}>
                      {Math.round(item.totalMinutes / 60)}h total | {item.personCount} people | avg quality {item.avgQuality.toFixed(1)}
                    </Text>
                  </View>
                </View>
              ))}
            </OptInSection>

            <View style={styles.footer} />
          </ScrollView>
        )}
      </View>
    </>
  );
}

// ── Opt-in section (collapsed by default) ───────────────────────────

function OptInSection({
  title,
  subtitle,
  revealed,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  revealed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable onPress={onToggle} style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        {!revealed ? (
          <View style={styles.revealBadge}>
            <Text style={styles.revealText}>Tap to reveal</Text>
          </View>
        ) : (
          <Text style={styles.chevron}>{'\u25B2'}</Text>
        )}
      </Pressable>
      {revealed && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

// ── Time bar ────────────────────────────────────────────────────────

function TimeBar({ person, maxMinutes }: { person: PersonTimeShare; maxMinutes: number }) {
  const fill = maxMinutes > 0 ? person.totalMinutes / maxMinutes : 0;
  return (
    <View style={styles.timeBarCard}>
      <View style={styles.timeBarTop}>
        <View style={styles.timeBarNameRow}>
          <View style={[styles.miniAvatar, { backgroundColor: getGradient(person.personName) }]}>
            <Text style={styles.miniAvatarText}>{getInitials(person.personName)}</Text>
          </View>
          <Text style={styles.timeBarName} numberOfLines={1}>{person.personName}</Text>
        </View>
        <Text style={styles.timeBarPercent}>{person.percentOfTotal}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(fill * 100, 2)}%` }]} />
      </View>
      <Text style={styles.timeBarMeta}>
        {Math.round(person.totalMinutes / 60)}h {person.totalMinutes % 60}m | {person.hangoutCount} hangouts
      </Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 },

  // Header
  header: { marginBottom: 24 },
  headerLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: TEXT_SECONDARY, marginBottom: 6 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 8 },
  headerSubtitle: { fontSize: 14, color: TEXT_SECONDARY, lineHeight: 20 },

  // Section
  section: { marginBottom: 20, borderRadius: 16, backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_BORDER, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: TEXT_SECONDARY },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16 },
  revealBadge: { backgroundColor: `${ACCENT}15`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  revealText: { fontSize: 12, fontWeight: '600', color: ACCENT },
  chevron: { fontSize: 10, color: TEXT_SECONDARY },

  // Time bars
  timeBarCard: { marginBottom: 10 },
  timeBarTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  timeBarNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  timeBarName: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY, flex: 1 },
  timeBarPercent: { fontSize: 13, fontWeight: '700', color: ACCENT },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: SURFACE, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: ACCENT },
  timeBarMeta: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 4 },

  // Inner circle
  circleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  circleItem: { alignItems: 'center', width: 72 },
  circleAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: INNER_CIRCLE_PINK },
  circleAvatarText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  circleName: { fontSize: 12, fontWeight: '600', color: TEXT_PRIMARY, marginTop: 6, textAlign: 'center' },
  circleStat: { fontSize: 10, color: TEXT_SECONDARY, marginTop: 2, textAlign: 'center' },

  // Quadrants
  quadrantGroup: { marginBottom: 14 },
  quadrantLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  quadrantDot: { width: 8, height: 8, borderRadius: 4 },
  quadrantLabel: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY, flex: 1 },
  quadrantCount: { fontSize: 12, fontWeight: '700', color: TEXT_SECONDARY },
  quadrantPeople: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quadrantChip: { backgroundColor: SURFACE, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  quadrantChipText: { fontSize: 12, color: TEXT_PRIMARY },
  quadrantMore: { fontSize: 12, color: TEXT_SECONDARY, alignSelf: 'center' },

  // Energy
  energyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: GLASS_BORDER },
  energyDot: { width: 12, height: 12, borderRadius: 6 },
  energyInfo: { flex: 1 },
  energyTag: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY, textTransform: 'capitalize' },
  energyMeta: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },

  // Empty
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(236, 72, 153, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'center', marginBottom: 12 },
  emptySubtitle: { fontSize: 15, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 22, maxWidth: 280 },

  // Footer
  footer: { height: 40 },
});
