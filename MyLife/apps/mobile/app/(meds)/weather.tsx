import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import {
  createWeatherLink,
  getCurrentWeather,
  getTriggerAlerts,
  getWeatherCorrelationPoints,
  getWeatherCorrelations,
  getWeatherHistory,
  getWeatherSymptomLinks,
  type WeatherFactorKey,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  SectionHeader,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const FACTOR_OPTIONS: Array<{
  key: WeatherFactorKey;
  label: string;
  unit: string;
}> = [
  { key: 'pressure', label: 'Pressure', unit: 'mb' },
  { key: 'humidity', label: 'Humidity', unit: '%' },
  { key: 'temperature', label: 'Temp', unit: '°C' },
  { key: 'wind', label: 'Wind', unit: 'km/h' },
] as const;

function formatWeatherMetric(
  value: number | null | undefined,
  unit: string,
): string {
  if (value == null) {
    return '--';
  }

  return `${Math.round(value)}${unit}`;
}

function ScatterPlot({
  factor,
  points,
}: {
  factor: WeatherFactorKey;
  points: Array<{
    severity: number;
    pressure: number | null;
    temperature: number | null;
    humidity: number | null;
    wind: number | null;
  }>;
}) {
  const width = 300;
  const height = 190;
  const padding = 20;
  const selectedValues = points
    .map((point) => point[factor])
    .filter((value): value is number => value != null);

  if (selectedValues.length === 0) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.emptyBody}>Link symptoms to weather snapshots to populate the scatter plot.</Text>
      </View>
    );
  }

  const minValue = Math.min(...selectedValues);
  const maxValue = Math.max(...selectedValues);
  const range = Math.max(1, maxValue - minValue);

  return (
    <View style={styles.chartWrap}>
      <Svg height={height} width={width}>
        <Line
          stroke={withAlpha(MD_TEXT_TERTIARY, 0.24)}
          strokeWidth={1}
          x1={padding}
          x2={width - padding}
          y1={height - padding}
          y2={height - padding}
        />
        <Line
          stroke={withAlpha(MD_TEXT_TERTIARY, 0.24)}
          strokeWidth={1}
          x1={padding}
          x2={padding}
          y1={padding}
          y2={height - padding}
        />
        {points.map((point, index) => {
          const rawValue = point[factor];
          if (rawValue == null) {
            return null;
          }

          const x = padding + ((rawValue - minValue) / range) * (width - padding * 2);
          const y = (height - padding) - ((point.severity - 1) / 4) * (height - padding * 2);

          return (
            <Circle
              cx={x}
              cy={y}
              fill={MD_ACCENT}
              key={`${factor}-${index}`}
              opacity={0.8}
              r={4}
            />
          );
        })}
        <SvgText fill={MD_TEXT_TERTIARY} fontSize="10" x={padding} y={height - 4}>
          Low
        </SvgText>
        <SvgText fill={MD_TEXT_TERTIARY} fontSize="10" textAnchor="end" x={width - padding} y={height - 4}>
          High
        </SvgText>
        <SvgText fill={MD_TEXT_TERTIARY} fontSize="10" x={padding - 10} y={padding + 4}>
          5
        </SvgText>
        <SvgText fill={MD_TEXT_TERTIARY} fontSize="10" x={padding - 10} y={height - padding + 4}>
          1
        </SvgText>
      </Svg>
    </View>
  );
}

