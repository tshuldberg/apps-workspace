import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  listCategories,
  createCategory,
  deleteCategory,
  getSubscriptionCount,
} from '@mylife/subs';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.subs;

export default function SubsSettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const refresh = () => setTick((v) => v + 1);

  const categories = useMemo(() => listCategories(db), [db, tick]);
  const totalSubs = useMemo(() => getSubscriptionCount(db), [db, tick]);

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const id = `cat_${Date.now()}`;
    createCategory(db, id, {
      name: newCatName.trim(),
      icon: null,
      color: newCatColor,
      sortOrder: categories.length,
    });
    setNewCatName('');
    refresh();
  };

  const handleDeleteCategory = (id: string, name: string) => {
    Alert.alert('Delete Category', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { deleteCategory(db, id); refresh(); },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Info */}
      <Card>
        <Text variant="subheading">MySubs Settings</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {totalSubs} subscription{totalSubs !== 1 ? 's' : ''} tracked
        </Text>
      </Card>

      {/* Find Subscriptions */}
      <Pressable style={styles.detectButton} onPress={() => router.push('/(subs)/detect')}>
        <Text variant="label" color={colors.background}>Find Subscriptions</Text>
      </Pressable>

      {/* Categories */}
      <Card>
        <Text variant="subheading">Categories</Text>
        <View style={styles.list}>
          {categories.map((cat) => (
            <View key={cat.id} style={styles.catRow}>
              <View style={[styles.dot, { backgroundColor: cat.color ?? ACCENT }]} />
              <Text variant="body" style={styles.catLabel}>
                {cat.icon ?? ''} {cat.name}
              </Text>
              <Pressable onPress={() => handleDeleteCategory(cat.id, cat.name)}>
                <Text variant="caption" color={colors.danger}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <View style={styles.formRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={newCatName}
            onChangeText={setNewCatName}
            placeholder="New category name"
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable style={styles.addButton} onPress={handleAddCategory}>
            <Text variant="label" color={colors.background}>Add</Text>
          </Pressable>
        </View>
      </Card>

      {/* Notification preferences placeholder */}
      <Card>
        <Text variant="subheading">Notifications</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Renewal reminders and price change alerts will be configurable here.
        </Text>
        {/* TODO: Implement notification toggle when push notification system is available */}
      </Card>

      {/* Data management */}
      <Card>
        <Text variant="subheading">Data</Text>
        <Text variant="caption" color={colors.textSecondary}>
          All subscription data is stored locally on your device.
        </Text>
        {/* TODO: Add CSV export and data reset options */}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  catLabel: { flex: 1 },
  formRow: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: colors.surfaceElevated,
  },
  addButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center',
  },
  detectButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
