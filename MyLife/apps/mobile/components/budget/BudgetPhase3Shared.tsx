import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_MUTED,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TRANSFER,
} from '@mylife/budget';

type BudgetTone =
  | 'positive'
  | 'warning'
  | 'danger'
  | 'accent'
  | 'info'
  | 'neutral';

export type BudgetChartPoint = {
  label: string;
  value: number;
};

export type BudgetDonutSegment = {
  color: string;
  label: string;
  value: number;
};

export function formatBudgetCurrency(
  cents: number,
  options?: {
    compact?: boolean;
    signed?: boolean;
  },
): string {
  const abs = Math.abs(cents) / 100;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: options?.compact ? 'compact' : 'standard',
    maximumFractionDigits: options?.compact ? 1 : 2,
    minimumFractionDigits: options?.compact ? 0 : 2,
  }).format(abs);

  if (!options?.signed || cents === 0) {
    return formatted;
  }

  return `${cents > 0 ? '+' : '-'}${formatted}`;
}

export function formatBudgetPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatBudgetDate(
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) {
    return 'No date';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
}

export function formatBudgetMonth(value?: string | null): string {
  if (!value) {
    return 'No date';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

export function relativeBudgetDate(
  value?: string | null,
  now = new Date(),
): string {
  if (!value) {
    return 'No date';
  }

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return value;
  }

  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  const absDays = Math.abs(diffDays);

  if (absDays <= 6) {
    if (diffDays === 0) {
      return 'today';
    }
    return diffDays > 0 ? `in ${absDays}d` : `${absDays}d ago`;
  }

  const diffMonths =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  const absMonths = Math.abs(diffMonths);

  if (absMonths <= 1) {
    return diffDays > 0 ? 'in 1 month' : '1 month ago';
  }

  return diffMonths > 0 ? `in ${absMonths} months` : `${absMonths} months ago`;
}

export function daysUntilBudgetDate(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}

function getToneStyles(tone: BudgetTone): { backgroundColor: string; color: string } {
  switch (tone) {
    case 'positive':
      return {
        backgroundColor: 'rgba(34, 197, 94, 0.16)',
        color: BG_MONEY,
      };
    case 'warning':
      return {
        backgroundColor: 'rgba(255, 184, 119, 0.16)',
        color: BG_ACCENT_LIGHT,
      };
    case 'danger':
      return {
        backgroundColor: 'rgba(255, 180, 171, 0.16)',
        color: BG_DANGER,
      };
    case 'accent':
      return {
        backgroundColor: 'rgba(201, 137, 77, 0.18)',
        color: BG_ACCENT_LIGHT,
      };
    case 'info':
      return {
        backgroundColor: 'rgba(139, 207, 240, 0.18)',
        color: BG_TRANSFER,
      };
    default:
      return {
        backgroundColor: BG_SURFACES.high,
        color: BG_TEXT_SECONDARY,
      };
  }
}

export function BudgetStatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: BudgetTone;
}) {
  const toneStyles = getToneStyles(tone);

  return (
    <View
      style={[styles.pill, { backgroundColor: toneStyles.backgroundColor }]}
    >
      <Text style={[styles.pillLabel, { color: toneStyles.color }]}>{label}</Text>
    </View>
  );
}

export function BudgetLineChart({
  color = BG_ACCENT_LIGHT,
  data,
  height = 148,
  width = 320,
  withDots = true,
}: {
  color?: string;
  data: BudgetChartPoint[];
  height?: number;
  width?: number;
  withDots?: boolean;
}) {
  const safeData =
    data.length === 1
      ? [data[0], { ...data[0], label: `${data[0].label} ` }]
      : data;
  const values = safeData.map((point) => point.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, min + 1);
  const range = max - min || 1;
  const padding = 16;

  const points = safeData
    .map((point, index) => {
      const x =
        padding +
        (index / Math.max(safeData.length - 1, 1)) * (width - padding * 2);
      const y =
        height -
        padding -
        ((point.value - min) / range) * (height - padding * 2);

      return { ...point, x, y };
    });

  return (
    <View style={styles.chartShell}>
      <Svg height={height} width={width}>
        <Polyline
          fill="none"
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
        />
        {withDots
          ? points.map((point) => (
              <Circle
                key={`${point.label}-${point.x}`}
                cx={point.x}
                cy={point.y}
                fill={color}
                r={3}
              />
            ))
          : null}
      </Svg>
      <View style={styles.chartLabels}>
        <Text style={styles.chartLabel}>{safeData[0]?.label ?? ''}</Text>
        <Text style={styles.chartLabel}>
          {safeData[Math.floor((safeData.length - 1) / 2)]?.label ?? ''}
        </Text>
        <Text style={styles.chartLabel}>
          {safeData[safeData.length - 1]?.label ?? ''}
        </Text>
      </View>
    </View>
  );
}

