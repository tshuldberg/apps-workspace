import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  APP_LIBRARY,
  PR_ACCENT,
  PR_ACCENT_GLOW,
  PR_ACCENT_LIGHT,
  PR_FONTS,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TYPOGRAPHY,
} from '@mylife/presence';

const BREATH_COUNT = 3;
const BREATH_STEP_MS = 4000;

export default function BreathingPauseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ appId?: string; appName?: string; required?: string }>();
  const app = useMemo(() => APP_LIBRARY.find((entry) => entry.appId === params.appId), [params.appId]);
  const appName = params.appName ?? app?.name ?? 'this app';
  const requiredPause = params.required === '1';

  const [phaseLabel, setPhaseLabel] = useState<'Breathe in' | 'Hold' | 'Breathe out'>('Breathe in');
  const [breathsComplete, setBreathsComplete] = useState(0);
  const scale = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.5,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
      { iterations: BREATH_COUNT },
    );
    animation.start();

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let breath = 0; breath < BREATH_COUNT; breath += 1) {
      timers.push(setTimeout(() => setPhaseLabel('Breathe in'), breath * BREATH_STEP_MS));
      timers.push(setTimeout(() => setPhaseLabel('Hold'), breath * BREATH_STEP_MS + 1800));
      timers.push(setTimeout(() => setPhaseLabel('Breathe out'), breath * BREATH_STEP_MS + 2200));
      timers.push(setTimeout(() => setBreathsComplete(breath + 1), (breath + 1) * BREATH_STEP_MS));
    }

    timers.push(setTimeout(() => {
      router.replace({
        pathname: '/(presence)/intention-prompt',
        params: {
          appId: params.appId ?? '',
          appName,
        },
      } as never);
    }, BREATH_COUNT * BREATH_STEP_MS + 300));

    return () => {
      animation.stop();
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [appName, params.appId, router, scale]);

  return (
    <View style={styles.screen}>
      <View style={styles.radialGlow} />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Pause before opening {appName}</Text>
        <Text style={styles.subtitle}>Three deliberate breaths to re-enter this app on purpose instead of momentum.</Text>
      </View>

      <View style={styles.center}>
        <Animated.View style={[styles.breathCircleOuter, { transform: [{ scale }] }]}>
          <View style={styles.breathCircleInner} />
        </Animated.View>
        <Text style={styles.phaseText}>{phaseLabel}</Text>
        <View style={styles.dotRow}>
          {Array.from({ length: BREATH_COUNT }).map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index < breathsComplete ? styles.dotActive : null]}
            />
          ))}
        </View>
      </View>

      {!requiredPause ? (
        <Pressable
          onPress={() => {
            router.replace({
              pathname: '/(presence)/intention-prompt',
              params: {
                appId: params.appId ?? '',
                appName,
              },
            } as never);
          }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PR_SURFACES.base,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radialGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: PR_ACCENT_GLOW,
    opacity: 0.16,
    top: 120,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  eyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
    textAlign: 'center',
  },
  subtitle: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
    maxWidth: 300,
  },
  center: {
    alignItems: 'center',
    gap: 24,
  },
  breathCircleOuter: {
    width: 220,
    height: 220,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${PR_ACCENT}22`,
    shadowColor: PR_ACCENT,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  breathCircleInner: {
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: `${PR_ACCENT_LIGHT}55`,
    borderWidth: 0,
  },
  phaseText: {
    ...PR_TYPOGRAPHY.displayLg,
    color: PR_TEXT,
    fontSize: 32,
    lineHeight: 36,
    fontFamily: PR_FONTS.extraBold,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  dotActive: {
    backgroundColor: PR_ACCENT_LIGHT,
  },
  skipText: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    textDecorationLine: 'underline',
  },
});
