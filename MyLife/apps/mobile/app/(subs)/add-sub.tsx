import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  createSubscription,
  listCategories,
} from '@mylife/subs';
import type { BillingCycle } from '@mylife/subs';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.subs;
const CYCLES: BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'yearly', 'lifetime'];

export default function AddSubScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [name, setName] = useState('');
  const [costStr, setCostStr] = useState('');
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');

  const categories = useMemo(() => listCategories(db), [db]);

  const handleSave = () => {
    if (!name.trim() || !costStr.trim()) return;
    const costCents = Math.round(parseFloat(costStr) * 100);
    if (isNaN(costCents) || costCents < 0) return;

    const id = `sub_${Date.now()}`;
    createSubscription(db, id, {
      name: name.trim(),
      costCents,
      billingCycle: cycle,
      startDate,
      categoryId,
      notes: notes.trim() || null,
      url: url.trim() || null,
    });
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Add Subscription</Text>
        <View style={styles.formGrid}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Service name (e.g. Netflix)"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={costStr}
            onChangeText={setCostStr}
            placeholder="Price in $"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
          />

          {/* Billing cycle */}
          <Text variant="caption" color={colors.textSecondary}>Billing Cycle</Text>
          <View style={styles.chipRow}>
            {CYCLES.map((c) => {
              const selected = c === cycle;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCycle(c)}
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="Start date (YYYY-MM-DD)"
            placeholderTextColor={colors.textTertiary}
          />

          {/* Category picker */}
          <Text variant="caption" color={colors.textSecondary}>Category</Text>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setCategoryId(null)}
              style={[styles.chip, categoryId === null && styles.chipActive]}
            >
              <Text variant="caption" color={categoryId === null ? colors.background : colors.textSecondary}>
                None
              </Text>
            </Pressable>
            {categories.map((cat) => {
              const selected = cat.id === categoryId;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  style={[styles.chip, selected && { backgroundColor: cat.color ?? ACCENT, borderColor: cat.color ?? ACCENT }]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {cat.icon ?? ''} {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="Website URL (optional)"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.textTertiary}
          />

          <Pressable style={styles.primaryButton} onPress={handleSave}>
            <Text variant="label" color={colors.background}>Save Subscription</Text>
          </Pressable>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  formGrid: { gap: spacing.sm, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: colors.surfaceElevated,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
