import { StyleSheet, Text, View } from 'react-native';
import { MK_ACCENT, MK_SURFACES, MK_TEXT, MK_TEXT_SECONDARY, MK_TYPOGRAPHY } from '../tokens';

export interface StatusTimelineStep {
  label: string;
  completedAt?: string;
  current?: boolean;
}

export interface StatusTimelineProps {
  steps: StatusTimelineStep[];
  orientation?: 'vertical' | 'horizontal';
}

export function StatusTimeline({
  steps,
  orientation = 'vertical',
}: StatusTimelineProps) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <View
      style={[
        styles.container,
        isHorizontal ? styles.horizontal : styles.vertical,
      ]}
    >
      {steps.map((step, index) => {
        const completed = Boolean(step.completedAt);
        const isLast = index === steps.length - 1;
        const dotStyle = completed
          ? styles.dotCompleted
          : step.current
            ? styles.dotCurrent
            : styles.dotPending;

        return (
          <View
            key={`${step.label}-${index}`}
            style={[
              styles.step,
              isHorizontal ? styles.stepHorizontal : styles.stepVertical,
            ]}
          >
            <View
              style={[
                styles.markerWrap,
                isHorizontal ? styles.markerHorizontal : styles.markerVertical,
              ]}
            >
              <View style={[styles.dot, dotStyle]} />
              {!isLast ? (
                <View
                  style={[
                    styles.line,
                    isHorizontal ? styles.lineHorizontal : styles.lineVertical,
                    completed ? styles.lineCompleted : styles.linePending,
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.label}>{step.label}</Text>
              {step.completedAt ? (
                <Text style={styles.meta}>{step.completedAt}</Text>
              ) : step.current ? (
                <Text style={styles.meta}>Current</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  vertical: {
    flexDirection: 'column',
  },
  horizontal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  step: {
    gap: 10,
  },
  stepVertical: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepHorizontal: {
    flex: 1,
  },
  markerWrap: {
    alignItems: 'center',
  },
  markerVertical: {
    width: 20,
  },
  markerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotCompleted: {
    backgroundColor: MK_ACCENT,
  },
  dotCurrent: {
    backgroundColor: MK_ACCENT,
    shadowColor: MK_ACCENT,
    shadowOpacity: 0.36,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  dotPending: {
    backgroundColor: MK_SURFACES.highest,
  },
  line: {
    backgroundColor: MK_SURFACES.high,
  },
  lineVertical: {
    width: 2,
    minHeight: 34,
    marginTop: 4,
  },
  lineHorizontal: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
  },
  lineCompleted: {
    backgroundColor: MK_ACCENT,
  },
  linePending: {
    backgroundColor: MK_SURFACES.high,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  meta: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
});
