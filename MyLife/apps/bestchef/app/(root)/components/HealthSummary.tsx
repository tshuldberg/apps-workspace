import { Pressable, StyleSheet, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { JAKARTA_FONTS, type NutritionDetail } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';

interface HealthSummaryProps {
  detail: NutritionDetail;
  compact?: boolean;
  onPressDetails?: () => void;
}

function formatAmount(value: number | null, unit: 'g' | 'mg', formatNumber: (value: number) => string): string {
  if (value === null) return 'Missing';
  const rounded = unit === 'mg' ? Math.round(value) : Math.round(value * 10) / 10;
  return `${formatNumber(rounded)}${unit}`;
}

export function HealthSummary({ detail, compact = false, onPressDetails }: HealthSummaryProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t, formatNumber } = useI18n();
  const summary = detail.healthSummary;
  const items = [
    { label: t('Protein'), value: formatAmount(summary.protein_g, 'g', formatNumber) },
    { label: t('Fiber'), value: formatAmount(summary.fiber_g, 'g', formatNumber) },
    { label: t('Sodium'), value: formatAmount(summary.sodium_mg, 'mg', formatNumber) },
    { label: t('Sat fat'), value: formatAmount(summary.saturated_fat_g, 'g', formatNumber) },
    { label: t('Added sugar'), value: formatAmount(summary.added_sugar_g, 'g', formatNumber) },
  ];

  return (
    <View style={[styles.card, compact && styles.compactCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: tc.text }]}>{t('Health Summary')}</Text>
          <Text style={[styles.meta, { color: tc.textTertiary }]}>
            {detail.status === 'missing'
              ? t('Nutrition facts missing')
              : detail.coveragePercent !== null
                ? t('{count}% coverage', { count: detail.coveragePercent })
                : detail.confidenceLabel}
          </Text>
        </View>
        {onPressDetails ? (
          <Pressable
            style={({ pressed }) => [
              styles.detailButton,
              { backgroundColor: `${tc.accent}1A` },
              pressed && { opacity: 0.78, transform: [{ scale: 0.97 }] },
            ]}
            onPress={onPressDetails}
            accessibilityRole="button"
            accessibilityLabel={t('Nutrition facts')}
          >
            <Info size={14} color={tc.accent} strokeWidth={2} />
            <Text style={[styles.detailButtonText, { color: tc.accent }]}>{t('Facts')}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.label} style={[styles.tile, { backgroundColor: tc.surface }]}>
            <Text style={[styles.tileValue, { color: item.value === 'Missing' ? tc.textTertiary : tc.text }]} numberOfLines={1}>
              {item.value === 'Missing' ? t('Missing') : item.value}
            </Text>
            <Text style={[styles.tileLabel, { color: tc.textTertiary }]} numberOfLines={1}>{item.label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.confidence, { color: tc.textTertiary }]}>
        {t('Source confidence')}: {t(summary.confidenceLabel)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  compactCard: { padding: 12, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headerText: { flex: 1, gap: 2 },
  title: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 14 },
  meta: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11 },
  detailButton: { minHeight: 32, borderRadius: 999, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.5%', minHeight: 54, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 8, justifyContent: 'center', gap: 2 },
  tileValue: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 13 },
  tileLabel: { fontFamily: JAKARTA_FONTS.medium, fontSize: 10 },
  confidence: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11 },
});
