import React from 'react';
import { View, Image, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, borderRadius, shadows, coverSizes, type CoverSize } from '../tokens';

interface Props {
  coverUrl?: string | null;
  size?: CoverSize;
  title?: string;
  style?: ViewStyle;
}

export function BookCover({ coverUrl, size = 'medium', title, style }: Props) {
  const dimensions = coverSizes[size];

  if (coverUrl) {
    return (
      <View style={[styles.container, dimensions, shadows.cover, style]}>
        <Image
          source={{ uri: coverUrl }}
          style={[styles.image, dimensions]}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.placeholder, dimensions, shadows.cover, style]}>
      {title ? (
        <Text
          variant="caption"
          color={colors.textSecondary}
          numberOfLines={3}
          style={styles.placeholderText}
        >
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.cover,
    overflow: 'hidden',
  },
  image: {
    borderRadius: borderRadius.cover,
  },
  placeholder: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  placeholderText: {
    textAlign: 'center',
  },
});
