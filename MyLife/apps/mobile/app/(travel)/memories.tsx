import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  listTrips,
  type JournalMemoryKind,
  type JournalMemoryRow,
  type TripRow,
} from '@mylife/travel';
import { useDatabase } from '../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from './_ui';

const KINDS: JournalMemoryKind[] = [
  'photo',
  'quote',
  'souvenir',
  'video',
  'audio',
  'other',
];

const KIND_ICONS: Record<JournalMemoryKind, string> = {
  photo: '\u{1F4F7}',
  quote: '\u{1F4AC}',
  souvenir: '\u{1F381}',
  video: '\u{1F3A5}',
  audio: '\u{1F3A7}',
  other: '\u{2728}',
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface MemoryWithEntry extends JournalMemoryRow {
  entry_date: string | null;
  entry_title: string | null;
  trip_id: string | null;
}

export default function TravelMemoriesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string; kind?: string }>();
  const initialTripId =
    typeof params.tripId === 'string' && params.tripId.length > 0
      ? params.tripId
      : null;
  const initialKindRaw =
    typeof params.kind === 'string' && params.kind.length > 0
      ? (params.kind as JournalMemoryKind)
      : null;
  const initialKind =
    initialKindRaw && KINDS.indexOf(initialKindRaw) >= 0
      ? initialKindRaw
      : null;

  const [status, setStatus] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryWithEntry[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [kindFilter, setKindFilter] = useState<JournalMemoryKind | null>(
    initialKind,
  );
  const [tripFilter, setTripFilter] = useState<string | null>(initialTripId);

  const load = useCallback(() => {
    setStatus('loading');
    try {
      const rows = db.query<MemoryWithEntry>(
        `SELECT m.id, m.entry_id, m.kind, m.media_ref, m.caption, m.sort_order,
                m.created_at,
                e.entry_date as entry_date,
                e.title as entry_title,
                e.trip_id as trip_id
         FROM tv_journal_memories m
         LEFT JOIN tv_journal_entries e ON e.id = m.entry_id
         ORDER BY m.created_at DESC, m.sort_order ASC`,
        [],
      );
      setMemories(rows);
      setTrips(listTrips(db));
      setStatus('ready');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load memories');
      setStatus('error');
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    return memories.filter((m) => {
      if (kindFilter && m.kind !== kindFilter) return false;
      if (tripFilter && m.trip_id !== tripFilter) return false;
      return true;
    });
  }, [memories, kindFilter, tripFilter]);

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < memories.length; i += 1) {
      const m = memories[i]!;
      if (tripFilter && m.trip_id !== tripFilter) continue;
      counts[m.kind] = (counts[m.kind] ?? 0) + 1;
    }
    return counts;
  }, [memories, tripFilter]);

  const activeTripName = useMemo(() => {
    if (!tripFilter) return null;
    const t = trips.find((x) => x.id === tripFilter);
    return t?.name ?? null;
  }, [tripFilter, trips]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Memories</Text>
        <Text style={styles.title}>Highlights</Text>
        <Text style={styles.subtitle}>
          Photos, quotes, souvenirs, and other memories attached to your
          journal entries.
        </Text>
      </View>

      <Pressable
        style={styles.newBtn}
        onPress={() => router.push('/(travel)/memory/new' as never)}
        accessibilityRole="button"
      >
        <Text style={styles.newBtnText}>+ New memory</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Filter by kind</Text>
        <View style={styles.chipRow}>
          <Pressable
            style={[
              styles.pickChip,
              kindFilter === null ? styles.pickChipActive : null,
            ]}
            onPress={() => setKindFilter(null)}
          >
            <Text style={styles.pickChipText}>All</Text>
          </Pressable>
          {KINDS.map((k) => (
            <Pressable
              key={k}
              style={[
                styles.pickChip,
                kindFilter === k ? styles.pickChipActive : null,
              ]}
              onPress={() => setKindFilter(kindFilter === k ? null : k)}
            >
              <Text style={styles.pickChipText}>
                {KIND_ICONS[k]} {k}
                {kindCounts[k] ? ` (${kindCounts[k]})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {trips.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Filter by trip</Text>
          <View style={styles.chipRow}>
            <Pressable
              style={[
                styles.pickChip,
                tripFilter === null ? styles.pickChipActive : null,
              ]}
              onPress={() => setTripFilter(null)}
            >
              <Text style={styles.pickChipText}>All trips</Text>
            </Pressable>
            {trips.slice(0, 20).map((t) => (
              <Pressable
                key={t.id}
                style={[
                  styles.pickChip,
                  tripFilter === t.id ? styles.pickChipActive : null,
                ]}
                onPress={() => setTripFilter(tripFilter === t.id ? null : t.id)}
              >
                <Text style={styles.pickChipText} numberOfLines={1}>
                  {t.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {activeTripName ? (
            <Text style={styles.muted}>
              Showing memories from {activeTripName}.
            </Text>
          ) : null}
        </View>
      ) : null}

      {status === 'loading' ? (
        <View style={styles.panel}>
          <ActivityIndicator color={TRAVEL_ACCENT} />
          <Text style={styles.muted}>Loading memories...</Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={[styles.panel, styles.errorPanel]}>
          <Text style={styles.errorText}>
            {error ?? 'Something went wrong.'}
          </Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {status === 'ready' && filtered.length === 0 ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>
            {memories.length === 0 ? 'No memories yet' : 'No matches'}
          </Text>
          <Text style={styles.muted}>
            {memories.length === 0
              ? 'Attach memories from a journal entry, or add one now.'
              : 'Try a different kind or trip filter.'}
          </Text>
          {memories.length === 0 ? (
            <Pressable
              style={styles.saveBtn}
              onPress={() => router.push('/(travel)/memory/new' as never)}
            >
              <Text style={styles.saveBtnText}>Add memory</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {status === 'ready' && filtered.length > 0 ? (
        <View style={styles.grid}>
          {filtered.map((m) => (
            <Pressable
              key={m.id}
              style={styles.card}
              onPress={() =>
                router.push(`/(travel)/memory/${m.id}` as never)
              }
              accessibilityRole="button"
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardKind}>
                  {KIND_ICONS[m.kind]} {m.kind}
                </Text>
                {m.entry_date ? (
                  <Text style={styles.cardDate}>{m.entry_date}</Text>
                ) : null}
              </View>
              {m.caption ? (
                <Text style={styles.cardCaption} numberOfLines={3}>
                  {m.caption}
                </Text>
              ) : null}
              {m.media_ref ? (
                <Text style={styles.cardRef} numberOfLines={2}>
                  {m.media_ref}
                </Text>
              ) : null}
              {m.entry_title ? (
                <Text style={styles.cardEntry} numberOfLines={1}>
                  from {m.entry_title}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 14,
  },
  hero: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: TRAVEL_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  newBtn: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: TRAVEL_ACCENT,
    alignItems: 'center',
  },
  newBtnText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  section: { gap: 8 },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 200,
  },
  pickChipActive: {
    backgroundColor: 'rgba(14,165,233,0.18)',
    borderColor: TRAVEL_ACCENT,
  },
  pickChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorPanel: {
    borderColor: '#93000A',
    backgroundColor: 'rgba(147,0,10,0.12)',
  },
  errorText: { color: '#FFB4AB', fontSize: 14, lineHeight: 20 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
  },
  retryText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  saveBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: TRAVEL_ACCENT,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  saveBtnText: { color: '#0E0E13', fontSize: 14, fontWeight: '800' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 150,
    gap: 6,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardKind: {
    color: TRAVEL_ACCENT,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardDate: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  cardCaption: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  cardRef: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  cardEntry: {
    color: colors.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
