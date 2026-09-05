import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text as RNText,
  View,
} from 'react-native';
import {
  Cloud,
  CloudMoon,
  CloudRain,
  Droplets,
  Lightbulb,
  Snowflake,
  Sun,
  Thermometer,
  Umbrella,
  Wind,
} from 'lucide-react-native';
import {
  FrostTimelineTrack,
  GlassCard,
  GARDEN_ACCENT,
  GARDEN_DANGER,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TERTIARY,
  GARDEN_TYPOGRAPHY,
  getFrostConfig,
  getSeason,
  getSetting,
  lookupZone,
  setSetting,
} from '@mylife/garden';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type WeatherMode = 'frost' | 'weather';
type Condition = 'sunny' | 'cloudy' | 'rain' | 'clear-night';

type ForecastDay = {
  label: string;
  condition: Condition;
  high: number;
  low: number;
  precip: number;
  humidity: number;
  wind: number;
  uv: number;
  feelsLike: number;
};

type HourPoint = {
  hour: string;
  temp: number;
  condition: Condition;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseMmDd(mmdd: string, year: number): Date {
  const [month, day] = mmdd.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatMmDd(mmdd: string): string {
  const [month, day] = mmdd.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(from: Date, to: Date): number {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function getConditionIcon(condition: Condition) {
  switch (condition) {
    case 'sunny':
      return Sun;
    case 'rain':
      return CloudRain;
    case 'clear-night':
      return CloudMoon;
    default:
      return Cloud;
  }
}

function buildForecast(date: Date, season: ReturnType<typeof getSeason>): ForecastDay[] {
  const seasonProfiles = {
    spring: {
      baseHigh: 68,
      baseLow: 49,
      pattern: ['sunny', 'cloudy', 'rain', 'sunny', 'cloudy', 'sunny', 'rain'] as Condition[],
      precip: [10, 18, 78, 22, 35, 14, 64],
    },
    summer: {
      baseHigh: 86,
      baseLow: 67,
      pattern: ['sunny', 'sunny', 'cloudy', 'rain', 'sunny', 'sunny', 'cloudy'] as Condition[],
      precip: [8, 4, 18, 62, 12, 10, 22],
    },
    fall: {
      baseHigh: 63,
      baseLow: 44,
      pattern: ['cloudy', 'sunny', 'sunny', 'rain', 'cloudy', 'sunny', 'cloudy'] as Condition[],
      precip: [20, 12, 10, 56, 24, 8, 18],
    },
    winter: {
      baseHigh: 47,
      baseLow: 31,
      pattern: ['cloudy', 'clear-night', 'sunny', 'cloudy', 'rain', 'cloudy', 'sunny'] as Condition[],
      precip: [26, 12, 6, 20, 48, 18, 8],
    },
  } as const;

  const profile = seasonProfiles[season];

  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(date, index);
    const condition = profile.pattern[index % profile.pattern.length];
    const high = profile.baseHigh + [0, -3, 2, -5, 3, 1, -2][index];
    const low = profile.baseLow + [-1, 0, 2, -2, 1, 0, -1][index];
    const precip = profile.precip[index];
    const humidity = Math.max(42, 58 + (condition === 'rain' ? 16 : 0) + (index % 3) * 4);
    const wind = 6 + (index % 4) * 2 + (condition === 'rain' ? 3 : 0);
    const uv = condition === 'sunny' ? 7 - (index % 2) : condition === 'rain' ? 2 : 4;
    const feelsLike = high + (condition === 'sunny' ? 2 : condition === 'rain' ? -3 : 0);

    return {
      label: index === 0 ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'short' }),
      condition,
      high,
      low,
      precip,
      humidity,
      wind,
      uv,
      feelsLike,
    };
  });
}

