import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TYPOGRAPHY,
  NU_WATER,
} from '../tokens';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';

export interface WaterTrackerProps {
  consumedMl: number;
  goalMl: number;
  onAdd: (ml: number) => void;
}

function formatLiters(ml: number): string {
  return `${(ml / 1000).toFixed(1)}L`;
}

export function WaterTracker({
  consumedMl,
  goalMl,
  onAdd,
}: WaterTrackerProps) {
  const progress = goalMl <= 0 ? 0 : Math.max(0, Math.min((consumedMl / goalMl) * 100, 100));

  return (
    <GlassCard padding={18}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.iconWrap}>
            <MaterialSymbol name="water_drop" size={22} color={NU_WATER} filled />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>Hydration</Text>
            <Text style={styles.subtitle}>
              {formatLiters(consumedMl)} / {formatLiters(goalMl)} consumed
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {[250, 500].map((amount) => (
            <QuickAddButton
              key={amount}
              label={`${amount}ml`}
              onPress={() => onAdd(amount)}
            />
          ))}
          <QuickAddButton label="Custom" onPress={() => onAdd(0)} />
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
    </GlassCard>
  );
}

function QuickAddButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAdd, pressed ? styles.quickAddPressed : null]}>
      <Text style={styles.quickAddText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  subtitle: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  quickAdd: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: NU_SURFACES.high,
  },
  quickAddPressed: {
    backgroundColor: NU_SURFACES.highest,
  },
  quickAddText: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_WATER,
  },
  progressTrack: {
    marginTop: 14,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: NU_SURFACES.highest,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: NU_WATER,
  },
});
