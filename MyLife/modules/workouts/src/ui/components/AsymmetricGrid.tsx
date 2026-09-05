import type { ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

export interface AsymmetricGridProps {
  left: ReactNode;
  right: ReactNode;
  leftSpan?: number;
  rightSpan?: number;
}

export function AsymmetricGrid({
  left,
  right,
  leftSpan = 7,
  rightSpan = 5,
}: AsymmetricGridProps) {
  const screenWidth = Dimensions.get('window').width;
  const isStacked = screenWidth < 768;

  if (isStacked) {
    return (
      <View style={styles.stack}>
        <View>{left}</View>
        <View>{right}</View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={{ flex: leftSpan }}>{left}</View>
      <View style={{ flex: rightSpan }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  stack: {
    gap: 16,
  },
});
