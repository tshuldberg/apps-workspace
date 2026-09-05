import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { CYCLE_FONTS } from '../typography';
import { CYCLE_PHASE_COLORS, CYCLE_SURFACES, type CyclePhaseKey } from '../tokens';

export interface PhaseRingProps {
  /** 1-indexed current day of the cycle. */
  currentDay: number;
  /** Total days in the cycle (typically the user's average length). */
  totalDays: number;
  /** Current phase the user is in. */
  phase: CyclePhaseKey;
  /** Length of the menstrual phase in days. */
  menstrualLength: number;
  /** Length of the follicular phase in days. */
  follicularLength: number;
  /** Length of the ovulation phase in days. */
  ovulationLength: number;
  /** Outer ring diameter in pixels. Defaults to 288. */
  size?: number;
}

const PHASE_LABEL: Record<CyclePhaseKey, string> = {
  menstrual: 'Menstrual Phase',
  follicular: 'Follicular Phase',
  ovulation: 'Ovulation Phase',
  luteal: 'Luteal Phase',
};

const ORDER: CyclePhaseKey[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];

/**
 * MyCycle hero ring. Renders a 4-segment colored ring (menstrual, follicular,
 * ovulation, luteal) using SVG Circle stroke-dashoffset segments, with a center
 * label showing the current day and phase.
 *
 * Pure visual component: does not fetch any data or read from the database.
 */
export function PhaseRing({
  currentDay,
  totalDays,
  phase,
  menstrualLength,
  follicularLength,
  ovulationLength,
  size = 288,
}: PhaseRingProps) {
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const safeTotal = Math.max(totalDays, 1);
  const lutealLength = Math.max(
    safeTotal - menstrualLength - follicularLength - ovulationLength,
    0,
  );
  const lengths: Record<CyclePhaseKey, number> = {
    menstrual: menstrualLength,
    follicular: follicularLength,
    ovulation: ovulationLength,
    luteal: lutealLength,
  };

  // Build an ordered list of cumulative offsets so each segment renders
  // at the correct location on the circle.
  let cumulative = 0;
  const segments = ORDER.map((key) => {
    const frac = lengths[key] / safeTotal;
    const length = frac * circumference;
    const offset = -cumulative * circumference;
    cumulative += frac;
    return { key, length, offset };
  });

  const currentPhaseColor = CYCLE_PHASE_COLORS[phase];
  const clampedDay = Math.max(1, Math.min(currentDay, safeTotal));
  const cutoutInset = stroke + 4;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Rotate so segment 0 starts at 12 o'clock. */}
        <G transform={`rotate(-90, ${center}, ${center})`}>
          {segments.map(({ key, length, offset }) => (
            <Circle
              key={key}
              cx={center}
              cy={center}
              r={radius}
              stroke={CYCLE_PHASE_COLORS[key]}
              strokeWidth={stroke}
              strokeLinecap="butt"
              fill="transparent"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={offset}
            />
          ))}
        </G>
      </Svg>

      {/* Inner cutout */}
      <View
        style={[
          styles.cutout,
          {
            top: cutoutInset,
            left: cutoutInset,
            right: cutoutInset,
            bottom: cutoutInset,
            borderRadius: (size - cutoutInset * 2) / 2,
          },
        ]}
      >
        <Text style={styles.label}>CURRENT DAY</Text>
        <Text style={[styles.day, { color: currentPhaseColor }]}>
          Day {clampedDay}
        </Text>
        <View
          style={[
            styles.phasePill,
            { backgroundColor: `${currentPhaseColor}1A` },
          ]}
        >
          <Text style={[styles.phaseText, { color: currentPhaseColor }]}>
            {PHASE_LABEL[phase]}
          </Text>
        </View>
      </View>

      {/* Active indicator dot at the top (12 o'clock) */}
      <View
        style={[
          styles.indicator,
          {
            top: -2,
            left: center - 8,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cutout: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CYCLE_SURFACES.base,
  },
  label: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 12,
    letterSpacing: 2.4,
    color: 'rgba(214, 195, 181, 0.85)',
    marginBottom: 4,
  },
  day: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 56,
    letterSpacing: -1.5,
    lineHeight: 64,
  },
  phasePill: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 999,
  },
  phaseText: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 13,
  },
  indicator: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.8,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
});
