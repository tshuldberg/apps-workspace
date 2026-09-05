import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { SurfSpot } from '@mylife/surf';
import {
  countFavoriteSpots,
  countSessions,
  countSpots,
  getAverageWaveHeightFt,
  getSpots,
  toggleSpotFavorite,
} from '@mylife/surf';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  SURF_ACCENT,
  SurfEmptyState,
  SurfGlassCard,
  SurfHero,
  SurfMetricCard,
  SurfScreen,
  SurfSection,
} from './_ui';

interface Overview {
  spots: number;
  favorites: number;
  avgWaveHeightFt: number;
  sessions: number;
}

export default function SurfHomeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview>({
    spots: 0,
    favorites: 0,
    avgWaveHeightFt: 0,
    sessions: 0,
  });
  const [spots, setSpots] = useState<SurfSpot[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadData = useCallback(() => {
    setOverview({
      spots: countSpots(db),
      favorites: countFavoriteSpots(db),
      avgWaveHeightFt: getAverageWaveHeightFt(db),
      sessions: countSessions(db),
    });
    setSpots(getSpots(db));
  }, [db]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const favoriteSpots = useMemo(() => spots.filter((spot) => spot.isFavorite).slice(0, 6), [spots]);
  const topSpots = favoriteSpots.length > 0 ? favoriteSpots : spots.slice(0, 6);

  return (
    <SurfScreen
      contentContainerStyle={styles.container}
    >
      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHandle} />
            <View>
              {[
                { label: 'Spots', route: '/(surf)/spots' },
                { label: 'Activity Feed', route: '/(surf)/feed' },
                { label: 'Regions', route: '/(surf)/regions' },
                { label: 'Alerts', route: '/(surf)/alerts' },
                { label: 'Crew', route: '/(surf)/crew' },
                { label: 'Wave Detect', route: '/(surf)/wave-detect' },
                { label: 'Buoys', route: '/(surf)/buoys' },
                { label: 'Tides', route: '/(surf)/tides' },
                { label: 'Favorites', route: '/(surf)/favorites' },
                { label: 'Settings', route: '/(surf)/settings' },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  style={styles.menuItem}
                  onPress={() => { setMenuOpen(false); router.push(item.route as never); }}
                >
                  <Text variant="body" color={colors.text}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <SurfHero
        title="MySurf"
        subtitle="Forecast windows, favorites, and session logging in one private surf dashboard."
        action={
          <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)}>
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </Pressable>
        }
      />

      <View style={styles.metricGrid}>
        <SurfMetricCard label="Tracked Spots" value={String(overview.spots)} hint="Pinned lineup coverage" />
        <SurfMetricCard label="Favorites" value={String(overview.favorites)} hint="Ready at a glance" />
        <SurfMetricCard label="Avg Wave" value={`${overview.avgWaveHeightFt.toFixed(1)} ft`} hint="Across tracked regions" />
        <SurfMetricCard label="Sessions" value={String(overview.sessions)} hint="Logged in the journal" />
      </View>

      <SurfSection eyebrow="Favorites" title={favoriteSpots.length > 0 ? 'Favorite Breaks' : 'Spot Feed'}>
        {topSpots.length === 0 ? (
          <SurfEmptyState
            icon="🌊"
            title="Your surf dashboard is ready"
            copy="Pin your first spot from the Map or Spots tab to start tracking conditions."
          />
        ) : (
          <View style={styles.list}>
          {topSpots.map((spot) => (
            <SurfGlassCard key={spot.id}>
              <View style={styles.itemHeader}>
                <Pressable style={styles.itemCopy} onPress={() => router.push(`/(surf)/spot/${spot.id}` as never)}>
                  <View style={styles.spotTopRow}>
                    <Text variant="body" style={styles.spotName}>
                      {spot.name}
                    </Text>
                    <Text variant="body" style={styles.waveValue}>
                      {spot.waveHeightFt.toFixed(1)} ft
                    </Text>
                  </View>
                  <Text variant="caption" color={colors.textSecondary}>
                    {spot.region} · {spot.breakType} · wind {spot.windKts.toFixed(0)} kts
                  </Text>
                </Pressable>
                <Pressable onPress={() => {
                  toggleSpotFavorite(db, spot.id);
                  loadData();
                }}>
                  <Text variant="label" color={spot.isFavorite ? colors.modules.surf : colors.textSecondary}>
                    {spot.isFavorite ? '★' : '☆'}
                  </Text>
                </Pressable>
              </View>
            </SurfGlassCard>
          ))}
          </View>
        )}
      </SurfSection>
    </SurfScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  spotTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spotName: {
    fontWeight: '700',
  },
  waveValue: {
    color: SURF_ACCENT,
    fontWeight: '700',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
    backgroundColor: '#12121A',
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
