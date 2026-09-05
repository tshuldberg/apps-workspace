import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Box } from 'lucide-react-native';
import { useNode } from '../providers/NodeProvider';
import { HonestNotice, ScopeBadge } from '../components/kit';
import { type MkColors, MK_MONO, MK_RADIUS, formatBytes, shortHex } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';

export default function NodeScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const { pinned, stats, refresh } = useNode();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={pinned}
        keyExtractor={(m) => m.contentId}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 16 }]}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Text style={styles.title}>Local library</Text>
            <Text style={styles.subtitle}>Saved content on this device</Text>

            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Local storage active</Text>
              </View>
              <HonestNotice text="This view shows only content this device has actually stored. It does not claim another person has received, saved, or backed up anything." />
              <View style={styles.statsRow}>
                <Stat label="Items" value={String(stats.manifestCount)} />
                <Stat label="Pieces" value={String(stats.blockCount)} />
                <Stat label="Stored" value={formatBytes(stats.totalBytes)} />
              </View>
            </View>

            <Text style={styles.sectionLabel}>Saved items</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Box size={32} color={c.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyText}>
              Save something from Files or Advanced sharing and it will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open saved item ${item.name}`}
            onPress={() => router.push(`/pinned/${item.contentId}`)}
            style={({ pressed }) => [styles.itemCard, pressed && styles.pressed]}
          >
            <View style={styles.itemTop}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <ScopeBadge scope={item.scope} />
            </View>
            <Text style={styles.itemMeta}>
              {formatBytes(item.size)} · {item.sealedChunkIds.length} piece
              {item.sealedChunkIds.length === 1 ? '' : 's'}
            </Text>
            <Text style={styles.itemId}>{shortHex(item.contentId, 10, 8)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  list: { paddingHorizontal: 16, paddingBottom: 96, gap: 10 },
  headerWrap: { gap: 12, marginBottom: 4 },
  title: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: c.textSecondary, fontSize: 14, marginTop: -6 },
  statusCard: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
    marginTop: 4,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: c.success,
  },
  statusText: { color: c.text, fontSize: 16, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: c.accent, fontSize: 18, fontWeight: '800' },
  statLabel: {
    color: c.textTertiary,
    fontSize: 10,
    fontWeight: '600',
  },
  sectionLabel: {
    color: c.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  emptyText: {
    color: c.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 19,
  },
  itemCard: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    gap: 6,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemName: { flex: 1, color: c.text, fontSize: 15, fontWeight: '700' },
  itemMeta: { color: c.textSecondary, fontSize: 12 },
  itemId: { color: c.textTertiary, fontSize: 11, fontFamily: MK_MONO },
  pressed: { opacity: 0.7 },
});
