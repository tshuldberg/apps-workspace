import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  createVenue,
  getAttendance,
  listVenues,
  logAttendance,
  markVisited,
  updateAttendance,
  type Attendance,
  type StarRating,
  type Venue,
} from '@mylife/sports';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../_ui';

function parseDollarsToCents(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export default function SportsEventsLogScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{ editId?: string; mode?: string }>();
  const editId = typeof params.editId === 'string' ? params.editId : undefined;
  const isWatchParty =
    typeof params.mode === 'string' && params.mode === 'watch-party';

  const existing = useMemo<Attendance | null>(() => {
    if (!editId) return null;
    return getAttendance(db, editId);
  }, [db, editId]);

  const [venues, setVenues] = useState<Venue[]>(() => listVenues(db));
  const [venueId, setVenueId] = useState<string | null>(
    existing?.venue_id ?? null,
  );
  const [venueName, setVenueName] = useState<string>(
    existing?.venue_name ?? '',
  );
  const [addingVenue, setAddingVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueCity, setNewVenueCity] = useState('');

  const [section, setSection] = useState<string>(existing?.section ?? '');
  const [rowLabel, setRowLabel] = useState<string>(existing?.row_label ?? '');
  const [seat, setSeat] = useState<string>(existing?.seat ?? '');

  const [companions, setCompanions] = useState<string[]>(
    existing ? [...existing.companions] : [],
  );
  const [companionDraft, setCompanionDraft] = useState('');

  const [costDollars, setCostDollars] = useState<string>(
    existing && existing.cost_cents > 0
      ? (existing.cost_cents / 100).toFixed(2)
      : '',
  );

  const [tailgate, setTailgate] = useState<string>(
    existing?.tailgate_notes_md ?? '',
  );
  const [parking, setParking] = useState<string>(
    existing?.parking_notes_md ?? '',
  );
  const [notes, setNotes] = useState<string>(existing?.notes_md ?? '');
  const [rating, setRating] = useState<StarRating | null>(
    existing?.rating ?? null,
  );
  const [attendedAt, setAttendedAt] = useState<number>(
    existing?.attended_at ?? Date.now(),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectVenue = useCallback((v: Venue) => {
    setVenueId(v.id);
    setVenueName(v.name);
    setAddingVenue(false);
  }, []);

  const addCompanion = () => {
    const v = companionDraft.trim();
    if (!v) return;
    setCompanions((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setCompanionDraft('');
  };

  const removeCompanion = (name: string) => {
    setCompanions((prev) => prev.filter((c) => c !== name));
  };

  const handleSave = useCallback(() => {
    setError(null);
    if (venueName.trim() === '' && !addingVenue) {
      setError('Venue name is required.');
      return;
    }
    setSaving(true);
    try {
      let resolvedVenueId: string | null = venueId;
      let resolvedVenueName = venueName.trim();

      if (addingVenue) {
        const name = newVenueName.trim();
        if (!name) {
          setError('New venue name is required.');
          setSaving(false);
          return;
        }
        const created = createVenue(db, {
          name,
          city: newVenueCity.trim() === '' ? null : newVenueCity.trim(),
        });
        resolvedVenueId = created.id;
        resolvedVenueName = created.name;
        markVisited(db, created.id, attendedAt);
      }

      const payload = {
        venue_id: resolvedVenueId,
        venue_name: resolvedVenueName,
        section: isWatchParty
          ? null
          : section.trim() === ''
            ? null
            : section.trim(),
        row_label: isWatchParty
          ? null
          : rowLabel.trim() === ''
            ? null
            : rowLabel.trim(),
        seat: isWatchParty
          ? null
          : seat.trim() === ''
            ? null
            : seat.trim(),
        companions,
        cost_cents: parseDollarsToCents(costDollars),
        tailgate_notes_md: tailgate.trim() === '' ? null : tailgate.trim(),
        parking_notes_md: isWatchParty
          ? null
          : parking.trim() === ''
            ? null
            : parking.trim(),
        notes_md: notes.trim() === '' ? null : notes.trim(),
        rating,
        attended_at: attendedAt,
      };

      if (editId && existing) {
        updateAttendance(db, editId, payload);
        router.replace(`/(sports)/events/${editId}` as never);
        return;
      }

      const saved = logAttendance(db, payload);
      // If a pre-existing venue was picked (not newly added), mark it visited.
      // Skip for watch parties -- "Home" / "Bar" are not real venue rows.
      if (!addingVenue && !isWatchParty && resolvedVenueId) {
        markVisited(db, resolvedVenueId, attendedAt);
      }
      if (isWatchParty) {
        router.replace('/(sports)/events/watch-party' as never);
        return;
      }
      router.replace(`/(sports)/events/${saved.id}` as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }, [
    addingVenue,
    attendedAt,
    companions,
    costDollars,
    db,
    editId,
    existing,
    isWatchParty,
    newVenueCity,
    newVenueName,
    notes,
    parking,
    rating,
    rowLabel,
    router,
    seat,
    section,
    tailgate,
    venueId,
    venueName,
  ]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>
          {editId
            ? 'Edit attendance'
            : isWatchParty
              ? 'Log watch party'
              : 'Log attendance'}
        </Text>
        <Text style={styles.title}>
          {editId
            ? 'Update game'
            : isWatchParty
              ? 'New watch party'
              : 'New game attended'}
        </Text>

        <Text style={styles.label}>
          {isWatchParty ? 'Where did you watch?' : 'Venue'}
        </Text>
        {isWatchParty ? (
          <View style={styles.wrapRow}>
            {["Home", "Bar", "Friend's"].map((preset) => {
              const active = venueName === preset;
              return (
                <Pressable
                  key={preset}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    setVenueId(null);
                    setVenueName(preset);
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                    ]}
                  >
                    {preset}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {isWatchParty ? (
          <TextInput
            value={venueName}
            onChangeText={(v) => {
              setVenueName(v);
              setVenueId(null);
            }}
            placeholder="Or type a custom location"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
        ) : addingVenue ? (
          <View style={styles.newVenueCard}>
            <TextInput
              value={newVenueName}
              onChangeText={setNewVenueName}
              placeholder="Venue name (e.g. Oracle Park)"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <TextInput
              value={newVenueCity}
              onChangeText={setNewVenueCity}
              placeholder="City (optional)"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <View style={styles.rowInline}>
              <Pressable
                onPress={() => {
                  setAddingVenue(false);
                  setNewVenueName('');
                  setNewVenueCity('');
                }}
                style={styles.ghostBtn}
              >
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.wrapRow}>
              {venues.map((v) => {
                const active = v.id === venueId;
                return (
                  <Pressable
                    key={v.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => selectVenue(v)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {v.name}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={styles.addChip}
                onPress={() => setAddingVenue(true)}
              >
                <Text style={styles.addChipText}>+ New venue</Text>
              </Pressable>
            </View>
            <TextInput
              value={venueName}
              onChangeText={(v) => {
                setVenueName(v);
                setVenueId(null);
              }}
              placeholder="Or type a venue name"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
          </>
        )}

        {isWatchParty ? null : (
          <>
            <Text style={styles.label}>Seat (optional)</Text>
            <View style={styles.rowInline}>
              <TextInput
                value={section}
                onChangeText={setSection}
                placeholder="Section"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                value={rowLabel}
                onChangeText={setRowLabel}
                placeholder="Row"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                value={seat}
                onChangeText={setSeat}
                placeholder="Seat"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
          </>
        )}

        <Text style={styles.label}>Companions (optional)</Text>
        <View style={styles.rowInline}>
          <TextInput
            value={companionDraft}
            onChangeText={setCompanionDraft}
            onSubmitEditing={addCompanion}
            placeholder="Add a name + tap enter"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable onPress={addCompanion} style={styles.addBtn}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
        {companions.length > 0 ? (
          <View style={styles.wrapRow}>
            {companions.map((name) => (
              <Pressable
                key={name}
                onPress={() => removeCompanion(name)}
                style={styles.companionChip}
              >
                <Text style={styles.companionText}>{name} ×</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.label}>Cost (USD, optional)</Text>
        <TextInput
          value={costDollars}
          onChangeText={setCostDollars}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Rating</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => {
            const active = rating !== null && n <= rating;
            return (
              <Pressable
                key={n}
                onPress={() =>
                  setRating((prev) =>
                    prev === n ? null : (n as StarRating),
                  )
                }
                style={styles.starBtn}
              >
                <Text style={[styles.star, active && styles.starActive]}>
                  {active ? '★' : '☆'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Attended at</Text>
        <View style={styles.rowInline}>
          <Text style={styles.playedText}>
            {new Date(attendedAt).toLocaleString()}
          </Text>
          <Pressable
            onPress={() => setAttendedAt(Date.now())}
            style={styles.nowBtn}
          >
            <Text style={styles.nowBtnText}>Now</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Tailgate notes (optional)</Text>
        <TextInput
          value={tailgate}
          onChangeText={setTailgate}
          multiline
          textAlignVertical="top"
          placeholder="Food, drinks, who hosted…"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, styles.notesInput]}
        />

        {isWatchParty ? null : (
          <>
            <Text style={styles.label}>Parking notes (optional)</Text>
            <TextInput
              value={parking}
              onChangeText={setParking}
              multiline
              textAlignVertical="top"
              placeholder="Where you parked, cost, walk time…"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.notesInput]}
            />
          </>
        )}

        <Text style={styles.label}>General notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
          placeholder="How did it go? Memorable plays, weather…"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, styles.notesInput]}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.footer}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Saving…' : editId ? 'Save changes' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 180,
    gap: 10,
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
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  input: {
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  notesInput: {
    minHeight: 80,
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#0E0E13',
  },
  addChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: SPORTS_ACCENT,
  },
  addChipText: {
    color: SPORTS_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  newVenueCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
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
  starsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  starBtn: {
    padding: 4,
  },
  star: {
    color: colors.textSecondary,
    fontSize: 28,
  },
  starActive: {
    color: SPORTS_ACCENT,
  },
  playedText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  nowBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SPORTS_ACCENT,
  },
  nowBtnText: {
    color: SPORTS_ACCENT,
    fontWeight: '700',
    fontSize: 13,
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SPORTS_ACCENT,
  },
  addBtnText: {
    color: '#0E0E13',
    fontWeight: '800',
    fontSize: 13,
  },
  ghostBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ghostBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: SPORTS_ACCENT,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
});
