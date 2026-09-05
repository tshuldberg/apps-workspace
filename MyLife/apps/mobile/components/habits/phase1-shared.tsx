import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  GlassCard,
  MaterialSymbol,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_AREAS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  withAlpha,
} from '@mylife/habits';

export type HabitsAreaPreset = {
  key: string;
  name: string;
  color: string;
  icon: string;
};

export const HABITS_AREA_PRESETS: HabitsAreaPreset[] = [
  { key: 'health', name: 'Health', color: HB_AREAS.health, icon: 'favorite' },
  { key: 'mind', name: 'Mind', color: HB_AREAS.mind, icon: 'psychology' },
  { key: 'body', name: 'Body', color: HB_AREAS.body, icon: 'fitness_center' },
  { key: 'money', name: 'Money', color: HB_AREAS.money, icon: 'attach_money' },
  { key: 'social', name: 'Social', color: HB_AREAS.social, icon: 'groups' },
  { key: 'spiritual', name: 'Spiritual', color: HB_AREAS.spiritual, icon: 'eco' },
  { key: 'learning', name: 'Learning', color: HB_AREAS.learning, icon: 'school' },
  { key: 'other', name: 'Other', color: HB_AREAS.other, icon: 'more_horiz' },
];

export function normalizeAreaName(name: string | null | undefined) {
  return (name ?? '').trim().toLowerCase();
}

export function resolveAreaPreset(name: string | null | undefined) {
  const normalized = normalizeAreaName(name);
  return HABITS_AREA_PRESETS.find((preset) => normalizeAreaName(preset.name) === normalized) ?? null;
}

export function resolveAreaColor(name: string | null | undefined, fallback?: string | null) {
  return fallback ?? resolveAreaPreset(name)?.color ?? HB_AREAS.other;
}

export function resolveAreaIcon(name: string | null | undefined, fallback?: string | null) {
  return fallback ?? resolveAreaPreset(name)?.icon ?? 'category';
}

export function HeaderIconButton({
  icon,
  onPress,
  label,
}: {
  icon: string;
  onPress?: () => void;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.headerIconButton}
    >
      <MaterialSymbol
        name={icon}
        size={18}
        color={HB_TEXT_SECONDARY}
      />
    </Pressable>
  );
}

export function FilterChip({
  label,
  selected = false,
  onPress,
  color = HB_ACCENT_LIGHT,
  icon,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? withAlpha(color, 0.2) : HB_SURFACES.low,
        },
        style,
      ]}
    >
      {icon ? (
        <MaterialSymbol
          name={icon}
          size={14}
          color={selected ? HB_TEXT : color}
          filled={selected}
        />
      ) : null}
      <Text
        style={[
          styles.filterChipLabel,
          {
            color: selected ? HB_TEXT : HB_TEXT_SECONDARY,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <GlassCard level={2} contentStyle={styles.searchFieldContent}>
      <MaterialSymbol
        name="search"
        size={18}
        color={HB_TEXT_TERTIARY}
      />
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={HB_TEXT_TERTIARY}
        style={styles.searchFieldInput}
        value={value}
      />
    </GlassCard>
  );
}

export function FeatureTile({
  icon,
  label,
  description,
  color = HB_ACCENT,
  onPress,
}: {
  icon: string;
  label: string;
  description?: string;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.featureTileWrap}>
      <GlassCard level={2} contentStyle={styles.featureTile}>
        <View style={[styles.featureIconWrap, { backgroundColor: withAlpha(color, 0.18) }]}>
          <MaterialSymbol
            name={icon}
            size={20}
            color={color}
            filled
          />
        </View>
        <Text numberOfLines={2} style={styles.featureLabel}>
          {label}
        </Text>
        {description ? (
          <Text numberOfLines={2} style={styles.featureDescription}>
            {description}
          </Text>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

export function ExpandablePanel({
  title,
  caption,
  open,
  onToggle,
  accent = HB_ACCENT_LIGHT,
  children,
}: {
  title: string;
  caption?: string;
  open: boolean;
  onToggle: () => void;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <GlassCard level={2} contentStyle={styles.panel}>
      <Pressable onPress={onToggle} style={styles.panelHeader}>
        <View style={styles.panelCopy}>
          <Text style={[styles.panelTitle, { color: HB_TEXT }]}>
            {title}
          </Text>
          {caption ? (
            <Text style={styles.panelCaption}>
              {caption}
            </Text>
          ) : null}
        </View>
        <View style={[styles.panelChevron, { backgroundColor: withAlpha(accent, 0.18) }]}>
          <MaterialSymbol
            name={open ? 'expand_less' : 'expand_more'}
            size={18}
            color={accent}
          />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.panelBody}>
          {children}
        </View>
      ) : null}
    </GlassCard>
  );
}

export function EmptyGlassState({
  title,
  message,
  actionLabel,
  onPress,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <GlassCard level={1} contentStyle={styles.emptyState}>
      <MaterialSymbol
        name="bolt"
        size={20}
        color={HB_ACCENT_LIGHT}
      />
      <Text style={styles.emptyTitle}>
        {title}
      </Text>
      <Text style={styles.emptyMessage}>
        {message}
      </Text>
      {actionLabel && onPress ? (
        <FilterChip
          label={actionLabel}
          onPress={onPress}
          selected
        />
      ) : null}
    </GlassCard>
  );
}

export function AreaSwatchPicker({
  value,
  onSelect,
}: {
  value: string | null | undefined;
  onSelect: (next: string) => void;
}) {
  return (
    <View style={styles.swatchRow}>
      {HABITS_AREA_PRESETS.map((preset) => {
        const selected = preset.color === value;
        return (
          <Pressable
            key={preset.key}
            onPress={() => onSelect(preset.color)}
            style={[
              styles.swatch,
              {
                backgroundColor: preset.color,
                shadowOpacity: selected ? 0.45 : 0.18,
                transform: [{ scale: selected ? 1.04 : 1 }],
              },
            ]}
          >
            {selected ? (
              <MaterialSymbol
                name="check"
                size={14}
                color={HB_TEXT}
                filled
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_TEXT, 0.06),
  },
  filterChip: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  filterChipLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    lineHeight: 16,
  },
  searchFieldContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  searchFieldInput: {
    flex: 1,
    color: HB_TEXT,
    ...HB_TYPOGRAPHY.bodyMd,
    paddingVertical: 0,
  },
  featureTileWrap: {
    width: '100%',
  },
  featureTile: {
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 118,
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: HB_TYPOGRAPHY.headlineMd.fontFamily,
  },
  featureDescription: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 11,
    lineHeight: 15,
  },
  panel: {
    gap: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelCopy: {
    flex: 1,
    gap: 4,
  },
  panelTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    lineHeight: 22,
  },
  panelCaption: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 17,
  },
  panelChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelBody: {
    gap: 12,
  },
  emptyState: {
    alignItems: 'flex-start',
    gap: 8,
  },
  emptyTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 18,
    lineHeight: 22,
  },
  emptyMessage: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
