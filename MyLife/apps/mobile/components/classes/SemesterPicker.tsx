import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import type { SemesterRow } from '@mylife/classes';

export interface SemesterPickerProps {
  semesters: SemesterRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddPress?: () => void;
}

/**
 * Horizontal segmented control for switching between semesters. No loading
 * state - selection is immediate because the rows are already in memory.
 */
export function SemesterPicker({
  semesters,
  selectedId,
  onSelect,
  onAddPress,
}: SemesterPickerProps) {
  if (semesters.length === 0) {
    return (
      <Pressable style={styles.emptyButton} onPress={onAddPress}>
        <Text style={styles.emptyButtonText}>+ Add a semester</Text>
      </Pressable>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {semesters.map((sem) => {
        const isActive = sem.id === selectedId;
        return (
          <Pressable
            key={sem.id}
            onPress={() => onSelect(sem.id)}
            style={[styles.pill, isActive && styles.pillActive]}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {sem.name}
            </Text>
            {sem.is_current === 1 ? <View style={styles.currentDot} /> : null}
          </Pressable>
        );
      })}
      {onAddPress ? (
        <Pressable
          onPress={onAddPress}
          style={[styles.pill, styles.pillGhost]}
          accessibilityLabel="Add semester"
        >
          <Text style={styles.pillTextGhost}>+</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderColor: 'rgba(59,130,246,0.45)',
  },
  pillGhost: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: colors.text,
  },
  pillTextGhost: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.modules.classes,
  },
  emptyButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
    alignSelf: 'flex-start',
  },
  emptyButtonText: {
    color: colors.modules.classes,
    fontWeight: '700',
    fontSize: 13,
  },
});
