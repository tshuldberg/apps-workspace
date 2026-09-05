import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  createIdentification,
  getIdentificationsForPlant,
  getPlants,
  type Plant,
  type Identification,
} from '@mylife/garden';
import { Text, colors, spacing, borderRadius } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.garden;

export default function IdentifyScreen() {
  const db = useDatabase();
  const { plantId: prefilledPlantId } = useLocalSearchParams<{ plantId?: string }>();

  const plants: Plant[] = useMemo(() => {
    try { return getPlants(db); } catch { return []; }
  }, [db]);

  const [plantId, setPlantId] = useState(prefilledPlantId ?? '');
  const [species, setSpecies] = useState('');
  const [commonName, setCommonName] = useState('');
  const [confidence, setConfidence] = useState('');
  const [tick, setTick] = useState(0);

  const history: Identification[] = useMemo(() => {
    if (!plantId) return [];
    try { return getIdentificationsForPlant(db, plantId); } catch { return []; }
  }, [db, plantId, tick]);

  const handleSave = () => {
    if (!species.trim()) {
      Alert.alert('Required', 'Enter a species name.');
      return;
    }
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      createIdentification(db, id, {
        plantId: plantId || null,
        imageUri: '',
        topSpecies: species.trim(),
        topCommonName: commonName.trim() || null,
        topConfidence: parseFloat(confidence) || null,
        source: 'manual',
      });
      setSpecies('');
      setCommonName('');
      setConfidence('');
      setTick((t) => t + 1);
    } catch {
      Alert.alert('Error', "Couldn't save identification.");
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="label" color={colors.textTertiary}>IDENTIFICATION RESULTS</Text>

      {plants.length > 0 && (
        <>
          <Text variant="caption" color={colors.textSecondary}>Link to Plant:</Text>
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, !plantId && { backgroundColor: ACCENT }]}
              onPress={() => setPlantId('')}
            >
              <Text variant="caption" color={!plantId ? colors.background : colors.textSecondary}>None</Text>
            </Pressable>
            {plants.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.chip, plantId === p.id && { backgroundColor: ACCENT }]}
                onPress={() => setPlantId(p.id)}
              >
                <Text variant="caption" color={plantId === p.id ? colors.background : colors.textSecondary}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <TextInput
        style={styles.input} value={species} onChangeText={setSpecies}
        placeholder="Species (e.g. Monstera deliciosa)" placeholderTextColor={colors.textTertiary}
      />
      <TextInput
        style={styles.input} value={commonName} onChangeText={setCommonName}
        placeholder="Common name (optional)" placeholderTextColor={colors.textTertiary}
      />
      <TextInput
        style={styles.input} value={confidence} onChangeText={setConfidence}
        placeholder="Confidence (0-1, optional)" placeholderTextColor={colors.textTertiary}
        keyboardType="decimal-pad"
      />

      <Pressable
        style={[styles.saveBtn, { backgroundColor: species ? ACCENT : colors.surface }]}
        onPress={handleSave} disabled={!species.trim()}
      >
        <Text variant="body" color={species ? colors.background : colors.textTertiary} style={{ fontWeight: '600' }}>
          Save
        </Text>
      </Pressable>

      {history.length > 0 && (
        <>
          <Text variant="label" color={colors.textTertiary} style={styles.sectionHeader}>
            PREVIOUS IDENTIFICATIONS
          </Text>
          {history.map((ident) => (
            <View key={ident.id} style={styles.identRow}>
              <Text variant="body">{ident.topSpecies}</Text>
              {ident.topCommonName && (
                <Text variant="caption" color={colors.textSecondary}>{ident.topCommonName}</Text>
              )}
              {ident.topConfidence != null && (
                <Text variant="iconCaption" color={colors.textTertiary}>
                  {Math.round(ident.topConfidence * 100)}% confidence
                </Text>
              )}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, minHeight: 44, justifyContent: 'center',
  },
  input: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    color: colors.text, fontFamily: 'Inter', fontSize: 16,
    borderWidth: 1, borderColor: colors.border, minHeight: 44,
  },
  saveBtn: {
    paddingVertical: spacing.sm + 4, borderRadius: borderRadius.md,
    alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.xs },
  identRow: {
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border, gap: 2,
  },
});
