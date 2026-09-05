import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  createPreference,
  deletePreference,
  listPreferencesByCategory,
  updatePreference,
  PreferenceCategorySchema,
  type Preference,
  type PreferenceCategory,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const CATEGORY_LABELS: Record<PreferenceCategory, string> = {
  tech: 'Tech',
  household: 'Household',
  color: 'Color',
  brand: 'Brand',
  material: 'Material',
  allergy: 'Allergy',
};

export default function PreferenceCategoryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const raw = Array.isArray(params.category)
    ? params.category[0]
    : params.category;

  const categoryParse = PreferenceCategorySchema.safeParse(raw);
  const category: PreferenceCategory | null = categoryParse.success
    ? categoryParse.data
    : null;

  const [tick, setTick] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
    }, []),
  );

  const list = useMemo<Preference[]>(() => {
    if (!category) return [];
    try {
      return listPreferencesByCategory(db, category);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, category, tick]);

  if (!category) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Unknown category.</Text>
      </View>
    );
  }

  const handleAdd = () => {
    if (!newKey.trim() || !newValue.trim()) {
      Alert.alert('Required', 'Key and value are required.');
      return;
    }
    try {
      createPreference(db, {
        category,
        key: newKey.trim(),
        value: newValue.trim(),
        notes: newNotes.trim() || null,
      });
      setNewKey('');
      setNewValue('');
      setNewNotes('');
      setShowAdd(false);
      setTick((t) => t + 1);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not save. Is this key already set?',
      );
    }
  };

  const beginEdit = (p: Preference) => {
    setEditingId(p.id);
    setEditValue(p.value);
    setEditNotes(p.notes ?? '');
  };

  const handleSaveEdit = () => {
    if (!editingId || !editValue.trim()) {
      Alert.alert('Required', 'Value is required.');
      return;
    }
    try {
      updatePreference(db, editingId, {
        value: editValue.trim(),
        notes: editNotes.trim() || null,
      });
      setEditingId(null);
      setTick((t) => t + 1);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save.');
    }
  };

  const handleDelete = (p: Preference) => {
    Alert.alert('Delete preference', `Remove "${p.key}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deletePreference(db, p.id);
          setEditingId(null);
          setTick((t) => t + 1);
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{CATEGORY_LABELS[category]}</Text>
        <Text style={styles.title}>
          {list.length === 0
            ? `Add your first ${CATEGORY_LABELS[category].toLowerCase()} preference`
            : `${list.length} ${list.length === 1 ? 'entry' : 'entries'}`}
        </Text>
      </View>

      {list.length === 0 && !showAdd ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyBody}>
            Preferences are stored as key + value pairs, with optional notes.
          </Text>
        </View>
      ) : null}

      {list.map((p) => {
        const isEditing = editingId === p.id;
        return (
          <View key={p.id} style={styles.card}>
            {isEditing ? (
              <>
                <Text style={styles.label}>{p.key}</Text>
                <TextInput
                  style={styles.input}
                  value={editValue}
                  onChangeText={setEditValue}
                  placeholder="Value"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Notes (optional)"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                />
                <View style={styles.rowActions}>
                  <Pressable
                    style={styles.secondaryButtonSmall}
                    onPress={() => setEditingId(null)}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButtonSmall}
                    onPress={() => handleDelete(p)}
                  >
                    <Text style={styles.deleteInlineText}>Delete</Text>
                  </Pressable>
                  <Pressable
                    style={styles.primaryButtonSmall}
                    onPress={handleSaveEdit}
                  >
                    <Text style={styles.primaryButtonText}>Save</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Pressable onPress={() => beginEdit(p)}>
                <Text style={styles.cardKey}>{p.key}</Text>
                <Text style={styles.cardValue}>{p.value}</Text>
                {p.notes ? (
                  <Text style={styles.cardNotes}>{p.notes}</Text>
                ) : null}
              </Pressable>
            )}
          </View>
        );
      })}

      {showAdd ? (
        <View style={styles.panel}>
          <Text style={styles.title}>New {CATEGORY_LABELS[category].toLowerCase()}</Text>
          <Text style={styles.label}>Key *</Text>
          <TextInput
            style={styles.input}
            value={newKey}
            onChangeText={setNewKey}
            placeholder={
              category === 'allergy'
                ? 'Latex'
                : category === 'tech'
                  ? 'Phone OS'
                  : 'Key'
            }
            placeholderTextColor={colors.textSecondary}
            autoFocus
          />
          <Text style={styles.label}>Value *</Text>
          <TextInput
            style={styles.input}
            value={newValue}
            onChangeText={setNewValue}
            placeholder={
              category === 'allergy'
                ? 'severe'
                : category === 'tech'
                  ? 'iOS'
                  : 'Value'
            }
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={newNotes}
            onChangeText={setNewNotes}
            placeholder="Optional"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
          <View style={styles.rowActions}>
            <Pressable
              style={styles.secondaryButtonSmall}
              onPress={() => {
                setShowAdd(false);
                setNewKey('');
                setNewValue('');
                setNewNotes('');
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButtonSmall} onPress={handleAdd}>
              <Text style={styles.primaryButtonText}>Add</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={styles.primaryButton}
          onPress={() => setShowAdd(true)}
        >
          <Text style={styles.primaryButtonText}>Add preference</Text>
        </Pressable>
      )}

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 180,
    gap: 12,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.lowest,
  },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
  header: {
    gap: 6,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SHOP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  emptyCard: {
    gap: 6,
    padding: 18,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emptyBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  card: {
    gap: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardKey: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardNotes: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  input: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    justifyContent: 'flex-end',
  },
  primaryButton: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonSmall: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 13, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonSmall: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  deleteInlineText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },
});
