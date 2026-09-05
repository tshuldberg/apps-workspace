// Shared UI primitives for the Trainer Studio (upload queue, manage grid,
// profile editor). All use DoWork brand tokens so the Studio matches the
// standalone app's gritty-gym look.

import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, Search, X } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { TRAINER_PRICE_TIERS } from '../../data/cloud-trainers';
import type { TrainerVideoAngle } from '../../data/cloud-trainer-videos';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../../theme/tokens';

export interface ExerciseOption {
  id: string;
  name: string;
  category: string;
}

export const STUDIO_ANGLES: { value: TrainerVideoAngle; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'three_quarter', label: '3/4' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'back', label: 'Back' },
];

export function StudioCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StudioField({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'sentences',
  keyboardType = 'default',
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  keyboardType?: 'default' | 'url';
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={DW_TEXT.disabled}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoCorrect={false}
        editable={editable}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function StudioTextArea({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={DW_TEXT.disabled}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        accessibilityLabel={label}
      />
    </View>
  );
}

export function PremiumToggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>Premium video</Text>
        <Text style={styles.toggleHint}>
          {value ? 'Only subscribers and active clients can watch.' : 'Free for anyone to watch.'}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: DW_ACCENT, false: DW_SURFACES.high }}
        thumbColor={DW_TEXT.primary}
        accessibilityLabel="Premium video toggle"
      />
    </View>
  );
}

export function AngleSelector({
  value,
  onChange,
}: {
  value: TrainerVideoAngle | null;
  onChange: (next: TrainerVideoAngle | null) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Camera angle</Text>
      <View style={styles.chipRow}>
        <SelectableChip label="None" selected={value === null} onPress={() => onChange(null)} />
        {STUDIO_ANGLES.map((angle) => (
          <SelectableChip
            key={angle.value}
            label={angle.label}
            selected={value === angle.value}
            onPress={() => onChange(angle.value)}
          />
        ))}
      </View>
    </View>
  );
}

export function PriceTierPicker({ value, onChange }: { value: number; onChange: (tier: number) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Subscription price</Text>
      <View style={styles.chipRow}>
        {TRAINER_PRICE_TIERS.map((tier) => (
          <SelectableChip
            key={tier.tier}
            label={tier.label}
            selected={value === tier.tier}
            onPress={() => onChange(tier.tier)}
          />
        ))}
      </View>
    </View>
  );
}

export function SpecialtyChipsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const entry = draft.trim();
    if (!entry) return;
    if (value.some((existing) => existing.toLowerCase() === entry.toLowerCase())) {
      setDraft('');
      return;
    }
    if (value.length >= 12) {
      setDraft('');
      return;
    }
    onChange([...value, entry]);
    setDraft('');
  };

  const remove = (entry: string) => {
    onChange(value.filter((existing) => existing !== entry));
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Specialties</Text>
      {value.length > 0 ? (
        <View style={styles.chipRow}>
          {value.map((entry) => (
            <Pressable
              key={entry}
              style={styles.removableChip}
              onPress={() => remove(entry)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${entry}`}
            >
              <Text style={styles.removableChipText}>{entry}</Text>
              <X size={12} color={DW_TEXT.secondary} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a specialty"
          placeholderTextColor={DW_TEXT.disabled}
          autoCapitalize="words"
          onSubmitEditing={add}
          returnKeyType="done"
          accessibilityLabel="Add a specialty"
        />
        <Pressable
          style={styles.addButton}
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel="Add specialty"
        >
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SelectableChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.selectChip, selected && styles.selectChipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[styles.selectChipText, selected && styles.selectChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function StudioButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        pressed && { opacity: 0.86 },
        disabled && { opacity: 0.45 },
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.buttonTextPrimary,
          variant === 'secondary' && styles.buttonTextSecondary,
          variant === 'danger' && styles.buttonTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ExercisePickerSheet({
  visible,
  exercises,
  onSelect,
  onClose,
}: {
  visible: boolean;
  exercises: ExerciseOption[];
  onSelect: (exercise: ExerciseOption) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? exercises.filter(
          (exercise) =>
            exercise.name.toLowerCase().includes(q) || exercise.category.toLowerCase().includes(q),
        )
      : exercises;
    return base.slice(0, 80);
  }, [exercises, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Link an exercise</Text>
          <View style={styles.searchWrap}>
            <Search size={16} color={DW_TEXT.tertiary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises"
              placeholderTextColor={DW_TEXT.disabled}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search exercises"
            />
          </View>
          <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
            {filtered.map((exercise) => (
              <Pressable
                key={exercise.id}
                style={({ pressed }) => [styles.exerciseRow, pressed && { opacity: 0.86 }]}
                onPress={() => onSelect(exercise)}
                accessibilityRole="button"
                accessibilityLabel={exercise.name}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseMeta}>{exercise.category}</Text>
                </View>
                <Check size={16} color={DW_TEXT.tertiary} />
              </Pressable>
            ))}
            {filtered.length === 0 ? (
              <Text style={styles.sheetEmpty}>No exercises match “{query.trim()}”.</Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.secondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: DW_SURFACES.mid,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: WK_FONTS.medium,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  textArea: {
    minHeight: 92,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
  toggleHint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectChip: {
    backgroundColor: DW_SURFACES.mid,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectChipActive: {
    backgroundColor: `${DW_ACCENT}22`,
    borderColor: DW_ACCENT,
  },
  selectChipText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.secondary,
  },
  selectChipTextActive: {
    color: DW_ACCENT,
  },
  removableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DW_SURFACES.high,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  removableChipText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.primary,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: DW_SURFACES.high,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  addButtonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    color: DW_TEXT.primary,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonPrimary: {
    backgroundColor: DW_ACCENT,
    borderColor: DW_ACCENT,
  },
  buttonSecondary: {
    backgroundColor: DW_SURFACES.high,
    borderColor: DW_BORDER.default,
  },
  buttonDanger: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderColor: 'rgba(255, 107, 107, 0.32)',
  },
  buttonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    letterSpacing: 0.4,
  },
  buttonTextPrimary: {
    color: DW_ON_ACCENT,
    textTransform: 'uppercase',
  },
  buttonTextSecondary: {
    color: DW_TEXT.primary,
  },
  buttonTextDanger: {
    color: '#FF8B7A',
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: DW_SURFACES.low,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: DW_BORDER.strong,
  },
  sheetTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 20,
    color: DW_TEXT.primary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DW_SURFACES.mid,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontFamily: WK_FONTS.medium,
    fontSize: 15,
    color: DW_TEXT.primary,
    padding: 0,
  },
  sheetList: {
    flexGrow: 0,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomColor: DW_BORDER.subtle,
    borderBottomWidth: 1,
  },
  exerciseName: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  exerciseMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  sheetEmpty: {
    paddingVertical: 24,
    textAlign: 'center',
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.tertiary,
  },
});
