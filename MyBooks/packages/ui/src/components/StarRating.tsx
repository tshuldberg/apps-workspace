import React from 'react';
import { View, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Text as RNText } from 'react-native';
import { colors, spacing } from '../tokens';

interface Props {
  rating: number;
  onChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
  style?: ViewStyle;
}

function Star({
  fill,
  size,
}: {
  fill: 'full' | 'half' | 'empty';
  size: number;
}) {
  const fontSize = size;
  const textStyle: TextStyle = { fontSize, lineHeight: size + 2 };

  if (fill === 'full') {
    return (
      <RNText style={[textStyle, { color: colors.star }]}>{'\u2605'}</RNText>
    );
  }

  if (fill === 'empty') {
    return (
      <RNText style={[textStyle, { color: colors.starEmpty }]}>{'\u2605'}</RNText>
    );
  }

  // Half star: overlay a clipped full star on top of an empty star
  return (
    <View style={{ width: size, height: size + 2 }}>
      <RNText style={[textStyle, { color: colors.starEmpty, position: 'absolute' }]}>
        {'\u2605'}
      </RNText>
      <View style={{ width: size / 2, height: size + 2, overflow: 'hidden', position: 'absolute' }}>
        <RNText style={[textStyle, { color: colors.star }]}>{'\u2605'}</RNText>
      </View>
    </View>
  );
}

export function StarRating({
  rating,
  onChange,
  size = 24,
  readonly = false,
  style,
}: Props) {
  const handlePress = (starIndex: number, isLeftHalf: boolean) => {
    if (readonly || !onChange) return;
    const newRating = isLeftHalf ? starIndex + 0.5 : starIndex + 1;
    onChange(newRating);
  };

  const stars = [];
  for (let i = 0; i < 5; i++) {
    const fill: 'full' | 'half' | 'empty' =
      rating >= i + 1 ? 'full' : rating >= i + 0.5 ? 'half' : 'empty';

    if (readonly) {
      stars.push(
        <View key={i} style={styles.star}>
          <Star fill={fill} size={size} />
        </View>,
      );
    } else {
      stars.push(
        <View key={i} style={[styles.star, { flexDirection: 'row', width: size, height: size + 2 }]}>
          <Pressable
            onPress={() => handlePress(i, true)}
            style={{ width: size / 2, height: size + 2, overflow: 'hidden' }}
          >
            <Star fill={fill} size={size} />
          </Pressable>
          <Pressable
            onPress={() => handlePress(i, false)}
            style={{ width: size / 2, height: size + 2, overflow: 'hidden' }}
          >
            <View style={{ position: 'absolute', right: 0 }}>
              <Star fill={fill} size={size} />
            </View>
          </Pressable>
        </View>,
      );
    }
  }

  return <View style={[styles.container, style]}>{stars}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    marginRight: spacing.xs,
  },
});
