import { View, StyleSheet } from 'react-native';
import { Clock, Flame, Users } from 'lucide-react-native';
import { StatBox } from '@mylife/bestchef/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';

export interface RecipeStatsRowProps {
  cookTimeMins?: number | null;
  difficulty?: string | null;
  servings?: number | null;
}

/**
 * Three StatBox cards: cook time, difficulty, servings.
 * Shows "—" when a value is absent.
 */
export function RecipeStatsRow({ cookTimeMins, difficulty, servings }: RecipeStatsRowProps) {
  const { t } = useI18n();
  const tc = useThemeColors();

  const cookTimeValue = cookTimeMins != null ? `${cookTimeMins}m` : '\u2014';
  const difficultyValue = difficulty ?? '\u2014';
  const servingsValue = servings != null ? String(servings) : '\u2014';

  return (
    <View style={styles.row}>
      <StatBox
        icon={<Clock size={14} color={tc.primary} strokeWidth={2} />}
        tint={tc.primary}
        value={cookTimeValue}
        caption={t('Cook time')}
      />
      <StatBox
        icon={<Flame size={14} color={tc.primaryContainer} strokeWidth={2} />}
        tint={tc.primaryContainer}
        value={difficultyValue}
        caption={t('Difficulty')}
      />
      <StatBox
        icon={<Users size={14} color={tc.accent} strokeWidth={2} />}
        tint={tc.accent}
        value={servingsValue}
        caption={t('Servings')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});
