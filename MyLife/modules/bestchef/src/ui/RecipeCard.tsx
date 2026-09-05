import { useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@mylife/ui';
import {
  RECIPES_ACCENT,
  RECIPES_GLASS,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from './tokens';

interface RecipeCardProps {
  title: string;
  subtitle?: string;
  imageUri?: string;
  videoUri?: string;
  mediaLabel?: string;
  cookTime?: string;
  difficulty?: string;
  onPress?: () => void;
}

export function RecipeCard({
  title,
  subtitle,
  imageUri,
  videoUri,
  mediaLabel,
  cookTime,
  difficulty,
  onPress,
}: RecipeCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const titleColor = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1.05,
        useNativeDriver: false,
        speed: 40,
        bounciness: 4,
      }),
      Animated.timing(titleColor, {
        toValue: 1,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: false,
        speed: 40,
        bounciness: 4,
      }),
      Animated.timing(titleColor, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const animatedTitleColor = titleColor.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.text, RECIPES_ACCENT],
  });

  const Content = (
    <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
      <View style={styles.photoWrap}>
        {imageUri != null ? (
          <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={styles.placeholderTitle}>{mediaLabel ?? 'Recipe media'}</Text>
            {videoUri != null ? <Text style={styles.placeholderMeta}>Video ready</Text> : null}
          </View>
        )}
        {videoUri != null && (
          <View style={styles.videoBadge}>
            <Text style={styles.badgeText}>Video</Text>
          </View>
        )}
        {cookTime != null && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{cookTime}</Text>
          </View>
        )}
        {difficulty != null && (
          <View style={[styles.badge, styles.badgeLeft]}>
            <Text style={styles.badgeText}>{difficulty}</Text>
          </View>
        )}
      </View>
      <Animated.Text numberOfLines={2} style={[styles.title, { color: animatedTitleColor }]}>
        {title}
      </Animated.Text>
      {subtitle != null && (
        <Text numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </Text>
      )}
    </Animated.View>
  );

  if (onPress == null) return Content;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Open recipe ${title}`}
    >
      {Content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 180,
    gap: 8,
  },
  photoWrap: {
    position: 'relative',
    aspectRatio: 4 / 5,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: RECIPES_SURFACES.lift,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RECIPES_SURFACES.focus,
    padding: 12,
    gap: 4,
  },
  placeholderTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
    textAlign: 'center',
  },
  placeholderMeta: {
    ...RECIPES_TYPOGRAPHY.bodyMd,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: RECIPES_GLASS.backgroundColor,
  },
  badgeLeft: {
    top: 10,
    left: 10,
    right: undefined,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  badgeText: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0,
    color: colors.text,
  },
  title: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    fontSize: 16,
  },
  subtitle: {
    ...RECIPES_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 1.6 * 13,
    color: colors.textSecondary,
  },
});
