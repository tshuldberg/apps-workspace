import { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  TextInput,
} from 'react-native';
import { Text } from '@mylife/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getReservation,
  getRestaurant,
  deleteReservation,
  cancelReservation,
  completeReservation,
  markNoShow,
  buildBookingUrl,
} from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE = '#1B1B20';
const SURFACE_ELEVATED = '#2A292F';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = 'rgba(228,225,233,0.35)';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

const STATUS_COLORS: Record<string, string> = {
  upcoming: '#8BCFF0',
  completed: '#30D158',
  cancelled: 'rgba(228,225,233,0.35)',
  no_show: '#FFB4AB',
};

const STATUS_LABELS: Record<string, string> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

const PLATFORM_LABELS: Record<string, string> = {
  resy: 'Resy',
  opentable: 'OpenTable',
  tock: 'Tock',
  yelp: 'Yelp',
  phone: 'Phone',
  walkin: 'Walk-in',
  other: 'Other',
};

function formatReminderLabel(minutes: number): string {
  if (minutes === 90) return '90 minutes before';
  if (minutes === 1440) return '1 day before';
  if (minutes === 10080) return '1 week before';
  if (minutes < 60) return `${minutes} min before`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hours before`;
  return `${Math.round(minutes / 1440)} days before`;
}

export default function ReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useFocusEffect(
    useCallback(() => {
      setTick((v) => v + 1);
    }, []),
  );

  const reservation = useMemo(() => {
    if (!id) return null;
    return getReservation(db, id);
  }, [db, id, tick]);

  const restaurant = useMemo(() => {
    if (!reservation) return null;
    return getRestaurant(db, reservation.restaurant_id);
  }, [db, reservation]);

  if (!reservation) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Reservation not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const reservedDate = new Date(reservation.reserved_at);
  const dateLabel = reservedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeLabel = reservedDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  const statusColor = STATUS_COLORS[reservation.status] ?? TEXT_TERTIARY;
  const statusLabel = STATUS_LABELS[reservation.status] ?? reservation.status;

  const bookingUrl = restaurant ? buildBookingUrl(restaurant) : null;

  const handleDelete = () => {
    Alert.alert(
      'Delete Reservation',
      'Are you sure you want to delete this reservation? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteReservation(db, reservation.id);
            router.back();
          },
        },
      ],
    );
  };

  const handleCancel = () => {
    cancelReservation(db, reservation.id, cancelReason.trim() || undefined);
    setShowCancelInput(false);
    setCancelReason('');
    setTick((v) => v + 1);
  };

  const handleComplete = () => {
    completeReservation(db, reservation.id);
    setTick((v) => v + 1);
  };

  const handleNoShow = () => {
    Alert.alert(
      'Mark as No-Show',
      'Mark this reservation as a no-show?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark No-Show',
          style: 'destructive',
          onPress: () => {
            markNoShow(db, reservation.id);
            setTick((v) => v + 1);
          },
        },
      ],
    );
  };

  const handleBookNow = () => {
    if (bookingUrl) {
      Linking.openURL(bookingUrl);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.hero}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>

        {/* Restaurant Name */}
        {restaurant && (
          <Pressable
            onPress={() =>
              router.push(`/(dining)/restaurant/${restaurant.id}` as `/${string}`)
            }
          >
            <Text style={styles.restaurantName}>{restaurant.name}</Text>
          </Pressable>
        )}

        {/* Date & Time */}
        <Text style={styles.dateText}>{dateLabel}</Text>
        <Text style={styles.timeText}>{timeLabel}</Text>
      </View>

      {/* Details */}
      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Party Size</Text>
          <Text style={styles.detailValue}>
            {reservation.party_size} {reservation.party_size === 1 ? 'guest' : 'guests'}
          </Text>
        </View>

        {reservation.platform && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Platform</Text>
            <Text style={styles.detailValue}>
              {PLATFORM_LABELS[reservation.platform] ?? reservation.platform}
            </Text>
          </View>
        )}

        {reservation.confirmation_code && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Confirmation</Text>
            <Text style={[styles.detailValue, styles.mono]}>
              {reservation.confirmation_code}
            </Text>
          </View>
        )}

        {reservation.reminder_minutes != null && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reminder</Text>
            <Text style={styles.detailValue}>
              {formatReminderLabel(reservation.reminder_minutes)}
            </Text>
          </View>
        )}
      </View>

      {/* Notes */}
      {reservation.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTES</Text>
          <Text style={styles.notesText}>{reservation.notes}</Text>
        </View>
      )}

      {/* Cancel Reason (if cancelled) */}
      {reservation.status === 'cancelled' && reservation.cancel_reason && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CANCEL REASON</Text>
          <Text style={styles.notesText}>{reservation.cancel_reason}</Text>
        </View>
      )}

      {/* Action Buttons */}
      {reservation.status === 'upcoming' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIONS</Text>

          {bookingUrl && (
            <Pressable style={styles.primaryButton} onPress={handleBookNow}>
              <Text style={styles.primaryButtonText}>
                {'\uD83D\uDD17'} Book Now
              </Text>
            </Pressable>
          )}

          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              const title = encodeURIComponent(`Dinner at ${restaurant?.name ?? 'Restaurant'}`);
              router.push(
                `/(rsvp)/create?title=${title}&date=${reservation.reserved_at}&capacity=${reservation.party_size}&source=dining` as `/${string}`,
              );
            }}
          >
            <Text style={styles.actionBtnIcon}>{'\uD83D\uDC65'}</Text>
            <Text style={styles.actionBtnText}>Invite Friends</Text>
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={handleComplete}>
            <Text style={styles.actionBtnIcon}>{'\u2713'}</Text>
            <Text style={styles.actionBtnText}>Mark Complete</Text>
          </Pressable>

          {!showCancelInput ? (
            <Pressable
              style={styles.actionBtn}
              onPress={() => setShowCancelInput(true)}
            >
              <Text style={styles.actionBtnIcon}>{'\u2715'}</Text>
              <Text style={styles.actionBtnText}>Cancel Reservation</Text>
            </Pressable>
          ) : (
            <View style={styles.cancelInputGroup}>
              <TextInput
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="Reason for cancellation (optional)"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.cancelInput}
                autoFocus
              />
              <View style={styles.cancelButtonRow}>
                <Pressable
                  style={styles.cancelDismiss}
                  onPress={() => {
                    setShowCancelInput(false);
                    setCancelReason('');
                  }}
                >
                  <Text style={styles.cancelDismissText}>Back</Text>
                </Pressable>
                <Pressable style={styles.cancelConfirm} onPress={handleCancel}>
                  <Text style={styles.cancelConfirmText}>Confirm Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}

          <Pressable style={styles.actionBtn} onPress={handleNoShow}>
            <Text style={styles.actionBtnIcon}>{'\uD83D\uDEAB'}</Text>
            <Text style={[styles.actionBtnText, { color: '#FFB4AB' }]}>
              Mark No-Show
            </Text>
          </Pressable>
        </View>
      )}

      {/* Completed: linked visit */}
      {reservation.status === 'completed' && reservation.visit_id && (
        <View style={styles.section}>
          <Pressable
            style={styles.linkedVisitButton}
            onPress={() =>
              router.push(
                `/(dining)/visit/${reservation.visit_id}` as `/${string}`,
              )
            }
          >
            <Text style={styles.linkedVisitText}>View Linked Visit</Text>
          </Pressable>
        </View>
      )}

      {/* Delete */}
      <View style={styles.section}>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete Reservation</Text>
        </Pressable>
      </View>

      {/* Timestamps */}
      <View style={styles.timestampSection}>
        <Text style={styles.timestampText}>
          Created {new Date(reservation.created_at).toLocaleDateString()}
        </Text>
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
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 4,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    textDecorationLine: 'underline',
    textDecorationColor: ACCENT,
  },
  dateText: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  timeText: {
    fontSize: 28,
    fontWeight: '800',
    color: ACCENT,
  },

  // Details card
  detailsCard: {
    marginHorizontal: 16,
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    gap: 14,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  mono: {
    fontFamily: 'Courier',
    letterSpacing: 1,
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },

  // Primary button (book now)
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Action buttons
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  actionBtnIcon: {
    fontSize: 18,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },

  // Cancel input
  cancelInputGroup: {
    gap: 10,
  },
  cancelInput: {
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT_PRIMARY,
  },
  cancelButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelDismiss: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: SURFACE,
    alignItems: 'center',
  },
  cancelDismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  cancelConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,180,171,0.15)',
    alignItems: 'center',
  },
  cancelConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFB4AB',
  },

  // Linked visit
  linkedVisitButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
  },
  linkedVisitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#30D158',
  },

  // Delete
  deleteButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,180,171,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.15)',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFB4AB',
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
