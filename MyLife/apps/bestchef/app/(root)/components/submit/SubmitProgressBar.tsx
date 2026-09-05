import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from '@mylife/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { type SubmitStep, WIZARD_STEPS, wizardStepIndex, stepSubtitle } from './types';

interface Props {
  step: SubmitStep;
  totalSteps?: number;
}

export function SubmitProgressBar({ step, totalSteps = 5 }: Props) {
  const tc = useThemeColors();
  const { t } = useI18n();

  const activeIndex = wizardStepIndex(step);

  const pillAnims = useRef(
    WIZARD_STEPS.map(() => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (step === 'dishSelection') return;
    const animations = WIZARD_STEPS.map((_, i) => {
      const target = i <= activeIndex ? 1 : 0;
      return Animated.timing(pillAnims[i]!, {
        toValue: target,
        duration: 300,
        useNativeDriver: false,
      });
    });
    Animated.parallel(animations).start();
  }, [step, activeIndex, pillAnims]);

  if (step === 'dishSelection') return null;

  const humanIndex = activeIndex + 1;
  const title = stepSubtitle(step);

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={[styles.stepLabel, { color: tc.textSecondary }]}>
          {t('Step {n} of 5', { n: String(humanIndex) })}
        </Text>
        <Text style={[styles.stepTitle, { color: tc.accent }]}>
          {t(title)}
        </Text>
      </View>
      <View style={styles.pillRow}>
        {WIZARD_STEPS.map((s, i) => {
          const anim = pillAnims[i]!;
          const bg = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [tc.surface ?? '#1B1B20', tc.accent],
          });
          return (
            <Animated.View
              key={s}
              style={[styles.pill, { backgroundColor: bg, flex: 1 }]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
  },
  stepTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 12,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    height: 5,
  },
  pill: {
    height: 5,
    borderRadius: 999,
  },
});
