import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Text } from '@mylife/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDatabase } from '../../components/DatabaseProvider';
import { listRestaurants } from '@mylife/dining';
const ACCENT = '#DC2626';
const ACCENT_VISITED = '#30D158';
const ACCENT_WISHLIST = '#DC2626';
const BG = '#0E0E13';
const SURFACE = '#1B1B20';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];


function parseCuisines(cuisines: string | null): string[] {
  if (!cuisines) return [];
  try {
    return JSON.parse(cuisines);
  } catch {
    return [cuisines];
  }
}

export default function DiningMapScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setTick((v) => v + 1);
    }, []),
  );

  const restaurants = useMemo(() => {
    return listRestaurants(db, { limit: 500 });
  }, [db, tick]);

  const withCoords = restaurants.filter(
    (r) => r.lat != null && r.lng != null,
  );

  // Simple placeholder map view since Mapbox requires native setup
  // This provides a list-based location view that can be upgraded to Mapbox later
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Restaurant Map</Text>
        <Text style={styles.headerSubtitle}>
          {withCoords.length} of {restaurants.length} restaurants have locations
        </Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ACCENT_VISITED }]} />
          <Text style={styles.legendText}>Visited</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ACCENT_WISHLIST }]} />
          <Text style={styles.legendText}>Wishlist</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#52443A' }]} />
          <Text style={styles.legendText}>Other</Text>
        </View>
      </View>

      {/* Map placeholder */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderIcon}>{'\uD83D\uDDFA\uFE0F'}</Text>
        <Text style={styles.mapPlaceholderTitle}>Map View</Text>
        <Text style={styles.mapPlaceholderText}>
          Interactive Mapbox map coming soon. For now, browse your restaurants
          with location data below.
        </Text>
      </View>

      {/* Location cards list */}
      {withCoords.length > 0 ? (
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            RESTAURANTS WITH LOCATIONS ({withCoords.length})
          </Text>
          {withCoords.map((r) => {
            const cuisines = parseCuisines(r.cuisines);
            const pinColor =
              r.is_visited
                ? ACCENT_VISITED
                : r.is_wishlist
                  ? ACCENT_WISHLIST
                  : '#52443A';
            return (
              <Pressable
                key={r.id}
                style={styles.locationCard}
                onPress={() =>
                  router.push(
                    `/(dining)/restaurant/${r.id}` as `/${string}`,
                  )
                }
              >
                <View style={[styles.pinDot, { backgroundColor: pinColor }]} />
                <View style={styles.locationInfo}>
                  <Text style={styles.locationName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.locationAddress} numberOfLines={1}>
                    {[r.neighborhood, r.city].filter(Boolean).join(', ') ||
                      r.address ||
                      'No address'}
                  </Text>
                  {cuisines.length > 0 && (
                    <Text style={styles.locationCuisine} numberOfLines={1}>
                      {cuisines.join(', ')}
                    </Text>
                  )}
                </View>
                {r.average_rating != null && (
                  <Text style={styles.locationRating}>
                    {'★'} {r.average_rating.toFixed(1)}
                  </Text>
                )}
                {r.price_tier != null && (
                  <Text style={styles.locationPrice}>
                    {PRICE_LABELS[r.price_tier]}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyLocations}>
          <Text style={styles.emptyText}>
            No restaurants have location data yet. Add an address or coordinates
            when creating a restaurant.
          </Text>
        </View>
      )}

      {/* Restaurants without locations */}
      {restaurants.length > withCoords.length && (
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            WITHOUT LOCATIONS ({restaurants.length - withCoords.length})
          </Text>
          {restaurants
            .filter((r) => r.lat == null || r.lng == null)
            .slice(0, 10)
            .map((r) => (
              <Pressable
                key={r.id}
                style={styles.locationCard}
                onPress={() =>
                  router.push(
                    `/(dining)/restaurant/${r.id}` as `/${string}`,
                  )
                }
              >
                <View style={[styles.pinDot, { backgroundColor: '#35343A' }]} />
                <View style={styles.locationInfo}>
                  <Text style={styles.locationName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.locationAddress} numberOfLines={1}>
                    {r.address || 'No address set'}
                  </Text>
                </View>
              </Pressable>
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  headerSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  legend: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  mapPlaceholder: {
    marginHorizontal: 16,
    padding: 32,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  mapPlaceholderIcon: {
    fontSize: 48,
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  listSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  locationInfo: {
    flex: 1,
    gap: 2,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  locationAddress: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  locationCuisine: {
    fontSize: 12,
    color: ACCENT,
  },
  locationRating: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFB877',
  },
  locationPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },
  emptyLocations: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
});
