import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemeColors } from '@mylife/ui';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';

export interface CountIndicatorProps {
  count: number;
  target: number;
  /** Already-translated unit string, e.g. "photos" or "videos". */
  unit: string;
  /** When true, render in success tint when count >= target. */
  successTint?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * are-blaze CountIndicator from SubmitSteps. Renders "N of M unit" copy with
 * a success tint when the target is satisfied. The unit string must already
 * be translated and pluralized by the caller (use tp(count, ...)).
 */
export function CountIndicator({ count, target, unit, successTint = true, style }: CountIndicatorProps) {
  const colors = useThemeColors();
  const fontFamily = getRoundedFontFamily();
  const isSatisfied = count >= target;
  const color = successTint && isSatisfied ? '#33A672' : colors.textSecondary;
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.text, { color, fontFamily }]}>
        {count} of {target} {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  text: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcCaption.fontSize,
    fontWeight: '600',
  },
});
