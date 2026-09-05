import { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  COUNTRIES,
  createDestination,
  markVisited,
  type Country,
} from '@mylife/travel';
import { useDatabase } from '../../../components/DatabaseProvider';
import { TRAVEL_ACCENT, countryFlag } from './dest-helpers';

type Kind = 'visited' | 'wishlist';

export function DestAddForm({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const db = useDatabase();
  const [name, setName] = useState('');
  const [countryQuery, setCountryQuery] = useState('');
  const [country, setCountry] = useState<Country | null>(null);
  const [kind, setKind] = useState<Kind>('wishlist');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return [] as Country[];
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase() === q,
    ).slice(0, 6);
  }, [countryQuery]);

  function reset() {
    setName('');
    setCountryQuery('');
    setCountry(null);
    setKind('wishlist');
    setLat('');
    setLng('');
    setError(null);
  }

  function handleSave() {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    const latNum = lat ? Number(lat) : undefined;
    const lngNum = lng ? Number(lng) : undefined;
    if (lat && (!Number.isFinite(latNum) || latNum! < -90 || latNum! > 90)) {
      setError('Latitude must be between -90 and 90');
      return;
    }
    if (lng && (!Number.isFinite(lngNum) || lngNum! < -180 || lngNum! > 180)) {
      setError('Longitude must be between -180 and 180');
      return;
    }
    setSaving(true);
    try {
      const created = createDestination(db, {
        name: name.trim(),
        country: country?.name,
        country_code: country?.code,
        region: country?.region,
        lat: latNum,
        lng: lngNum,
        bucket_list: kind === 'wishlist',
      });
      if (kind === 'visited') {
        const today = new Date().toISOString().slice(0, 10);
        markVisited(db, created.id, today);
      }
      reset();
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add destination</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Tokyo, Patagonia, Zion..."
              placeholderTextColor="#9F8E81"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              placeholder="Type to search..."
              placeholderTextColor="#9F8E81"
              value={country ? `${countryFlag(country.code)}  ${country.name}` : countryQuery}
              onChangeText={(v) => {
                setCountry(null);
                setCountryQuery(v);
              }}
              autoCapitalize="words"
            />
            {matches.length > 0 ? (
              <View style={styles.suggestions}>
                {matches.map((c) => (
                  <Pressable
                    key={c.code}
                    style={styles.suggestion}
                    onPress={() => {
                      setCountry(c);
                      setCountryQuery('');
                    }}
                  >
                    <Text style={styles.suggestionFlag}>{countryFlag(c.code)}</Text>
                    <Text style={styles.suggestionText}>{c.name}</Text>
                    <Text style={styles.suggestionRegion}>{c.region}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={styles.label}>Type</Text>
            <View style={styles.chipRow}>
              {(['wishlist', 'visited'] as const).map((k) => {
                const selected = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    style={[styles.chip, selected && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {k === 'wishlist' ? 'Wishlist' : 'Visited'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.row2}>
              <View style={styles.col}>
                <Text style={styles.label}>Latitude</Text>
                <TextInput
                  style={styles.input}
                  placeholder="optional"
                  placeholderTextColor="#9F8E81"
                  value={lat}
                  onChangeText={setLat}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Longitude</Text>
                <TextInput
                  style={styles.input}
                  placeholder="optional"
                  placeholderTextColor="#9F8E81"
                  value={lng}
                  onChangeText={setLng}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.save, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveText}>
                {saving ? 'Saving...' : 'Save destination'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: surfaceTiers.container,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  close: {
    color: TRAVEL_ACCENT,
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    padding: 20,
    gap: 12,
    paddingBottom: 40,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 6,
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
  suggestions: {
    backgroundColor: surfaceTiers.low,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionFlag: { fontSize: 22 },
  suggestionText: {
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
  suggestionRegion: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.low,
  },
  chipActive: {
    backgroundColor: 'rgba(14,165,233,0.2)',
    borderColor: TRAVEL_ACCENT,
  },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: TRAVEL_ACCENT },
  row2: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  error: {
    color: '#FFB4AB',
    fontSize: 13,
    marginTop: 4,
  },
  save: {
    marginTop: 16,
    backgroundColor: TRAVEL_ACCENT,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveText: {
    color: '#0E0E13',
    fontWeight: '800',
    fontSize: 15,
  },
});
