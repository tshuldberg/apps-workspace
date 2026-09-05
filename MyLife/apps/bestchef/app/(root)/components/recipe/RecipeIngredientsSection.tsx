import { StyleSheet, View } from 'react-native';
import { BCSectionHeader } from '@mylife/bestchef/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';

interface IngredientRowProps {
  text: string;
  isLast: boolean;
}

function IngredientRow({ text, isLast }: IngredientRowProps) {
  const tc = useThemeColors();

  return (
    <>
      <View style={[styles.ingredientRow, { paddingLeft: 36 }]}>
        <View style={[styles.bullet, { backgroundColor: tc.accent }]} />
        <Text style={[styles.ingredientText, { color: tc.text }]}>{text}</Text>
      </View>
      {!isLast ? (
        <View style={[styles.divider, { backgroundColor: tc.border }]} />
      ) : null}
    </>
  );
}

interface RecipeIngredientsSectionProps {
  ingredients: string[];
}

export function RecipeIngredientsSection({ ingredients }: RecipeIngredientsSectionProps) {
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <BCSectionHeader
        title={t('Ingredients')}
        subtitle={t('{count} items', { count: ingredients.length })}
        style={styles.header}
      />
      <View style={styles.list}>
        {ingredients.map((ing, i) => (
          <IngredientRow key={i} text={ing} isLast={i === ingredients.length - 1} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  header: { paddingHorizontal: 0, paddingVertical: 0 },
  list: { gap: 0 },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    flexShrink: 0,
  },
  ingredientText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 36,
    opacity: 0.4,
  },
});
