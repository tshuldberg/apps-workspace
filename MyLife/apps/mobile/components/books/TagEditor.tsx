import React, { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import { useContentWarnings } from '../../hooks/books/use-content-warnings';

const SEVERITY_OPTIONS = ['mild', 'moderate', 'severe'] as const;
const MOOD_TYPES = [
  { key: 'mood' as const, label: 'Mood', color: '#9B59B6' },
  { key: 'pace' as const, label: 'Pace', color: '#3498DB' },
  { key: 'genre' as const, label: 'Genre', color: '#2ECC71' },
];

interface TagEditorProps {
  bookId: string;
}

export function TagEditor({ bookId }: TagEditorProps) {
  const {
    warnings, moods,
    distinctWarnings, distinctMoods, distinctPaces, distinctGenres,
    addWarning, removeWarning, addMood, removeMood,
  } = useContentWarnings(bookId);

  const [showAddMood, setShowAddMood] = useState<'mood' | 'pace' | 'genre' | null>(null);
  const [showAddWarning, setShowAddWarning] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('mild');

  const getSuggestions = (type: 'mood' | 'pace' | 'genre') => {
    switch (type) {
      case 'mood': return distinctMoods;
      case 'pace': return distinctPaces;
      case 'genre': return distinctGenres;
    }
  };

  const handleAddMood = (type: 'mood' | 'pace' | 'genre', value: string) => {
    if (!value.trim()) return;
    addMood(type, value.trim());
    setCustomValue('');
    setShowAddMood(null);
  };

  const handleAddWarning = (warning: string) => {
    if (!warning.trim()) return;
    addWarning(warning.trim(), severity);
    setCustomValue('');
    setShowAddWarning(false);
  };

  return (
    <View style={styles.container}>
      {/* Mood Tags */}
      <Text variant="label">Mood Tags</Text>
      {MOOD_TYPES.map(({ key, label, color }) => {
        const tags = moods.filter((m) => m.tag_type === key);
        return (
          <View key={key} style={styles.tagSection}>
            <View style={styles.tagHeader}>
              <Text variant="caption" color={colors.textSecondary}>{label}</Text>
              <Pressable onPress={() => setShowAddMood(showAddMood === key ? null : key)} hitSlop={8}>
                <Text variant="caption" color={colors.modules.books}>+</Text>
              </Pressable>
            </View>
            <View style={styles.chipRow}>
              {tags.map((t) => (
                <Pressable
                  key={t.id}
                  style={[styles.chip, { backgroundColor: `${color}33` }]}
                  onPress={() => removeMood(t.id)}
                >
                  <Text variant="caption" color={color}>{t.value} x</Text>
                </Pressable>
              ))}
            </View>
            {showAddMood === key && (
              <View style={styles.addRow}>
                <View style={styles.chipRow}>
                  {getSuggestions(key).slice(0, 6).map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.chip, { backgroundColor: colors.surfaceElevated }]}
                      onPress={() => handleAddMood(key, s)}
                    >
                      <Text variant="caption" color={colors.textSecondary}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={customValue}
                    onChangeText={setCustomValue}
                    placeholder="Custom..."
                    placeholderTextColor={colors.textTertiary}
                    onSubmitEditing={() => handleAddMood(key, customValue)}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })}

      {/* Content Warnings */}
      <View style={styles.warningSection}>
        <View style={styles.tagHeader}>
          <Text variant="label">Content Warnings</Text>
          <Pressable onPress={() => setShowAddWarning(!showAddWarning)} hitSlop={8}>
            <Text variant="caption" color={colors.modules.books}>+</Text>
          </Pressable>
        </View>
        <View style={styles.chipRow}>
          {warnings.map((w) => (
            <Pressable
              key={w.id}
              style={[styles.chip, { backgroundColor: `${colors.danger}22` }]}
              onPress={() => removeWarning(w.id)}
            >
              <Text variant="caption" color={colors.danger}>
                {w.warning} {w.severity === 'severe' ? '***' : w.severity === 'moderate' ? '**' : '*'} x
              </Text>
            </Pressable>
          ))}
        </View>
        {showAddWarning && (
          <View style={styles.addRow}>
            <View style={styles.chipRow}>
              {SEVERITY_OPTIONS.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.chip, severity === s && { backgroundColor: `${colors.danger}33` }]}
                  onPress={() => setSeverity(s)}
                >
                  <Text variant="caption" color={severity === s ? colors.danger : colors.textSecondary}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.chipRow}>
              {distinctWarnings.slice(0, 6).map((w) => (
                <Pressable
                  key={w}
                  style={[styles.chip, { backgroundColor: colors.surfaceElevated }]}
                  onPress={() => handleAddWarning(w)}
                >
                  <Text variant="caption" color={colors.textSecondary}>{w}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={customValue}
                onChangeText={setCustomValue}
                placeholder="Custom warning..."
                placeholderTextColor={colors.textTertiary}
                onSubmitEditing={() => handleAddWarning(customValue)}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  tagSection: {
    gap: 4,
  },
  tagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    backgroundColor: colors.surfaceElevated,
  },
  warningSection: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  addRow: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    padding: spacing.xs,
    color: colors.text,
    fontFamily: 'Inter',
    fontSize: 13,
  },
});
