import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  deleteAttendance,
  getAttendance,
  getVenue,
  type Attendance,
  type Venue,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCost(cents: number): string {
  if (cents <= 0) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function starsText(rating: number | null): string {
  if (rating === null) return '—';
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export default function SportsAttendanceDetailScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [row, setRow] = useState<Attendance | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    const a = getAttendance(db, id);
    setRow(a);
    setVenue(a && a.venue_id ? getVenue(db, a.venue_id) : null);
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleDelete = useCallback(() => {
    if (!id || !row) return;
    Alert.alert('Delete attendance?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteAttendance(db, id);
          router.back();
        },
      },
    ]);
  }, [db, id, router, row]);

  const handleEdit = useCallback(() => {
    if (!id) return;
    router.push(`/(sports)/events/log?editId=${id}` as never);
  }, [id, router]);

  if (!row) {
    return (
      <View style={[styles.screen, styles.emptyWrap]}>
        <Text style={styles.missingText}>Attendance not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const seatParts: string[] = [];
  if (row.section) seatParts.push(`Section ${row.section}`);
  if (row.row_label) seatParts.push(`Row ${row.row_label}`);
  if (row.seat) seatParts.push(`Seat ${row.seat}`);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Attendance</Text>
      <Text style={styles.title}>{row.venue_name}</Text>
      {venue?.city ? (
        <Text style={styles.subtitle}>{venue.city}</Text>
      ) : null}

      <View style={styles.metaCard}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Attended at</Text>
          <Text style={styles.metaValue}>
            {formatDateTime(row.attended_at)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Cost</Text>
          <Text style={styles.metaValue}>{formatCost(row.cost_cents)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Rating</Text>
          <Text style={[styles.metaValue, styles.accent]}>
            {starsText(row.rating)}
          </Text>
        </View>
      </View>

      {seatParts.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Seat</Text>
          <View style={styles.flatCard}>
            <Text style={styles.bodyText}>{seatParts.join(' · ')}</Text>
          </View>
        </View>
      ) : null}

      {row.companions.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Companions</Text>
          <View style={styles.wrapRow}>
            {row.companions.map((name) => (
              <View key={name} style={styles.companionChip}>
                <Text style={styles.companionText}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {row.tailgate_notes_md ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Tailgate</Text>
          <View style={styles.flatCard}>
            <Text style={styles.bodyText}>{row.tailgate_notes_md}</Text>
          </View>
        </View>
      ) : null}

      {row.parking_notes_md ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Parking</Text>
          <View style={styles.flatCard}>
            <Text style={styles.bodyText}>{row.parking_notes_md}</Text>
          </View>
        </View>
      ) : null}

      {row.notes_md ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Notes</Text>
          <View style={styles.flatCard}>
            <Text style={styles.bodyText}>{row.notes_md}</Text>
          </View>
        </View>
      ) : null}

      {venue ? (
        <Pressable
          style={styles.linkCard}
          onPress={() =>
            router.push(`/(sports)/events/venues/${venue.id}` as never)
          }
        >
          <Text style={styles.linkCardText}>View venue →</Text>
        </Pressable>
      ) : null}

      <View style={styles.footer}>
        <Pressable
          onPress={handleDelete}
          style={styles.destructiveBtn}
          accessibilityRole="button"
        >
          <Text style={styles.destructiveBtnText}>Delete</Text>
        </Pressable>
        <Pressable
          onPress={handleEdit}
          style={styles.primaryBtn}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>Edit</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
    gap: 14,
  },
  emptyWrap: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  missingText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  metaCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: colors.text,
    fontSize: 14,
  },
  accent: {
    color: SPORTS_ACCENT,
    fontWeight: '700',
  },
  block: {
    gap: 10,
  },
  blockLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  flatCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bodyText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  companionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  companionText: {
    color: colors.text,
    fontSize: 13,
  },
  linkCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SPORTS_ACCENT,
    backgroundColor: surfaceTiers.container,
  },
  linkCardText: {
    color: SPORTS_ACCENT,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: SPORTS_ACCENT,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  destructiveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: '#F87171',
    alignItems: 'center',
  },
  destructiveBtnText: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
