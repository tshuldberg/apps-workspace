import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  getAllCompanionPlants,
  checkCompatibility,
  getCompanions,
  getAntagonists,
  getPlants,
  type CompanionEntry,
} from '@mylife/garden';
import { Card, Text, colors, spacing, borderRadius } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.garden;

const REL_COLORS: Record<string, string> = {
  companion: colors.success,
  antagonist: colors.danger,
  neutral: colors.textTertiary,
};

export default function CompanionMatrixScreen() {
  const db = useDatabase();
  const [search, setSearch] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('');
  const [showMyGarden, setShowMyGarden] = useState(false);

  const allPlants = useMemo(() => {
    try { return getAllCompanionPlants(); } catch { return []; }
  }, []);

  const myPlants = useMemo(() => {
    try { return getPlants(db).map((p) => p.name.toLowerCase()); } catch { return []; }
  }, [db]);

  const filteredPlants = useMemo(() => {
    let plants = allPlants;
    if (showMyGarden) {
      plants = plants.filter((p) => myPlants.includes(p));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      plants = plants.filter((p) => p.includes(q));
    }
    return plants.slice(0, 20);
  }, [allPlants, myPlants, search, showMyGarden]);

  const companions: CompanionEntry[] = useMemo(() => {
    if (!selectedPlant) return [];
    try { return getCompanions(selectedPlant); } catch { return []; }
  }, [selectedPlant]);

  const antagonists: CompanionEntry[] = useMemo(() => {
    if (!selectedPlant) return [];
    try { return getAntagonists(selectedPlant); } catch { return []; }
  }, [selectedPlant]);

  // Check for conflicts in user's garden
  const gardenConflicts = useMemo(() => {
    if (!showMyGarden || myPlants.length < 2) return [];
    const conflicts: { a: string; b: string; benefit: string }[] = [];
    for (let i = 0; i < myPlants.length; i++) {
      for (let j = i + 1; j < myPlants.length; j++) {
        try {
          const result = checkCompatibility(myPlants[i], myPlants[j]);
          if (result.relationship === 'antagonist') {
            conflicts.push({ a: myPlants[i], b: myPlants[j], benefit: result.benefit });
          }
        } catch { /* ok */ }
      }
    }
    return conflicts;
  }, [myPlants, showMyGarden]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Companion Matrix</Text>

      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search plants..."
        placeholderTextColor={colors.textTertiary}
      />

      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, showMyGarden && { backgroundColor: ACCENT }]}
          onPress={() => setShowMyGarden(!showMyGarden)}
        >
          <Text variant="caption" color={showMyGarden ? colors.background : colors.textSecondary}>
            My Garden Only
          </Text>
        </Pressable>
      </View>

      {/* Garden conflicts */}
      {gardenConflicts.length > 0 && (
        <Card style={{ borderColor: colors.danger, borderWidth: 1 }}>
          <Text variant="label" color={colors.danger}>GARDEN CONFLICTS</Text>
          {gardenConflicts.map((c, i) => (
            <Text key={i} variant="body" color={colors.textSecondary}>
              {c.a} + {c.b}: {c.benefit}
            </Text>
          ))}
        </Card>
      )}

      {/* Plant selector */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>SELECT A PLANT</Text>
        <View style={styles.plantGrid}>
          {filteredPlants.map((plant) => (
            <Pressable
              key={plant}
              style={[styles.plantChip, selectedPlant === plant && { backgroundColor: ACCENT }]}
              onPress={() => setSelectedPlant(plant === selectedPlant ? '' : plant)}
            >
              <Text variant="caption" color={selectedPlant === plant ? colors.background : colors.textSecondary}>
                {plant}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Companions */}
      {selectedPlant && companions.length > 0 && (
        <Card>
          <Text variant="label" color={colors.success}>
            COMPANIONS ({companions.length})
          </Text>
          {companions.map((c, i) => {
            const partner = c.plantA === selectedPlant ? c.plantB : c.plantA;
            return (
              <View key={i} style={styles.relRow}>
                <View style={[styles.relDot, { backgroundColor: colors.success }]} />
                <View style={styles.relInfo}>
                  <Text variant="body">{partner}</Text>
                  <Text variant="caption" color={colors.textSecondary}>{c.benefit}</Text>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {/* Antagonists */}
      {selectedPlant && antagonists.length > 0 && (
        <Card>
          <Text variant="label" color={colors.danger}>
            ANTAGONISTS ({antagonists.length})
          </Text>
          {antagonists.map((c, i) => {
            const partner = c.plantA === selectedPlant ? c.plantB : c.plantA;
            return (
              <View key={i} style={styles.relRow}>
                <View style={[styles.relDot, { backgroundColor: colors.danger }]} />
                <View style={styles.relInfo}>
                  <Text variant="body">{partner}</Text>
                  <Text variant="caption" color={colors.textSecondary}>{c.benefit}</Text>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {selectedPlant && companions.length === 0 && antagonists.length === 0 && (
        <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          No companion data found for {selectedPlant}.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  searchInput: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    color: colors.text, fontFamily: 'Inter', fontSize: 16,
    borderWidth: 1, borderColor: colors.border, minHeight: 44,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, minHeight: 44, justifyContent: 'center',
  },
  plantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  plantChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: borderRadius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  relRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  relDot: { width: 10, height: 10, borderRadius: 5 },
  relInfo: { flex: 1, gap: 2 },
});
