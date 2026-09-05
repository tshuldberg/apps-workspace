import React from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { Card, Text, colors, spacing } from '@mylife/ui';

interface Zone {
  id: string;
  name: string;
  slug: string;
  spotCount: number;
  country: string;
}

const SEED_ZONES: Zone[] = [
  { id: 'california', name: 'California', slug: 'california', spotCount: 200, country: 'US' },
  { id: 'pacific-nw', name: 'Pacific Northwest', slug: 'pacific-nw', spotCount: 45, country: 'US' },
  { id: 'hawaii', name: 'Hawaii', slug: 'hawaii', spotCount: 60, country: 'US' },
  { id: 'east-coast-south', name: 'East Coast South', slug: 'east-coast-south', spotCount: 35, country: 'US' },
  { id: 'east-coast-north', name: 'East Coast North', slug: 'east-coast-north', spotCount: 30, country: 'US' },
  { id: 'gulf-coast', name: 'Gulf Coast', slug: 'gulf-coast', spotCount: 20, country: 'US' },
];

function ZoneCard({ zone }: { zone: Zone }) {
  return (
    <Pressable>
      <Card>
        <View style={styles.cardHeader}>
          <Text variant="subheading">{zone.name}</Text>
          <View style={styles.badge}>
            <Text variant="caption" color={colors.modules.surf}>{zone.spotCount} spots</Text>
          </View>
        </View>
        <Text variant="caption" color={colors.textSecondary}>{zone.country}</Text>
      </Card>
    </Pressable>
  );
}

export default function RegionsScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={SEED_ZONES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ZoneCard zone={item} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="heading">Surf Zones</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Browse surf regions around the world
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: colors.glassStrong,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
