import { useMemo } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { getBirthProfile, getDailyReading } from '@mylife/stars';

const ACCENT = colors.modules.stars;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ActionRow {
  label: string;
  route: string;
}

export default function ProfileDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const profile = useMemo(() => (id ? getBirthProfile(db, id) : null), [db, id]);
  const today = new Date().toISOString().slice(0, 10);
  const reading = useMemo(
    () => (id ? getDailyReading(db, id, today) : null),
    [db, id, today],
  );

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text variant="subheading" color={colors.danger}>Profile not found</Text>
        <Text variant="body" color={colors.textSecondary}>
          This profile may have been deleted.
        </Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text variant="label" color={ACCENT}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const bigThree: Array<{ label: string; sign: string | null }> = [
    { label: 'Sun', sign: profile.sunSign },
    { label: 'Moon', sign: profile.moonSign },
    { label: 'Rising', sign: profile.risingSign },
  ];

  const actions: ActionRow[] = [
    { label: 'Birth Chart', route: `/(stars)/birth-chart?id=${profile.id}` },
    { label: 'Compatibility', route: '/(stars)/compatibility' },
    { label: 'Transits', route: '/(stars)/transit-timeline' },
    { label: 'Solar Return', route: `/(stars)/solar-return?id=${profile.id}` },
    { label: 'Progressions', route: `/(stars)/progressions?id=${profile.id}` },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Big Three */}
      <Card style={styles.bigThreeCard}>
        <Text variant="subheading" style={{ textAlign: 'center' }}>{profile.name}</Text>
        <View style={styles.bigThreeGrid}>
          {bigThree.map((item) => (
            <View key={item.label} style={styles.bigThreeItem}>
              <Text variant="caption" color={colors.textTertiary}>{item.label}</Text>
              <Text style={[styles.bigThreeSign, { color: item.sign ? ACCENT : colors.textTertiary }]}>
                {item.sign ? capitalize(item.sign) : '?'}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Birth Info */}
      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text variant="caption" color={colors.textTertiary}>Date</Text>
          <Text variant="body">{profile.birthDate}</Text>
        </View>
        {profile.birthTime ? (
          <View style={styles.infoRow}>
            <Text variant="caption" color={colors.textTertiary}>Time</Text>
            <Text variant="body">{profile.birthTime}</Text>
          </View>
        ) : null}
        {profile.birthPlace ? (
          <View style={styles.infoRow}>
            <Text variant="caption" color={colors.textTertiary}>Place</Text>
            <Text variant="body">{profile.birthPlace}</Text>
          </View>
        ) : null}
      </Card>

      {/* Actions */}
      <Card style={styles.actionsCard}>
        <Text variant="label" color={colors.textTertiary}>ACTIONS</Text>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            style={styles.actionRow}
            onPress={() => router.push(action.route as never)}
          >
            <Text variant="body">{action.label}</Text>
            <Text variant="body" color={colors.textTertiary}>{'\u203A'}</Text>
          </Pressable>
        ))}
      </Card>

      {/* Recent Readings */}
      <Card style={styles.readingsCard}>
        <Text variant="label" color={colors.textTertiary}>RECENT READINGS</Text>
        {reading ? (
          <View style={styles.readingItem}>
            <Text variant="body">{reading.date}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {reading.summary ?? 'No summary'}
            </Text>
            {reading.tarotCard ? (
              <Text variant="caption" color={ACCENT}>
                Card: {reading.tarotCard}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text variant="body" color={colors.textSecondary}>
            No readings yet
          </Text>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  backButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  bigThreeCard: { gap: spacing.md, alignItems: 'center' },
  bigThreeGrid: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'center' },
  bigThreeItem: { alignItems: 'center', gap: spacing.xs },
  bigThreeSign: { fontSize: 22, fontWeight: '700' },
  infoCard: { gap: spacing.sm },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  actionsCard: { gap: spacing.xs },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  readingsCard: { gap: spacing.sm },
  readingItem: { gap: spacing.xs },
});
