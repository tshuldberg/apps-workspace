import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { Pencil, Sparkles, Thermometer, Trash2 } from 'lucide-react-native';
import {
  GlassCard,
  analyzeTemperatures,
  celsiusToFahrenheit,
  deleteTemperature,
  getCycles,
  getTemperaturesByDateRange,
  upsertTemperature,
  updateTemperature,
  CYCLE_ACCENT,
  CYCLE_ACCENT_LIGHT,
  CYCLE_FONTS,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
  CYCLE_TYPOGRAPHY,
  type Temperature,
} from '@mylife/cycle';
import {
  getCycleTempUnit,
  setCycleTempUnit,
  type CycleTempUnit,
} from '../../lib/cycle/preferences';
import { uuid } from '../../lib/uuid';
import { useDatabase } from '../../components/DatabaseProvider';

const CHART_WIDTH = 320;
const CHART_HEIGHT = 220;
const CHART_PADDING_X = 18;
const CHART_PADDING_Y = 18;
const THERMAL_ACCENT = CYCLE_PHASE_COLORS.ovulation;
const COVERLINE_COLOR = CYCLE_PHASE_COLORS.menstrual;

type TemperatureSheetState = {
  date: string;
  entry: Temperature | null;
} | null;

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function formatShortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatTemp(valueCelsius: number, unit: CycleTempUnit): string {
  const value =
    unit === 'fahrenheit'
      ? celsiusToFahrenheit(valueCelsius)
      : Math.round(valueCelsius * 10) / 10;
  return value.toFixed(1);
}

function parseReading(value: string, unit: CycleTempUnit): number | null {
  const numeric = Number.parseFloat(value.trim());
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const celsius =
    unit === 'fahrenheit'
      ? Math.round(((numeric - 32) * 5 / 9) * 100) / 100
      : Math.round(numeric * 100) / 100;

  if (celsius < 35 || celsius > 42) {
    return null;
  }

  return celsius;
}