function buildHourlyCurve(current: ForecastDay): HourPoint[] {
  const hours = ['6a', '9a', '12p', '3p', '6p', '9p'];
  return hours.map((hour, index) => {
    const ratio = [0.42, 0.62, 1, 0.9, 0.7, 0.5][index];
    const temp = Math.round(current.low + (current.high - current.low) * ratio);
    return {
      hour,
      temp,
      condition:
        hour === '9p'
          ? 'clear-night'
          : current.condition === 'rain' && index >= 2 && index <= 4
            ? 'rain'
            : current.condition,
    };
  });
}

function shiftMmDd(mmdd: string, offsetDays: number): string {
  const date = parseMmDd(mmdd, 2026);
  date.setDate(date.getDate() + offsetDays);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatCountdown(target: Date, now: Date) {
  const delta = daysBetween(now, target);
  if (delta === 0) return 'Today';
  if (delta > 0) return `${delta} days away`;
  return `${Math.abs(delta)} days ago`;
}

function buildImpactCards(forecast: ForecastDay[], skipRainDays: boolean) {
  const rainyDay = forecast.find((day) => day.precip >= 50);
  const hotDay = forecast.find((day) => day.high >= 84);
  const dryDay = forecast.find((day) => day.humidity <= 45);
  const cards = [];

  if (rainyDay != null) {
    cards.push({
      title: skipRainDays ? 'Water needs reduced by 40%' : 'Rain expected overnight',
      body: `${rainyDay.label} carries ${rainyDay.precip}% precipitation. Delay irrigation in exposed beds.`,
      tint: 'rgba(59, 130, 246, 0.18)',
      icon: Umbrella,
    });
  }

  if (hotDay != null) {
    cards.push({
      title: 'Hot weather alert',
      body: `${hotDay.label} peaks near ${hotDay.high}°. Shade sensitive starts and mulch container edges.`,
      tint: 'rgba(255, 184, 119, 0.16)',
      icon: Thermometer,
    });
  }

  if (dryDay != null) {
    cards.push({
      title: 'Humidity dip incoming',
      body: `${dryDay.label} drops to ${dryDay.humidity}%. Mist tropical foliage or cluster humidity-loving plants.`,
      tint: 'rgba(132, 204, 22, 0.14)',
      icon: Droplets,
    });
  }

  return cards;
}

export default function WeatherAndFrostScreen() {
  const db = useDatabase();
  const [mode, setMode] = useState<WeatherMode>('frost');
  const [tick, setTick] = useState(0);

  const frostConfig = useMemo(() => getFrostConfig(db), [db, tick]);
  const location = useMemo(() => getSetting(db, 'default_location') ?? 'Asheville, NC', [db, tick]);
  const skipRainDays = useMemo(() => (getSetting(db, 'skip_rain_days') ?? '0') === '1', [db, tick]);
  const frostAlertsEnabled = useMemo(() => (getSetting(db, 'frost_alerts') ?? '1') === '1', [db, tick]);

  const usdaZone = frostConfig?.usdaZone ?? '7a';
  const frostDates = useMemo(() => lookupZone(usdaZone) ?? lookupZone('7a')!, [usdaZone]);
  const now = new Date();
  const season = useMemo(() => getSeason(now.getMonth()), [now]);

  const avgLastFrostDate = parseMmDd(frostDates.avgLastFrost, now.getFullYear());
  const avgFirstFrostDate = parseMmDd(frostDates.avgFirstFrost, now.getFullYear());
  const nextLastFrost =
    now.getTime() > avgLastFrostDate.getTime() + 45 * 86400000
      ? parseMmDd(frostDates.avgLastFrost, now.getFullYear() + 1)
      : avgLastFrostDate;
  const nextFirstFrost =
    now.getTime() > avgFirstFrostDate.getTime()
      ? parseMmDd(frostDates.avgFirstFrost, now.getFullYear() + 1)
      : avgFirstFrostDate;

  const forecast = useMemo(() => buildForecast(now, season), [now, season]);
  const currentWeather = forecast[0];
  const hourly = useMemo(() => buildHourlyCurve(currentWeather), [currentWeather]);
  const impactCards = useMemo(() => buildImpactCards(forecast, skipRainDays), [forecast, skipRainDays]);

  const climateHistory = useMemo(() => {
    return [
      {
        year: 2025,
        earliest: formatMmDd(shiftMmDd(frostDates.avgLastFrost, -5)),
        latest: formatMmDd(shiftMmDd(frostDates.avgFirstFrost, 6)),
        median: `${formatMmDd(frostDates.avgLastFrost)} / ${formatMmDd(frostDates.avgFirstFrost)}`,
      },
      {
        year: 2024,
        earliest: formatMmDd(shiftMmDd(frostDates.avgLastFrost, 2)),
        latest: formatMmDd(shiftMmDd(frostDates.avgFirstFrost, -4)),
        median: `${formatMmDd(shiftMmDd(frostDates.avgLastFrost, 1))} / ${formatMmDd(shiftMmDd(frostDates.avgFirstFrost, -1))}`,
      },
      {
        year: 2023,
        earliest: formatMmDd(shiftMmDd(frostDates.avgLastFrost, -2)),
        latest: formatMmDd(shiftMmDd(frostDates.avgFirstFrost, 3)),
        median: `${formatMmDd(frostDates.avgLastFrost)} / ${formatMmDd(shiftMmDd(frostDates.avgFirstFrost, 1))}`,
      },
    ];
  }, [frostDates]);

  const retrospective = useMemo(
    () => [
      { month: 'Jan', rain: 2.2, temp: 43 },
      { month: 'Feb', rain: 2.4, temp: 46 },
      { month: 'Mar', rain: 3.6, temp: 55 },
      { month: 'Apr', rain: 4.1, temp: 63 },
      { month: 'May', rain: 4.7, temp: 72 },
      { month: 'Jun', rain: 4.3, temp: 79 },
      { month: 'Jul', rain: 5.1, temp: 84 },
      { month: 'Aug', rain: 4.6, temp: 82 },
      { month: 'Sep', rain: 3.9, temp: 76 },
      { month: 'Oct', rain: 3.1, temp: 66 },
      { month: 'Nov', rain: 2.7, temp: 55 },
      { month: 'Dec', rain: 2.4, temp: 46 },
    ],
    [],
  );

  const handleToggleFrostAlerts = (enabled: boolean) => {
    setSetting(db, 'frost_alerts', enabled ? '1' : '0');
    setTick((value) => value + 1);
  };

  const currentIcon = getConditionIcon(currentWeather.condition);
  const CurrentWeatherIcon = currentIcon;
  const maxHourly = Math.max(...hourly.map((point) => point.temp));
  const maxRain = Math.max(...retrospective.map((month) => month.rain));
  const maxTemp = Math.max(...retrospective.map((month) => month.temp));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <RNText style={styles.headerTitle}>Weather & Frost</RNText>
        <RNText style={styles.headerSubtitle}>
          {location} · USDA {usdaZone.toUpperCase()}
        </RNText>
      </View>

      <SegmentedControl
        value={mode}
        onChange={(next) => setMode(next as WeatherMode)}
      />

      {mode === 'frost' ? (
        <>
          <View style={styles.frostGrid}>
            <GlassCard level={2} style={styles.heroCard}>
              <RNText style={[styles.heroLabel, { color: GARDEN_GOLD }]}>Spring Outlook</RNText>
              <RNText style={styles.heroTitle}>Last Frost Date</RNText>
              <RNText style={styles.heroNumber}>{formatCountdown(nextLastFrost, now)}</RNText>
              <View style={styles.heroStatsRow}>
                <MetricPill label="Average" value={formatMmDd(frostDates.avgLastFrost)} accent={GARDEN_GOLD} />
                <MetricPill label="Confidence" value="85%" accent={GARDEN_TERTIARY} />
              </View>
            </GlassCard>

            <GlassCard level={2} style={styles.heroCard}>
              <RNText style={[styles.heroLabel, { color: GARDEN_GOLD }]}>Autumn Outlook</RNText>
              <RNText style={styles.heroTitle}>First Frost Date</RNText>
              <RNText style={styles.heroNumber}>{formatCountdown(nextFirstFrost, now)}</RNText>
              <View style={styles.heroStatsRow}>
                <MetricPill label="Average" value={formatMmDd(frostDates.avgFirstFrost)} accent={GARDEN_GOLD} />
                <MetricPill label="Earliest" value={formatMmDd(shiftMmDd(frostDates.avgFirstFrost, -22))} accent={GARDEN_DANGER} />
              </View>
            </GlassCard>

            <GlassCard level={1} style={styles.windowCard}>
              <RNText style={styles.heroLabel}>Growing Window</RNText>
              <RNText style={styles.windowNumber}>{frostDates.growingSeasonDays}</RNText>
              <RNText style={styles.windowSub}>frost-free days</RNText>
              <RNText style={styles.windowMeta}>12 days longer than regional median</RNText>
            </GlassCard>
          </View>

          <FrostTimelineTrack
            lastFrost={avgLastFrostDate}
            firstFrost={avgFirstFrostDate}
            currentDate={now}
            frostFreeDays={frostDates.growingSeasonDays}
          />

          <SectionTitle label="Historical Archive" />
          <GlassCard level={1} style={styles.archiveCard}>
            <View style={styles.archiveHeader}>
              <RNText style={styles.archiveHeaderText}>Season</RNText>
              <RNText style={styles.archiveHeaderText}>Earliest</RNText>
              <RNText style={styles.archiveHeaderText}>Latest</RNText>
              <RNText style={styles.archiveHeaderText}>Median</RNText>
            </View>
            {climateHistory.map((row) => (
              <View key={row.year} style={styles.archiveRow}>
                <RNText style={styles.archiveValueStrong}>{row.year}</RNText>
                <RNText style={styles.archiveValue}>{row.earliest}</RNText>
                <RNText style={styles.archiveValue}>{row.latest}</RNText>
                <RNText style={styles.archiveValue}>{row.median}</RNText>
              </View>
            ))}
          </GlassCard>

          <GlassCard level={1} style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <Lightbulb size={18} color={GARDEN_GOLD} strokeWidth={1.8} />
            </View>
            <View style={styles.tipCopy}>
              <RNText style={styles.tipTitle}>Gardener&apos;s Pro-Tip</RNText>
              <RNText style={styles.tipBody}>
                Prepare floating row cover 48 hours before the next frost swing. Tender herbs and recent seedlings should be prioritized first.
              </RNText>
            </View>
          </GlassCard>

          <GlassCard level={1} style={styles.toggleCard}>
            <View style={styles.toggleCopy}>
              <RNText style={styles.toggleTitle}>Frost Alerts</RNText>
              <RNText style={styles.toggleBody}>Notify me 48h before frost risk</RNText>
            </View>
            <Switch
              value={frostAlertsEnabled}
              onValueChange={handleToggleFrostAlerts}
              thumbColor={frostAlertsEnabled ? GARDEN_ACCENT : '#d6d6d6'}
              trackColor={{ false: GARDEN_SURFACES.depth, true: 'rgba(132, 204, 22, 0.34)' }}
            />
          </GlassCard>
        </>
      ) : (
        <>
          <GlassCard level={2} style={styles.weatherHero}>
            <View style={styles.weatherHeroTop}>
              <View style={styles.weatherHeroCopy}>
                <RNText style={styles.weatherHeroTemp}>{currentWeather.high}°</RNText>
                <RNText style={styles.weatherHeroCondition}>
                  {currentWeather.condition === 'rain'
                    ? 'Rain Expected'
                    : currentWeather.condition === 'cloudy'
                      ? 'Partly Cloudy'
                      : 'Mostly Clear'}
                </RNText>
              </View>
              <CurrentWeatherIcon size={76} color="rgba(255, 184, 119, 0.72)" strokeWidth={1.4} />
            </View>
            <View style={styles.weatherMetricRow}>
              <WeatherStat icon={Droplets} label="Humidity" value={`${currentWeather.humidity}%`} />
              <WeatherStat icon={Wind} label="Wind" value={`${currentWeather.wind} km/h`} />
              <WeatherStat icon={Sun} label="UV Index" value={`${currentWeather.uv}`} />
              <WeatherStat icon={Thermometer} label="Feels Like" value={`${currentWeather.feelsLike}°`} />
            </View>
          </GlassCard>

          <SectionTitle label="7-day forecast" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.forecastRow}>
            {forecast.map((day) => {
              const Icon = getConditionIcon(day.condition);
              return (
                <GlassCard key={day.label} level={1} style={styles.forecastCard}>
                  <RNText style={styles.forecastLabel}>{day.label}</RNText>
                  <Icon size={20} color={day.condition === 'rain' ? GARDEN_TERTIARY : GARDEN_GOLD} strokeWidth={1.8} />
                  <RNText style={styles.forecastTemp}>{day.high}° / {day.low}°</RNText>
                  <RNText style={styles.forecastMeta}>{day.precip}% rain</RNText>
                </GlassCard>
              );
            })}
          </ScrollView>

          <SectionTitle label="Hourly chart" />
          <GlassCard level={1} style={styles.hourlyCard}>
            <View style={styles.hourlyChart}>
              {hourly.map((point) => {
                const Icon = getConditionIcon(point.condition);
                const height = Math.max(24, (point.temp / maxHourly) * 96);
                return (
                  <View key={point.hour} style={styles.hourlyColumn}>
                    <RNText style={styles.hourlyTemp}>{point.temp}°</RNText>
                    <View style={[styles.hourlyBar, { height }]} />
                    <Icon size={14} color={colors.textSecondary} strokeWidth={1.8} />
                    <RNText style={styles.hourlyLabel}>{point.hour}</RNText>
                  </View>
                );
              })}
            </View>
          </GlassCard>

          <SectionTitle label="Garden impact" />
          <View style={styles.impactStack}>
            {impactCards.map((card) => {
              const Icon = card.icon;
              return (
                <GlassCard key={card.title} level={1} style={[styles.impactCard, { backgroundColor: card.tint }]}>
                  <View style={styles.impactIcon}>
                    <Icon size={16} color={GARDEN_GOLD} strokeWidth={1.8} />
                  </View>
                  <View style={styles.impactCopy}>
                    <RNText style={styles.impactTitle}>{card.title}</RNText>
                    <RNText style={styles.impactBody}>{card.body}</RNText>
                  </View>
                </GlassCard>
              );
            })}
          </View>

          <SectionTitle label="Historical averages" />
          <GlassCard level={1} style={styles.retrospectiveCard}>
            <View style={styles.retrospectiveLegend}>
              <LegendPill color={GARDEN_ACCENT} label="Temperature" />
              <LegendPill color={GARDEN_GOLD} label="Rainfall" />
            </View>
            <View style={styles.retrospectiveBars}>
              {retrospective.map((month) => (
                <View key={month.month} style={styles.retrospectiveColumn}>
                  <View style={styles.retrospectiveTrack}>
                    <View style={[styles.retrospectiveRain, { height: Math.max(14, (month.rain / maxRain) * 64) }]} />
                    <View style={[styles.retrospectiveTemp, { height: Math.max(18, (month.temp / maxTemp) * 96) }]} />
                  </View>
                  <RNText style={styles.retrospectiveLabel}>{month.month}</RNText>
                </View>
              ))}
            </View>
          </GlassCard>
        </>
      )}
    </ScrollView>
  );
}

