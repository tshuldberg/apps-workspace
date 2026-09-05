import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  MD_ACCENT_LIGHT,
  MD_CARD_RADIUS,
  MD_DOSE_STATUS,
  MD_PILL_RADIUS,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  resolveDoseColor,
  withAlpha,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface DoseCardProps {
  medication: string;
  dose: string;
  scheduledTime: string;
  status: keyof typeof MD_DOSE_STATUS | string;
  onTake?: () => void;
  onSkip?: () => void;
  onSnooze?: () => void;
  onPress?: () => void;
}

function formatDoseTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function DoseCard({
  medication,
  dose,
  scheduledTime,
  status,
  onTake,
  onSkip,
  onSnooze,
  onPress,
}: DoseCardProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const toneColor = resolveDoseColor(status);
  const showActions = Boolean((onTake || onSkip || onSnooze) && ['due', 'upcoming'].includes(status));
  const formattedTime = useMemo(() => formatDoseTime(scheduledTime), [scheduledTime]);

  useEffect(() => {
    if (status !== 'due') {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
      pulse.setValue(1);
    };
  }, [pulse, status]);

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: pulse }],
            shadowColor: toneColor,
            shadowOpacity: status === 'due' ? 0.24 : 0.1,
          },
        ]}
      >
        <View style={styles.iconShell}>
          <MaterialSymbol name="pill" size={18} color={MD_ACCENT_LIGHT} />
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.medication}>
            {medication}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {dose} · {formattedTime}
          </Text>
        </View>
        <View style={styles.trailing}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: withAlpha(toneColor, 0.18) },
            ]}
          >
            <Text style={[styles.statusText, { color: toneColor }]}>
              {status.toUpperCase()}
            </Text>
          </View>
          {showActions ? (
            <View style={styles.actions}>
              {onTake ? (
                <Pressable
                  accessibilityLabel="Take dose"
                  onPress={onTake}
                  style={[styles.actionButton, styles.takeButton]}
                >
                  <Text style={styles.takeButtonText}>Take</Text>
                </Pressable>
              ) : null}
              {onSkip ? (
                <Pressable
                  accessibilityLabel="Skip dose"
                  onPress={onSkip}
                  style={styles.actionButton}
                >
                  <Text style={styles.skipButtonText}>Skip</Text>
                </Pressable>
              ) : null}
              {onSnooze ? (
                <Pressable
                  accessibilityLabel="Snooze dose"
                  onPress={onSnooze}
                  style={styles.actionButton}
                >
                  <Text style={styles.skipButtonText}>Snooze</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    borderRadius: MD_CARD_RADIUS,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 10,
  },
  iconShell: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT_LIGHT, 0.12),
    borderRadius: 18,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  medication: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  meta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 10,
  },
  statusPill: {
    borderRadius: MD_PILL_RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    borderRadius: MD_PILL_RADIUS,
    borderWidth: 1,
    borderColor: withAlpha(MD_TEXT_TERTIARY, 0.2),
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  takeButton: {
    backgroundColor: withAlpha(MD_ACCENT_LIGHT, 0.18),
    borderColor: withAlpha(MD_ACCENT_LIGHT, 0.22),
  },
  takeButtonText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  skipButtonText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
});
