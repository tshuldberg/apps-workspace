import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';

/**
 * Cluster definitions, sourced from
 * docs/plans/consolidation/04-onboarding-goal-based.md and
 * packages/module-registry/src/dashboard.ts (CLUSTER_MODULES).
 */
const CLUSTERS: readonly {
  id: string;
  icon: string;
  label: string;
  description: string;
}[] = [
  { id: 'body', icon: '\u{1F4AA}', label: 'Body', description: 'Health, energy, movement, sleep.' },
  { id: 'mind', icon: '\u{1F9E0}', label: 'Mind', description: 'Journaling, reflection, focus, mood.' },
  { id: 'home', icon: '\u{1F3E1}', label: 'Home', description: 'Household, car, closet, pets, garden.' },
  { id: 'money', icon: '\u{1F4B0}', label: 'Money', description: 'Budget, subscriptions, savings.' },
  { id: 'social', icon: '\u{1F465}', label: 'Social', description: 'Events, friends, messages.' },
  { id: 'outdoor', icon: '\u{1F332}', label: 'Outdoor', description: 'Trails, surf, stars, garden.' },
  { id: 'knowledge', icon: '\u{1F4DA}', label: 'Knowledge', description: 'Books, flashcards, words, notes.' },
];

const MIN_SELECTION = 1;
const MAX_SELECTION = 3;

export default function GoalScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<readonly string[]>([]);

  const toggle = useCallback((clusterId: string) => {
    setSelected((prev) => {
      if (prev.includes(clusterId)) {
        return prev.filter((id) => id !== clusterId);
      }
      if (prev.length >= MAX_SELECTION) return prev;
      return [...prev, clusterId];
    });
  }, []);

  const canContinue = selected.length >= MIN_SELECTION;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    router.replace({
      pathname: '/(onboarding)/kit',
      params: { clusters: selected.join(',') },
    });
  }, [canContinue, router, selected]);

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.hero}>
        <Text style={s.heroTitle}>What matters to you?</Text>
        <Text style={s.heroSubtitle}>
          Pick 1 to 3 areas of your life. We'll build a starter kit around them.
        </Text>
      </View>

      <View style={s.grid}>
        {CLUSTERS.map((cluster) => {
          const isSelected = selected.includes(cluster.id);
          const isDisabled = !isSelected && selected.length >= MAX_SELECTION;
          return (
            <Pressable
              key={cluster.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: isDisabled }}
              accessibilityLabel={`${cluster.label}: ${cluster.description}`}
              style={({ pressed }) => [
                s.tile,
                isSelected && s.tileSelected,
                isDisabled && s.tileDisabled,
                pressed && !isDisabled && s.tilePressed,
              ]}
              onPress={() => toggle(cluster.id)}
              disabled={isDisabled}
            >
              <Text style={s.tileIcon}>{cluster.icon}</Text>
              <View style={s.tileText}>
                <Text
                  style={[s.tileLabel, isSelected && s.tileLabelSelected]}
                >
                  {cluster.label}
                </Text>
                <Text style={s.tileDescription}>{cluster.description}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={s.footer}>
        <Text style={s.selectionHint}>
          {selected.length === 0
            ? 'Select at least 1 to continue'
            : `${selected.length} of ${MAX_SELECTION} selected`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled: !canContinue }}
          disabled={!canContinue}
          style={({ pressed }) => [
            s.primaryBtn,
            !canContinue && s.primaryBtnDisabled,
            pressed && canContinue && s.btnPressed,
          ]}
          onPress={handleContinue}
        >
          <Text style={s.primaryBtnText}>Continue</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: 72,
    paddingBottom: 48,
    flexGrow: 1,
  },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  grid: {
    gap: 12,
    marginBottom: spacing.xl,
  },
  tile: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tileSelected: {
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderColor: colors.accent,
  },
  tileDisabled: { opacity: 0.4 },
  tilePressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  tileIcon: { fontSize: 32, width: 40, textAlign: 'center' },
  tileText: { flex: 1, gap: 2 },
  tileLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  tileLabelSelected: { color: colors.text },
  tileDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  footer: { gap: 10, marginTop: 'auto' },
  selectionHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
