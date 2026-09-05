// Voice coach overlay for the player: a pulsing mic pill that reflects the
// honest recognition state, a short command toast, and a pre-permission
// explainer sheet. Purely presentational on top of useVoiceCoach - all
// recognition lifecycle lives in the hook.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import { WK_FONTS, type PlayerVoiceMatch } from '@mylife/workouts';
import {
  useVoiceCoach,
  type VoiceCoachGrammar,
  type VoiceCoachStatus,
} from '../../../lib/voice/useVoiceCoach';
import {
  DW_ACCENT,
  DW_BORDER,
  DW_FEEDBACK,
  DW_ON_ACCENT,
  DW_SURFACES,
  DW_TEXT,
} from '../theme/tokens';

// Copy shown in the pre-permission explainer sheet. Defaults describe the video
// player; the session screen passes its own so the examples match its grammar.
export interface VoiceExplainerCopy {
  title: string;
  body: string;
  cta: string;
}

const PLAYER_EXPLAINER: VoiceExplainerCopy = {
  title: 'Control playback with your voice',
  body:
    'Say things like “slow down”, “back up”, or “pause” while a workout video plays, so your hands stay on the bar. Speech is recognized on your device and the audio never leaves it.',
  cta: 'Enable voice control',
};

interface VoiceCoachProps<M = PlayerVoiceMatch> {
  enabled: boolean;
  playing: boolean;
  onCommand: (match: M) => string | void;
  // Omit to drive the player grammar (default). The session screen injects its
  // own grammar so the same pill + lifecycle serves the live workout too.
  grammar?: VoiceCoachGrammar<M>;
  explainer?: VoiceExplainerCopy;
}

const PILL_LABEL: Record<VoiceCoachStatus, string> = {
  listening: 'Listening',
  paused: 'Voice ready',
  off: 'Tap to talk',
  denied: 'Mic blocked',
  unavailable: 'Voice unavailable',
  interrupted: 'Tap to talk',
};

export function VoiceCoach<M = PlayerVoiceMatch>({
  enabled,
  playing,
  onCommand,
  grammar,
  explainer = PLAYER_EXPLAINER,
}: VoiceCoachProps<M>) {
  const coach = useVoiceCoach<M>({ enabled, playing, onCommand, grammar });
  const [showExplainer, setShowExplainer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const promptedRef = useRef(false);

  // First time voice is on but not yet permitted, explain before the OS prompt.
  useEffect(() => {
    if (enabled && coach.status === 'off' && !promptedRef.current) {
      promptedRef.current = true;
      setShowExplainer(true);
    }
  }, [enabled, coach.status]);

  // Command toast: 1.2 s, re-triggered per accepted command via the seq bump.
  useEffect(() => {
    if (coach.lastCommandSeq === 0 || !coach.lastCommandLabel) return;
    setToast(coach.lastCommandLabel);
    const timer = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(timer);
  }, [coach.lastCommandSeq, coach.lastCommandLabel]);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (coach.status !== 'listening') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [coach.status, pulse]);

  const handlePress = useCallback(() => {
    switch (coach.status) {
      case 'denied':
        void Linking.openSettings();
        return;
      case 'unavailable':
        return;
      case 'interrupted':
        // Continuous mode gave up on this device; the tap is the promised
        // one-shot mic button.
        void coach.pushToTalk();
        return;
      case 'off':
        if (!enabled) {
          void coach.pushToTalk();
        } else {
          setShowExplainer(true);
        }
        return;
      case 'paused':
      case 'listening':
        // Continuous recognition is already running; a tap is a no-op.
        return;
    }
  }, [coach, enabled]);

  const handleEnableFromSheet = useCallback(() => {
    setShowExplainer(false);
    void coach.requestPermission();
  }, [coach]);

  const isListening = coach.status === 'listening';
  const isDenied = coach.status === 'denied';
  const isUnavailable = coach.status === 'unavailable';
  const isInterrupted = coach.status === 'interrupted';

  const ringStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
  };

  return (
    <View style={styles.root} pointerEvents="box-none">
      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {(isUnavailable || isInterrupted) && coach.unavailableReason ? (
        <View style={styles.reason} pointerEvents="none">
          <Text style={styles.reasonText}>{coach.unavailableReason}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={handlePress}
        disabled={isUnavailable}
        accessibilityRole="button"
        accessibilityLabel={`Voice control: ${PILL_LABEL[coach.status]}`}
        style={({ pressed }) => [
          styles.pill,
          isListening && styles.pillListening,
          isDenied && styles.pillDenied,
          isUnavailable && styles.pillUnavailable,
          pressed && { opacity: 0.86 },
        ]}
      >
        {isListening ? <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" /> : null}
        {coach.status === 'listening' || coach.status === 'paused' ? (
          <Mic size={16} color={isListening ? DW_ON_ACCENT : DW_TEXT.secondary} />
        ) : (
          <MicOff size={16} color={isDenied ? DW_FEEDBACK.danger : DW_TEXT.tertiary} />
        )}
        <Text
          style={[
            styles.pillLabel,
            isListening && styles.pillLabelListening,
            isDenied && styles.pillLabelDenied,
          ]}
        >
          {PILL_LABEL[coach.status]}
        </Text>
      </Pressable>

      <Modal visible={showExplainer} animationType="slide" transparent>
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <View style={styles.sheetIcon}>
              <Mic size={24} color={DW_ACCENT} />
            </View>
            <Text style={styles.sheetTitle}>{explainer.title}</Text>
            <Text style={styles.sheetBody}>{explainer.body}</Text>
            <Pressable
              style={({ pressed }) => [styles.sheetPrimary, pressed && { opacity: 0.86 }]}
              onPress={handleEnableFromSheet}
              accessibilityRole="button"
            >
              <Text style={styles.sheetPrimaryText}>{explainer.cta}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.sheetSecondary, pressed && { opacity: 0.7 }]}
              onPress={() => setShowExplainer(false)}
              accessibilityRole="button"
            >
              <Text style={styles.sheetSecondaryText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 24,
    gap: 10,
  },
  toast: {
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: DW_BORDER.default,
  },
  toastText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_TEXT.primary,
    letterSpacing: 0.3,
  },
  reason: {
    maxWidth: 300,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reasonText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: DW_TEXT.secondary,
    textAlign: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: DW_SURFACES.high,
    borderWidth: 1,
    borderColor: DW_BORDER.default,
  },
  pillListening: {
    backgroundColor: DW_ACCENT,
    borderColor: DW_ACCENT,
  },
  pillDenied: {
    borderColor: 'rgba(255, 107, 107, 0.45)',
  },
  pillUnavailable: {
    opacity: 0.6,
  },
  ring: {
    position: 'absolute',
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DW_ACCENT,
  },
  pillLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.secondary,
    letterSpacing: 0.3,
  },
  pillLabelListening: {
    color: DW_ON_ACCENT,
  },
  pillLabelDenied: {
    color: DW_FEEDBACK.danger,
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 12,
    backgroundColor: DW_SURFACES.base,
  },
  sheetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 0, 0.12)',
  },
  sheetTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: DW_TEXT.primary,
  },
  sheetBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: DW_TEXT.secondary,
  },
  sheetPrimary: {
    marginTop: 8,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetPrimaryText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_ON_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sheetSecondary: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetSecondaryText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.tertiary,
  },
});
