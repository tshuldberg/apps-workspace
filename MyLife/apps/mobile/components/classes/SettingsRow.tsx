import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';

const CLASSES_ACCENT = colors.modules.classes;

export interface SettingsRowToggleProps {
  variant: 'toggle';
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

export interface SettingsRowSegmentedProps<T extends string | number> {
  variant: 'segmented';
  label: string;
  description?: string;
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange: (next: T) => void;
}

export interface SettingsRowStepperProps {
  variant: 'stepper';
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (next: number) => void;
}

export interface SettingsRowChipsProps<T extends string | number> {
  variant: 'chips';
  label: string;
  description?: string;
  options: ReadonlyArray<{ label: string; value: T }>;
  values: T[];
  onChange: (next: T[]) => void;
}

export interface SettingsRowChildProps {
  variant: 'child';
  label: string;
  description?: string;
  children: ReactNode;
}

export type SettingsRowProps<T extends string | number = string> =
  | SettingsRowToggleProps
  | SettingsRowSegmentedProps<T>
  | SettingsRowStepperProps
  | SettingsRowChipsProps<T>
  | SettingsRowChildProps;

export function SettingsRow<T extends string | number = string>(
  props: SettingsRowProps<T>,
) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text variant="body" style={styles.label}>
          {props.label}
        </Text>
        {props.description ? (
          <Text variant="caption" color={colors.textSecondary} style={styles.description}>
            {props.description}
          </Text>
        ) : null}
      </View>
      <View style={styles.control}>{renderControl(props)}</View>
    </View>
  );
}

function renderControl<T extends string | number>(props: SettingsRowProps<T>) {
  switch (props.variant) {
    case 'toggle':
      return (
        <Switch
          value={props.value}
          onValueChange={props.onChange}
          trackColor={{ false: colors.surfaceElevated, true: CLASSES_ACCENT }}
          thumbColor="#FFFFFF"
        />
      );
    case 'segmented':
      return (
        <View style={styles.segmentRow}>
          {props.options.map((option) => {
            const active = option.value === props.value;
            return (
              <Pressable
                key={String(option.value)}
                onPress={() => props.onChange(option.value)}
                style={[styles.segmentButton, active ? styles.segmentButtonActive : null]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  variant="label"
                  color={active ? colors.background : colors.textSecondary}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    case 'stepper':
      return (
        <View style={styles.stepperRow}>
          <Pressable
            onPress={() => props.onChange(Math.max(props.min, props.value - props.step))}
            style={styles.stepperButton}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${props.label}`}
          >
            <Text variant="label" color={colors.text}>
              −
            </Text>
          </Pressable>
          <View style={styles.stepperValue}>
            <Text variant="body" style={styles.stepperValueText}>
              {props.value}
              {props.unit ? ` ${props.unit}` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => props.onChange(Math.min(props.max, props.value + props.step))}
            style={styles.stepperButton}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${props.label}`}
          >
            <Text variant="label" color={colors.text}>
              +
            </Text>
          </Pressable>
        </View>
      );
    case 'chips':
      return (
        <View style={styles.chipRow}>
          {props.options.map((option) => {
            const active = props.values.includes(option.value);
            return (
              <Pressable
                key={String(option.value)}
                onPress={() => {
                  const exists = props.values.includes(option.value);
                  const next = exists
                    ? props.values.filter((item) => item !== option.value)
                    : [...props.values, option.value];
                  props.onChange(next);
                }}
                style={[styles.chip, active ? styles.chipActive : null]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  variant="label"
                  color={active ? colors.background : colors.textSecondary}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    case 'child':
      return <>{props.children}</>;
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 4,
    paddingRight: spacing.sm,
  },
  label: {
    fontWeight: '600',
  },
  description: {
    lineHeight: 18,
  },
  control: {
    flexShrink: 0,
    alignItems: 'flex-end',
    maxWidth: '60%',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-end',
  },
  segmentButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  segmentButtonActive: {
    backgroundColor: CLASSES_ACCENT,
    borderColor: CLASSES_ACCENT,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepperButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  stepperValue: {
    minWidth: 76,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  stepperValueText: {
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-end',
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: CLASSES_ACCENT,
    borderColor: CLASSES_ACCENT,
  },
});
