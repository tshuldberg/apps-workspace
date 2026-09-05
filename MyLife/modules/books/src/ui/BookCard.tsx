import { useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';
import { BOOKS_SURFACES, BOOKS_GHOST_BORDER } from './tokens';
import { JAKARTA_FONTS } from './typography';

export interface BookCardProps {
  title: string;
  author: string;
  coverUri?: string;
  coverSource?: ImageSourcePropType;
  rating?: number;
  statusLabel?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function BookCard({
  title,
  author,
  coverUri,
  coverSource,
  rating,
  statusLabel,
  onPress,
  style,
}: BookCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const bgColor = useRef(new Animated.Value(0)).current;

  // Both animations must use the same driver. Animated bgColor cannot run on
  // the native driver, so the spring also runs on JS to avoid mixing — mixing
  // triggers "Cannot read property 'default' of undefined" when ScrollView
  // fires rapid press cancellation. Same root cause as the SkeletonRow fix.
  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1.02,
        useNativeDriver: false,
      }),
      Animated.timing(bgColor, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: false,
      }),
      Animated.timing(bgColor, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const animatedBg = bgColor.interpolate({
    inputRange: [0, 1],
    outputRange: [BOOKS_SURFACES.lift, BOOKS_SURFACES.focus],
  });

  const imageSource = coverUri ? { uri: coverUri } : coverSource;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: animatedBg, transform: [{ scale }] },
          style,
        ]}
      >
        {imageSource && (
          <View style={styles.coverContainer}>
            <Image source={imageSource} style={styles.cover} resizeMode="cover" />
            <View style={styles.ghostBorder} />
          </View>
        )}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {author}
        </Text>
        {rating != null && rating > 0 ? (
          <Text style={styles.rating}>★ {rating.toFixed(1)}</Text>
        ) : statusLabel != null ? (
          <Text style={styles.statusLabel}>{statusLabel}</Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: BOOKS_SURFACES.lift,
  },
  coverContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
  },
  ghostBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BOOKS_GHOST_BORDER,
  },
  title: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#E4E1E9',
    marginTop: 24,
  },
  author: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
  },
  rating: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: '#C9894D',
    marginTop: 4,
  },
  statusLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#C9894D',
    textTransform: 'uppercase' as const,
    marginTop: 4,
  },
});
