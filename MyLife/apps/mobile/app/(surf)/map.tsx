import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { SurfSpot } from '@mylife/surf';
import {
  createSpot,
  getSpots,
  toggleSpotFavorite,
} from '@mylife/surf';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  SURF_ACCENT,
  SurfChip,
  SurfGlassCard,
  SurfPrimaryButton,
  SurfScreen,
  SurfSection,
} from './_ui';

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function SurfMapScreen() {
  const db = useDatabase();

  const [spots, setSpots] = useState<SurfSpot[]>([]);
  const [regionFilter, setRegionFilter] = useState('all');

  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [breakType, setBreakType] = useState<SurfSpot['breakType']>('beach');

  const loadData = useCallback(() => {
    setSpots(
      getSpots(db, {
        region: regionFilter === 'all' ? undefined : regionFilter,
      }),
    );
  }, [db, regionFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const regions = useMemo(() => {
    const set = new Set(getSpots(db).map((spot) => spot.region));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [db, spots]);

  const handlePin = () => {
    if (!name.trim() || !region.trim()) return;
    createSpot(db, makeId('spot'), {
      name: name.trim(),
      region: region.trim(),
      breakType,
      waveHeightFt: 0,
      windKts: 0,
      tide: 'mid',
      swellDirection: 'W',
      isFavorite: false,
    });
    setName('');
    loadData();
  };

  return (
    <SurfScreen contentContainerStyle={styles.container}>
      <SurfSection eyebrow="Map" title="Conditions Map">
        <SurfGlassCard>
          <View style={styles.mapCard}>
            {spots.slice(0, 12).map((spot, index) => (
              <Pressable
                key={spot.id}
                style={[
                  styles.mapMarker,
                  {
                    left: `${12 + ((index * 17) % 76)}%`,
                    top: `${12 + ((index * 23) % 70)}%`,
                    backgroundColor:
                      spot.waveHeightFt >= 5 ? colors.success : spot.waveHeightFt >= 3 ? '#EAB308' : colors.danger,
                  },
                ]}
                onPress={() => toggleSpotFavorite(db, spot.id)}
              />
            ))}
            <View style={styles.mapOverlay}>
              <Text variant="subheading">Dark swell map</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Tap markers for quick condition checks and favorite toggles.
              </Text>
            </View>
          </View>
        </SurfGlassCard>
        <View style={styles.rowWrap}>
          {regions.map((item) => (
            <SurfChip
              key={item}
              label={item === 'all' ? 'All regions' : item}
              active={item === regionFilter}
              onPress={() => setRegionFilter(item)}
            />
          ))}
        </View>
      </SurfSection>

      <SurfSection title="Pin Spot">
        <SurfGlassCard style={styles.sectionCard}>
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Spot name"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Region"
            placeholderTextColor={colors.textTertiary}
            value={region}
            onChangeText={setRegion}
          />
          <View style={styles.rowWrap}>
            {(['beach', 'point', 'reef', 'river-mouth', 'other'] as const).map((value) => (
              <SurfChip
                key={value}
                label={value}
                active={breakType === value}
                onPress={() => setBreakType(value)}
              />
            ))}
          </View>
          <SurfPrimaryButton label="Pin Spot" onPress={handlePin} />
        </View>
        </SurfGlassCard>
      </SurfSection>

      <SurfSection title="Quick Conditions">
      <View style={styles.list}>
        {spots.map((spot) => (
          <SurfGlassCard key={spot.id}>
            <View style={styles.itemHeader}>
              <View style={styles.itemCopy}>
                <View style={styles.itemTopRow}>
                  <Text variant="body" style={styles.itemTitle}>{spot.name}</Text>
                  <Text variant="body" style={styles.waveValue}>{spot.waveHeightFt.toFixed(1)} ft</Text>
                </View>
                <Text variant="caption" color={colors.textSecondary}>
                  {spot.region} · {spot.breakType} · wind {spot.windKts.toFixed(0)} kts
                </Text>
              </View>
              <Pressable onPress={() => {
                toggleSpotFavorite(db, spot.id);
                loadData();
              }}>
                <Text variant="label" color={spot.isFavorite ? colors.modules.surf : colors.textSecondary}>
                  {spot.isFavorite ? 'Favorited' : 'Favorite'}
                </Text>
              </Pressable>
            </View>
          </SurfGlassCard>
        ))}
      </View>
      </SurfSection>
    </SurfScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  mapCard: {
    minHeight: 240,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.16)',
  },
  mapMarker: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#F0F0F5',
  },
  mapOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: 'rgba(10,10,15,0.74)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionCard: {
    gap: spacing.sm,
  },
  form: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
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
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemTitle: {
    fontWeight: '700',
  },
  waveValue: {
    color: SURF_ACCENT,
    fontWeight: '700',
  },
});
