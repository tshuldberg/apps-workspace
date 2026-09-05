import { StyleSheet, View } from 'react-native';
import { BCSectionHeader } from '@mylife/bestchef/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';

interface RecipeStorySectionProps {
  description: string | null;
  dishName: string;
  cuisine: string;
  region: string;
  reviewedCount: number;
}

export function RecipeStorySection({
  description,
  dishName,
  cuisine,
  region,
  reviewedCount,
}: RecipeStorySectionProps) {
  const tc = useThemeColors();
  const { t } = useI18n();

  const bodyText = description && description.trim().length > 0
    ? description.trim()
    : t(
        'Passed down through three generations, this {dish} blends bold {cuisine} tradition with a modern twist from {region}. Reviewed by {reviewedCount} chefs.',
        { dish: dishName.toLowerCase(), cuisine, region: region || 'the community', reviewedCount },
      );

  return (
    <View style={styles.container}>
      <BCSectionHeader title={t('The Story')} style={styles.header} />
      <Text style={[styles.body, { color: tc.textSecondary }]}>{bodyText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  header: { paddingHorizontal: 0, paddingVertical: 0 },
  body: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 14 * 1.5,
  },
});
