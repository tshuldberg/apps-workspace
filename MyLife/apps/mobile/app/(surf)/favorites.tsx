import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { SurfSpot } from '@mylife/surf';
import { getSpots, toggleSpotFavorite } from '@mylife/surf';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

export default function SurfFavoritesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [favorites, setFavorites] = useState<SurfSpot[]>([]);

  const loadFavorites = useCallback(() => {
    setFavorites(getSpots(db, { favoritesOnly: true }));
  }, [db]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.list}>
        {favorites.map((spot) => (
          <Card key={spot.id}>
            <View style={styles.itemHeader}>
              <Pressable
                style={styles.itemCopy}
                onPress={() => router.push(`/(surf)/spot/${spot.id}` as never)}
              >
                <Text variant="body">{spot.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {spot.region} · {spot.breakType} · {spot.waveHeightFt.toFixed(1)} ft · {spot.windKts.toFixed(0)} kts
                </Text>
              </Pressable>
              <Pressable onPress={() => {
                toggleSpotFavorite(db, spot.id);
                loadFavorites();
              }}>
                <Text variant="label" color={colors.textSecondary}>Remove</Text>
              </Pressable>
            </View>
          </Card>
        ))}
        {favorites.length === 0 && (
          <Card>
            <View style={styles.emptyState}>
              <Text variant="subheading">Star your go-to breaks</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Tap the star on any spot to add it to your favorites
              </Text>
            </View>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
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
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
});
