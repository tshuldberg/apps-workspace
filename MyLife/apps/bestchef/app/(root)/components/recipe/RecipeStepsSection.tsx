import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BCSectionHeader, HERO_GRADIENT } from '@mylife/bestchef/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';

interface StepRowProps {
  number: number;
  text: string;
}

function StepRow({ number, text }: StepRowProps) {
  const tc = useThemeColors();

  return (
    <View style={styles.stepRow}>
      <LinearGradient
        colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.stepCircle}
      >
        <Text style={styles.stepNumber}>{number}</Text>
      </LinearGradient>
      <Text style={[styles.stepText, { color: tc.text }]}>{text}</Text>
    </View>
  );
}

interface RecipeStepsSectionProps {
  steps: string[];
}

export function RecipeStepsSection({ steps }: RecipeStepsSectionProps) {
  const { t } = useI18n();

  if (steps.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BCSectionHeader title={t('Steps')} style={styles.header} />
      <View style={styles.list}>
        {steps.map((step, i) => (
          <StepRow key={i} number={i + 1} text={step} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  header: { paddingHorizontal: 0, paddingVertical: 0 },
  list: { gap: 14 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumber: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  stepText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 14 * 1.5,
    flex: 1,
  },
});
