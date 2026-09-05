import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listTemplates } from '@mylife/flash';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.flash;

const REFERENCE_TYPES = [
  {
    key: 'basic',
    title: 'Basic',
    description: 'Direct question and answer for fast daily review.',
    example: 'Q: What is the capital of France?\nA: Paris',
  },
  {
    key: 'reversed',
    title: 'Reversed',
    description: 'Generate both directions so you can recall either side first.',
    example: 'Q: Paris\nA: Capital of France',
  },
  {
    key: 'cloze',
    title: 'Cloze',
    description: 'Hide the critical parts of a sentence and recall them in context.',
    example: 'The {{c1::capital}} of France is {{c2::Paris}}.',
  },
  {
    key: 'occlusion',
    title: 'Image Occlusion',
    description: 'Mask diagrams or screenshots and reveal them on demand.',
    example: 'Use for anatomy, maps, and chart labels.',
  },
  {
    key: 'multiple-choice',
    title: 'Multiple Choice',
    description: 'Practice recognition with distractors before moving into open recall.',
    example: 'Which layer protects the heart? Epicardium, pleura, dura, fascia',
  },
  {
    key: 'match',
    title: 'Match Game',
    description: 'Warm up by matching prompts to answers on a timed board.',
    example: 'Best for vocabulary, symbols, dates, and quick confidence reps.',
  },
] as const;

export default function FlashCardTypesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const templates = listTemplates(db);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.hero}>
        <Text variant="label" color={ACCENT}>CARD TYPES</Text>
        <Text variant="heading">Build the right recall shape for the material.</Text>
        <Text variant="body" color={colors.textSecondary}>
          MyFlash supports direct recall, two-way prompts, cloze deletions, media-driven cards,
          and timed memory drills. Start in Decks, then mix in Match Game for lighter reps.
        </Text>
        <View style={styles.heroActions}>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/(flash)/decks')}>
            <Text variant="label" color={colors.background}>Create Cards</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/(flash)/match-game')}>
            <Text variant="label" color={ACCENT}>Play Match</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Built-in Templates</Text>
        <View style={styles.templateList}>
          {templates.map((template) => (
            <View key={template.id} style={styles.templateRow}>
              <View style={styles.templateBadge}>
                <Text variant="caption" color={ACCENT}>{template.cardCountPerNote}x</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body">{template.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {template.description}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      {REFERENCE_TYPES.map((type) => (
        <Card key={type.key} style={styles.referenceCard}>
          <View style={styles.referenceHeader}>
            <Text variant="subheading">{type.title}</Text>
            <View style={styles.referencePill}>
              <Text variant="caption" color={ACCENT}>Recommended</Text>
            </View>
          </View>
          <Text variant="body" color={colors.textSecondary}>
            {type.description}
          </Text>
          <View style={styles.exampleBox}>
            <Text variant="label" color={colors.textTertiary}>EXAMPLE</Text>
            <Text variant="body" color={colors.text}>{type.example}</Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  hero: {
    gap: spacing.md,
    borderColor: 'rgba(139,92,246,0.2)',
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: ACCENT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.28)',
    backgroundColor: 'rgba(139,92,246,0.08)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  templateList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
  },
  templateBadge: {
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.12)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  referenceCard: {
    gap: spacing.sm,
  },
  referenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  referencePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
    backgroundColor: 'rgba(139,92,246,0.08)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  exampleBox: {
    gap: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
  },
});
