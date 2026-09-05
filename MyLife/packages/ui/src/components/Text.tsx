import React from 'react';
import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors } from '../tokens/colors';
import { typography, type TypographyVariant } from '../tokens/typography';

interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  children: React.ReactNode;
}

/**
 * Dynamic Type is supported but clamped: unbounded font scaling over the
 * suite's fixed-height rows and numberOfLines={1} clusters truncates instead
 * of reflowing. 1.4x keeps large-text users readable while layouts survive;
 * screens that reflow properly can raise it per-instance.
 */
const DEFAULT_MAX_FONT_SIZE_MULTIPLIER = 1.4;

export function Text({
  variant = 'body',
  color,
  style,
  maxFontSizeMultiplier = DEFAULT_MAX_FONT_SIZE_MULTIPLIER,
  children,
  ...props
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        styles.base,
        typography[variant],
        color ? { color } : undefined,
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
  },
});
