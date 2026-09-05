import { useCallback, useMemo, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  getProperties, getAllActiveSchedules, getCostEntriesForProperty,
  calculateScheduleStatus, sortByUrgency, getTaskTypeLabel,
  getCostSummary, markComplete, updateSchedule,
  type ScheduleWithStatus,
} from '@mylife/homes';
import { useHomeSettings } from '../../hooks/homes/use-settings';

const ACCENT = colors.modules.homes;

function formatCents(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export default function HomesDashboard() {
  const db = useDatabase();
  const router = useRouter();
  const settings = useHomeSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const properties = useMemo(() => getProperties(db), [db, tick]);
  const defaultPropId = settings.get('default_property_id');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activePropertyId = selectedId ?? defaultPropId ?? properties[0]?.id ?? null;
  const activeProperty = properties.find((p) => p.id === activePropertyId) ?? null;

  const allSchedules = useMemo(() => getAllActiveSchedules(db), [db, tick]);
  const schedulesWithStatus: ScheduleWithStatus[] = useMemo(
    () => allSchedules
      .filter((s) => !activePropertyId || s.propertyId === activePropertyId)
      .map((s) => ({ ...s, status: calculateScheduleStatus(s.nextDueDate) })),
    [allSchedules, activePropertyId],
  );
  const sorted = sortByUrgency(schedulesWithStatus);
  const overdue = sorted.filter((s) => s.status === 'overdue');
  const dueSoon = sorted.filter((s) => s.status === 'due_soon');
  const alerts = [...overdue, ...dueSoon].slice(0, 3);

  const costs = useMemo(
    () => activePropertyId ? getCostEntriesForProperty(db, activePropertyId) : [],
    [db, activePropertyId, tick],
  );
  const costSummary = getCostSummary(costs);

  const handleComplete = (schedule: ScheduleWithStatus) => {
    const result = markComplete(schedule);
    updateSchedule(db, schedule.id, {
      lastCompletedDate: result.lastCompletedDate,
      nextDueDate: result.nextDueDate,
      snoozeDays: 0,
      snoozeCount: 0,
    });
    refresh();
  };

  // Empty state: no properties
  if (properties.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏠</Text>
        <Text variant="heading" style={styles.emptyTitle}>Your home awaits</Text>
        <Text variant="body" color={colors.textSecondary} style={styles.emptyBody}>
          Add your first property to start tracking maintenance, costs, and more.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/(homes)/onboarding')}>
          <Text variant="label" color={colors.background}>Add Your First Property</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Text variant="heading" style={styles.greeting}>Home</Text>
        <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHandle} />
            <ScrollView bounces={false}>
              {[
                { label: 'Insights', route: '/(homes)/insights' },
                { label: 'Costs', route: '/(homes)/cost' },
                { label: 'Contractors', route: '/(homes)/contractor' },
                { label: 'Insurance', route: '/(homes)/insurance' },
                { label: 'Documents', route: '/(homes)/document' },
                { label: 'Inventory', route: '/(homes)/inventory' },
                { label: 'Appliances', route: '/(homes)/appliance' },
                { label: 'Projects', route: '/(homes)/project' },
                { label: 'Project Timeline', route: '/(homes)/project/dependencies' },
                { label: 'Cost Predictor', route: '/(homes)/cost-predictor' },
                { label: 'Forecasting', route: '/(homes)/forecasting' },
                { label: 'Warranties', route: '/(homes)/warranties' },
                { label: 'Settings', route: '/(homes)/settings' },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  style={styles.menuItem}
                  onPress={() => { setMenuOpen(false); router.push(item.route as never); }}
                >
                  <Text variant="body" color={colors.text}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Hero greeting */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>
          {activeProperty?.name ?? 'Your Home'}
        </Text>
        {activeProperty?.address && (
          <Text variant="body" color={colors.textSecondary}>
            {activeProperty.address}
            {activeProperty.city ? `, ${activeProperty.city}` : ''}
          </Text>
        )}
        {activeProperty && (
          <View style={styles.badgeRow}>
            <Badge label={activeProperty.propertyType} />
            <Badge label={activeProperty.ownershipType === 'own' ? 'Owner' : 'Renter'} />
          </View>
        )}
      </View>

      {/* Property switcher */}
      {properties.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherRow}>
          {properties.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.switcherPill, p.id === activePropertyId && styles.switcherPillActive]}
              onPress={() => setSelectedId(p.id)}
            >
              <Text
                variant="label"
                color={p.id === activePropertyId ? colors.background : colors.textSecondary}
              >
                {p.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Alert rows */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          {alerts.map((s) => (
            <View
              key={s.id}
              style={[
                styles.alertRow,
                { borderLeftColor: s.status === 'overdue' ? colors.danger : ACCENT },
              ]}
            >
              <View style={styles.alertContent}>
                <Text variant="body" numberOfLines={1}>
                  {getTaskTypeLabel(s.taskType, s.taskTypeCustom)}
                </Text>
                <Text variant="caption" color={s.status === 'overdue' ? colors.danger : ACCENT}>
                  {s.status === 'overdue' ? 'Overdue' : 'Due soon'}
                  {s.nextDueDate ? ` · ${s.nextDueDate.slice(0, 10)}` : ''}
                </Text>
              </View>
              <Pressable
                style={styles.ghostButton}
                onPress={() => handleComplete(s)}
              >
                <Text variant="label" color={colors.success}>Done</Text>
              </Pressable>
            </View>
          ))}
          {overdue.length + dueSoon.length > 3 && (
            <Pressable onPress={() => router.push('/(homes)/maintenance')}>
              <Text variant="caption" color={ACCENT}>
                View all {overdue.length + dueSoon.length} alerts
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Quick actions */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
        <QuickAction label="Log Cost" icon="💰" onPress={() => router.push(`/(homes)/cost/add?propertyId=${activePropertyId}`)} />
        <QuickAction label="Add Task" icon="🔧" onPress={() => router.push(`/(homes)/maintenance/add?propertyId=${activePropertyId}`)} />
        <QuickAction label="Find Pro" icon="👷" onPress={() => router.push('/(homes)/contractor/')} />
        <QuickAction label="Scan Doc" icon="📄" onPress={() => router.push(`/(homes)/document/add?propertyId=${activePropertyId}`)} />
      </ScrollView>

      {/* This Month cost snapshot */}
      <Pressable onPress={() => router.push(`/(homes)/cost/?propertyId=${activePropertyId}`)}>
        <Card style={styles.costCard}>
          <Text style={styles.costAmount}>{formatCents(costSummary.totalCents)}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            spent across {Object.keys(costSummary.byCategory).length} categories
          </Text>
          <View style={styles.categoryBar}>
            {Object.entries(costSummary.byCategory).map(([cat, cents], i) => (
              <View
                key={cat}
                style={[
                  styles.categorySegment,
                  {
                    flex: cents / Math.max(costSummary.totalCents, 1),
                    backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                  },
                ]}
              />
            ))}
          </View>
        </Card>
      </Pressable>

      {/* Upcoming maintenance */}
      {sorted.length > 0 && (
        <View style={styles.section}>
          <Text variant="subheading">Coming Up</Text>
          {sorted.slice(0, 3).map((s) => (
            <View key={s.id} style={styles.upcomingRow}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[s.status] }]} />
              <Text variant="body" style={styles.flex1} numberOfLines={1}>
                {getTaskTypeLabel(s.taskType, s.taskTypeCustom)}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                {s.nextDueDate?.slice(0, 10) ?? 'No date'}
              </Text>
            </View>
          ))}
          <Pressable onPress={() => router.push('/(homes)/maintenance')}>
            <Text variant="caption" color={ACCENT}>View All</Text>
          </Pressable>
        </View>
      )}

      {/* Settings gear */}
      <Pressable
        style={styles.settingsLink}
        onPress={() => router.push('/(homes)/settings')}
        accessibilityLabel="Settings"
      >
        <Text variant="caption" color={colors.textSecondary}>⚙️ Settings</Text>
      </Pressable>
    </ScrollView>
  );
}

const CATEGORY_COLORS = [colors.modules.homes, colors.success, colors.accent, colors.modules.stars, colors.danger];
const STATUS_COLORS: Record<string, string> = {
  overdue: colors.danger,
  due_soon: ACCENT,
  ok: colors.success,
  unknown: colors.textTertiary,
};

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text variant="label" style={styles.badgeText}>{label.toUpperCase()}</Text>
    </View>
  );
}