function TemperatureUnitToggle({
  unit,
  onChange,
}: {
  unit: CycleTempUnit;
  onChange: (unit: CycleTempUnit) => void;
}) {
  return (
    <View style={styles.unitToggleWrap}>
      {(['celsius', 'fahrenheit'] as const).map((option) => {
        const active = unit === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.unitToggleButton,
              active && styles.unitToggleButtonActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <RNText
              style={[
                styles.unitToggleText,
                active && styles.unitToggleTextActive,
              ]}
            >
              {option === 'celsius' ? 'Celsius' : 'Fahrenheit'}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [pressed && !disabled && { opacity: 0.92 }]}
    >
      <LinearGradient
        colors={
          disabled
            ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.08)']
            : [CYCLE_ACCENT_LIGHT, CYCLE_ACCENT]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButton}
      >
        <RNText
          style={[
            styles.primaryButtonText,
            disabled && { color: 'rgba(228, 225, 233, 0.45)' },
          ]}
        >
          {label}
        </RNText>
      </LinearGradient>
    </Pressable>
  );
}

export default function TemperatureScreen() {
  const db = useDatabase();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [quickValue, setQuickValue] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [tempUnit, setTempUnit] = useState<CycleTempUnit>(getCycleTempUnit);
  const [sheetState, setSheetState] = useState<TemperatureSheetState>(null);
  const [sheetValue, setSheetValue] = useState('');

  const refresh = useCallback(() => setRefreshKey((tick) => tick + 1), []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const cycles = useMemo(() => {
    try {
      return getCycles(db, 12);
    } catch {
      return [];
    }
  }, [db, refreshKey]);

  const currentCycleStart = cycles[0]?.startDate ?? addDays(today, -27);
  const currentCycleDay = Math.max(1, daysBetween(currentCycleStart, today) + 1);

  const temperatures = useMemo(() => {
    try {
      return getTemperaturesByDateRange(db, currentCycleStart, today, 180);
    } catch {
      return [];
    }
  }, [db, currentCycleStart, today, refreshKey]);

  const temperaturesByDate = useMemo(
    () => new Map(temperatures.map((entry) => [entry.date, entry])),
    [temperatures],
  );

  const todayEntry = temperaturesByDate.get(today) ?? null;
  const analysis = useMemo(
    () => analyzeTemperatures(temperatures.map((entry) => entry.valueCelsius)),
    [temperatures],
  );

  const logRows = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const date = addDays(today, -(13 - index));
        return {
          date,
          entry: temperaturesByDate.get(date) ?? null,
          cycleDay: Math.max(1, daysBetween(currentCycleStart, date) + 1),
        };
      }),
    [currentCycleStart, temperaturesByDate, today],
  );

  const chartModel = useMemo(() => {
    if (temperatures.length === 0) {
      return null;
    }

    const coverline = analysis?.coverline ?? null;
    const cycleReadings = temperatures.map((entry) => ({
      entry,
      cycleDay: Math.max(1, daysBetween(currentCycleStart, entry.date) + 1),
    }));

    const values = cycleReadings.map(({ entry }) => entry.valueCelsius);
    if (coverline != null) {
      values.push(coverline);
    }

    const minValue = Math.min(...values) - 0.12;
    const maxValue = Math.max(...values) + 0.12;
    const totalDays = Math.max(
      currentCycleDay,
      cycleReadings[cycleReadings.length - 1]?.cycleDay ?? 1,
    );
    const usableWidth = CHART_WIDTH - CHART_PADDING_X * 2;
    const usableHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;

    const yForValue = (value: number) => {
      if (maxValue === minValue) {
        return CHART_HEIGHT / 2;
      }

      const progress = (value - minValue) / (maxValue - minValue);
      return CHART_HEIGHT - CHART_PADDING_Y - progress * usableHeight;
    };

    const xForDay = (cycleDay: number) =>
      CHART_PADDING_X + ((cycleDay - 1) / Math.max(totalDays - 1, 1)) * usableWidth;

    const points = cycleReadings.map(({ entry, cycleDay }) => ({
      id: entry.id,
      x: xForDay(cycleDay),
      y: yForValue(entry.valueCelsius),
      cycleDay,
      date: entry.date,
      valueCelsius: entry.valueCelsius,
    }));

    const shiftPoint =
      analysis?.shiftStartIndex != null
        ? points[analysis.shiftStartIndex] ?? null
        : null;

    const coverlineY = coverline != null ? yForValue(coverline) : null;
    const yTicks = Array.from({ length: 4 }, (_, index) => {
      const value = maxValue - ((maxValue - minValue) / 3) * index;
      return { value, y: yForValue(value) };
    });

    const xTicks = Array.from({ length: 5 }, (_, index) => {
      const day = Math.max(
        1,
        Math.round(1 + ((Math.max(totalDays, 2) - 1) / 4) * index),
      );
      return { day, x: xForDay(day) };
    });

    return {
      points,
      shiftPoint,
      coverline,
      coverlineY,
      yTicks,
      xTicks,
      totalDays,
    };
  }, [analysis, currentCycleDay, currentCycleStart, temperatures]);

  const handleUnitChange = useCallback((unit: CycleTempUnit) => {
    setTempUnit(unit);
    setCycleTempUnit(unit);
  }, []);

  const openEntrySheet = useCallback(
    (date: string) => {
      const entry = temperaturesByDate.get(date) ?? null;
      setSheetState({ date, entry });
      setSheetValue(entry ? formatTemp(entry.valueCelsius, tempUnit) : '');
    },
    [tempUnit, temperaturesByDate],
  );

  const closeSheet = useCallback(() => {
    setSheetState(null);
    setSheetValue('');
  }, []);

  const handleQuickSave = useCallback(() => {
    const valueCelsius = parseReading(quickValue, tempUnit);
    if (valueCelsius == null) {
      Alert.alert(
        'Invalid temperature',
        tempUnit === 'fahrenheit'
          ? 'Enter a reading between 95.0°F and 107.6°F.'
          : 'Enter a reading between 35.0°C and 42.0°C.',
      );
      return;
    }

    try {
      upsertTemperature(db, uuid(), {
        date: today,
        valueCelsius,
        method: 'oral',
      });
      setQuickValue('');
      refresh();
    } catch (error) {
      Alert.alert(
        'Unable to save reading',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [db, quickValue, refresh, tempUnit, today]);

  const handleSheetSave = useCallback(() => {
    if (sheetState == null) {
      return;
    }

    const valueCelsius = parseReading(sheetValue, tempUnit);
    if (valueCelsius == null) {
      Alert.alert(
        'Invalid temperature',
        tempUnit === 'fahrenheit'
          ? 'Enter a reading between 95.0°F and 107.6°F.'
          : 'Enter a reading between 35.0°C and 42.0°C.',
      );
      return;
    }

    try {
      if (sheetState.entry) {
        updateTemperature(db, sheetState.entry.id, { valueCelsius });
      } else {
        upsertTemperature(db, uuid(), {
          date: sheetState.date,
          valueCelsius,
          method: 'oral',
        });
      }
      closeSheet();
      refresh();
    } catch (error) {
      Alert.alert(
        'Unable to update reading',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [closeSheet, db, refresh, sheetState, sheetValue, tempUnit]);

  const handleSheetDelete = useCallback(() => {
    if (sheetState?.entry == null) {
      return;
    }

    Alert.alert('Delete reading?', 'This temperature entry will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteTemperature(db, sheetState.entry!.id);
            closeSheet();
            refresh();
          } catch (error) {
            Alert.alert(
              'Unable to delete reading',
              error instanceof Error ? error.message : 'Please try again.',
            );
          }
        },
      },
    ]);
  }, [closeSheet, db, refresh, sheetState]);

  const missingForCoverline = Math.max(0, 6 - temperatures.length);
  const shiftCycleDay =
    analysis?.shiftStartIndex != null
      ? Math.max(
          1,
          daysBetween(currentCycleStart, temperatures[analysis.shiftStartIndex].date) + 1,
        )
      : null;
  const ovulationDay = shiftCycleDay != null ? Math.max(1, shiftCycleDay - 1) : null;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'BBT Tracking' }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 156, 180) },
          ]}
        >
          <View style={styles.heroWrap}>
            <RNText style={styles.heroEyebrow}>
              Cycle day {currentCycleDay} • Body literacy
            </RNText>
            <RNText style={styles.heroTitle}>Body Temperature</RNText>
          </View>

          <GlassCard variant="high" style={styles.latestCard}>
            <View style={styles.latestCardChrome}>
              <View style={styles.latestIconWrap}>
                <Thermometer color={THERMAL_ACCENT} size={22} strokeWidth={2.1} />
              </View>
              <TemperatureUnitToggle unit={tempUnit} onChange={handleUnitChange} />
            </View>

            <View style={styles.latestReadingWrap}>
              <RNText style={styles.sectionEyebrow}>Daily Reading</RNText>
              {todayEntry ? (
                <>
                  <View style={styles.latestValueRow}>
                    <RNText style={styles.latestValue}>
                      {formatTemp(todayEntry.valueCelsius, tempUnit)}
                    </RNText>
                    <RNText style={styles.latestUnit}>
                      °{tempUnit === 'fahrenheit' ? 'F' : 'C'}
                    </RNText>
                  </View>
                  <View style={styles.latestEquivalentPill}>
                    <RNText style={styles.latestEquivalentText}>
                      {tempUnit === 'fahrenheit'
                        ? `${todayEntry.valueCelsius.toFixed(1)}°C equivalent`
                        : `${celsiusToFahrenheit(todayEntry.valueCelsius).toFixed(1)}°F equivalent`}
                    </RNText>
                  </View>
                </>
              ) : (
                <>
                  <RNText style={styles.latestEmptyTitle}>No reading today</RNText>
                  <RNText style={styles.latestEmptyBody}>
                    Log your basal temperature after waking for the cleanest trend line.
                  </RNText>
                </>
              )}
            </View>

            <View style={styles.cardActionsRow}>
              <PrimaryButton
                label={todayEntry ? 'Update today' : 'Log temperature'}
                onPress={() => inputRef.current?.focus()}
              />
              <Pressable
                onPress={() => openEntrySheet(today)}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <RNText style={styles.secondaryButtonText}>Edit in log</RNText>
              </Pressable>
            </View>
          </GlassCard>

          <GlassCard style={styles.chartCard}>
            <View style={styles.cardHeaderRow}>
              <View>
                <RNText style={styles.cardTitle}>Cycle Overview</RNText>
                <RNText style={styles.cardSub}>
                  {temperatures.length > 0
                    ? `${temperatures.length} reading${temperatures.length === 1 ? '' : 's'} this cycle`
                    : 'No temperatures logged in this cycle yet'}
                </RNText>
              </View>
            </View>

            {chartModel ? (
              <>
                <View style={styles.chartWrap}>
                  <View style={styles.yAxisLabels}>
                    {chartModel.yTicks.map((tick) => (
                      <RNText key={tick.y} style={styles.axisLabel}>
                        {formatTemp(tick.value, tempUnit)}
                      </RNText>
                    ))}
                  </View>
                  <View style={styles.chartCanvas}>
                    <Svg
                      width="100%"
                      height="100%"
                      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    >
                      {chartModel.shiftPoint ? (
                        <>
                          <Rect
                            x={0}
                            y={0}
                            width={chartModel.shiftPoint.x}
                            height={CHART_HEIGHT}
                            fill="rgba(244, 114, 182, 0.05)"
                          />
                          <Rect
                            x={chartModel.shiftPoint.x}
                            y={0}
                            width={CHART_WIDTH - chartModel.shiftPoint.x}
                            height={CHART_HEIGHT}
                            fill="rgba(244, 114, 182, 0.14)"
                          />
                        </>
                      ) : null}

                      {chartModel.yTicks.map((tick) => (
                        <Line
                          key={`grid-${tick.y}`}
                          x1={CHART_PADDING_X}
                          x2={CHART_WIDTH - CHART_PADDING_X}
                          y1={tick.y}
                          y2={tick.y}
                          stroke="rgba(255,255,255,0.06)"
                          strokeWidth={1}
                          strokeDasharray="2 8"
                        />
                      ))}

                      {chartModel.coverlineY != null ? (
                        <Line
                          x1={CHART_PADDING_X}
                          x2={CHART_WIDTH - CHART_PADDING_X}
                          y1={chartModel.coverlineY}
                          y2={chartModel.coverlineY}
                          stroke={COVERLINE_COLOR}
                          strokeWidth={1.5}
                          strokeDasharray="7 7"
                        />
                      ) : null}

                      {chartModel.shiftPoint ? (
                        <Line
                          x1={chartModel.shiftPoint.x}
                          x2={chartModel.shiftPoint.x}
                          y1={CHART_PADDING_Y}
                          y2={CHART_HEIGHT - CHART_PADDING_Y}
                          stroke={THERMAL_ACCENT}
                          strokeWidth={1.5}
                        />
                      ) : null}

                      <Polyline
                        points={chartModel.points.map((point) => `${point.x},${point.y}`).join(' ')}
                        fill="none"
                        stroke={THERMAL_ACCENT}
                        strokeWidth={3}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />

                      {chartModel.points.map((point) => (
                        <Circle
                          key={point.id}
                          cx={point.x}
                          cy={point.y}
                          r={point === chartModel.points[chartModel.points.length - 1] ? 5 : 4}
                          fill={
                            point === chartModel.points[chartModel.points.length - 1]
                              ? THERMAL_ACCENT
                              : CYCLE_SURFACES.base
                          }
                          stroke={THERMAL_ACCENT}
                          strokeWidth={2}
                        />
                      ))}
                    </Svg>

                    {chartModel.coverline != null ? (
                      <View
                        style={[
                          styles.chartBadge,
                          { top: chartModel.coverlineY ?? CHART_HEIGHT / 2 },
                        ]}
                      >
                        <RNText style={styles.chartBadgeText}>
                          Coverline {formatTemp(chartModel.coverline, tempUnit)}°
                        </RNText>
                      </View>
                    ) : null}

                    {chartModel.shiftPoint ? (
                      <View
                        style={[
                          styles.shiftBadge,
                          {
                            left: `${(chartModel.shiftPoint.x / CHART_WIDTH) * 100}%`,
                          },
                        ]}
                      >
                        <RNText style={styles.shiftBadgeText}>Thermal shift</RNText>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.xAxisRow}>
                  {chartModel.xTicks.map((tick) => (
                    <RNText key={`x-${tick.day}`} style={styles.axisLabel}>
                      CD {tick.day}
                    </RNText>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.emptyChartState}>
                <Thermometer color={THERMAL_ACCENT} size={28} strokeWidth={1.8} />
                <RNText style={styles.emptyChartTitle}>Your chart fills in as you log</RNText>
                <RNText style={styles.emptyChartBody}>
                  Start with six readings to unlock a coverline and ovulation shift detection.
                </RNText>
              </View>
            )}
          </GlassCard>

          <GlassCard variant="high" style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <View style={styles.insightIconWrap}>
                <Sparkles color={CYCLE_ACCENT} size={18} strokeWidth={2.2} />
              </View>
              <RNText style={styles.cardTitle}>Insights</RNText>
            </View>
            {analysis?.shiftDetected && ovulationDay != null ? (
              <>
                <RNText style={styles.insightTitle}>
                  Ovulation likely happened on cycle day {ovulationDay}
                </RNText>
                <RNText style={styles.insightBody}>
                  Your temperature rose above coverline and stayed elevated for three readings,
                  which is the classic post-ovulation shift pattern.
                </RNText>
              </>
            ) : missingForCoverline > 0 ? (
              <>
                <RNText style={styles.insightTitle}>
                  Need {missingForCoverline} more reading{missingForCoverline === 1 ? '' : 's'} for a coverline
                </RNText>
                <RNText style={styles.insightBody}>
                  Once you log six temperatures in this cycle, MyCycle can draw a coverline and
                  start looking for a thermal shift.
                </RNText>
              </>
            ) : (
              <>
                <RNText style={styles.insightTitle}>Coverline is ready. Keep logging.</RNText>
                <RNText style={styles.insightBody}>
                  You have enough data for a baseline, but there is not a confirmed sustained rise
                  yet. Consistent morning readings will sharpen the pattern.
                </RNText>
              </>
            )}
          </GlassCard>

          <View style={styles.logHeader}>
            <RNText style={styles.cardTitle}>Daily Log</RNText>
            <RNText style={styles.cardSub}>Last 14 days</RNText>
          </View>

          <View style={styles.logGrid}>
            {logRows.map((row) => (
              <Pressable
                key={row.date}
                onPress={() => openEntrySheet(row.date)}
                style={({ pressed }) => [
                  styles.logRow,
                  row.entry ? styles.logRowFilled : null,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <View style={styles.logRowLeft}>
                  <RNText style={styles.logRowDate}>{formatShortDate(row.date)}</RNText>
                  <RNText style={styles.logRowSub}>Cycle day {row.cycleDay}</RNText>
                </View>
                <View style={styles.logRowRight}>
                  <RNText style={styles.logRowValue}>
                    {row.entry
                      ? `${formatTemp(row.entry.valueCelsius, tempUnit)}°${tempUnit === 'fahrenheit' ? 'F' : 'C'}`
                      : 'No reading'}
                  </RNText>
                  <View style={styles.logRowEditIcon}>
                    <Pencil color="rgba(228, 225, 233, 0.7)" size={15} strokeWidth={2} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View
          style={[
            styles.quickLogBar,
            { paddingBottom: Math.max(insets.bottom + 8, 18) },
          ]}
        >
          <RNText style={styles.quickLogLabel}>Quick log for today</RNText>
          <View style={styles.quickLogRow}>
            <View style={styles.quickInputWrap}>
              <TextInput
                ref={inputRef}
                value={quickValue}
                onChangeText={setQuickValue}
                placeholder={tempUnit === 'fahrenheit' ? '98.6' : '37.0'}
                placeholderTextColor="rgba(214, 195, 181, 0.4)"
                keyboardType="decimal-pad"
                style={styles.quickInput}
              />
              <RNText style={styles.quickInputUnit}>
                °{tempUnit === 'fahrenheit' ? 'F' : 'C'}
              </RNText>
            </View>
            <PrimaryButton
              label={todayEntry ? 'Save update' : 'Save reading'}
              onPress={handleQuickSave}
              disabled={quickValue.trim().length === 0}
            />
          </View>
        </View>

        <Modal
          visible={sheetState != null}
          animationType="slide"
          transparent
          onRequestClose={closeSheet}
        >
          <View style={styles.sheetBackdrop}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.sheetKeyboardWrap}
            >
              <View style={styles.sheetCard}>
                <RNText style={styles.sheetEyebrow}>Daily Log</RNText>
                <RNText style={styles.sheetTitle}>
                  {sheetState ? formatShortDate(sheetState.date) : ''}
                </RNText>
                <RNText style={styles.sheetBody}>
                  {sheetState?.entry
                    ? 'Adjust or remove this reading.'
                    : 'Add a temperature for this day.'}
                </RNText>

                <View style={styles.sheetInputWrap}>
                  <TextInput
                    value={sheetValue}
                    onChangeText={setSheetValue}
                    keyboardType="decimal-pad"
                    placeholder={tempUnit === 'fahrenheit' ? '98.6' : '37.0'}
                    placeholderTextColor="rgba(214, 195, 181, 0.4)"
                    style={styles.sheetInput}
                  />
                  <RNText style={styles.sheetInputUnit}>
                    °{tempUnit === 'fahrenheit' ? 'F' : 'C'}
                  </RNText>
                </View>

                <View style={styles.sheetActions}>
                  <Pressable
                    onPress={closeSheet}
                    style={({ pressed }) => [
                      styles.sheetSecondaryButton,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <RNText style={styles.sheetSecondaryText}>Close</RNText>
                  </Pressable>
                  <PrimaryButton
                    label={sheetState?.entry ? 'Save changes' : 'Add reading'}
                    onPress={handleSheetSave}
                    disabled={sheetValue.trim().length === 0}
                  />
                </View>

                {sheetState?.entry ? (
                  <Pressable
                    onPress={handleSheetDelete}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Trash2 color={CYCLE_PHASE_COLORS.menstrual} size={16} strokeWidth={2} />
                    <RNText style={styles.deleteButtonText}>Delete reading</RNText>
                  </Pressable>
                ) : null}
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CYCLE_SURFACES.base,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 18,
  },
  heroWrap: {
    gap: 4,
  },
  heroEyebrow: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: THERMAL_ACCENT,
  },
  heroTitle: {
    ...CYCLE_TYPOGRAPHY.displayMd,
    color: '#E4E1E9',
  },
  latestCard: {
    gap: 20,
  },
  latestCardChrome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  latestIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: 'rgba(244, 114, 182, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  latestReadingWrap: {
    alignItems: 'center',
    gap: 8,
  },
  sectionEyebrow: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.55)',
  },
  latestValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  latestValue: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 58,
    lineHeight: 64,
    letterSpacing: -1.6,
    color: '#F7F2FA',
  },
  latestUnit: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 26,
    lineHeight: 30,
    color: 'rgba(214, 195, 181, 0.8)',
    paddingBottom: 8,
  },
  latestEquivalentPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  latestEquivalentText: {
    ...CYCLE_TYPOGRAPHY.labelTight,
    color: 'rgba(214, 195, 181, 0.85)',
  },
  latestEmptyTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#F7F2FA',
  },
  latestEmptyBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.78)',
    textAlign: 'center',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  unitToggleWrap: {
    flexDirection: 'row',
    backgroundColor: CYCLE_SURFACES.low,
    padding: 4,
    borderRadius: 999,
    gap: 4,
  },
  unitToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  unitToggleButtonActive: {
    backgroundColor: CYCLE_SURFACES.highest,
  },
  unitToggleText: {
    ...CYCLE_TYPOGRAPHY.labelTight,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  unitToggleTextActive: {
    color: '#F7F2FA',
  },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 138,
  },
  primaryButtonText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.24,
    color: '#4B2700',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    color: '#E4E1E9',
  },
  chartCard: {
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    ...CYCLE_TYPOGRAPHY.headlineMd,
    color: '#F3EDF7',
  },
  cardSub: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  chartWrap: {
    flexDirection: 'row',
    gap: 10,
  },
  yAxisLabels: {
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingTop: 12,
  },
  chartCanvas: {
    flex: 1,
    height: 248,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
    position: 'relative',
  },
  axisLabel: {
    ...CYCLE_TYPOGRAPHY.labelTight,
    color: 'rgba(214, 195, 181, 0.55)',
  },
  chartBadge: {
    position: 'absolute',
    right: 12,
    marginTop: -10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
  },
  chartBadgeText: {
    ...CYCLE_TYPOGRAPHY.labelTight,
    color: COVERLINE_COLOR,
  },
  shiftBadge: {
    position: 'absolute',
    bottom: 12,
    transform: [{ translateX: -42 }],
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: THERMAL_ACCENT,
  },
  shiftBadgeText: {
    ...CYCLE_TYPOGRAPHY.labelTight,
    color: '#FFF5FB',
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 40,
    paddingRight: 8,
  },
  emptyChartState: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyChartTitle: {
    ...CYCLE_TYPOGRAPHY.titleMd,
    color: '#F3EDF7',
  },
  emptyChartBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.72)',
    textAlign: 'center',
  },
  insightCard: {
    gap: 10,
    backgroundColor: CYCLE_SURFACES.high,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  insightIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: 'rgba(201, 137, 77, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    ...CYCLE_TYPOGRAPHY.titleMd,
    color: '#F5F0F8',
  },
  insightBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.78)',
  },
  logHeader: {
    gap: 2,
  },
  logGrid: {
    gap: 10,
  },
  logRow: {
    backgroundColor: CYCLE_SURFACES.low,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logRowFilled: {
    backgroundColor: CYCLE_SURFACES.mid,
  },
  logRowLeft: {
    gap: 2,
  },
  logRowDate: {
    ...CYCLE_TYPOGRAPHY.titleMd,
    color: '#F5F0F8',
  },
  logRowSub: {
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  logRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logRowValue: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: '#F7F2FA',
  },
  logRowEditIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLogBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    backgroundColor: 'rgba(14, 14, 19, 0.96)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 12,
  },
  quickLogLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  quickLogRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  quickInputWrap: {
    flex: 1,
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: CYCLE_SURFACES.low,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickInput: {
    flex: 1,
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 26,
    lineHeight: 30,
    color: '#F7F2FA',
    paddingVertical: 0,
  },
  quickInputUnit: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 16,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheetKeyboardWrap: {
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: CYCLE_SURFACES.low,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 14,
  },
  sheetEyebrow: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: THERMAL_ACCENT,
  },
  sheetTitle: {
    ...CYCLE_TYPOGRAPHY.displayMd,
    color: '#F3EDF7',
  },
  sheetBody: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.78)',
  },
  sheetInputWrap: {
    minHeight: 60,
    borderRadius: 22,
    backgroundColor: CYCLE_SURFACES.high,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetInput: {
    flex: 1,
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 28,
    lineHeight: 32,
    color: '#F7F2FA',
    paddingVertical: 0,
  },
  sheetInputUnit: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 16,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetSecondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    color: '#E4E1E9',
  },
  deleteButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  deleteButtonText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    color: COVERLINE_COLOR,
  },
});
