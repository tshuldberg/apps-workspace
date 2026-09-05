import { StyleSheet, Text, View } from 'react-native';
import { formatScreenTime } from '../../engines/stats';
import { getDailyTimeCardDeltaState } from '../logic';
import {
  PR_ACCENT_LIGHT,
  PR_DANGER,
  PR_SUCCESS,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TYPOGRAPHY,
} from '../tokens';
import { GlassPanel } from './GlassPanel';
import { MaterialSymbol } from './MaterialSymbol';
import { TrendBars } from './TrendBars';

export interface DailyTimeTrendDatum {
  date: string;
  minutes: number;
}

export interface DailyTimeCardProps {
  totalMinutes: number;
  deltaMinutes: number;
  goalMinutes: number;
  trendData: DailyTimeTrendDatum[];
}

export function DailyTimeCard({
  totalMinutes,
  deltaMinutes,
  goalMinutes,
  trendData,
}: DailyTimeCardProps) {
  const deltaState = getDailyTimeCardDeltaState(deltaMinutes);
  const deltaTone = deltaState.direction === 'over' ? PR_DANGER : PR_SUCCESS;
  const chartData = trendData.slice(-30).map((entry, index, source) => ({
    label: entry.date.slice(5),
    value: entry.minutes,
    isToday: index === source.length - 1,
  }));

  return (
    <GlassPanel padding={24} style={styles.panel}>
      <View style={styles.orb} />
      <View style={styles.headerRow}>
        <Text style={styles.label}>Today's Focus</Text>
        <MaterialSymbol name="bolt" size={18} color={PR_ACCENT_LIGHT} />
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.total}>{formatScreenTime(totalMinutes)}</Text>
        <View style={[styles.deltaPill, { backgroundColor: `${deltaTone}1A` }]}>
          <MaterialSymbol name={deltaState.icon} size={14} color={deltaTone} />
          <Text style={[styles.deltaText, { color: deltaTone }]}>
            {`${deltaMinutes > 0 ? '+' : deltaMinutes < 0 ? '-' : ''}${formatScreenTime(Math.abs(deltaMinutes))}`}
          </Text>
        </View>
      </View>

      <Text style={styles.subtitle}>{deltaState.label}</Text>

      <View style={styles.chartWrap}>
        <TrendBars data={chartData} goalValue={goalMinutes} height={80} />
      </View>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'relative',
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    top: -48,
    right: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(8, 145, 178, 0.10)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_SECONDARY,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  total: {
    ...PR_TYPOGRAPHY.displayLg,
    color: PR_TEXT,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  deltaText: {
    ...PR_TYPOGRAPHY.titleMd,
  },
  subtitle: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    marginTop: 4,
    marginBottom: 20,
  },
  chartWrap: {
    paddingTop: 4,
  },
});
