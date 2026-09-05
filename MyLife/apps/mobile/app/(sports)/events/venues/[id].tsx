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
  deleteVenue,
  getVenue,
  listAttendance,
  markVisited,
  setBucketList,
  type Venue,
} from '@mylife/sports';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../../_ui';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function starsText(rating: number | null): string {
  if (rating === null) return '—';
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export default function SportsVenueDetailScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [visitsCount, setVisitsCount] = useState<number>(0);

  const reload = useCallback(() => {
    if (!id) return;
    const v = getVenue(db, id);
    setVenue(v);
    if (v) {
      setVisitsCount(listAttendance(db, { venueId: v.id }).length);
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleMarkVisited = useCallback(() => {
    if (!id) return;
    markVisited(db, id, Date.now());
    reload();
  }, [db, id, reload]);

  const handleBucket = useCallback(() => {
    if (!venue) return;
    setBucketList(db, venue.id, !(venue.bucket_list === 1));
    reload();
  }, [db, venue, reload]);

  const handleDelete = useCallback(() => {
    if (!venue) return;
    Alert.alert(
      'Delete venue?',
      'Attendance rows that reference this venue will keep the venue name but lose the link.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteVenue(db, venue.id);
            router.back();
          },
        },
      ],
    );
  }, [db, router, venue]);

  if (!venue) {
    return (
      <View style={[styles.screen, styles.emptyWrap]}>
        <Text style={styles.missingText}>Venue not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const bucketOn = venue.bucket_list === 1;
  const visitedOn = venue.visited === 1;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Venue</Text>
      <Text style={styles.title}>{venue.name}</Text>
      {venue.city || venue.country ? (
        <Text style={styles.subtitle}>
          {[venue.city, venue.country].filter(Boolean).join(', ')}
        </Text>
      ) : null}

      <View style={styles.metaCard}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Sport</Text>
          <Text style={styles.metaValue}>{venue.sport ?? '—'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Team</Text>
          <Text style={styles.metaValue}>{venue.team ?? '—'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Capacity</Text>
          <Text style={styles.metaValue}>
            {venue.capacity ? venue.capacity.toLocaleString() : '—'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Visits</Text>
          <Text style={[styles.metaValue, styles.accent]}>{visitsCount}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>First visit</Text>
          <Text style={styles.metaValue}>
            {venue.first_visit_at ? formatDate(venue.first_visit_at) : '—'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Last visit</Text>
          <Text style={styles.metaValue}>
            {venue.last_visit_at ? formatDate(venue.last_visit_at) : '—'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Rating</Text>
          <Text style={[styles.metaValue, styles.accent]}>
            {starsText(venue.rating)}
          </Text>
        </View>
      </View>

      {venue.notes_md ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Notes</Text>
          <View style={styles.flatCard}>
            <Text style={styles.bodyText}>{venue.notes_md}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.actionsCol}>
        {!visitedOn ? (
          <Pressable style={styles.primaryBtn} onPress={handleMarkVisited}>
            <Text style={styles.primaryBtnText}>Mark visited</Text>
          </Pressable>
        ) : (
          <View style={styles.visitedBanner}>
            <Text style={styles.visitedBannerText}>
              ✓ Visited{venue.last_visit_at
                ? ` · last ${formatDate(venue.last_visit_at)}`
                : ''}
            </Text>
          </View>
        )}

        <Pressable
          style={[styles.toggleBtn, bucketOn && styles.toggleBtnActive]}
          onPress={handleBucket}
        >
          <Text
            style={[
              styles.toggleBtnText,
              bucketOn && styles.toggleBtnTextActive,
            ]}
          >
            {bucketOn ? '★ On bucket list' : 'Add to bucket list'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleDelete}
          style={styles.destructiveBtn}
          accessibilityRole="button"
        >
          <Text style={styles.destructiveBtnText}>Delete</Text>
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
    textTransform: 'capitalize',
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
  actionsCol: {
    gap: 10,
  },
  primaryBtn: {
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
  toggleBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  toggleBtnActive: {
    borderColor: '#FFB877',
    backgroundColor: surfaceTiers.container,
  },
  toggleBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  toggleBtnTextActive: {
    color: '#FFB877',
  },
  visitedBanner: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: SPORTS_ACCENT,
    alignItems: 'center',
  },
  visitedBannerText: {
    color: SPORTS_ACCENT,
    fontSize: 14,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
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