export function BudgetDonutChart({
  centerLabel,
  centerValue,
  segments,
  size = 180,
  strokeWidth = 18,
}: {
  centerLabel: string;
  centerValue: string;
  segments: BudgetDonutSegment[];
  size?: number;
  strokeWidth?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={[styles.donutShell, { width: size, height: size }]}>
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={radius}
          stroke={BG_SURFACES.high}
          strokeWidth={strokeWidth}
        />
        {segments.map((segment) => {
          const length = total > 0 ? (segment.value / total) * circumference : 0;
          const dashOffset = circumference - offset;
          offset += length;

          return (
            <Circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              fill="transparent"
              r={radius}
              stroke={segment.color}
              strokeDasharray={`${Math.max(length, 0)} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutLabel}>{centerLabel}</Text>
        <Text style={styles.donutValue}>{centerValue}</Text>
      </View>
    </View>
  );
}

export function BudgetSteppedSlider({
  label,
  labels,
  value,
  values,
  onChange,
  valueFormatter,
}: {
  label: string;
  labels?: string[];
  value: number;
  values: number[];
  onChange: (value: number) => void;
  valueFormatter?: (value: number) => string;
}) {
  const selectedIndex = Math.max(0, values.indexOf(value));
  const fillWidth = (
    values.length <= 1
      ? '0%'
      : `${(selectedIndex / (values.length - 1)) * 100}%`
  ) as `${number}%`;

  return (
    <View style={styles.sliderSection}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>
          {valueFormatter ? valueFormatter(value) : String(value)}
        </Text>
      </View>
      <View style={styles.sliderTrack}>
        <View style={styles.sliderTrackBase} />
        <View style={[styles.sliderTrackFill, { width: fillWidth }]} />
        <View style={styles.sliderStops}>
          {values.map((option, index) => {
            const active = index <= selectedIndex;
            const selected = option === value;
            return (
              <Pressable
                key={`${label}-${option}`}
                accessibilityLabel={`${label} ${option}`}
                onPress={() => onChange(option)}
                style={styles.sliderStopButton}
              >
                <View
                  style={[
                    styles.sliderStop,
                    active ? styles.sliderStopActive : null,
                    selected ? styles.sliderStopSelected : null,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.sliderFoot}>
        {values.map((option, index) => (
          <Text key={`${label}-label-${option}`} style={styles.sliderFootLabel}>
            {labels?.[index] ?? option}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function getBudgetDeltaTone(value: number): BudgetTone {
  if (value > 0) {
    return 'positive';
  }
  if (value < 0) {
    return 'danger';
  }
  return 'neutral';
}

export function getBudgetGoalTone(
  status: 'behind' | 'completed' | 'no_target_date' | 'on_track' | 'overdue',
): BudgetTone {
  switch (status) {
    case 'completed':
      return 'positive';
    case 'on_track':
      return 'positive';
    case 'behind':
      return 'warning';
    case 'overdue':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getBudgetGoalLabel(
  status: 'behind' | 'completed' | 'no_target_date' | 'on_track' | 'overdue',
): string {
  switch (status) {
    case 'completed':
      return 'Achieved';
    case 'on_track':
      return 'On Track';
    case 'behind':
      return 'Behind';
    case 'overdue':
      return 'Overdue';
    default:
      return 'Flexible';
  }
}

export function getBudgetMilestoneCopy(type: string, value: number): string {
  if (type === 'first_positive') {
    return 'Reached positive net worth';
  }
  if (type === 'round_number') {
    return `Crossed ${formatBudgetCurrency(value)}`;
  }
  if (type === 'all_time_high') {
    return `New all-time high at ${formatBudgetCurrency(value)}`;
  }
  if (type === 'debt_free') {
    return 'Became debt free';
  }
  return value > 0 ? formatBudgetCurrency(value) : 'Milestone reached';
}

export const PHASE3_CHART_COLORS = [
  BG_ACCENT_LIGHT,
  BG_MONEY,
  BG_TRANSFER,
  '#A78BFA',
  '#F97316',
  BG_TEXT_MUTED,
] as const;

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillLabel: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chartShell: {
    gap: 10,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  chartLabel: {
    color: BG_TEXT_TERTIARY,
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  donutShell: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutCenter: {
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    position: 'absolute',
  },
  donutLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  donutValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  sliderSection: {
    gap: 10,
  },
  sliderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sliderLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  sliderValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  sliderTrack: {
    justifyContent: 'center',
    minHeight: 24,
    position: 'relative',
  },
  sliderTrackBase: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    height: 6,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  sliderTrackFill: {
    backgroundColor: BG_ACCENT_LIGHT,
    borderRadius: 999,
    height: 6,
    left: 0,
    position: 'absolute',
  },
  sliderStops: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderStopButton: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  sliderStop: {
    backgroundColor: BG_SURFACES.highest,
    borderColor: BG_SURFACES.lowest,
    borderRadius: 999,
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  sliderStopActive: {
    backgroundColor: BG_ACCENT,
  },
  sliderStopSelected: {
    backgroundColor: BG_ACCENT_LIGHT,
    shadowColor: BG_ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
  },
  sliderFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  sliderFootLabel: {
    color: BG_TEXT_TERTIARY,
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
