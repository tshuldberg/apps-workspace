import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  createWorkoutPlan,
  getWorkoutPlans,
  deleteWorkoutPlan,
  subscribeToPlan,
  unsubscribeFromPlan,
  getActivePlanSubscription,
  getPlanProgress,
} from '@mylife/workouts';
import type { WorkoutPlan, PlanSubscriptionRow } from '@mylife/workouts';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.workouts;

export default function PlansScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [activeSub, setActiveSub] = useState<PlanSubscriptionRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [weeks, setWeeks] = useState('4');

  const load = useCallback(() => {
    setPlans(getWorkoutPlans(db));
    setActiveSub(getActivePlanSubscription(db));
  }, [db]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = () => {
    if (!name.trim()) return;
    const weeksJson = JSON.stringify(
      Array.from({ length: Number(weeks) || 4 }, () => ({
        days: Array.from({ length: 7 }, () => ({ workoutId: null, isRest: true })),
      })),
    );
    createWorkoutPlan(db, uuid(), {
      title: name.trim(),
      description: description.trim() || '',
      weeksJson,
    });
    setName('');
    setDescription('');
    setShowForm(false);
    load();
  };

  const handleDelete = (id: string, planName: string) => {
    Alert.alert('Delete Plan', `Delete "${planName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteWorkoutPlan(db, id); load(); } },
    ]);
  };

  const handleSubscribe = (planId: string) => {
    subscribeToPlan(db, uuid(), planId);
    load();
  };

  const handleUnsubscribe = () => {
    if (activeSub) { unsubscribeFromPlan(db, activeSub.planId); load(); }
  };

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={plans}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <View style={styles.rowBetween}>
            <Text variant="subheading">Workout Plans</Text>
            <Pressable style={styles.newButton} onPress={() => setShowForm(!showForm)}>
              <Text variant="label" color={colors.background}>{showForm ? 'Cancel' : 'New Plan'}</Text>
            </Pressable>
          </View>

          {activeSub ? (
            <Card>
              <Text variant="label" color={ACCENT}>Active Plan</Text>
              <Text variant="body">{plans.find((p) => p.id === activeSub.planId)?.title ?? 'Unknown'}</Text>
              <Pressable style={styles.unsub} onPress={handleUnsubscribe}>
                <Text variant="caption" color={colors.danger}>Unsubscribe</Text>
              </Pressable>
            </Card>
          ) : null}

          {showForm ? (
            <Card>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Plan name" placeholderTextColor={colors.textTertiary} />
              <TextInput style={[styles.input, { marginTop: spacing.xs }]} value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={colors.textTertiary} />
              <View style={[styles.formRow, { marginTop: spacing.xs }]}>
                <Text variant="body">Weeks:</Text>
                <TextInput style={[styles.input, { width: 60 }]} value={weeks} onChangeText={setWeeks} keyboardType="number-pad" placeholderTextColor={colors.textTertiary} />
              </View>
              <Pressable style={[styles.newButton, { marginTop: spacing.sm }]} onPress={handleCreate}>
                <Text variant="label" color={colors.background}>Create Plan</Text>
              </Pressable>
            </Card>
          ) : null}
        </>
      }
      renderItem={({ item }) => {
        const isActive = activeSub?.planId === item.id;
        const weekCount = item.weeks.length;
        return (
          <Card>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontWeight: '600' }}>{item.title}</Text>
                {item.description ? <Text variant="caption" color={colors.textSecondary}>{item.description}</Text> : null}
                <Text variant="caption" color={colors.textSecondary}>{weekCount} weeks</Text>
              </View>
              <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
                {!isActive ? (
                  <Pressable style={styles.subButton} onPress={() => handleSubscribe(item.id)}>
                    <Text variant="caption" color={colors.background}>Subscribe</Text>
                  </Pressable>
                ) : (
                  <Text variant="caption" color={ACCENT}>Active</Text>
                )}
                <Pressable onPress={() => handleDelete(item.id, item.title)}>
                  <Text variant="caption" color={colors.danger}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </Card>
        );
      }}
      ListEmptyComponent={
        !showForm ? (
          <Text variant="caption" color={colors.textSecondary} style={{ textAlign: 'center', marginTop: spacing.lg }}>
            No workout plans yet. Create one to structure your training.
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  newButton: { borderRadius: 8, backgroundColor: ACCENT, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: colors.text, backgroundColor: colors.surfaceElevated },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subButton: { borderRadius: 6, backgroundColor: ACCENT, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  unsub: { marginTop: spacing.xs },
});