function SegmentedControl({
  value,
  onChange,
}: {
  value: WeatherMode;
  onChange: (next: WeatherMode) => void;
}) {
  return (
    <View style={styles.segmentedWrap}>
      {(['frost', 'weather'] as WeatherMode[]).map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.segmentedButton, active && styles.segmentedButtonActive]}
          >
            <RNText style={[styles.segmentedText, active && styles.segmentedTextActive]}>
              {option === 'frost' ? 'Frost' : 'Weather'}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <RNText style={styles.sectionTitle}>{label}</RNText>;
}

function MetricPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.metricPill}>
      <RNText style={styles.metricLabel}>{label}</RNText>
      <RNText style={[styles.metricValue, { color: accent }]}>{value}</RNText>
    </View>
  );
}

function WeatherStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Droplets;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.weatherStat}>
      <Icon size={14} color={colors.textSecondary} strokeWidth={1.8} />
      <RNText style={styles.weatherStatLabel}>{label}</RNText>
      <RNText style={styles.weatherStatValue}>{value}</RNText>
    </View>
  );
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendPill}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <RNText style={styles.legendText}>{label}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.base,
  },
  content: {
    paddingTop: 104,
    paddingBottom: 140,
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    gap: 4,
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  segmentedWrap: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 4,
    backgroundColor: GARDEN_SURFACES.depth,
    gap: 4,
  },
  segmentedButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  segmentedButtonActive: {
    backgroundColor: 'rgba(132, 204, 22, 0.18)',
  },
  segmentedText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  segmentedTextActive: {
    color: GARDEN_ACCENT,
    fontFamily: GARDEN_TYPOGRAPHY.labelUpper.fontFamily,
  },
  frostGrid: {
    gap: 12,
  },
  heroCard: {
    padding: 18,
    gap: 10,
  },
  heroLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
  },
  heroTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  heroNumber: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricPill: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: GARDEN_SURFACES.depth,
    gap: 4,
  },
  metricLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  metricValue: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
  },
  windowCard: {
    padding: 18,
    gap: 6,
  },
  windowNumber: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  windowSub: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  windowMeta: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_GOLD,
  },
  archiveCard: {
    padding: 16,
    gap: 10,
  },
  archiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  archiveHeaderText: {
    flex: 1,
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: colors.textTertiary,
  },
  archiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  archiveValueStrong: {
    flex: 1,
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },
  archiveValue: {
    flex: 1,
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  tipCard: {
    padding: 16,
    gap: 12,
    flexDirection: 'row',
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  tipCopy: {
    flex: 1,
    gap: 4,
  },
  tipTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  tipBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  toggleCard: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  toggleBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  weatherHero: {
    padding: 18,
    gap: 16,
  },
  weatherHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weatherHeroCopy: {
    gap: 4,
  },
  weatherHeroTemp: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  weatherHeroCondition: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.textSecondary,
  },
  weatherMetricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  weatherStat: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 16,
    padding: 12,
    backgroundColor: GARDEN_SURFACES.depth,
    gap: 4,
  },
  weatherStatLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: colors.textSecondary,
  },
  weatherStatValue: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },
  forecastRow: {
    gap: 10,
    paddingRight: 12,
  },
  forecastCard: {
    width: 112,
    padding: 14,
    gap: 10,
  },
  forecastLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  forecastTemp: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },
  forecastMeta: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  hourlyCard: {
    padding: 16,
  },
  hourlyChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 10,
  },
  hourlyColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  hourlyTemp: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 11,
    color: colors.textSecondary,
  },
  hourlyBar: {
    width: 18,
    borderRadius: 999,
    backgroundColor: GARDEN_ACCENT,
  },
  hourlyLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    color: colors.textTertiary,
  },
  impactStack: {
    gap: 12,
  },
  impactCard: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  impactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 14, 19, 0.24)',
  },
  impactCopy: {
    flex: 1,
    gap: 4,
  },
  impactTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  impactBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  retrospectiveCard: {
    padding: 16,
    gap: 16,
  },
  retrospectiveLegend: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  retrospectiveBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 8,
  },
  retrospectiveColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  retrospectiveTrack: {
    height: 110,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  retrospectiveRain: {
    width: '70%',
    borderRadius: 999,
    backgroundColor: GARDEN_GOLD,
    opacity: 0.55,
    position: 'absolute',
    bottom: 0,
  },
  retrospectiveTemp: {
    width: '70%',
    borderRadius: 999,
    backgroundColor: GARDEN_ACCENT,
    opacity: 0.9,
    position: 'absolute',
    bottom: 0,
  },
  retrospectiveLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    color: colors.textTertiary,
  },
});
