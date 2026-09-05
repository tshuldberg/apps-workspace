import { StyleSheet, View } from 'react-native';
import { GARDEN_HEALTH_COLORS, type GardenHealthStatus } from './tokens';

interface HealthDotProps {
  status: GardenHealthStatus;
  size?: number;
}

export function HealthDot({ status, size = 10 }: HealthDotProps) {
  const color = GARDEN_HEALTH_COLORS[status];
  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
});
