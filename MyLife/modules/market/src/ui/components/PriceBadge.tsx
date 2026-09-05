import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  MK_GLASS,
  MK_SURFACES,
  MK_TEXT,
  MK_TYPOGRAPHY,
} from '../tokens';
import { formatMarketPrice } from '../logic';

const SIZE_STYLES = {
  sm: { paddingHorizontal: 10, paddingVertical: 6, fontSize: 12 },
  md: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  lg: { paddingHorizontal: 14, paddingVertical: 10, fontSize: 18 },
} as const;

export interface PriceBadgeProps {
  price: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  glass?: boolean;
}

export function PriceBadge({
  price,
  currency = 'USD',
  size = 'md',
  glass = false,
}: PriceBadgeProps) {
  const config = SIZE_STYLES[size];

  return (
    <View
      style={[
        styles.badge,
        {
          paddingHorizontal: config.paddingHorizontal,
          paddingVertical: config.paddingVertical,
          backgroundColor: glass ? MK_GLASS.backgroundColor : MK_SURFACES.low,
        },
      ]}
    >
      {glass ? (
        <BlurView
          tint="dark"
          intensity={20}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      <Text
        style={[
          styles.text,
          {
            fontSize: config.fontSize,
            lineHeight: config.fontSize * 1.1,
          },
        ]}
      >
        {formatMarketPrice(price, currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  text: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
    zIndex: 1,
  },
});
