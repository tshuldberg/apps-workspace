import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import {
  calculateAverageGlucose,
  createA1cRecord,
  estimateA1c,
  getA1cConfidence,
  getA1cRecords,
  getGlucoseReadings,
  interpretA1c,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_CARD_RADIUS,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const CONVERSION_ROWS = [
  { average: 97, a1c: 5.0 },
  { average: 126, a1c: 6.0 },
  { average: 154, a1c: 7.0 },
  { average: 183, a1c: 8.0 },
  { average: 212, a1c: 9.0 },
] as const;

function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatInputDate(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function buildLabNotes(labName: string, doctorName: string): string | undefined {
  const parts = [
    labName.trim() ? `Lab: ${labName.trim()}` : null,
    doctorName.trim() ? `Doctor: ${doctorName.trim()}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(' • ') : undefined;
}

function A1cTrendChart({
  estimatedA1c,
  records,
}: {
  estimatedA1c: number;
  records: Array<{ id: string; value: number; recordedAt: string }>;
}) {
  const data = [...records]
    .reverse()
    .slice(-6)
    .map((record) => ({
      id: record.id,
      label: formatDateLabel(record.recordedAt),
      value: record.value,
      estimated: false,
    }));

  data.push({
    id: 'estimated-now',
    label: 'Today',
    value: estimatedA1c,
    estimated: true,
  });

  if (data.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>Add at least one lab result to compare your estimate against real tests.</Text>
      </View>
    );
  }

  const width = 320;
  const height = 172;
  const padding = 18;
  const minValue = Math.min(5, ...data.map((point) => point.value)) - 0.2;
  const maxValue = Math.max(9, ...data.map((point) => point.value)) + 0.3;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;
  const step = chartWidth / Math.max(1, data.length - 1);
  const yFor = (value: number) => height - padding - ((value - minValue) / Math.max(0.1, maxValue - minValue)) * chartHeight;
  const points = data.map((point, index) => `${padding + index * step},${yFor(point.value)}`).join(' ');
  const targetY = yFor(7.0);

  return (
    <Svg height={height} viewBox={`0 0 ${width} ${height}`} width="100%">
      {[6, 7, 8].map((value) => (
        <Line
          key={value}
          stroke={withAlpha(MD_TEXT_SECONDARY, 0.16)}
          strokeDasharray="4 6"
          strokeWidth={1.4}
          x1={padding}
          x2={width - padding}
          y1={yFor(value)}
          y2={yFor(value)}
        />
      ))}
      <Line
        stroke={withAlpha('#FFB877', 0.7)}
        strokeDasharray="8 6"
        strokeWidth={2}
        x1={padding}
        x2={width - padding}
        y1={targetY}
        y2={targetY}
      />
      <Polyline
        fill="none"
        points={points}
        stroke={MD_ACCENT_LIGHT}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />
      {data.map((point, index) => (
        <Circle
          key={point.id}
          cx={padding + index * step}
          cy={yFor(point.value)}
          fill={point.estimated ? MD_ACCENT : '#FFB877'}
          r={point.estimated ? 5 : 4.5}
        />
      ))}
    </Svg>
  );
}

export default function A1cScreen() {
  const db = useDatabase();
  const [showForm, setShowForm] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [labValueText, setLabValueText] = useState('');
  const [labDate, setLabDate] = useState(formatInputDate(new Date().toISOString()));
  const [labName, setLabName] = useState('');
  const [doctorName, setDoctorName] = useState('');

  const ninetyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date.toISOString();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRefreshToken((value) => value + 1);
    }, []),
  );

  const glucoseReadings = useMemo(
    () => getGlucoseReadings(db, { from: ninetyDaysAgo, limit: 1000 }),
    [db, ninetyDaysAgo, refreshToken],
  );
  const labRecords = useMemo(
    () => getA1cRecords(db, { source: 'lab', limit: 12 }),
    [db, refreshToken],
  );

  const averageGlucose = useMemo(() => calculateAverageGlucose(glucoseReadings), [glucoseReadings]);
  const estimatedA1c = useMemo(() => estimateA1c(averageGlucose), [averageGlucose]);
  const confidence = useMemo(() => getA1cConfidence(glucoseReadings.length), [glucoseReadings.length]);
  const interpretation = useMemo(() => interpretA1c(estimatedA1c), [estimatedA1c]);
  const latestLab = labRecords[0] ?? null;
  const estimateGap = latestLab ? Number((estimatedA1c - latestLab.value).toFixed(1)) : null;
  const trendDirection = useMemo(() => {
    if (labRecords.length >= 2) {
      const delta = Number((labRecords[0].value - labRecords[1].value).toFixed(1));
      if (delta <= -0.2) {
        return 'Improving';
      }
      if (delta >= 0.2) {
        return 'Rising';
      }
      return 'Stable';
    }

    return latestLab ? 'Comparing to latest lab' : 'Awaiting first lab';
  }, [labRecords, latestLab]);

  const windowSpanDays = useMemo(() => {
    if (!glucoseReadings.length) {
      return 0;
    }

    const oldest = glucoseReadings[glucoseReadings.length - 1];
    const spanMs = Date.now() - new Date(oldest.measuredAt).getTime();
    return Math.min(90, Math.max(1, Math.round(spanMs / (1000 * 60 * 60 * 24))));
  }, [glucoseReadings]);

  function handleSaveLab() {
    const parsedValue = Number.parseFloat(labValueText);
    const parsedDate = new Date(labDate);

    if (!Number.isFinite(parsedValue) || parsedValue < 3 || parsedValue > 20) {
      Alert.alert('Invalid lab result', 'Enter an A1c value between 3.0 and 20.0.');
      return;
    }

    if (Number.isNaN(parsedDate.getTime())) {
      Alert.alert('Invalid date', 'Enter the lab date in YYYY-MM-DD format.');
      return;
    }

    try {
      const id = `a1c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      createA1cRecord(db, id, {
        value: parsedValue,
        source: 'lab',
        averageGlucose,
        readingCount: glucoseReadings.length,
        periodDays: 90,
        notes: buildLabNotes(labName, doctorName),
        recordedAt: parsedDate.toISOString(),
      });

      setLabValueText('');
      setLabName('');
      setDoctorName('');
      setShowForm(false);
      setRefreshToken((value) => value + 1);
      Alert.alert('Lab result saved', 'Your A1c history has been updated.');
    } catch (error) {
      Alert.alert(
        'Unable to save lab result',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  if (!glucoseReadings.length) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <GlassCard intensity={22} padding={22} style={styles.emptyCard}>
          <MaterialSymbol color={MD_ACCENT_LIGHT} name="bloodtype" size={26} />
          <Text style={styles.emptyTitle}>No glucose readings yet</Text>
          <Text style={styles.emptyBody}>Record glucose values to generate an estimated A1c and compare it with lab history.</Text>
        </GlassCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <GlassCard intensity={26} padding={22} style={styles.heroCard}>
        <Text style={styles.eyebrow}>A1c Dashboard</Text>
        <View style={styles.heroLayout}>
          <View style={[styles.heroRing, { borderColor: interpretation.color }]}>
            <Text style={styles.heroValue}>{estimatedA1c.toFixed(1)}</Text>
            <Text style={styles.heroValueUnit}>%</Text>
          </View>

          <View style={styles.heroCopy}>
            <View style={[styles.statusBadge, { backgroundColor: withAlpha(interpretation.color, 0.16) }]}>
              <Text style={[styles.statusBadgeText, { color: interpretation.color }]}>
                {interpretation.label}
              </Text>
            </View>
            <Text style={styles.heroBody}>
              Based on {glucoseReadings.length} readings across the last {windowSpanDays} days.
            </Text>
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>Confidence</Text>
              <Text style={styles.confidenceValue}>{confidence.toUpperCase()}</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Lab A1c History" />
        <GlassCard intensity={16} padding={18} style={styles.chartCard}>
          <A1cTrendChart
            estimatedA1c={estimatedA1c}
            records={labRecords.map((record) => ({
              id: record.id,
              value: record.value,
              recordedAt: record.recordedAt,
            }))}
          />
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FFB877' }]} />
              <Text style={styles.legendText}>Lab result</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: MD_ACCENT }]} />
              <Text style={styles.legendText}>Estimated today</Text>
            </View>
          </View>
        </GlassCard>

        <Pressable onPress={() => setShowForm((value) => !value)} style={styles.addLabButton}>
          <MaterialSymbol color={MD_ACCENT_LIGHT} name="add" size={18} />
          <Text style={styles.addLabButtonText}>{showForm ? 'Hide lab entry' : 'Add lab result'}</Text>
        </Pressable>

        {showForm ? (
          <GlassCard intensity={14} padding={16} style={styles.formCard}>
            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>A1c value</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={setLabValueText}
                  placeholder="6.4"
                  placeholderTextColor={withAlpha(MD_TEXT_TERTIARY, 0.45)}
                  style={styles.formInput}
                  value={labValueText}
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Lab date</Text>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setLabDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={withAlpha(MD_TEXT_TERTIARY, 0.45)}
                  style={styles.formInput}
                  value={labDate}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Lab name</Text>
                <TextInput
                  onChangeText={setLabName}
                  placeholder="Quest Diagnostics"
                  placeholderTextColor={withAlpha(MD_TEXT_TERTIARY, 0.45)}
                  style={styles.formInput}
                  value={labName}
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Doctor</Text>
                <TextInput
                  onChangeText={setDoctorName}
                  placeholder="Dr. Chen"
                  placeholderTextColor={withAlpha(MD_TEXT_TERTIARY, 0.45)}
                  style={styles.formInput}
                  value={doctorName}
                />
              </View>
            </View>

            <Pressable onPress={handleSaveLab} style={styles.saveLabButton}>
              <Text style={styles.saveLabButtonText}>Save lab result</Text>
            </Pressable>
          </GlassCard>
        ) : null}
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Average Glucose Conversion" />
        <GlassCard intensity={14} padding={18} style={styles.tableCard}>
          {CONVERSION_ROWS.map((row) => (
            <View key={row.a1c} style={styles.tableRow}>
              <Text style={styles.tableLabel}>{row.average} mg/dL</Text>
              <Text style={styles.tableValue}>{row.a1c.toFixed(1)}%</Text>
            </View>
          ))}
        </GlassCard>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Factors Affecting A1c" />
        <GlassCard intensity={14} padding={18} style={styles.factorsCard}>
          <View style={styles.factorRow}>
            <MaterialSymbol color={MD_ACCENT_LIGHT} name="medication" size={18} />
            <Text style={styles.factorText}>Medication changes can move A1c faster than trend charts suggest.</Text>
          </View>
          <View style={styles.factorRow}>
            <MaterialSymbol color={MD_ACCENT_LIGHT} name="restaurant_menu" size={18} />
            <Text style={styles.factorText}>Diet consistency matters most when post-meal readings trend above target.</Text>
          </View>
          <View style={styles.factorRow}>
            <MaterialSymbol color={MD_ACCENT_LIGHT} name="favorite" size={18} />
            <Text style={styles.factorText}>Exercise improves insulin sensitivity and lowers average glucose over time.</Text>
          </View>
        </GlassCard>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Insights" />
        <GlassCard intensity={14} padding={18} style={styles.insightsCard}>
          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Trend direction</Text>
            <Text style={styles.insightValue}>{trendDirection}</Text>
          </View>
          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>90-day avg glucose</Text>
            <Text style={styles.insightValue}>{averageGlucose.toFixed(1)} mg/dL</Text>
          </View>
          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Estimate gap vs latest lab</Text>
            <Text style={styles.insightValue}>{estimateGap === null ? '--' : `${estimateGap > 0 ? '+' : ''}${estimateGap}%`}</Text>
          </View>
          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Estimate refresh</Text>
            <Text style={styles.insightValue}>On next glucose reading</Text>
          </View>
        </GlassCard>
      </View>

      <Text style={styles.disclaimer}>
        Estimated A1c is directional only. Use lab-confirmed results for clinical decisions.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 20,
    padding: 20,
    paddingBottom: 110,
  },
  heroCard: {
    backgroundColor: withAlpha(MD_SURFACES.lowest, 0.72),
    borderRadius: 24,
    gap: 18,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroLayout: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  heroRing: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 3,
    height: 134,
    justifyContent: 'center',
    width: 134,
  },
  heroValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 42,
    fontVariant: ['tabular-nums'],
    lineHeight: 44,
  },
  heroValueUnit: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
    marginTop: 4,
  },
  heroCopy: {
    flex: 1,
    gap: 10,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBadgeText: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  heroBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  confidenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  confidenceLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  confidenceValue: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  sectionWrap: {
    gap: 14,
  },
  chartCard: {
    gap: 10,
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  chartEmptyText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  addLabButton: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.12),
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addLabButtonText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  formCard: {
    gap: 14,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formField: {
    flex: 1,
    gap: 8,
  },
  formLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  formInput: {
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: MD_CARD_RADIUS,
    color: MD_TEXT,
    fontFamily: MD_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  saveLabButton: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.18),
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  saveLabButtonText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  tableCard: {
    gap: 10,
  },
  tableRow: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tableLabel: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  tableValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  factorsCard: {
    gap: 12,
  },
  factorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  factorText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    flex: 1,
  },
  insightsCard: {
    gap: 12,
  },
  insightRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  insightLabel: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    flex: 1,
  },
  insightValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  disclaimer: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 24,
    gap: 10,
    marginTop: 32,
  },
  emptyTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
    textAlign: 'center',
  },
  emptyBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
});
