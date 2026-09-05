import { Pressable, StyleSheet, View } from 'react-native';
import {
  JAKARTA_FONTS,
  type NutritionDetail,
  type NutritionFactsWithAddedSugar,
  type NutritionFieldKey,
  type NutritionSourceChoice,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';

interface NutritionPanelProps {
  detail: NutritionDetail;
  compact?: boolean;
  sourceChoices?: NutritionSourceChoice[];
  onSelectSource?: (nutritionDataId: string) => void;
}

const NUTRIENTS: Array<{ key: NutritionFieldKey; label: string; unit: 'kcal' | 'g' | 'mg' }> = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'fat_g', label: 'Total fat', unit: 'g' },
  { key: 'saturated_fat_g', label: 'Saturated fat', unit: 'g' },
  { key: 'carbs_g', label: 'Total carbohydrate', unit: 'g' },
  { key: 'fiber_g', label: 'Dietary fiber', unit: 'g' },
  { key: 'sugar_g', label: 'Total sugars', unit: 'g' },
  { key: 'added_sugar_g', label: 'Added sugars', unit: 'g' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'sodium_mg', label: 'Sodium', unit: 'mg' },
];

function formatValue(
  facts: NutritionFactsWithAddedSugar,
  key: NutritionFieldKey,
  unit: 'kcal' | 'g' | 'mg',
  formatNumber: (value: number) => string,
): string {
  const value = facts[key];
  if (value === null) return 'Missing';
  const rounded = unit === 'g' ? Math.round(value * 10) / 10 : Math.round(value);
  return unit === 'kcal' ? formatNumber(rounded) : `${formatNumber(rounded)}${unit}`;
}

function basisLabel(detail: NutritionDetail): string {
  if (!detail.servingBasis) return 'Serving basis missing';
  const quantity = detail.servingQuantity === null ? '' : `${detail.servingQuantity} `;
  const unit = detail.servingUnit ?? '';
  return `${detail.servingBasis.replace(/_/g, ' ')} ${quantity}${unit}`.trim();
}

function choiceServingLabel(choice: NutritionSourceChoice): string {
  if (choice.servingSizeText) return choice.servingSizeText;
  const quantity = choice.servingQuantity === null ? '' : `${choice.servingQuantity} `;
  const unit = choice.servingUnit ?? '';
  return `${choice.servingBasis.replace(/_/g, ' ')} ${quantity}${unit}`.trim();
}

function choiceSummary(
  choice: NutritionSourceChoice,
  formatNumber: (value: number) => string,
  missingLabel: string,
): string {
  const calories = choice.calories === null ? missingLabel : `${formatNumber(Math.round(choice.calories))} kcal`;
  const protein = choice.protein_g === null ? missingLabel : `${formatNumber(Math.round(choice.protein_g * 10) / 10)}g protein`;
  return `${calories} / ${protein}`;
}

