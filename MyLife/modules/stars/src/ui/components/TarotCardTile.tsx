import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { TarotCard } from '../../types';
import {
  ST_ACCENT,
  ST_ACCENT_DEEP,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  withAlpha,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface TarotCardTileProps {
  card: TarotCard;
  reversed?: boolean;
  onPress?: () => void;
  faceDown?: boolean;
  size?: 'regular' | 'compact' | 'hero';
  style?: StyleProp<ViewStyle>;
}

export function TarotCardTile({
  card,
  reversed = false,
  onPress,
  faceDown = false,
  size = 'regular',
  style,
}: TarotCardTileProps) {
  const metrics = TILE_METRICS[size];

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <LinearGradient
        colors={
          faceDown
            ? [ST_ACCENT_DEEP, ST_SURFACES.high]
            : [withAlpha(ST_ACCENT_LIGHT, 0.32), ST_SURFACES.low]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.card,
          {
            width: metrics.width,
            minHeight: metrics.minHeight,
            padding: metrics.padding,
          },
          style,
        ]}
      >
        {faceDown ? (
          <View style={styles.faceDown}>
            <MaterialSymbol
              name="moon_stars"
              size={metrics.faceDownIcon}
              color={ST_ACCENT_LIGHT}
              filled
            />
            <Text style={[styles.faceDownLabel, { fontSize: metrics.faceDownLabel }]}>
              Draw From The Deck
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.imageShell,
                { minHeight: metrics.imageHeight, borderRadius: metrics.imageRadius },
              ]}
            >
              <MaterialSymbol
                name="star"
                size={metrics.imageIcon}
                color={ST_ACCENT_LIGHT}
                filled
              />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { fontSize: metrics.titleSize }]}>{card.name}</Text>
              <Text style={styles.meta}>
                {card.suit ? `${card.suit} · ${card.number}` : `Major Arcana · ${card.number}`}
              </Text>
            </View>
            <View
              style={[
                styles.orientationBadge,
                reversed ? styles.orientationBadgeReversed : null,
              ]}
            >
              <MaterialSymbol
                name="north"
                size={14}
                color={reversed ? ST_TEXT : '#2E1600'}
                style={reversed ? styles.reversedArrow : undefined}
                filled
              />
              <Text
                style={[
                  styles.orientationText,
                  reversed ? styles.orientationTextReversed : null,
                ]}
              >
                {reversed ? 'Reversed' : 'Upright'}
              </Text>
            </View>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  imageShell: {
    flex: 1,
    backgroundColor: withAlpha(ST_SURFACES.highest, 0.8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    marginTop: 14,
    gap: 4,
  },
  title: {
    fontFamily: ST_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: ST_TEXT,
  },
  meta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  orientationBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: ST_ACCENT_LIGHT,
  },
  orientationBadgeReversed: {
    backgroundColor: withAlpha(ST_ACCENT, 0.22),
  },
  orientationText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    color: '#2E1600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  orientationTextReversed: {
    color: ST_TEXT,
  },
  reversedArrow: {
    transform: [{ rotate: '180deg' }],
  },
  faceDown: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  faceDownLabel: {
    fontFamily: ST_FONTS.bold,
    color: ST_TEXT,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});

const TILE_METRICS = {
  regular: {
    width: 220,
    minHeight: 320,
    padding: 16,
    imageHeight: 210,
    imageRadius: 20,
    imageIcon: 28,
    titleSize: 22,
    faceDownIcon: 36,
    faceDownLabel: 14,
  },
  compact: {
    width: 152,
    minHeight: 224,
    padding: 12,
    imageHeight: 132,
    imageRadius: 18,
    imageIcon: 22,
    titleSize: 16,
    faceDownIcon: 28,
    faceDownLabel: 11,
  },
  hero: {
    width: 236,
    minHeight: 348,
    padding: 18,
    imageHeight: 232,
    imageRadius: 22,
    imageIcon: 30,
    titleSize: 24,
    faceDownIcon: 40,
    faceDownLabel: 15,
  },
} as const;
