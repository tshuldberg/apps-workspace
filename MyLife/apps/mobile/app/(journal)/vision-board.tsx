import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MAX_BOARDS, MAX_ITEMS_PER_BOARD, isBoardLimitReached } from '@mylife/journal';
import { Card, Text, colors, spacing } from '@mylife/ui';

const ACCENT = colors.modules.journal;
const TEMPLATES = [
  { name: 'Career Goals', color: '#3B82F6' },
  { name: 'Travel Dreams', color: '#14B8A6' },
  { name: 'Fitness Goals', color: '#EF4444' },
  { name: 'Relationships', color: '#F472B6' },
  { name: 'Personal Growth', color: '#A78BFA' },
];

export default function VisionBoardScreen() {
  const [boards] = useState<Array<{ id: string; name: string; items: number }>>([]);
  const limitReached = isBoardLimitReached(boards.length);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Vision Board</Text>
      <Text style={styles.subtitle}>
        Visualize your goals and dreams. {boards.length}/{MAX_BOARDS} boards.
      </Text>

      {boards.length === 0 && (
        <Card style={styles.emptyCard}>
          <Text style={{ fontSize: 48 }}>🎯</Text>
          <Text style={styles.emptyTitle}>Create Your First Board</Text>
          <Text style={styles.emptyText}>
            A vision board helps you visualize and manifest your goals.
          </Text>
        </Card>
      )}

      {/* Template Gallery */}
      <Text style={styles.sectionTitle}>Templates</Text>
      <View style={styles.templateGrid}>
        {TEMPLATES.map((t) => (
          <Card key={t.name} style={[styles.templateCard, { borderLeftColor: t.color, borderLeftWidth: 3 }]}>
            <Text style={styles.templateName}>{t.name}</Text>
          </Card>
        ))}
      </View>

      {/* Board List */}
      {boards.map((b) => (
        <Card key={b.id} style={styles.boardCard}>
          <Text style={styles.boardName}>{b.name}</Text>
          <Text style={styles.boardMeta}>{b.items}/{MAX_ITEMS_PER_BOARD} items</Text>
        </Card>
      ))}

      {/* Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>
        <Text style={styles.featureItem}>{'\u2022'} Add images from camera or library</Text>
        <Text style={styles.featureItem}>{'\u2022'} Text blocks and color backgrounds</Text>
        <Text style={styles.featureItem}>{'\u2022'} Zoom, pan, and position items freely</Text>
        <Text style={styles.featureItem}>{'\u2022'} Export as image to share</Text>
        <Text style={styles.featureItem}>{'\u2022'} Daily inspiration from random board items</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  emptyCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  templateGrid: { gap: spacing.sm },
  templateCard: { padding: spacing.md },
  templateName: { fontSize: 15, fontWeight: '600', color: colors.text },
  boardCard: { padding: spacing.md, gap: spacing.xs },
  boardName: { fontSize: 16, fontWeight: '600', color: colors.text },
  boardMeta: { fontSize: 12, color: colors.textSecondary },
  section: { padding: spacing.md, gap: spacing.sm },
  featureItem: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
});
