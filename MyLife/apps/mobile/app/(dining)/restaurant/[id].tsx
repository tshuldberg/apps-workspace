import { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Text } from '@mylife/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getRestaurant,
  deleteRestaurant,
  updateRestaurant,
  listVisitsByRestaurant,
  listDishesByRestaurant,
  getBestBookingPlatform,
  buildBookingUrl,
  listReservations,
} from '@mylife/dining';
import type { Visit, Dish, Reservation } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE = '#1B1B20';
const SURFACE_ELEVATED = '#2A292F';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = 'rgba(228,225,233,0.35)';
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

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <Text style={{ color: '#FFB877', fontSize: size }}>
      {'★'.repeat(full)}
      {half ? '★' : ''}
      {'☆'.repeat(empty)}
    </Text>
  );
}

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((v) => v + 1);
    }, []),
  );

  const restaurant = useMemo(() => {
    if (!id) return null;
    return getRestaurant(db, id);
  }, [db, id, tick]);

  const visits = useMemo(() => {
    if (!id) return [];
    return listVisitsByRestaurant(db, id, { limit: 10 });
  }, [db, id, tick]);

  const dishes = useMemo(() => {
    if (!id) return [];
    return listDishesByRestaurant(db, id, { limit: 10 });
  }, [db, id, tick]);

  const reservations = useMemo(() => {
    if (!id) return [];
    return listReservations(db, { restaurant_id: id, limit: 10 });
  }, [db, id, tick]);

  const bookingPlatform = useMemo(() => {
    if (!restaurant) return null;
    return getBestBookingPlatform(restaurant);
  }, [restaurant]);

  const bookingUrl = useMemo(() => {
    if (!restaurant) return null;
    return buildBookingUrl(restaurant);
  }, [restaurant]);

  if (!restaurant) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Restaurant not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const cuisines = parseCuisines(restaurant.cuisines);
  const tags = restaurant.tags;

  const handleDelete = () => {
    Alert.alert(
      'Delete Restaurant',
      `Are you sure you want to delete "${restaurant.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRestaurant(db, restaurant.id);
            router.back();
          },
        },
      ],
    );
  };

  const toggleWishlist = () => {
    updateRestaurant(db, restaurant.id, {
      is_wishlist: restaurant.is_wishlist ? 0 : 1,
    });
    setTick((v) => v + 1);
  };

  const openDirections = () => {
    const address = restaurant.address ?? restaurant.name;
    const encodedAddress = encodeURIComponent(address);
    if (restaurant.lat && restaurant.lng) {
      const url =
        Platform.OS === 'ios'
          ? `maps:?daddr=${restaurant.lat},${restaurant.lng}`
          : `geo:${restaurant.lat},${restaurant.lng}?q=${encodedAddress}`;
      Linking.openURL(url);
    } else {
      const url =
        Platform.OS === 'ios'
          ? `maps:?q=${encodedAddress}`
          : `geo:0,0?q=${encodedAddress}`;
      Linking.openURL(url);
    }
  };

  const externalLinks = [
    { label: 'Resy', url: restaurant.resy_url, icon: '\uD83C\uDF7D\uFE0F' },
    { label: 'OpenTable', url: restaurant.opentable_url, icon: '\uD83D\uDCCB' },
    { label: 'Tock', url: restaurant.tock_url, icon: '\uD83C\uDFAB' },
    { label: 'Yelp', url: restaurant.yelp_url, icon: '\u2B50' },
    {
      label: 'Instagram',
      url: restaurant.instagram_handle
        ? `https://instagram.com/${restaurant.instagram_handle.replace('@', '')}`
        : null,
      icon: '\uD83D\uDCF7',
    },
    { label: 'Website', url: restaurant.website_url, icon: '\uD83C\uDF10' },
  ].filter((l) => l.url);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <View style={styles.hero}>
        <View style={styles.heroPlaceholder}>
          <Text style={styles.heroEmoji}>{'\uD83C\uDF7D\uFE0F'}</Text>
        </View>
        <Text style={styles.name}>{restaurant.name}</Text>
        {(restaurant.neighborhood || restaurant.city) && (
          <Text style={styles.location}>
            {[restaurant.neighborhood, restaurant.city]
              .filter(Boolean)
              .join(', ')}
          </Text>
        )}
        <View style={styles.metaRow}>
          {cuisines.length > 0 && (
            <View style={styles.cuisineRow}>
              {cuisines.map((c) => (
                <View key={c} style={styles.cuisineChip}>
                  <Text style={styles.cuisineChipText}>{c}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.metaBadges}>
            {restaurant.price_tier && (
              <Text style={styles.priceBadge}>
                {PRICE_LABELS[restaurant.price_tier]}
              </Text>
            )}
            {restaurant.average_rating != null && (
              <Stars rating={restaurant.average_rating} size={16} />
            )}
          </View>
        </View>
        {/* Status badges */}
        <View style={styles.statusRow}>
          {restaurant.is_visited === 1 && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {'\u2713'} Visited
                {restaurant.visit_count > 0
                  ? ` (${restaurant.visit_count}x)`
                  : ''}
              </Text>
            </View>
          )}
          {restaurant.is_wishlist === 1 && (
            <View style={[styles.statusBadge, styles.wishlistBadge]}>
              <Text style={styles.statusBadgeText}>
                {'\u2764\uFE0F'} Wishlist
              </Text>
            </View>
          )}
          {tags.some((t) => t.name.toLowerCase() === 'pet-friendly') && (
            <View style={[styles.statusBadge, styles.petFriendlyBadge]}>
              <Text style={styles.statusBadgeText}>
                {'\uD83D\uDC3E'} Pet-Friendly
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionButton}
          onPress={() =>
            router.push(
              `/(dining)/restaurant/edit/${restaurant.id}` as `/${string}`,
            )
          }
        >
          <Text style={styles.actionIcon}>{'\u270F\uFE0F'}</Text>
          <Text style={styles.actionLabel}>Edit</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={toggleWishlist}>
          <Text style={styles.actionIcon}>
            {restaurant.is_wishlist ? '\u2764\uFE0F' : '\u2661'}
          </Text>
          <Text style={styles.actionLabel}>
            {restaurant.is_wishlist ? 'Wishlisted' : 'Wishlist'}
          </Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => router.push(`/(dining)/visit/add?restaurantId=${restaurant.id}` as `/${string}`)}>
          <Text style={styles.actionIcon}>{'\uD83D\uDCDD'}</Text>
          <Text style={styles.actionLabel}>Log Visit</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.actionDanger]}
          onPress={handleDelete}
        >
          <Text style={styles.actionIcon}>{'\uD83D\uDDD1\uFE0F'}</Text>
          <Text style={[styles.actionLabel, styles.dangerText]}>Delete</Text>
        </Pressable>
      </View>

      {/* Booking + Reservation Actions */}
      <View style={styles.bookingRow}>
        {bookingUrl && (
          <Pressable
            style={styles.bookButton}
            onPress={() => Linking.openURL(bookingUrl)}
          >
            <Text style={styles.bookButtonText}>
              {'\uD83D\uDD17'} Book on {bookingPlatform ? bookingPlatform.charAt(0).toUpperCase() + bookingPlatform.slice(1) : 'Platform'}
            </Text>
          </Pressable>
        )}
        <Pressable
          style={styles.addReservationButton}
          onPress={() => router.push(`/(dining)/reservation/add?restaurantId=${restaurant.id}` as `/${string}`)}
        >
          <Text style={styles.addReservationButtonText}>+ Add Reservation</Text>
        </Pressable>
      </View>

      {/* Notes */}
      {restaurant.notes_md && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTES</Text>
          <Text style={styles.notesText}>{restaurant.notes_md}</Text>
        </View>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TAGS</Text>
          <View style={styles.tagsRow}>
            {tags.map((tag) => (
              <View
                key={tag.id}
                style={[
                  styles.tagChip,
                  tag.color ? { backgroundColor: `${tag.color}20` } : null,
                ]}
              >
                <Text
                  style={[
                    styles.tagChipText,
                    tag.color ? { color: tag.color } : null,
                  ]}
                >
                  {tag.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Visit History */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>VISIT HISTORY</Text>
          <Pressable
            onPress={() => router.push(`/(dining)/visit/add?restaurantId=${restaurant.id}` as `/${string}`)}
            hitSlop={8}
          >
            <Text style={styles.logVisitLink}>+ Log Visit</Text>
          </Pressable>
        </View>
        {visits.length === 0 ? (
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderIcon}>{'\uD83D\uDCDD'}</Text>
            <Text style={styles.placeholderText}>No visits logged yet</Text>
            <Text style={styles.placeholderSubtext}>
              Log your first visit to start tracking your dining experiences.
            </Text>
          </View>
        ) : (
          <View style={styles.visitList}>
            {visits.map((v: Visit) => {
              const vDate = new Date(v.visited_at);
              const dateStr = vDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
              const stars = '\u2605'.repeat(v.overall_rating) + '\u2606'.repeat(5 - v.overall_rating);
              return (
                <Pressable
                  key={v.id}
                  style={styles.visitCard}
                  onPress={() => router.push(`/(dining)/visit/${v.id}` as `/${string}`)}
                >
                  <View style={styles.visitCardInfo}>
                    <Text style={styles.visitCardDate}>{dateStr}</Text>
                    <Text style={styles.visitCardStars}>{stars}</Text>
                  </View>
                  {v.occasion && (
                    <View style={styles.visitOccasionBadge}>
                      <Text style={styles.visitOccasionText}>{v.occasion}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Dishes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>DISHES</Text>
          <Pressable
            onPress={() =>
              router.push(
                `/(dining)/dish/add?restaurantId=${restaurant.id}` as `/${string}`,
              )
            }
            hitSlop={8}
          >
            <Text style={styles.logVisitLink}>+ Add Dish</Text>
          </Pressable>
        </View>
        {dishes.length === 0 ? (
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderIcon}>{'\uD83C\uDF72'}</Text>
            <Text style={styles.placeholderText}>No dishes yet</Text>
            <Text style={styles.placeholderSubtext}>
              Dishes you order will appear here after logging a visit.
            </Text>
          </View>
        ) : (
          <View style={styles.dishList}>
            {dishes.slice(0, 5).map((d: Dish) => {
              const allergens = d.allergens ? (() => { try { return JSON.parse(d.allergens!) as string[]; } catch { return []; } })() : [];
              return (
                <Pressable
                  key={d.id}
                  style={styles.dishCard}
                  onPress={() =>
                    router.push(`/(dining)/dish/${d.id}` as `/${string}`)
                  }
                >
                  <View style={styles.dishCardTop}>
                    <Text style={styles.dishName}>{d.name}</Text>
                    {d.rating != null && (
                      <Stars rating={d.rating} size={14} />
                    )}
                  </View>
                  <View style={styles.dishCardMeta}>
                    {d.course && (
                      <View style={styles.dishCourseBadge}>
                        <Text style={styles.dishCourseBadgeText}>
                          {d.course.charAt(0).toUpperCase() + d.course.slice(1)}
                        </Text>
                      </View>
                    )}
                    {d.would_order_again === 1 && (
                      <View style={styles.orderAgainBadge}>
                        <Text style={styles.orderAgainBadgeText}>{'\u2705'} Again</Text>
                      </View>
                    )}
                    {allergens.map((a) => (
                      <View key={a} style={styles.allergenChip}>
                        <Text style={styles.allergenChipText}>{a}</Text>
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
            {dishes.length > 5 && (
              <Text style={styles.viewAllHint}>
                +{dishes.length - 5} more dishes
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Reservations */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>RESERVATIONS</Text>
          <Pressable
            onPress={() => router.push(`/(dining)/reservation/add?restaurantId=${restaurant.id}` as `/${string}`)}
            hitSlop={8}
          >
            <Text style={styles.logVisitLink}>+ Add</Text>
          </Pressable>
        </View>
        {reservations.length === 0 ? (
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderIcon}>{'\uD83D\uDCC5'}</Text>
            <Text style={styles.placeholderText}>No reservations</Text>
            <Text style={styles.placeholderSubtext}>
              Add a reservation to track your upcoming bookings.
            </Text>
          </View>
        ) : (
          <View style={styles.visitList}>
            {reservations.slice(0, 5).map((r: Reservation) => {
              const rDate = new Date(r.reserved_at);
              const dateStr = rDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
              const timeStr = rDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
              const statusColor = r.status === 'upcoming' ? '#8BCFF0' : r.status === 'completed' ? '#30D158' : r.status === 'no_show' ? '#FFB4AB' : 'rgba(228,225,233,0.35)';
              const statusLabel = r.status === 'upcoming' ? 'Upcoming' : r.status === 'completed' ? 'Completed' : r.status === 'no_show' ? 'No Show' : 'Cancelled';
              return (
                <Pressable
                  key={r.id}
                  style={styles.visitCard}
                  onPress={() => router.push(`/(dining)/reservation/${r.id}` as `/${string}`)}
                >
                  <View style={styles.visitCardInfo}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.visitCardDate}>{dateStr} at {timeStr}</Text>
                      <Text style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                        {r.party_size} {r.party_size === 1 ? 'guest' : 'guests'}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: `${statusColor}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: statusColor, textTransform: 'uppercase' }}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            {reservations.length > 5 && (
              <Text style={styles.viewAllHint}>
                +{reservations.length - 5} more reservations
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Photos placeholder */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PHOTOS</Text>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderIcon}>{'\uD83D\uDCF7'}</Text>
          <Text style={styles.placeholderText}>No photos yet</Text>
          <Text style={styles.placeholderSubtext}>
            Photos from your visits will be collected here.
          </Text>
        </View>
      </View>

      {/* External Links */}
      {externalLinks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LINKS</Text>
          <View style={styles.linksRow}>
            {externalLinks.map((link) => (
              <Pressable
                key={link.label}
                style={styles.linkButton}
                onPress={() => Linking.openURL(link.url!)}
              >
                <Text style={styles.linkIcon}>{link.icon}</Text>
                <Text style={styles.linkLabel}>{link.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Directions */}
      {(restaurant.address || (restaurant.lat && restaurant.lng)) && (
        <View style={styles.section}>
          <Pressable style={styles.directionsButton} onPress={openDirections}>
            <Text style={styles.directionsIcon}>{'\uD83D\uDCCD'}</Text>
            <View style={styles.directionsInfo}>
              <Text style={styles.directionsLabel}>Get Directions</Text>
              {restaurant.address && (
                <Text style={styles.directionsAddress}>
                  {restaurant.address}
                </Text>
              )}
            </View>
            <Text style={styles.directionsArrow}>{'\u203A'}</Text>
          </Pressable>
        </View>
      )}

      {/* Timestamps */}
      <View style={styles.timestampSection}>
        <Text style={styles.timestampText}>
          Added {new Date(restaurant.created_at).toLocaleDateString()}
        </Text>
        {restaurant.last_visited_at && (
          <Text style={styles.timestampText}>
            Last visited{' '}
            {new Date(restaurant.last_visited_at).toLocaleDateString()}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  backLink: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backLinkText: {
    fontSize: 15,
    color: ACCENT,
    fontWeight: '600',
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 8,
  },
  heroPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: SURFACE_ELEVATED,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroEmoji: {
    fontSize: 56,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  location: {
    fontSize: 15,
    color: TEXT_SECONDARY,
  },
  metaRow: {
    alignItems: 'center',
    gap: 8,
  },
  cuisineRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  cuisineChip: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cuisineChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
  },
  metaBadges: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  priceBadge: {
    fontSize: 16,
    fontWeight: '700',
    color: ACCENT,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: 'rgba(48,209,88,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  wishlistBadge: {
    backgroundColor: 'rgba(220,38,38,0.12)',
  },
  petFriendlyBadge: {
    backgroundColor: 'rgba(48,209,88,0.15)',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  actionDanger: {
    borderColor: 'rgba(255,180,171,0.15)',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dangerText: {
    color: '#FFB4AB',
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  notesText: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tagChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },

  // Section header with inline action
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  logVisitLink: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },

  // Visit list
  visitList: {
    gap: 8,
  },
  visitCard: {
    backgroundColor: GLASS,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    gap: 8,
  },
  visitCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visitCardDate: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  visitCardStars: {
    fontSize: 13,
    color: '#FFB877',
  },
  visitOccasionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  visitOccasionText: {
    fontSize: 11,
    fontWeight: '600',
    color: ACCENT,
  },

  // Dish list
  dishList: {
    gap: 8,
  },
  dishCard: {
    backgroundColor: GLASS,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    gap: 8,
  },
  dishCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dishName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    flex: 1,
    marginRight: 8,
  },
  dishCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  dishCourseBadge: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dishCourseBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: ACCENT,
  },
  orderAgainBadge: {
    backgroundColor: 'rgba(48,209,88,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  orderAgainBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#30D158',
  },
  allergenChip: {
    backgroundColor: 'rgba(255,184,119,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  allergenChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFB877',
  },
  viewAllHint: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    paddingTop: 8,
  },

  // Placeholder sections
  placeholderCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: 6,
  },
  placeholderIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  placeholderSubtext: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Links
  linksRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  linkIcon: {
    fontSize: 16,
  },
  linkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },

  // Directions
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  directionsIcon: {
    fontSize: 24,
  },
  directionsInfo: {
    flex: 1,
    gap: 2,
  },
  directionsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  directionsAddress: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  directionsArrow: {
    fontSize: 24,
    color: TEXT_SECONDARY,
    fontWeight: '300',
  },

  // Booking + Reservation actions
  bookingRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  bookButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addReservationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
  },
  addReservationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT,
  },

  // Timestamps
  timestampSection: {
    paddingHorizontal: 16,
    gap: 4,
    marginTop: 8,
    marginBottom: 20,
  },
  timestampText: {
    fontSize: 12,
    color: TEXT_TERTIARY,
  },
});
