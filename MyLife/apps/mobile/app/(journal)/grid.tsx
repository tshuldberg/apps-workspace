import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BUILT_IN_LAYOUTS } from '@mylife/journal';
import { Card, Text, colors, spacing } from '@mylife/ui';

const ACCENT = colors.modules.journal;

type BuiltInLayout = (typeof BUILT_IN_LAYOUTS)[number];

export default function GridScreen() {
  const [selected, setSelected] = useState<BuiltInLayout | null>(null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Grid Layouts</Text>
      <Text style={styles.subtitle}>Choose a structured layout for your journal entries.</Text>

      {!selected ? (
        <View style={styles.layoutGrid}>
          {BUILT_IN_LAYOUTS.map((layout) => (
            <Pressable key={layout.name} onPress={() => setSelected(layout)}>
              <Card style={styles.layoutCard}>
                <Text style={styles.layoutName}>{layout.name}</Text>
                <Text style={styles.layoutMeta}>
                  {layout.rows}x{layout.cols} grid {'\u00B7'} {layout.cells.length} cells
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Pressable style={styles.backBtn} onPress={() => setSelected(null)}>
            <Text style={styles.backText}>Back to Layouts</Text>
          </Pressable>
          <Card style={styles.previewCard}>
            <Text style={styles.previewTitle}>{selected.name}</Text>
            <Text style={styles.previewMeta}>
              {selected.rows} rows x {selected.cols} columns
            </Text>
            <View style={styles.gridPreview}>
              {selected.cells.map((cell, i) => (
                <View key={i} style={[styles.gridCell, {
                  width: `${Math.floor(100 / selected.cols) - 2}%`,
                }]}>
                  <Text style={styles.cellPrompt} numberOfLines={2}>{cell.prompt}</Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  layoutGrid: { gap: spacing.sm },
  layoutCard: { padding: spacing.md, gap: spacing.xs },
  layoutName: { fontSize: 16, fontWeight: '700', color: colors.text },
  layoutMeta: { fontSize: 12, color: colors.textSecondary },
  backBtn: { padding: spacing.sm },
  backText: { fontSize: 14, color: ACCENT },
  previewCard: { padding: spacing.md, gap: spacing.sm },
  previewTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  previewMeta: { fontSize: 13, color: colors.textSecondary },
  gridPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.sm },
  gridCell: {
    aspectRatio: 1, backgroundColor: colors.surfaceElevated, borderRadius: 6,
    borderWidth: 1, borderColor: colors.border, padding: 4, justifyContent: 'center',
  },
  cellPrompt: { fontSize: 8, color: colors.textSecondary, textAlign: 'center' },
});
