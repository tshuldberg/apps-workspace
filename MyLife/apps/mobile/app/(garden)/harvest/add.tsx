import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Save, Camera } from 'lucide-react-native';
import {
  createHarvest,
  getPlants,
  GARDEN_ACCENT,
  GARDEN_CTA_GRADIENT,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  type HarvestUnit,
  type Plant,
} from '@mylife/garden';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

const UNITS: HarvestUnit[] = ['grams', 'kg', 'oz', 'lbs', 'count'];

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AddHarvestScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { plantId: prefilledPlantId } = useLocalSearchParams<{
    plantId?: string;
  }>();

  const plants: Plant[] = useMemo(() => {
    try {
      return getPlants(db);
    } catch {
      return [];
    }
  }, [db]);

  const [plantId, setPlantId] = useState<string>(prefilledPlantId ?? '');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<HarvestUnit>('grams');
  const [date, setDate] = useState<string>(todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedPlant = plants.find((p) => p.id === plantId);

  const handleSave = () => {
    if (!plantId) {
      Alert.alert('Required', 'Please select a plant.');
      return;
    }
    const q = parseFloat(quantity);
    if (!quantity || isNaN(q) || q <= 0) {
      Alert.alert('Required', 'Please enter a valid amount.');
      return;
    }
    setSaving(true);
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      createHarvest(db, id, {
        plantId,
        quantity: q,
        unit,
        date,
        cropType: selectedPlant?.species ?? selectedPlant?.name ?? null,
        notes: notes.trim() || null,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Save failed. Please try again.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.headerBtn}
          hitSlop={12}
        >
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Log Harvest</Text>
        <Pressable
          onPress={handleSave}
          style={styles.headerBtn}
          hitSlop={12}
          disabled={saving}
        >
          <Save size={20} color={saving ? colors.textTertiary : GARDEN_ACCENT} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Plant selector */}
        <View style={styles.section}>
          <Text style={styles.label}>PLANT</Text>
          {plants.length === 0 ? (
            <GlassCard level={1} style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No plants yet. Add a plant first.
              </Text>
            </GlassCard>
          ) : (
            <View style={styles.pillWrap}>
              {plants.map((p) => {
                const active = plantId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setPlantId(p.id)}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <Text
                      style={[styles.pillText, active && styles.pillTextActive]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Amount + unit */}
        <View style={styles.section}>
          <Text style={styles.label}>AMOUNT</Text>
          <GlassCard level={1} style={styles.amountCard}>
            <TextInput
              style={styles.amountInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.unitRow}>
              {UNITS.map((u) => {
                const active = unit === u;
                return (
                  <Pressable
                    key={u}
                    onPress={() => setUnit(u)}
                    style={[styles.unitPill, active && styles.unitPillActive]}
                  >
                    <Text
                      style={[
                        styles.unitText,
                        active && styles.unitTextActive,
                      ]}
                    >
                      {u}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        </View>

        {/* Date */}
        <View style={styles.section}>
          <Text style={styles.label}>DATE</Text>
          <GlassCard level={1} style={styles.inputCard}>
            <TextInput
              style={styles.textInput}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
            />
          </GlassCard>
        </View>

        {/* Photo placeholder */}
        <View style={styles.section}>
          <Text style={styles.label}>PHOTO</Text>
          <GlassCard level={1} style={styles.photoCard}>
            <Camera size={24} color={colors.textTertiary} />
            <Text style={styles.photoText}>Tap to add photo (coming soon)</Text>
          </GlassCard>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>NOTES</Text>
          <GlassCard level={1} style={styles.inputCard}>
            <TextInput
              style={[styles.textInput, styles.multiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes…"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
            />
          </GlassCard>
        </View>

        {/* Save button */}
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={styles.saveWrap}
        >
          <LinearGradient
            colors={[GARDEN_CTA_GRADIENT.from, GARDEN_CTA_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtn}
          >
            <Save size={18} color="#0B1a04" strokeWidth={2.5} />
            <Text style={styles.saveText}>
              {saving ? 'Saving…' : 'Save Harvest'}
            </Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GARDEN_SURFACES.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: GARDEN_SURFACES.base,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GARDEN_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: colors.text,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  label: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 1.5,
    color: GARDEN_ACCENT,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.lift,
    minHeight: 40,
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: GARDEN_ACCENT,
  },
  pillText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: '#0B1a04',
    fontWeight: '700',
  },
  amountCard: {
    gap: 14,
  },
  amountInput: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    fontSize: 36,
    color: colors.text,
    paddingVertical: 4,
  },
  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unitPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.depth,
    minHeight: 36,
    justifyContent: 'center',
  },
  unitPillActive: {
    backgroundColor: GARDEN_ACCENT,
  },
  unitText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: colors.textSecondary,
  },
  unitTextActive: {
    color: '#0B1a04',
  },
  inputCard: {
    paddingVertical: 4,
  },
  textInput: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
    minHeight: 40,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  photoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  photoText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textTertiary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  saveWrap: {
    marginTop: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 999,
    shadowColor: GARDEN_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  saveText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: '#0B1a04',
    fontWeight: '700',
  },
});
