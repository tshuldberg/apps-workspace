import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  calculatePetAgeYears,
  type Pet,
  type PetSpecies,
} from '@mylife/pets';
import { Card, Text, colors, spacing, surfaceTiers } from '@mylife/ui';

export const PETS_ACCENT = colors.modules.pets;

const SPECIES_META: Record<PetSpecies, { icon: string; label: string }> = {
  dog: { icon: '🐶', label: 'Dog' },
  cat: { icon: '🐱', label: 'Cat' },
  bird: { icon: '🐦', label: 'Bird' },
  fish: { icon: '🐠', label: 'Fish' },
  reptile: { icon: '🦎', label: 'Reptile' },
  rabbit: { icon: '🐰', label: 'Rabbit' },
  small_mammal: { icon: '🐹', label: 'Small Mammal' },
  horse: { icon: '🐴', label: 'Horse' },
  other: { icon: '🐾', label: 'Other' },
};

export function getPetSpeciesMeta(species: PetSpecies) {
  return SPECIES_META[species];
}

export function formatPetSpecies(species: PetSpecies) {
  return getPetSpeciesMeta(species).label;
}

export function formatPetAge(birthDate: string | null | undefined) {
  const years = calculatePetAgeYears(birthDate ?? null);
  return years ? `${years} yr` : 'Age unknown';
}

export function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return 'Not set';
  }

  return value.length >= 10 ? value.slice(0, 10) : value;
}

export function formatCurrencyCents(value: number | null | undefined) {
  return `$${(((value ?? 0) as number) / 100).toFixed(0)}`;
}

export function formatWeightGrams(
  grams: number | null | undefined,
  unit: 'lbs' | 'kg' = 'lbs',
) {
  if (!grams) {
    return '--';
  }

  if (unit === 'kg') {
    return `${(grams / 1000).toFixed(1)} kg`;
  }

  return `${(grams / 453.592).toFixed(1)} lb`;
}

export function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text variant="label" color={colors.background}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text variant="label" color={colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

export function MetricTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
    </View>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text variant="subheading">{title}</Text>
          {subtitle ? (
            <Text variant="caption" color={colors.textSecondary}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </Card>
  );
}

export function DetailLine({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.detailLine}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="body" color={valueColor ?? colors.text}>
        {value}
      </Text>
    </View>
  );
}

export function StatusPill({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const toneStyle =
    tone === 'success'
      ? styles.successPill
      : tone === 'warning'
        ? styles.warningPill
        : tone === 'danger'
          ? styles.dangerPill
          : styles.defaultPill;

  return (
    <View style={[styles.statusPill, toneStyle]}>
      <Text
        variant="caption"
        color={tone === 'default' ? colors.textSecondary : colors.text}
      >
        {label}
      </Text>
    </View>
  );
}

export function EmptyPanel({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.emptyPanel}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text variant="subheading">{title}</Text>
      <Text
        variant="caption"
        color={colors.textSecondary}
        style={styles.emptyBody}
      >
        {body}
      </Text>
    </View>
  );
}

export function PetSelector({
  pets,
  selectedPetId,
  onSelect,
}: {
  pets: Pet[];
  selectedPetId: string | null;
  onSelect: (petId: string) => void;
}) {
  return (
    <View style={styles.selectorRow}>
      {pets.map((pet) => {
        const active = pet.id === selectedPetId;
        return (
          <Pressable
            key={pet.id}
            onPress={() => onSelect(pet.id)}
            style={[styles.selectorChip, active ? styles.selectorChipActive : null]}
          >
            <Text variant="caption" color={active ? colors.background : colors.textSecondary}>
              {getPetSpeciesMeta(pet.species).icon} {pet.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <TextInput
      style={[styles.field, multiline ? styles.fieldMultiline : null]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      multiline={multiline}
      keyboardType={keyboardType}
    />
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  heroCard: {
    backgroundColor: surfaceTiers.low,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    gap: spacing.md,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  heroBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.30)',
  },
  heroBadgeText: {
    fontSize: 28,
  },
  heroTitleRow: {
    gap: spacing.xs,
    flex: 1,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricTile: {
    flexGrow: 1,
    minWidth: 102,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.xs,
  },
  metricIcon: {
    fontSize: 18,
  },
  metricValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: PETS_ACCENT,
  },
  sectionCard: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  primaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    backgroundColor: PETS_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectorChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  selectorChipActive: {
    backgroundColor: PETS_ACCENT,
    borderColor: PETS_ACCENT,
  },
  detailLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
  },
  defaultPill: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  successPill: {
    backgroundColor: 'rgba(48,209,88,0.16)',
  },
  warningPill: {
    backgroundColor: 'rgba(255,159,10,0.16)',
  },
  dangerPill: {
    backgroundColor: 'rgba(255,69,58,0.16)',
  },
  emptyPanel: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 18,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  emptyIcon: {
    fontSize: 34,
    lineHeight: 40,
  },
  emptyBody: {
    textAlign: 'center',
  },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fieldMultiline: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  gridTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridCell: {
    flexGrow: 1,
    minWidth: 140,
  },
  stackedList: {
    gap: spacing.sm,
  },
  glassItem: {
    borderRadius: 16,
    padding: spacing.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.xs,
  },
});
