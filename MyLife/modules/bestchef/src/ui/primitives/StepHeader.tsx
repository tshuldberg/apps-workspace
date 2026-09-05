import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemeColors } from '@mylife/ui';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';

export interface StepHeaderProps {
  icon?: ReactNode;
  /** Tinted backdrop for the icon circle. Default hero terracotta. */
  tint?: string;
  /** Already-translated step title. */
  title: string;
  /** Already-translated step subtitle. */
  subtitle?: string;
  /** Show a tiny REQUIRED pill on the right side. */
  required?: boolean;
  /** Already-translated text shown inside the pill (default "REQUIRED"). */
  requiredLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * are-blaze SubmitSteps StepHeader: tinted circle icon + title + subtitle +
 * optional REQUIRED pill. Used at the top of each submission wizard step.
 */
export function StepHeader({
  icon,
  tint,
  title,
  subtitle,
  required,
  requiredLabel = 'REQUIRED',
  style,
}: StepHeaderProps) {
  const colors = useThemeColors();
  const fontFamily = getRoundedFontFamily();
  const tintColor = tint ?? '#F26A3A';
  return (
    <View style={[styles.container, style]}>
      {icon != null && (
        <View style={[styles.iconWrap, { backgroundColor: tintColor + '22' }]}>
          {icon}
        </View>
      )}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text, fontFamily }]}>{title}</Text>
        {subtitle != null && (
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {required === true && (
        <View style={[styles.requiredPill, { backgroundColor: tintColor + '22' }]}>
          <Text style={[styles.requiredText, { color: tintColor, fontFamily }]}>
            {requiredLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.fontSize,
    fontWeight: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.fontWeight,
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcHeadline.letterSpacing,
  },
  subtitle: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    fontWeight: '500',
  },
  requiredPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  requiredText: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.fontSize,
    fontWeight: '700',
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.letterSpacing,
  },
});
