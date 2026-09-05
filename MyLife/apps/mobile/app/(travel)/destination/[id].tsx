import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  deleteDestination,
  getDestination,
  markVisited,
  updateDestination,
  type DestinationRecord,
} from '@mylife/travel';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  TRAVEL_ACCENT,
  WISHLIST_GOLD,
  BOTH_GREEN,
  countryFlag,
  isVisited,
} from '../_components/dest-helpers';

export default function TravelDestinationDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [record, setRecord] = useState<DestinationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit fields
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [bestSeason, setBestSeason] = useState('');

  const load = useCallback(() => {
    if (!id) {
      setLoading(false);
      setError('Missing destination id.');
      return;
    }
    try {
      setError(null);
      const next = getDestination(db, id);
      setRecord(next);
      if (next) {
        setName(next.name);
        setCity(next.region ?? '');
        setNotes(next.notes_md ?? '');
        setBestSeason(next.best_season ?? '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load destination');
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [load]);

  function handleSave() {
    if (!record) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Destination name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      updateDestination(db, record.id, {
        name: name.trim(),
        region: city.trim() || undefined,
        notes_md: notes.length > 0 ? notes : undefined,
        best_season: bestSeason.trim() || undefined,
      });
      setEditing(false);
      load();
    } catch (e) {
      Alert.alert(
        'Could not save',
        e instanceof Error ? e.message : 'Unknown error',
      );
    } finally {
      setSaving(false);
    }
  }

  function handleVisit() {
    if (!record) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      markVisited(db, record.id, today);
      load();
    } catch (e) {
      Alert.alert(
        'Could not mark visited',
        e instanceof Error ? e.message : 'Unknown error',
      );
    }
  }

  function handleDelete() {
    if (!record) return;
    Alert.alert(
      'Delete destination?',
      `${record.name} will be removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteDestination(db, record.id);
              router.back();
            } catch (e) {
              Alert.alert(
                'Could not delete',
                e instanceof Error ? e.message : 'Unknown error',
              );
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={TRAVEL_ACCENT} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.screen, styles.center]}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!record) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.emptyTitle}>Destination not found</Text>
        <Text style={styles.emptyBody}>
          This destination may have been deleted.
        </Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.replace('/(travel)/destinations')}
        >
          <Text style={styles.primaryBtnText}>Back to list</Text>
        </Pressable>
      </View>
    );
  }

  const visited = isVisited(record);
  const accent =
    visited && record.bucket_list
      ? BOTH_GREEN
      : visited
        ? TRAVEL_ACCENT
        : WISHLIST_GOLD;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{'<-'} Back</Text>
        </Pressable>

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.flag}>{countryFlag(record.country_code)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{record.name}</Text>
              <Text style={styles.country}>
                {record.country ?? 'Unknown location'}
                {record.region ? `  \u00B7  ${record.region}` : ''}
              </Text>
            </View>
            <View style={[styles.badge, { borderColor: accent }]}>
              <Text style={[styles.badgeText, { color: accent }]}>
                {visited && record.bucket_list
                  ? 'Visited + Wishlist'
                  : visited
                    ? `Visited${record.visit_count > 1 ? ` \u00D7${record.visit_count}` : ''}`
                    : 'Wishlist'}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <Stat label="Visits" value={String(record.visit_count)} />
            <Stat
              label="First"
              value={
                record.first_visited ? record.first_visited.slice(0, 10) : '\u2014'
              }
            />
            <Stat
              label="Last"
              value={
                record.last_visited ? record.last_visited.slice(0, 10) : '\u2014'
              }
            />
            <Stat
              label="Rating"
              value={record.rating ? `${record.rating}/5` : '\u2014'}
            />
          </View>

          {record.lat != null && record.lng != null ? (
            <Text style={styles.coords}>
              Coordinates {record.lat.toFixed(4)}, {record.lng.toFixed(4)}
            </Text>
          ) : null}

          {!editing && record.best_season ? (
            <Text style={styles.season}>Best season: {record.best_season}</Text>
          ) : null}

          {!editing && record.notes_md ? (
            <View style={styles.notesBlock}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.notesText}>{record.notes_md}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => setEditing((v) => !v)}
          >
            <Text style={styles.primaryBtnText}>
              {editing ? 'Cancel' : 'Edit'}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={handleVisit}>
            <Text style={styles.secondaryBtnText}>
              {visited ? 'Mark visited again' : 'Mark as visited'}
            </Text>
          </Pressable>
          <Pressable style={styles.dangerBtn} onPress={handleDelete}>
            <Text style={styles.dangerBtnText}>Delete</Text>
          </Pressable>
        </View>

        {editing ? (
          <View style={styles.editCard}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Destination name"
              placeholderTextColor="#9F8E81"
            />

            <Text style={styles.label}>City / region</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              style={styles.input}
              placeholder="City or region"
              placeholderTextColor="#9F8E81"
            />

            <Text style={styles.label}>Best season</Text>
            <TextInput
              value={bestSeason}
              onChangeText={setBestSeason}
              style={styles.input}
              placeholder="e.g. Spring, October-November"
              placeholderTextColor="#9F8E81"
              maxLength={50}
            />

            <Text style={styles.label}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              style={[styles.input, styles.textarea]}
              placeholder="Favorite spots, recommendations, memories..."
              placeholderTextColor="#9F8E81"
              multiline
              textAlignVertical="top"
            />

            <Pressable
              style={[styles.save, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveText}>
                {saving ? 'Saving...' : 'Save changes'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { padding: 20, paddingBottom: 120, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 8 },
  back: { alignSelf: 'flex-start' },
  backText: { color: TRAVEL_ACCENT, fontSize: 13, fontWeight: '600' },
  heroCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flag: { fontSize: 42 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  country: { color: colors.textSecondary, fontSize: 13 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: TRAVEL_ACCENT, fontSize: 18, fontWeight: '800' },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  coords: { color: colors.textSecondary, fontSize: 13 },
  season: { color: colors.textSecondary, fontSize: 13 },
  notesBlock: { gap: 6 },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  notesText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: TRAVEL_ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryBtnText: { color: '#0E0E13', fontWeight: '800', fontSize: 13 },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.low,
  },
  secondaryBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  dangerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.4)',
    backgroundColor: 'rgba(147,0,10,0.3)',
  },
  dangerBtnText: { color: '#FFB4AB', fontWeight: '700', fontSize: 13 },
  editCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  input: {
    backgroundColor: surfaceTiers.low,
    color: colors.text,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textarea: { minHeight: 120 },
  save: {
    marginTop: 10,
    backgroundColor: TRAVEL_ACCENT,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveText: { color: '#0E0E13', fontWeight: '800', fontSize: 15 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  errorCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(147,0,10,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.3)',
    gap: 10,
  },
  errorTitle: { color: '#FFB4AB', fontSize: 15, fontWeight: '700' },
  errorBody: { color: colors.textSecondary, fontSize: 13 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
