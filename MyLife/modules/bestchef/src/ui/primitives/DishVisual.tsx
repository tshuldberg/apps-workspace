import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getDishVisuals } from '../../cloud/dish-visuals';

export interface DishVisualSource {
  name: string;
  cuisine?: string | null;
  gradientFrom?: string | null;
  gradientTo?: string | null;
  emoji?: string | null;
  photoUrl?: string | null;
  /** Native-script and localized names improve emoji matching (Phase 2.6). */
  nativeName?: string | null;
  localizedName?: string | null;
}

export interface DishVisualProps {
  dish: DishVisualSource;
  size: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders the brand-strong fallback visual for a dish: oversized rotated emoji
 * over a per-cuisine gradient. When `dish.photoUrl` is set, the photo is
 * layered above the gradient so the gradient acts as a letterbox while the
 * image loads or when it has transparent regions.
 *
 * Falls back to per-cuisine gradient and emoji derived via `getDishVisuals`
 * when the dish row is missing the cached values (older rows pre-migration).
 */
export function DishVisual({ dish, size, radius, style }: DishVisualProps) {
  const fallback =
    !dish.gradientFrom || !dish.gradientTo || !dish.emoji
      ? getDishVisuals(dish.name, dish.cuisine ?? undefined, [
          dish.nativeName,
          dish.localizedName,
        ])
      : null;

  const gradientFrom = dish.gradientFrom ?? fallback?.from ?? '#D9742F';
  const gradientTo = dish.gradientTo ?? fallback?.to ?? '#8C401E';
  const emoji = dish.emoji ?? fallback?.emoji ?? '\u{1F37D}\u{FE0F}';
  const cornerRadius = radius ?? 20;
  const emojiSize = size * 0.6;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: cornerRadius,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[gradientFrom, gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          fontSize: emojiSize,
          transform: [
            { rotate: '-8deg' },
            { translateX: 40 },
            { translateY: -10 },
          ],
        }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {emoji}
      </Text>
      {dish.photoUrl ? (
        <Image
          source={{ uri: dish.photoUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}