export function NutritionPanel({
  detail,
  compact = false,
  sourceChoices = [],
  onSelectSource,
}: NutritionPanelProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, formatNumber } = useI18n();
  const facts = detail.perServingNutrients ?? detail.nutrients;
  const totalFacts = detail.totalNutrients;
  const selectableSourceChoices = sourceChoices.length > 1 ? sourceChoices : [];

  return (
    <View style={[styles.panel, compact && styles.compactPanel, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: tc.text }]}>{t('Nutrition Facts')}</Text>
          <Text style={[styles.subtitle, { color: tc.textTertiary }]}>{detail.title}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: detail.status === 'missing' ? tc.surface : `${tc.accent}1A` }]}>
          <Text style={[styles.statusText, { color: detail.status === 'missing' ? tc.textTertiary : tc.accent }]}>
            {t(detail.status)}
          </Text>
        </View>
      </View>

      <View style={styles.metaGrid}>
        <View style={[styles.metaTile, { backgroundColor: tc.surface }]}>
          <Text style={[styles.metaLabel, { color: tc.textTertiary }]}>{t('Serving')}</Text>
          <Text style={[styles.metaValue, { color: tc.text }]}>{t(basisLabel(detail))}</Text>
        </View>
        <View style={[styles.metaTile, { backgroundColor: tc.surface }]}>
          <Text style={[styles.metaLabel, { color: tc.textTertiary }]}>{t('Confidence')}</Text>
          <Text style={[styles.metaValue, { color: tc.text }]}>{t(detail.confidenceLabel)}</Text>
        </View>
      </View>

      <Text style={[styles.disclaimerText, { color: tc.textTertiary }]}>
        {t('Estimated from ingredient databases and AI, not medical or dietary advice. Always verify allergens and nutrition against product labels.')}
      </Text>

      <View style={styles.nutrientList}>
        {NUTRIENTS.map((nutrient) => (
          <View key={nutrient.key} style={[styles.nutrientRow, { borderBottomColor: tc.border }]}>
            <Text style={[styles.nutrientLabel, { color: tc.text }]}>{t(nutrient.label)}</Text>
            <View style={styles.nutrientValues}>
              <Text style={[styles.nutrientValue, { color: facts[nutrient.key] === null ? tc.textTertiary : tc.text }]}>
                {formatValue(facts, nutrient.key, nutrient.unit, formatNumber) === 'Missing'
                  ? t('Missing')
                  : formatValue(facts, nutrient.key, nutrient.unit, formatNumber)}
              </Text>
              {totalFacts ? (
                <Text style={[styles.totalValue, { color: tc.textTertiary }]}>
                  {t('Total')}: {formatValue(totalFacts, nutrient.key, nutrient.unit, formatNumber) === 'Missing'
                    ? t('Missing')
                    : formatValue(totalFacts, nutrient.key, nutrient.unit, formatNumber)}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.sourceBox, { backgroundColor: tc.surface }]}>
        <Text style={[styles.sourceTitle, { color: tc.text }]}>{t('Source')}</Text>
        <Text style={[styles.sourceText, { color: tc.textSecondary }]}>
          {detail.sourceDisplay?.label ?? t('No nutrition source selected')}
          {detail.sourceId ? ` / ${t('Source ID')} ${detail.sourceId}` : ''}
        </Text>
        <Text style={[styles.sourceText, { color: tc.textTertiary }]}>
          {[detail.servingSizeText, detail.fetchedAt ? `${t('Fetched')} ${detail.fetchedAt}` : null, detail.confirmedAt ? `${t('Confirmed')} ${detail.confirmedAt}` : null]
            .filter(Boolean)
            .join(' / ') || t('No source timestamp')}
        </Text>
      </View>

      {selectableSourceChoices.length > 0 ? (
        <View style={styles.sourceChoices}>
          <Text style={[styles.sourceTitle, { color: tc.text }]}>{t('Source Choices')}</Text>
          {selectableSourceChoices.map((choice) => (
            <Pressable
              key={choice.nutritionDataId}
              style={({ pressed }) => [
                styles.sourceChoice,
                { backgroundColor: choice.isSelected ? `${tc.accent}1A` : tc.surface, borderColor: choice.isSelected ? tc.accent : tc.border },
                pressed && !choice.isSelected && { opacity: 0.78, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => {
                if (!choice.isSelected) onSelectSource?.(choice.nutritionDataId);
              }}
              disabled={choice.isSelected || !onSelectSource}
              accessibilityRole="button"
              accessibilityLabel={`${choice.isSelected ? t('Selected nutrition source') : t('Choose nutrition source')}: ${choice.display.label}`}
            >
              <View style={styles.sourceChoiceHeader}>
                <Text style={[styles.sourceChoiceTitle, { color: choice.isSelected ? tc.accent : tc.text }]}>
                  {choice.display.label}
                  {choice.sourceId ? ` / ${choice.sourceId}` : ''}
                </Text>
                <Text style={[styles.sourceChoiceBadge, { color: choice.isSelected ? tc.accent : tc.textTertiary }]}>
                  {choice.isSelected ? t('Selected') : t(choice.confidenceLabel)}
                </Text>
              </View>
              <Text style={[styles.sourceChoiceMeta, { color: tc.textTertiary }]}>
                {[choice.productName, choice.brand, choiceServingLabel(choice)]
                  .filter(Boolean)
                  .join(' / ')}
              </Text>
              <Text style={[styles.sourceChoiceMeta, { color: tc.textSecondary }]}>
                {choiceSummary(choice, formatNumber, t('Missing'))}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {detail.coveragePercent !== null || detail.sourceBreakdown.length > 0 ? (
        <View style={styles.breakdown}>
          {detail.coveragePercent !== null ? (
            <Text style={[styles.breakdownText, { color: tc.textSecondary }]}>
              {t('Coverage')}: {formatNumber(detail.coveragePercent)}%
            </Text>
          ) : null}
          {detail.sourceBreakdown.map((source) => (
            <Text key={`${source.source}:${source.sourceId ?? 'none'}`} style={[styles.breakdownText, { color: tc.textSecondary }]}>
              {source.label}: {formatNumber(source.count)} {t('ingredient records')}
              {source.confidence !== null ? ` / ${t('confidence')} ${formatNumber(Math.round(source.confidence * 100))}%` : ''}
            </Text>
          ))}
        </View>
      ) : null}

      {detail.missingFields.length > 0 ? (
        <Text style={[styles.warningText, { color: tc.textTertiary }]}>
          {t('Missing fields')}: {detail.missingFields.map((field) => t(field.label)).join(', ')}
        </Text>
      ) : null}
      {detail.missingIngredients.length > 0 ? (
        <Text style={[styles.warningText, { color: tc.textTertiary }]}>
          {t('Missing ingredients')}: {detail.missingIngredients.join(', ')}
        </Text>
      ) : null}
      {detail.ambiguousConversions.length > 0 ? (
        <Text style={[styles.warningText, { color: tc.textTertiary }]}>
          {t('Ambiguous conversions')}: {detail.ambiguousConversions.join('; ')}
        </Text>
      ) : null}
      {detail.lowConfidenceWarnings.length > 0 ? (
        <Text style={[styles.warningText, { color: tc.primaryContainer }]}>
          {detail.lowConfidenceWarnings.join('; ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 },
  compactPanel: { padding: 14, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  title: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 17 },
  subtitle: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, textTransform: 'capitalize' },
  metaGrid: { flexDirection: 'row', gap: 8 },
  metaTile: { flex: 1, borderRadius: 12, padding: 10, gap: 3 },
  metaLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, textTransform: 'uppercase' },
  metaValue: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12, textTransform: 'capitalize' },
  nutrientList: { gap: 0 },
  nutrientRow: { minHeight: 40, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  nutrientLabel: { flex: 1, fontFamily: JAKARTA_FONTS.medium, fontSize: 13 },
  nutrientValues: { alignItems: 'flex-end', gap: 2 },
  nutrientValue: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  totalValue: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10 },
  sourceBox: { borderRadius: 12, padding: 12, gap: 4 },
  sourceTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  sourceText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 16 },
  sourceChoices: { gap: 8 },
  sourceChoice: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 5 },
  sourceChoiceHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sourceChoiceTitle: { flex: 1, fontFamily: JAKARTA_FONTS.bold, fontSize: 12 },
  sourceChoiceBadge: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, textTransform: 'uppercase' },
  sourceChoiceMeta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10, lineHeight: 14 },
  breakdown: { gap: 4 },
  breakdownText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 16 },
  warningText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, lineHeight: 16 },
  disclaimerText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10, lineHeight: 14, fontStyle: 'italic' },
});
