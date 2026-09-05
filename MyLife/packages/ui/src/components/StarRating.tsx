import React from 'react';
import { View, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Text as RNText } from 'react-native';
import { spacing } from '../tokens/spacing';

// Books-domain star colors (not in shared tokens)
const STAR_COLOR = '#E8B84B';
const STAR_EMPTY_COLOR = '#2A2A34';

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
  const textStyle: TextStyle = { fontSize, lineHeight: size + 2, textAlign: 'center' };
  const charWidth = size;

  if (fill === 'full') {
    return (
      <View style={{ width: charWidth, height: size + 2, alignItems: 'center' }}>
        <RNText style={[textStyle, { color: STAR_COLOR }]}>{'\u2605'}</RNText>
      </View>
    );
  }

  if (fill === 'empty') {
    return (
      <View style={{ width: charWidth, height: size + 2, alignItems: 'center' }}>
        <RNText style={[textStyle, { color: STAR_EMPTY_COLOR }]}>{'\u2605'}</RNText>
      </View>
    );
  }

  // Half star: left half filled, right half empty
  return (
    <View style={{ width: charWidth, height: size + 2, flexDirection: 'row' }}>
      <View style={{ width: charWidth / 2, height: size + 2, overflow: 'hidden' }}>
        <RNText style={[textStyle, { color: STAR_COLOR, width: charWidth }]}>{'\u2605'}</RNText>
      </View>
      <View style={{ width: charWidth / 2, height: size + 2, overflow: 'hidden' }}>
        <RNText style={[textStyle, { color: STAR_EMPTY_COLOR, width: charWidth, marginLeft: -(charWidth / 2) }]}>{'\u2605'}</RNText>
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
            style={{ width: size / 2, height: size + 2 }}
          >
            <View style={{ width: size, height: size + 2, overflow: 'hidden' }}>
              <Star fill={fill} size={size} />
            </View>
          </Pressable>
          <Pressable
            onPress={() => handlePress(i, false)}
            style={{ width: size / 2, height: size + 2, overflow: 'hidden' }}
          >
            <View style={{ width: size, height: size + 2, marginLeft: -(size / 2) }}>
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
