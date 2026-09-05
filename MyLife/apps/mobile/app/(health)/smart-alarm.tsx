import { useMemo, useState, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, colors } from '@mylife/ui';
import {
  getAllAlarms,
  createAlarm,
  updateAlarm,
  getAllAlarmHistory,
  calculateSuccessRate,
  HEALTH_ACCENT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  HEALTH_CTA_GRADIENT,
  JAKARTA_FONTS,
  GlassCard,
  SectionHeader,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const DAY_ISO = [1, 2, 3, 4, 5, 6, 7] as const;

export default function SmartAlarmScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const alarms = useMemo(() => getAllAlarms(db), [db, tick]);
  const history = useMemo(() => getAllAlarmHistory(db), [db, tick]);
  const successRate = useMemo(() => calculateSuccessRate(history), [history]);
  const alarm = alarms.length > 0 ? alarms[0] : null;

  // Local state for alarm configuration
  const [enabled, setEnabled] = useState(alarm?.is_enabled === 1);
  const [hours, setHours] = useState(alarm ? parseInt(alarm.target_time.split(':')[0], 10) : 6);
  const [minutes, setMinutes] = useState(alarm ? parseInt(alarm.target_time.split(':')[1], 10) : 45);
  const [repeatDays, setRepeatDays] = useState<Set<number>>(() => {
    if (alarm) {
      return new Set(alarm.days_of_week.split(',').map(Number).filter((d) => d >= 1 && d <= 7));
    }
    return new Set([1, 2, 3, 4, 5]);
  });
  const [sound] = useState(alarm?.sound ?? 'Forest Dawn');
  const [haptic, setHaptic] = useState(alarm?.vibration === 1);

  const displayHour = hours % 12 || 12;
  const amPm = hours < 12 ? 'AM' : 'PM';

  const wakeWindowMin = alarm?.wake_window_minutes ?? 30;
  const windowStartH = (hours * 60 + minutes - wakeWindowMin + 1440) % 1440;
  const wStartHour = Math.floor(windowStartH / 60) % 12 || 12;
  const wStartMin = windowStartH % 60;
  const wStartAmPm = Math.floor(windowStartH / 60) < 12 ? 'AM' : 'PM';

  const persistAlarm = useCallback(() => {
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const daysStr = Array.from(repeatDays).sort().join(',');
    if (alarm) {
      updateAlarm(db, alarm.id, {
        target_time: timeStr,
        is_enabled: enabled ? 1 : 0,
        days_of_week: daysStr,
        sound,
        vibration: haptic ? 1 : 0,
      });
    } else {
      createAlarm(db, {
        target_time: timeStr,
        wake_window_minutes: 30,
        is_enabled: enabled ? 1 : 0,
        days_of_week: daysStr,
        sound,
        vibration: haptic ? 1 : 0,
        snooze_enabled: 1,
        snooze_duration_minutes: 5,
      });
    }
    refresh();
  }, [db, alarm, hours, minutes, enabled, repeatDays, sound, haptic, refresh]);

  const adjustHours = (delta: number) => {
    setHours((h) => (h + delta + 24) % 24);
  };

  const adjustMinutes = (delta: number) => {
    setMinutes((m) => {
      const next = m + delta;
      if (next >= 60) { adjustHours(1); return next - 60; }
      if (next < 0) { adjustHours(-1); return next + 60; }
      return next;
    });
  };

  const toggleDay = (day: number) => {
    setRepeatDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const toggleEnabled = (val: boolean) => {
    setEnabled(val);
    // Persist immediately on toggle
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const daysStr = Array.from(repeatDays).sort().join(',');
    if (alarm) {
      updateAlarm(db, alarm.id, { is_enabled: val ? 1 : 0, target_time: timeStr, days_of_week: daysStr, sound, vibration: haptic ? 1 : 0 });
    } else {
      createAlarm(db, {
        target_time: timeStr, wake_window_minutes: 30, is_enabled: val ? 1 : 0,
        days_of_week: daysStr, sound, vibration: haptic ? 1 : 0, snooze_enabled: 1, snooze_duration_minutes: 5,
      });
    }
    refresh();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Smart Alarm</Text>
          <Text style={styles.labelUpper}>OPTIMIZED WAKEUP</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggleEnabled}
          trackColor={{ false: HEALTH_SURFACES.focus, true: HEALTH_CTA_GRADIENT.from }}
          thumbColor={enabled ? '#FFFFFF' : HEALTH_SURFACES.highest}
        />
      </View>

      {/* Massive time display */}
      <View style={styles.timeSection}>
        <Pressable onPress={() => adjustHours(1)} hitSlop={12}>
          <Text style={styles.chevron}>{'\u25B2'}</Text>
        </Pressable>
        <View style={styles.timeRow}>
          <Pressable onPress={() => adjustMinutes(-5)} hitSlop={12} style={styles.timeAdjust}>
            <Text style={styles.chevronSmall}>{'\u25C0'}</Text>
          </Pressable>
          <Text style={styles.timeDisplay}>
            {String(displayHour).padStart(2, '0')}:{String(minutes).padStart(2, '0')}
          </Text>
          <Pressable onPress={() => adjustMinutes(5)} hitSlop={12} style={styles.timeAdjust}>
            <Text style={styles.chevronSmall}>{'\u25B6'}</Text>
          </Pressable>
          <Text style={styles.amPm}>{amPm}</Text>
        </View>
        <Pressable onPress={() => adjustHours(-1)} hitSlop={12}>
          <Text style={styles.chevron}>{'\u25BC'}</Text>
        </Pressable>
      </View>

      {/* Wake Window card */}
      <GlassCard level={2} style={styles.wakeCard}>
        <View style={styles.wakeHeader}>
          <Text style={styles.wakeIcon}>{'\u2728'}</Text>
          <Text style={styles.wakeTitleText}>{wakeWindowMin}MIN WAKE WINDOW</Text>
        </View>
        <Text style={styles.wakeDesc}>
          Our AI monitors your sleep cycles. We'll wake you up between{' '}
          <Text style={styles.wakeBold}>
            {String(wStartHour).padStart(2, '0')}:{String(wStartMin).padStart(2, '0')} {wStartAmPm}
          </Text>
          {' '}and{' '}
          <Text style={styles.wakeBold}>
            {String(displayHour).padStart(2, '0')}:{String(minutes).padStart(2, '0')} {amPm}
          </Text>
          {' '}when you are in your lightest sleep phase to ensure you feel refreshed.
        </Text>
      </GlassCard>

      {/* Repeat Days */}
      <SectionHeader title="Repeat Days" />
      <View style={styles.daysRow}>
        {DAY_LABELS.map((label, i) => {
          const isoDay = DAY_ISO[i];
          const active = repeatDays.has(isoDay);
          return (
            <Pressable
              key={isoDay}
              onPress={() => { toggleDay(isoDay); }}
              style={[styles.dayCircle, active && styles.dayCircleActive]}
            >
              <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Sound picker */}
      <GlassCard level={2} style={styles.optionCard}>
        <View style={styles.optionRow}>
          <Text style={styles.optionIcon}>{'\uD83C\uDFB5'}</Text>
          <Text style={styles.optionLabel}>SOUND</Text>
          <Text style={styles.optionValue}>{sound}</Text>
        </View>
      </GlassCard>

      {/* Snooze config */}
      <GlassCard level={2} style={styles.optionCard}>
        <View style={styles.optionRow}>
          <Text style={styles.optionIcon}>{'\u23F0'}</Text>
          <Text style={styles.optionLabel}>SNOOZE</Text>
          <Text style={styles.optionValue}>5 min, 3 times</Text>
        </View>
      </GlassCard>

      {/* Haptic Feedback */}
      <GlassCard level={2} style={styles.optionCard}>
        <View style={styles.optionRow}>
          <Text style={styles.optionIcon}>{'\uD83D\uDCF3'}</Text>
          <Text style={styles.optionLabel}>Haptic Feedback</Text>
          <View style={{ flex: 1 }} />
          <Switch
            value={haptic}
            onValueChange={(val) => setHaptic(val)}
            trackColor={{ false: HEALTH_SURFACES.focus, true: HEALTH_CTA_GRADIENT.from }}
            thumbColor={haptic ? '#FFFFFF' : HEALTH_SURFACES.highest}
          />
        </View>
      </GlassCard>

      {/* Save button */}
      <Pressable onPress={persistAlarm} style={styles.saveWrapper}>
        <LinearGradient
          colors={[HEALTH_CTA_GRADIENT.from, HEALTH_CTA_GRADIENT.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.saveGradient}
        >
          <Text style={styles.saveText}>Save Alarm</Text>
        </LinearGradient>
      </Pressable>

      {/* Recommended section */}
      <SectionHeader title="Recommended" />
      <GlassCard level={2} style={styles.recommendedCard}>
        <View style={styles.recommendedRow}>
          <View style={styles.recommendedInfo}>
            <Text style={styles.recommendedTitle}>Ambient Forest Mist</Text>
            <Text style={styles.recommendedSub}>Nature sounds to ease your wake</Text>
          </View>
          <Pressable style={styles.playBtn}>
            <Text style={styles.playIcon}>{'\u25B6'}</Text>
          </Pressable>
        </View>
      </GlassCard>

      {/* Success rate */}
      {history.length > 0 && (
        <>
          <SectionHeader title="Alarm Effectiveness" />
          <GlassCard level={2} style={styles.statsCard}>
            <Text style={styles.statsValue}>{successRate.rate}%</Text>
            <Text style={styles.statsLabel}>LIGHT SLEEP WAKES</Text>
            <Text style={styles.statsDetail}>
              {successRate.lightSleepWakes} of {successRate.total} alarms triggered during light sleep
            </Text>
          </GlassCard>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HEALTH_SURFACES.depth },
  content: { paddingBottom: 100, gap: 12 },

  // Title
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  labelUpper: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: HEALTH_ACCENT,
    marginTop: 2,
  },

  // Time display
  timeSection: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  chevron: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  chevronSmall: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  timeAdjust: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  timeDisplay: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 64,
    letterSpacing: -0.02 * 64,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  amPm: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: colors.textSecondary,
    marginLeft: 6,
    marginBottom: 8,
  },

  // Wake window card
  wakeCard: { marginHorizontal: 16, gap: 8 },
  wakeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wakeIcon: { fontSize: 18 },
  wakeTitleText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: HEALTH_CTA_GRADIENT.from,
  },
  wakeDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  wakeBold: {
    fontFamily: JAKARTA_FONTS.semiBold,
    color: colors.text,
  },

  // Days row
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: HEALTH_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: HEALTH_CTA_GRADIENT.from,
  },
  dayLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  dayLabelActive: {
    color: '#1a1008',
  },

  // Option cards
  optionCard: { marginHorizontal: 16 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionIcon: { fontSize: 18 },
  optionLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  optionValue: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.text,
    flex: 1,
    textAlign: 'right',
  },

  // Save button
  saveWrapper: { marginHorizontal: 16, marginTop: 4 },
  saveGradient: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: '#1a1008',
  },

  // Recommended
  recommendedCard: { marginHorizontal: 16 },
  recommendedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recommendedInfo: { flex: 1, gap: 2 },
  recommendedTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  recommendedSub: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: HEALTH_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 14,
    color: HEALTH_CTA_GRADIENT.from,
    marginLeft: 2,
  },

  // Stats
  statsCard: { marginHorizontal: 16, alignItems: 'center', gap: 4 },
  statsValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 36,
    color: HEALTH_ACCENT,
    fontVariant: ['tabular-nums'],
  },
  statsLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  statsDetail: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 2,
  },
});
