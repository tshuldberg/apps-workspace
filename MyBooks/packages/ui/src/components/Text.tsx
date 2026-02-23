import React from 'react';
import { Text as RNText, StyleSheet, type TextStyle, type TextProps } from 'react-native';
import { typography, colors, type TypographyVariant } from '../tokens';

interface Props extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  children: React.ReactNode;
}

export function Text({ variant = 'body', color, style, children, ...rest }: Props) {
  return (
    <RNText
      style={[
        styles.base,
        typography[variant] as TextStyle,
        color ? { color } : null,
        style,
      ]}
      {...rest}
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
