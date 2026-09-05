import React from 'react';
import { View, TextInput, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors } from '../tokens/colors';
import { spacing, borderRadius } from '../tokens/spacing';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onScanPress?: () => void;
  style?: ViewStyle;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search by title, author, or ISBN',
  onScanPress,
  style,
}: Props) {
  return (
    <View style={[styles.container, style]}>
      <Text variant="caption" color={colors.textTertiary} style={styles.searchIcon}>
        {'\u2315'}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {onScanPress ? (
        <Pressable onPress={onScanPress} hitSlop={8} style={styles.scanButton}>
          <Text variant="caption" color={colors.accent}>
            {'\u2750'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.sm,
    fontSize: 18,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: 'Inter',
    fontSize: 16,
    paddingVertical: 0,
  },
  scanButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
});
