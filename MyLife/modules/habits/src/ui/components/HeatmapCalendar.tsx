import { StyleSheet, View } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { HB_ACCENT, HB_SURFACES, HB_TEXT_SECONDARY, HB_TYPOGRAPHY, withAlpha } from '../tokens';

export interface HeatmapCalendarDatum {
  date: string;
  value: number;
}

export interface HeatmapCalendarProps {
  data: HeatmapCalendarDatum[];
  months?: number;
  onDayPress?: (day: HeatmapCalendarDatum) => void;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  timeZone: 'UTC',
});

function parseUtcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

export function getHeatmapIntensity(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) {
    return 0;
  }

  const ratio = value / maxValue;

  if (ratio >= 0.85) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.3) return 2;
  return 1;
}

export function getHeatmapCellColor(value: number, maxValue: number): string {
  const intensity = getHeatmapIntensity(value, maxValue);

  switch (intensity) {
    case 4:
      return HB_ACCENT;
    case 3:
      return withAlpha(HB_ACCENT, 0.72);
    case 2:
      return withAlpha(HB_ACCENT, 0.46);
    case 1:
      return withAlpha(HB_ACCENT, 0.24);
    default:
      return HB_SURFACES.high;
  }
}

export function HeatmapCalendar({
  data,
  months,
  onDayPress,
}: HeatmapCalendarProps) {
  const visibleData = months == null ? data : data.slice(-Math.max(1, months) * 31);
  const maxValue = Math.max(0, ...visibleData.map((day) => day.value));
  const cellSize = 12;
  const gap = 4;
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  if (visibleData.length === 0) {
    return <View style={styles.empty} />;
  }

  const firstDate = parseUtcDate(visibleData[0].date);
  const weekOffset = firstDate.getUTCDay();

  const monthAnchors = visibleData.reduce<Array<{ label: string; x: number }>>((acc, day, index) => {
    const parsed = parseUtcDate(day.date);
    if (parsed.getUTCDate() === 1 || index === 0) {
      const x = Math.floor((index + weekOffset) / 7) * (cellSize + gap);
      acc.push({
        label: MONTH_FORMATTER.format(parsed),
        x,
      });
    }
    return acc;
  }, []);

  const totalWeeks = Math.ceil((visibleData.length + weekOffset) / 7);
  const width = totalWeeks * (cellSize + gap) + 44;
  const height = 7 * (cellSize + gap) + 28;

  return (
    <View>
      <Svg width={width} height={height}>
        <G x={0} y={22}>
          {dayLabels.map((label, index) => (
            <SvgText
              key={label + index}
              x={0}
              y={index * (cellSize + gap) + 10}
              fill={HB_TEXT_SECONDARY}
              fontSize={10}
              fontFamily={HB_TYPOGRAPHY.labelUpper.fontFamily}
            >
              {label}
            </SvgText>
          ))}
        </G>
        <G x={28} y={0}>
          {monthAnchors.map((anchor) => (
            <SvgText
              key={`${anchor.label}-${anchor.x}`}
              x={anchor.x}
              y={10}
              fill={HB_TEXT_SECONDARY}
              fontSize={10}
              fontFamily={HB_TYPOGRAPHY.labelUpper.fontFamily}
            >
              {anchor.label}
            </SvgText>
          ))}
        </G>
        <G x={28} y={18}>
          {visibleData.map((day, index) => {
            const absoluteIndex = index + weekOffset;
            const col = Math.floor(absoluteIndex / 7);
            const row = absoluteIndex % 7;

            return (
              <Rect
                key={day.date}
                x={col * (cellSize + gap)}
                y={row * (cellSize + gap)}
                width={cellSize}
                height={cellSize}
                rx={4}
                fill={getHeatmapCellColor(day.value, maxValue)}
                onPress={onDayPress ? () => onDayPress(day) : undefined}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    minHeight: 110,
  },
});