function QuickAction({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickPill} onPress={onPress}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text variant="label" color={colors.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  emptyContainer: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  emptyIcon: { fontSize: 64, marginBottom: spacing.md },
  emptyTitle: { marginBottom: spacing.sm, textAlign: 'center' },
  emptyBody: { textAlign: 'center', marginBottom: spacing.lg },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  hero: { padding: spacing.md, gap: spacing.xs },
  heroTitle: {
    fontSize: 36, lineHeight: 44, fontWeight: '800', color: colors.text, fontFamily: 'Inter',
  },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  badge: {
    backgroundColor: colors.glassStrong,
    borderRadius: 4,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
  badgeText: { fontSize: 12 },
  switcherRow: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  switcherPill: {
    backgroundColor: colors.glassStrong,
    borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    marginRight: spacing.sm,
  },
  switcherPillActive: { backgroundColor: ACCENT },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  alertRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.glass, borderRadius: 8,
    borderLeftWidth: 3, padding: spacing.sm, gap: spacing.sm,
  },
  alertContent: { flex: 1, gap: 2 },
  ghostButton: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: 4, borderWidth: 1, borderColor: colors.success,
  },
  quickRow: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  quickPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.glassStrong, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  costCard: { marginHorizontal: spacing.md, marginTop: spacing.lg },
  costAmount: { fontSize: 24, fontWeight: '700', color: ACCENT },
  categoryBar: {
    flexDirection: 'row', height: 6, borderRadius: 3,
    overflow: 'hidden', marginTop: spacing.sm,
  },
  categorySegment: { height: 6 },
  upcomingRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  flex1: { flex: 1 },
  settingsLink: { alignItems: 'center', marginTop: spacing.xl, paddingVertical: spacing.md },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  greeting: {
    marginBottom: spacing.xs,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
    maxHeight: '70%',
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  menuItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
