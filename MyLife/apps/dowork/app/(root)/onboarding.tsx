import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Button, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';
import { DW_ACCENT } from './theme/tokens';

const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'Beginner', sub: '0-1 year' },
  { id: 'intermediate', label: 'Intermediate', sub: '1-3 years' },
  { id: 'advanced', label: 'Advanced', sub: '3+ years' },
];

const GOALS = [
  { id: 'strength', label: 'Build Strength', icon: '💪' },
  { id: 'muscle', label: 'Build Muscle', icon: '🏋️' },
  { id: 'endurance', label: 'Improve Endurance', icon: '🏃' },
  { id: 'weight_loss', label: 'Lose Weight', icon: '⚖️' },
  { id: 'flexibility', label: 'Flexibility', icon: '🧘' },
  { id: 'general', label: 'General Fitness', icon: '❤️' },
];

export default function WorkoutsOnboardingScreen() {
  const router = useRouter();
  const [experience, setExperience] = useState<string | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const db = useDatabase();

  const handleGetStarted = () => {
    db.execute(
      `INSERT INTO hub_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['workouts.onboarding_complete', 'true'],
    );
    if (experience) {
      db.execute(
        `INSERT INTO hub_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ['workouts.experience_level', experience],
      );
    }
    if (selectedGoals.length > 0) {
      db.execute(
        `INSERT INTO hub_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ['workouts.goals', JSON.stringify(selectedGoals)],
      );
    }
    router.replace('/(root)/(tabs)');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>🏋️</Text>
        <Text variant="heading">Welcome to DoWork</Text>
        <Text variant="body" color={colors.textSecondary} style={styles.centered}>
          Track your training, completely private.
        </Text>
      </View>

      <Card style={styles.card}>
        <Text variant="subheading">Training experience</Text>
        <View style={styles.optionList}>
          {EXPERIENCE_LEVELS.map((level) => {
            const selected = experience === level.id;
            return (
              <Pressable
                key={level.id}
                style={[styles.optionCard, selected && styles.optionSelected]}
                onPress={() => setExperience(level.id)}
              >
                <View>
                  <Text variant="body" color={colors.text}>{level.label}</Text>
                  <Text variant="caption" color={colors.textSecondary}>{level.sub}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]} />
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="subheading">What are your goals?</Text>
        <View style={styles.goalGrid}>
          {GOALS.map((goal) => {
            const selected = selectedGoals.includes(goal.id);
            return (
              <Pressable
                key={goal.id}
                style={[styles.goalCard, selected && styles.goalSelected]}
                onPress={() => toggleGoal(goal.id)}
              >
                <Text style={styles.goalIcon}>{goal.icon}</Text>
                <Text variant="caption" color={selected ? colors.text : colors.textSecondary}>
                  {goal.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="subheading">Meet your coach</Text>
        <Text variant="body" color={colors.textSecondary}>
          Train solo or connect with a real trainer for form checks and personalized programming.
        </Text>
        <Pressable
          style={styles.coachCard}
          onPress={() => router.push('/(root)/(tabs)/trainers' as never)}
        >
          <Text style={styles.coachIcon}>🧑‍🏫</Text>
          <View style={styles.coachTextWrap}>
            <Text variant="body" color={colors.text}>Browse trainers</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Find a coach or redeem an invite code
            </Text>
          </View>
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <Text variant="subheading">Get started</Text>
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionCard}
            onPress={() => {
              handleGetStarted();
              router.push('/(root)/builder' as never);
            }}
          >
            <Text style={styles.actionIcon}>📝</Text>
            <Text variant="label" color={colors.text}>Build a Workout</Text>
          </Pressable>
          <Pressable
            style={styles.actionCard}
            onPress={() => {
              handleGetStarted();
              router.push('/(root)/(tabs)/explore' as never);
            }}
          >
            <Text style={styles.actionIcon}>🔍</Text>
            <Text variant="label" color={colors.text}>Browse Exercises</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.buttonRow}>
        <Button
          variant="primary"
          label="Get Started"
          onPress={handleGetStarted}
        />
        <Button variant="ghost" label="Skip for now" onPress={handleGetStarted} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  heroIcon: { fontSize: 64 },
  centered: { textAlign: 'center', maxWidth: 280 },
  card: { gap: spacing.sm },
  optionList: { gap: spacing.sm },
  optionCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surfaceElevated,
  },
  optionSelected: { borderColor: DW_ACCENT, backgroundColor: DW_ACCENT + '18' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border },
  radioSelected: { borderColor: DW_ACCENT, backgroundColor: DW_ACCENT },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  goalCard: {
    width: '30%', flexGrow: 1, alignItems: 'center', padding: spacing.sm,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceElevated, gap: 4,
  },
  goalSelected: { borderColor: DW_ACCENT, backgroundColor: DW_ACCENT + '18' },
  goalIcon: { fontSize: 28 },
  coachCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surfaceElevated,
  },
  coachIcon: { fontSize: 28 },
  coachTextWrap: { flex: 1, gap: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionCard: {
    flex: 1, alignItems: 'center', gap: spacing.xs, padding: spacing.md,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated,
  },
  actionIcon: { fontSize: 32 },
  buttonRow: { gap: spacing.sm, paddingTop: spacing.md },
});
