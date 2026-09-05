import { useEffect, useState, type ReactNode, type ReactElement } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  GlassCard,
  MaterialSymbol,
  NU_ACCENT,
  NU_ACCENT_DARK,
  NU_ACCENT_LIGHT,
  NU_FONT_BOLD,
  NU_FONT_MEDIUM,
  NU_FONT_REGULAR,
  NU_FONT_SEMIBOLD,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
} from '@mylife/nutrition';

export function NutritionScrollScreen({
  children,
  refreshControl,
  contentStyle,
}: {
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, contentStyle]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
}

export function NutritionHeaderBar({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <View style={styles.headerBar}>
      <NutritionIconButton icon="arrow_back" label="Back" onPress={onBack} />
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerAction}>{action}</View>
    </View>
  );
}

export function NutritionHero({
  eyebrow,
  title,
  subtitle,
  icon,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon?: string;
  action?: ReactNode;
}) {
  return (
    <GlassCard style={styles.heroCard}>
      <View style={styles.heroGlow} />
      <View style={styles.heroHeader}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>{eyebrow}</Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
        </View>
        {action ?? (
          icon != null ? (
            <View style={styles.heroIconWrap}>
              <LinearGradient
                colors={[NU_ACCENT_LIGHT, NU_ACCENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroIconTile}
              >
                <MaterialSymbol name={icon} size={24} color={NU_ACCENT_DARK} filled />
              </LinearGradient>
            </View>
          ) : null
        )}
      </View>
    </GlassCard>
  );
}

export function NutritionSectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function NutritionSearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchField}>
      <MaterialSymbol name="search" size={18} color={NU_TEXT_TERTIARY} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={NU_TEXT_TERTIARY}
        style={styles.searchInput}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

export function NutritionChip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.chip, selected ? styles.chipSelected : null]}>
      <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>{label}</Text>
    </View>
  );

  if (onPress == null) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function NutritionIconButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.iconButton}>
      <MaterialSymbol name={icon} size={18} color={NU_TEXT} />
      <Text style={styles.iconButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export function NutritionPrimaryButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const content = (
    <LinearGradient
      colors={disabled ? ['#5E513F', '#5E513F'] : [NU_ACCENT_LIGHT, NU_ACCENT]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.primaryButton}
    >
      {icon != null ? <MaterialSymbol name={icon} size={16} color={NU_ACCENT_DARK} filled /> : null}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </LinearGradient>
  );

  if (disabled) {
    return <View style={styles.disabledWrap}>{content}</View>;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function NutritionSecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function NutritionFieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

export function NutritionInput(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={NU_TEXT_TERTIARY}
      style={[styles.input, props.multiline ? styles.inputMultiline : null, props.style]}
    />
  );
}

export function NutritionEmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <GlassCard style={styles.emptyCard}>
      <View style={styles.emptyIconTile}>
        <MaterialSymbol name={icon} size={22} color={NU_ACCENT_LIGHT} filled />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action}
    </GlassCard>
  );
}

export function NutritionBottomSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetKeyboardAvoid}
        >
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable onPress={onClose} style={styles.sheetClose}>
                <MaterialSymbol name="close" size={18} color={NU_TEXT_SECONDARY} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: NU_SURFACES.lowest,
  },
  screen: {
    flex: 1,
    backgroundColor: NU_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 18,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    gap: 12,
  },
  headerTitle: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
    flex: 1,
    textAlign: 'center',
  },
  headerAction: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
  heroCard: {
    overflow: 'hidden',
    padding: 22,
    gap: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  heroGlow: {
    position: 'absolute',
    top: -80,
    right: -32,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 184, 119, 0.16)',
  },
  heroHeader: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroEyebrow: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_ACCENT_LIGHT,
  },
  heroTitle: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.2,
    color: NU_TEXT,
  },
  heroSubtitle: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  heroIconWrap: {
    paddingTop: 4,
  },
  heroIconTile: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  searchField: {
    minHeight: 56,
    borderRadius: 999,
    paddingHorizontal: 18,
    backgroundColor: NU_SURFACES.highest,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: NU_TEXT,
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 15,
    paddingVertical: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: NU_SURFACES.mid,
  },
  chipSelected: {
    backgroundColor: NU_ACCENT,
  },
  chipLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_TEXT_SECONDARY,
  },
  chipLabelSelected: {
    color: NU_ACCENT_DARK,
  },
  iconButton: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: NU_SURFACES.mid,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButtonLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_TEXT,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 14,
    color: NU_ACCENT_DARK,
  },
  disabledWrap: {
    opacity: 0.55,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.mid,
  },
  secondaryButtonText: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 14,
    color: NU_TEXT_SECONDARY,
  },
  fieldLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_SECONDARY,
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: NU_SURFACES.mid,
    color: NU_TEXT,
    fontFamily: NU_FONT_REGULAR,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 132,
    textAlignVertical: 'top',
  },
  emptyCard: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyIconTile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
  },
  emptyTitle: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  emptyBody: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
    textAlign: 'center',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheetKeyboardAvoid: {
    width: '100%',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: NU_SURFACES.base,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 26 : 20,
  },
  sheetHandle: {
    width: 56,
    height: 5,
    borderRadius: 999,
    backgroundColor: NU_SURFACES.highest,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  sheetTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
    flex: 1,
  },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.mid,
  },
  sheetContent: {
    gap: 16,
    paddingBottom: 12,
  },
});
