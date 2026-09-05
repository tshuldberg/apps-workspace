import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text as RNText,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  ProgressRing,
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  REST_TIME_PRESETS,
} from '@mylife/workouts';
import {
  WorkoutGradientButton,
  WorkoutGhostButton,
  WorkoutPhaseHeader,
  WorkoutPhaseScreen,
  formatClock,
} from './phase2-kit';

export default function WorkoutRestTimerScreen() {
  const router = useRouter();
  const [totalSeconds, setTotalSeconds] = useState<number>(REST_TIME_PRESETS[2] ?? 90);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(REST_TIME_PRESETS[2] ?? 90);
  const [running, setRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = useMemo(() => {
    if (totalSeconds <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(1, remainingSeconds / totalSeconds));
  }, [remainingSeconds, totalSeconds]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  useEffect(() => {
    if (remainingSeconds !== 0) {
      return;
    }

    if (vibrationEnabled) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (soundEnabled) {
      Speech.speak('Rest complete');
    }
  }, [remainingSeconds, soundEnabled, vibrationEnabled]);

  const adjustSeconds = (delta: number) => {
    const next = Math.max(5, Math.min(900, totalSeconds + delta));
    setTotalSeconds(next);
    setRemainingSeconds(next);
    setRunning(false);
  };

  const selectPreset = (value: number) => {
    setTotalSeconds(value);
    setRemainingSeconds(value);
    setRunning(false);
  };

  const statusAccent =
    remainingSeconds <= 10 && running
      ? WK_CATEGORY_COLORS.hypertrophy
      : WK_ACCENT_LIGHT;

  return (
    <WorkoutPhaseScreen contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutPhaseHeader title="Rest Timer" onBack={() => router.back()} />

      <View style={styles.body}>
        <View style={styles.ringWrap}>
          <ProgressRing
            progress={progress}
            size={280}
            strokeWidth={10}
            color={statusAccent}
            centerValue={formatClock(remainingSeconds * 1000)}
            centerLabel="Remaining"
          />
        </View>

        <View style={styles.presetRow}>
          {REST_TIME_PRESETS.map((value) => (
            <Chip
              key={value}
              label={value >= 60 ? `${Math.round(value / 60)}m` : `${value}s`}
              selected={totalSeconds === value}
              accent={WK_ACCENT}
              onPress={() => selectPreset(value)}
            />
          ))}
        </View>

        <GlassPanel padding={20} style={styles.adjustCard}>
          <RNText style={styles.adjustTitle}>Custom Time</RNText>
          <View style={styles.adjustControls}>
            <Pressable onPress={() => adjustSeconds(-5)} style={styles.adjustButton}>
              <MaterialSymbol name="remove" size={16} color={WK_ACCENT_LIGHT} />
            </Pressable>
            <RNText style={styles.adjustValue}>{totalSeconds}s</RNText>
            <Pressable onPress={() => adjustSeconds(5)} style={styles.adjustButton}>
              <MaterialSymbol name="add" size={16} color={WK_ACCENT_LIGHT} />
            </Pressable>
          </View>
        </GlassPanel>

        <View style={styles.actionRow}>
          <WorkoutGradientButton
            label={running ? 'Pause' : remainingSeconds === 0 ? 'Restart' : 'Start'}
            icon={running ? 'pause' : 'play_arrow'}
            onPress={() => {
              if (remainingSeconds === 0) {
                setRemainingSeconds(totalSeconds);
                setRunning(true);
                return;
              }
              setRunning((current) => !current);
            }}
          />
          <WorkoutGhostButton
            label="Reset"
            icon="restart_alt"
            onPress={() => {
              setRunning(false);
              setRemainingSeconds(totalSeconds);
            }}
          />
        </View>

        <GlassPanel padding={18} style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <RNText style={styles.toggleTitle}>Sound Cue</RNText>
              <RNText style={styles.toggleMeta}>Speak when rest ends</RNText>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: 'rgba(255,255,255,0.14)', true: WK_ACCENT }}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <RNText style={styles.toggleTitle}>Vibration</RNText>
              <RNText style={styles.toggleMeta}>Pulse when the timer hits zero</RNText>
            </View>
            <Switch
              value={vibrationEnabled}
              onValueChange={setVibrationEnabled}
              trackColor={{ false: 'rgba(255,255,255,0.14)', true: WK_ACCENT }}
            />
          </View>
        </GlassPanel>
      </View>
    </WorkoutPhaseScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 20,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  adjustCard: {
    gap: 14,
  },
  adjustTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 19,
  },
  adjustControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adjustButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  adjustValue: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  actionRow: {
    gap: 12,
  },
  toggleCard: {
    gap: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.medium,
    fontSize: 15,
    lineHeight: 18,
  },
  toggleMeta: {
    color: 'rgba(214, 195, 181, 0.68)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});
