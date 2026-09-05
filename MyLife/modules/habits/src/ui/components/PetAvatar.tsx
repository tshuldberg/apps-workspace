import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { HB_ACCENT_LIGHT, HB_STREAK, HB_SURFACES, HB_TEXT, HB_TEXT_SECONDARY, HB_TYPOGRAPHY, HB_XP, withAlpha } from '../tokens';

export type PetAvatarPet = {
  name: string;
  species?: 'fox' | 'cat' | 'dog' | 'owl' | 'penguin' | string;
  level?: number;
};

export type PetAvatarStats = {
  hunger: number;
  happiness: number;
  energy: number;
};

export interface PetAvatarProps {
  pet: PetAvatarPet;
  stats: PetAvatarStats;
  size?: number;
  animate?: boolean;
}

const PET_EMOJI: Record<string, string> = {
  fox: '🦊',
  cat: '🐈',
  dog: '🐕',
  owl: '🦉',
  penguin: '🐧',
};

function clampProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

function Ring({
  radius,
  size,
  progress,
  stroke,
  strokeWidth,
}: {
  radius: number;
  size: number;
  progress: number;
  stroke: string;
  strokeWidth: number;
}) {
  const circumference = 2 * Math.PI * radius;

  return (
    <Svg
      height={size}
      width={size}
      style={StyleSheet.absoluteFillObject}
    >
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={withAlpha(HB_TEXT_SECONDARY, 0.16)}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - progress)}
        rotation="-90"
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

export function PetAvatar({
  pet,
  stats,
  size = 88,
  animate = true,
}: PetAvatarProps) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      bob.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: -4,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
      bob.setValue(0);
    };
  }, [animate, bob]);

  const emoji = PET_EMOJI[pet.species ?? 'fox'] ?? '🐾';

  return (
    <View style={styles.container}>
      <View style={[styles.avatarWrap, { width: size, height: size, borderRadius: size / 2 }]}>
        <Ring
          radius={size / 2 - 6}
          size={size}
          progress={clampProgress(stats.hunger)}
          stroke={HB_STREAK.fire}
          strokeWidth={4}
        />
        <Ring
          radius={size / 2 - 13}
          size={size}
          progress={clampProgress(stats.happiness)}
          stroke={HB_ACCENT_LIGHT}
          strokeWidth={4}
        />
        <Ring
          radius={size / 2 - 20}
          size={size}
          progress={clampProgress(stats.energy)}
          stroke={HB_XP}
          strokeWidth={4}
        />
        <Animated.View
          style={[
            styles.avatarCore,
            {
              width: size - 34,
              height: size - 34,
              borderRadius: (size - 34) / 2,
              transform: [{ translateY: bob }],
            },
          ]}
        >
          <Text style={styles.emoji}>
            {emoji}
          </Text>
        </Animated.View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>
            Lv {pet.level ?? 1}
          </Text>
        </View>
      </View>
      <Text style={styles.name}>
        {pet.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HB_SURFACES.low,
  },
  avatarCore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HB_SURFACES.high,
  },
  emoji: {
    fontSize: 28,
    lineHeight: 36,
  },
  levelBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.highest,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  levelText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_XP,
  },
  name: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
    fontSize: 13,
    lineHeight: 18,
  },
});