export default function WeatherScreen() {
  const db = useDatabase();
  const [selectedFactor, setSelectedFactor] = useState<WeatherFactorKey>('pressure');
  const [pressureDropThreshold, setPressureDropThreshold] = useState(3);
  const [humidityThreshold, setHumidityThreshold] = useState(70);
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    setRefreshTick((value) => value + 1);
  }, []));

  const data = useMemo(() => {
    try {
      const latest = getCurrentWeather(db);
      const history = getWeatherHistory(db, 7);
      const alerts = getTriggerAlerts(db, undefined, new Date().toISOString());
      const correlations = getWeatherCorrelations(db, undefined, new Date().toISOString());
      const points = getWeatherCorrelationPoints(db, undefined, new Date().toISOString());
      const links = getWeatherSymptomLinks(db);
      const recentSymptoms = db.query<{
        symptom_log_id: string;
        symptom_name: string;
        severity: number;
        logged_at: string;
        is_linked: number;
      }>(
        `SELECT
          sl.id as symptom_log_id,
          s.name as symptom_name,
          sl.severity,
          sl.logged_at,
          EXISTS(SELECT 1 FROM md_weather_symptom_links link WHERE link.symptom_log_id = sl.id) as is_linked
         FROM md_symptom_logs sl
         JOIN md_symptoms s ON s.id = sl.symptom_id
         ORDER BY sl.logged_at DESC
         LIMIT 6`,
      );
      return {
        latest,
        history,
        alerts,
        correlations,
        points,
        links,
        recentSymptoms,
        error: null as string | null,
      };
    } catch {
      return {
        latest: null,
        history: [],
        alerts: [],
        correlations: [],
        points: [],
        links: [],
        recentSymptoms: [],
        error: 'Weather correlations could not be loaded.',
      };
    }
  }, [db, refreshTick]);

  const filteredAlerts = data.alerts.filter((alert) => {
    if (alert.id.includes('pressure')) {
      return true;
    }
    if (alert.id.includes('humidity')) {
      return true;
    }
    return true;
  }).filter((alert) => {
    if (alert.id === 'pressure-drop' && data.latest?.pressureChange3h != null) {
      return Math.abs(data.latest.pressureChange3h) >= pressureDropThreshold;
    }
    if (alert.id === 'humidity-spike' && data.latest?.humidityPercent != null) {
      return data.latest.humidityPercent >= humidityThreshold;
    }
    return true;
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 350);
  };

  const handleLinkLatestWeather = (symptomLogId: string) => {
    if (!data.latest) {
      Alert.alert('No weather snapshot', 'Weather must be captured before it can be linked to a symptom.');
      return;
    }

    try {
      createWeatherLink(db, uuid(), data.latest.id, symptomLogId);
      setRefreshTick((value) => value + 1);
    } catch {
      Alert.alert('Link failed', 'The symptom could not be linked to the latest weather snapshot.');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} tintColor={MD_ACCENT_LIGHT} />}
      style={styles.screen}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Environment & Triggers</Text>
        <Text style={styles.title}>Weather Correlation</Text>
        <Text style={styles.subtitle}>
          Pull down to refresh local weather-linked symptoms and re-run the trigger analysis.
        </Text>
      </View>

      <GlassCard padding={22} style={styles.heroCard}>
        <View style={styles.heroCardTop}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroLabel}>Current Conditions</Text>
            <Text style={styles.heroValue}>
              {formatWeatherMetric(data.latest?.temperatureC ?? null, '°')}
            </Text>
            <Text style={styles.heroDescription}>
              {data.latest?.weatherDescription ?? 'No live weather description'}
            </Text>
          </View>
          <View style={styles.heroIconWrap}>
            <MaterialSymbol color={MD_ACCENT_LIGHT} name="partly_cloudy_day" size={44} />
          </View>
        </View>
        <View style={styles.metricGrid}>
          <View style={styles.metricTile}>
            <Text style={styles.metricLabel}>Pressure</Text>
            <Text style={styles.metricValue}>{formatWeatherMetric(data.latest?.pressureMb ?? null, 'mb')}</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricLabel}>Humidity</Text>
            <Text style={styles.metricValue}>{formatWeatherMetric(data.latest?.humidityPercent ?? null, '%')}</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricLabel}>UV</Text>
            <Text style={styles.metricValue}>--</Text>
          </View>
          <View style={styles.metricTile}>
            <Text style={styles.metricLabel}>Pollen</Text>
            <Text style={styles.metricValue}>--</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader
          action={<Text style={styles.sectionMeta}>Alerts</Text>}
          title="Trigger Alerts"
        />
        <View style={styles.thresholdRow}>
          <Pressable onPress={() => setPressureDropThreshold((value) => Math.max(1, value - 1))} style={styles.thresholdButton}>
            <Text style={styles.thresholdButtonLabel}>Pressure -</Text>
          </Pressable>
          <Text style={styles.thresholdLabel}>{pressureDropThreshold} mb drop</Text>
          <Pressable onPress={() => setPressureDropThreshold((value) => Math.min(8, value + 1))} style={styles.thresholdButton}>
            <Text style={styles.thresholdButtonLabel}>Pressure +</Text>
          </Pressable>
        </View>
        <View style={styles.thresholdRow}>
          <Pressable onPress={() => setHumidityThreshold((value) => Math.max(40, value - 5))} style={styles.thresholdButton}>
            <Text style={styles.thresholdButtonLabel}>Humidity -</Text>
          </Pressable>
          <Text style={styles.thresholdLabel}>{humidityThreshold}% humidity</Text>
          <Pressable onPress={() => setHumidityThreshold((value) => Math.min(95, value + 5))} style={styles.thresholdButton}>
            <Text style={styles.thresholdButtonLabel}>Humidity +</Text>
          </Pressable>
        </View>
        <View style={styles.listGap}>
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => (
              <View key={alert.id} style={styles.alertRow}>
                <View style={[styles.alertDot, { backgroundColor: alert.level === 'high' ? '#FF453A' : alert.level === 'medium' ? '#FFB877' : MD_ACCENT_LIGHT }]} />
                <View style={styles.alertCopy}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertBody}>{alert.detail}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyBody}>
              No active triggers are firing against the thresholds you selected.
            </Text>
          )}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader
          action={<Text style={styles.sectionMeta}>Scatter</Text>}
          title="Symptom vs Weather"
        />
        <View style={styles.factorRow}>
          {FACTOR_OPTIONS.map((option) => {
            const active = option.key === selectedFactor;
            return (
              <Pressable
                key={option.key}
                onPress={() => setSelectedFactor(option.key)}
                style={[styles.factorChip, active ? styles.factorChipActive : null]}
              >
                <Text style={[styles.factorLabel, { color: active ? MD_SURFACES.lowest : MD_TEXT_SECONDARY }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <ScatterPlot factor={selectedFactor} points={data.points} />
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader
          action={<Text style={styles.sectionMeta}>Historical Pattern</Text>}
          title="Correlation Highlights"
        />
        <View style={styles.listGap}>
          {data.correlations.length > 0 ? (
            data.correlations.slice(0, 3).map((correlation) => (
              <View key={correlation.factor} style={styles.patternCard}>
                <Text style={styles.patternTitle}>
                  {correlation.factor === 'pressure' ? 'Pressure' : correlation.factor === 'temperature' ? 'Temperature' : correlation.factor === 'humidity' ? 'Humidity' : 'Wind'}
                </Text>
                <Text style={styles.patternBody}>
                  Symptoms are {correlation.multiplier.toFixed(1)}x more likely when this factor trends {correlation.coefficient > 0 ? 'higher' : 'lower'} than usual.
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyBody}>
              MyMeds needs at least 10 linked symptom-weather data points before it can rank correlations.
            </Text>
          )}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader
          action={<Text style={styles.sectionMeta}>7-Day Strip</Text>}
          title="Recent Weather Risk"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.forecastRow}>
            {data.history.map((snapshot, index) => {
              const date = new Date(snapshot.capturedAt);
              const risk = (
                (snapshot.pressureChange3h != null && Math.abs(snapshot.pressureChange3h) >= pressureDropThreshold)
                || (snapshot.humidityPercent != null && snapshot.humidityPercent >= humidityThreshold)
              );
              return (
                <View key={`${snapshot.id}-${index}`} style={styles.forecastTile}>
                  <Text style={styles.forecastDay}>
                    {date.toLocaleDateString(undefined, { weekday: 'short' })}
                  </Text>
                  <MaterialSymbol color={risk ? '#FFB877' : MD_ACCENT_LIGHT} name={risk ? 'warning' : 'cloud'} size={20} />
                  <Text style={styles.forecastTemp}>{formatWeatherMetric(snapshot.temperatureC, '°')}</Text>
                  <Text style={styles.forecastRisk}>{risk ? 'Risk' : 'Stable'}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader
          action={<Text style={styles.sectionMeta}>{data.links.length} links</Text>}
          title="Symptom-Weather Links"
        />
        <View style={styles.listGap}>
          {data.recentSymptoms.length > 0 ? (
            data.recentSymptoms.map((symptom) => (
              <View key={symptom.symptom_log_id} style={styles.linkRow}>
                <View style={styles.linkCopy}>
                  <Text style={styles.linkTitle}>{symptom.symptom_name}</Text>
                  <Text style={styles.linkMeta}>
                    Severity {symptom.severity}/5 • {new Date(symptom.logged_at).toLocaleString()}
                  </Text>
                </View>
                {symptom.is_linked ? (
                  <Text style={styles.linkBadge}>Linked</Text>
                ) : (
                  <Pressable
                    onPress={() => handleLinkLatestWeather(symptom.symptom_log_id)}
                    style={styles.linkButton}
                  >
                    <Text style={styles.linkButtonLabel}>Link latest weather</Text>
                  </Pressable>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyBody}>
              No symptom logs yet. Log symptoms elsewhere in MyMeds, then link them to weather here.
            </Text>
          )}
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 18,
  },
  hero: {
    gap: 8,
    paddingTop: 4,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  title: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 38,
    lineHeight: 42,
  },
  subtitle: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  heroCard: {
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
  },
  heroCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroMetric: {
    flex: 1,
    gap: 4,
  },
  heroLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroValue: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 42,
    lineHeight: 46,
  },
  heroDescription: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    textTransform: 'capitalize',
  },
  heroIconWrap: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT_LIGHT, 0.12),
    borderRadius: 20,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
  },
  metricTile: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexBasis: '47%',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metricLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  metricValue: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
  },
  sectionMeta: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  thresholdRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  thresholdButton: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  thresholdButtonLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT_SECONDARY,
  },
  thresholdLabel: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT,
    flex: 1,
    textAlign: 'center',
  },
  listGap: {
    gap: 12,
    marginTop: 18,
  },
  alertRow: {
    alignItems: 'flex-start',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  alertDot: {
    borderRadius: 999,
    height: 10,
    marginTop: 6,
    width: 10,
  },
  alertCopy: {
    flex: 1,
    gap: 4,
  },
  alertTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  alertBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  factorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  factorChip: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  factorChipActive: {
    backgroundColor: MD_ACCENT,
  },
  factorLabel: {
    ...MD_TYPOGRAPHY.titleMd,
  },
  chartWrap: {
    alignItems: 'center',
    marginTop: 18,
  },
  chartEmpty: {
    marginTop: 18,
  },
  patternCard: {
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
    borderRadius: 18,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  patternTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  patternBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  forecastRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  forecastTile: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    gap: 8,
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  forecastDay: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  forecastTemp: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  forecastRisk: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  linkRow: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  linkCopy: {
    flex: 1,
    gap: 4,
  },
  linkTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    textTransform: 'capitalize',
  },
  linkMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
  },
  linkBadge: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  linkButton: {
    backgroundColor: withAlpha(MD_ACCENT, 0.16),
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkButtonLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_ACCENT_LIGHT,
    fontSize: 13,
    lineHeight: 16,
  },
  emptyBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
});
