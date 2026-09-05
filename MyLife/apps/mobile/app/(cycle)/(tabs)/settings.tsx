import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Baby,
  CalendarDays,
  ChevronRight,
  Database,
  Droplet,
  Info,
  Minus,
  Plus,
  Share2,
  Sparkles,
  Thermometer,
} from 'lucide-react-native';
import {
  GlassCard,
  getCycleStats,
  CYCLE_ACCENT,
  CYCLE_FONTS,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
  CYCLE_TYPOGRAPHY,
} from '@mylife/cycle';
import {
  getCycleTempUnit,
  setCycleTempUnit,
  type CycleTempUnit,
} from '../../../lib/cycle/preferences';
import { useDatabase } from '../../../components/DatabaseProvider';

type TrackingMode = 'period_fertility' | 'period_only' | 'pregnancy';

const APP_VERSION = '1.0.0';

export default function CycleSettingsScreen() {
  const db = useDatabase();
  const router = useRouter();

  const stats = useMemo(() => {
    try {
      return getCycleStats(db);
    } catch {
      return null;
    }
  }, [db]);

  const defaultCycleLength = stats?.averageCycleLength
    ? Math.round(stats.averageCycleLength)
    : 28;
  const defaultPeriodLength = stats?.averagePeriodLength
    ? Math.round(stats.averagePeriodLength)
    : 5;

  const [cycleLength, setCycleLength] = useState<number>(defaultCycleLength);
  const [periodLength, setPeriodLength] = useState<number>(defaultPeriodLength);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>(
    'period_fertility',
  );
  const [tempUnit, setTempUnit] = useState<CycleTempUnit>(getCycleTempUnit);

  const [enablePredictions, setEnablePredictions] = useState(true);
  const [notifyPeriod, setNotifyPeriod] = useState(true);
  const [notifyFertile, setNotifyFertile] = useState(false);

  const handleClearData = useCallback(() => {
    Alert.alert(
      'Clear all cycle data?',
      'This deletes every cycle, day log, symptom, and temperature reading. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Coming soon',
              'Bulk delete is wired in P3. Use the Hub Data tools for now.',
            );
          },
        },
      ],
    );
  }, []);

  const handleExport = useCallback(() => {
    Alert.alert('Export', 'CSV export ships in P3 with the data tools.');
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroWrap}>
          <RNText style={styles.heroTitle}>Settings</RNText>
          <RNText style={styles.heroSub}>
            Manage your cycle parameters, predictions, and data privacy.
          </RNText>
        </View>

        <SectionLabel>Tracking</SectionLabel>
        <GlassCard style={styles.sectionCard}>
          <Stepper
            icon={<CalendarDays size={18} color={CYCLE_ACCENT} strokeWidth={2} />}
            label="Average cycle length"
            sub="Average days between periods"
            value={cycleLength}
            min={20}
            max={45}
            onChange={setCycleLength}
          />
          <Divider />
          <Stepper
            icon={
              <Droplet
                size={18}
                color={CYCLE_PHASE_COLORS.menstrual}
                strokeWidth={2}
              />
            }
            label="Average period length"
            sub="Average duration of bleeding"
            value={periodLength}
            min={1}
            max={10}
            onChange={setPeriodLength}
          />
          <Divider />
          <Choice
            icon={
              <Sparkles
                size={18}
                color={CYCLE_PHASE_COLORS.ovulation}
                strokeWidth={2}
              />
            }
            label="Tracking mode"
            value={trackingModeLabel(trackingMode)}
            onPress={() => {
              const next: TrackingMode =
                trackingMode === 'period_fertility'
                  ? 'period_only'
                  : trackingMode === 'period_only'
                    ? 'pregnancy'
                    : 'period_fertility';
              setTrackingMode(next);
            }}
          />
          <Divider />
          <Toggle
            icon={
              <Thermometer
                size={18}
                color={CYCLE_PHASE_COLORS.follicular}
                strokeWidth={2}
              />
            }
            label="Temperature unit"
            sub={tempUnit === 'fahrenheit' ? 'Fahrenheit (°F)' : 'Celsius (°C)'}
            value={tempUnit === 'fahrenheit'}
            onChange={(on) => {
              const nextUnit: CycleTempUnit = on ? 'fahrenheit' : 'celsius';
              setTempUnit(nextUnit);
              setCycleTempUnit(nextUnit);
            }}
          />
        </GlassCard>

        <SectionLabel>Predictions</SectionLabel>
        <GlassCard style={styles.sectionCard}>
          <Toggle
            label="Enable predictions"
            sub="Use cycle history to forecast next period"
            value={enablePredictions}
            onChange={setEnablePredictions}
          />
          <Divider />
          <Toggle
            label="Period reminder"
            sub="Notify me before my next period"
            value={notifyPeriod}
            onChange={setNotifyPeriod}
          />
          <Divider />
          <Toggle
            label="Fertile window alerts"
            sub="Notify me at the start of fertility"
            value={notifyFertile}
            onChange={setNotifyFertile}
          />
        </GlassCard>

        <SectionLabel>Pregnancy</SectionLabel>
        <GlassCard
          onPress={() => router.push('/(cycle)/pregnancy')}
          style={styles.sectionCard}
        >
          <Row
            icon={<Baby size={18} color={CYCLE_ACCENT} strokeWidth={2} />}
            label="Pregnancy mode"
            sub="Pause cycle tracking and start a pregnancy journey"
            trailing={
              <ChevronRight
                size={18}
                color="rgba(214, 195, 181, 0.5)"
                strokeWidth={2}
              />
            }
          />
        </GlassCard>

        <SectionLabel>Partner Sharing</SectionLabel>
        <GlassCard
          onPress={() => router.push('/(cycle)/sharing')}
          style={styles.sectionCard}
        >
          <Row
            icon={
              <Share2
                size={18}
                color={CYCLE_PHASE_COLORS.ovulation}
                strokeWidth={2}
              />
            }
            label="Manage partner link"
            sub="Share a private snapshot with someone you trust"
            trailing={
              <ChevronRight
                size={18}
                color="rgba(214, 195, 181, 0.5)"
                strokeWidth={2}
              />
            }
          />
        </GlassCard>

        <SectionLabel>Data</SectionLabel>
        <GlassCard style={styles.sectionCard}>
          <Row
            icon={<Database size={18} color={CYCLE_ACCENT} strokeWidth={2} />}
            label="Export data"
            sub="Download a CSV of cycles, symptoms, and temperatures"
            trailing={
              <ChevronRight
                size={18}
                color="rgba(214, 195, 181, 0.5)"
                strokeWidth={2}
              />
            }
            onPress={handleExport}
          />
          <Divider />
          <Row
            icon={
              <Database
                size={18}
                color={CYCLE_PHASE_COLORS.menstrual}
                strokeWidth={2}
              />
            }
            label="Clear all cycle data"
            sub="Permanently delete every entry on this device"
            trailing={
              <RNText style={styles.danger}>Delete</RNText>
            }
            onPress={handleClearData}
            destructive
          />
        </GlassCard>

        <SectionLabel>About</SectionLabel>
        <GlassCard style={styles.sectionCard}>
          <Row
            icon={<Info size={18} color={CYCLE_ACCENT} strokeWidth={2} />}
            label="Version"
            sub={APP_VERSION}
          />
          <Divider />
          <Row
            icon={<Info size={18} color={CYCLE_ACCENT} strokeWidth={2} />}
            label="Privacy policy"
            trailing={
              <ChevronRight
                size={18}
                color="rgba(214, 195, 181, 0.5)"
                strokeWidth={2}
              />
            }
            onPress={() =>
              Alert.alert('Privacy', 'MyCycle stores all data locally on this device.')
            }
          />
          <Divider />
          <Row
            icon={<Info size={18} color={CYCLE_ACCENT} strokeWidth={2} />}
            label="Support"
            trailing={
              <ChevronRight
                size={18}
                color="rgba(214, 195, 181, 0.5)"
                strokeWidth={2}
              />
            }
            onPress={() => Alert.alert('Support', 'Reach the MyLife team via the hub.')}
          />
        </GlassCard>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <RNText style={styles.sectionLabel}>{children.toUpperCase()}</RNText>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function Stepper({
  icon,
  label,
  sub,
  value,
  min,
  max,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.row}>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={styles.rowBody}>
        <RNText style={styles.rowLabel}>{label}</RNText>
        {sub ? <RNText style={styles.rowSub}>{sub}</RNText> : null}
      </View>
      <View style={styles.stepperWrap}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          style={({ pressed }) => [
            styles.stepperButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Minus size={16} color="#E4E1E9" strokeWidth={2.2} />
        </Pressable>
        <RNText style={styles.stepperValue}>{value}</RNText>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          style={({ pressed }) => [
            styles.stepperButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Plus size={16} color={CYCLE_ACCENT} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

function Toggle({
  icon,
  label,
  sub,
  value,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={styles.rowBody}>
        <RNText style={styles.rowLabel}>{label}</RNText>
        {sub ? <RNText style={styles.rowSub}>{sub}</RNText> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          false: CYCLE_SURFACES.highest,
          true: `${CYCLE_ACCENT}AA`,
        }}
        thumbColor={value ? CYCLE_ACCENT : 'rgba(214, 195, 181, 0.6)'}
      />
    </View>
  );
}

function Choice({
  icon,
  label,
  value,
  onPress,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { opacity: 0.7 },
      ]}
    >
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={styles.rowBody}>
        <RNText style={styles.rowLabel}>{label}</RNText>
        <RNText style={styles.rowSub}>{value}</RNText>
      </View>
      <ChevronRight
        size={18}
        color="rgba(214, 195, 181, 0.5)"
        strokeWidth={2}
      />
    </Pressable>
  );
}

function Row({
  icon,
  label,
  sub,
  trailing,
  onPress,
  destructive,
}: {
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const body = (
    <>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={styles.rowBody}>
        <RNText
          style={[
            styles.rowLabel,
            destructive ? { color: CYCLE_PHASE_COLORS.menstrual } : null,
          ]}
        >
          {label}
        </RNText>
        {sub ? <RNText style={styles.rowSub}>{sub}</RNText> : null}
      </View>
      {trailing}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={styles.row}>{body}</View>;
}

function trackingModeLabel(mode: TrackingMode): string {
  if (mode === 'period_only') return 'Period only';
  if (mode === 'pregnancy') return 'Pregnancy';
  return 'Period & Fertility';
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
    paddingTop: 32,
    paddingBottom: 160,
    gap: 18,
  },
  heroWrap: {
    gap: 6,
    marginBottom: 6,
  },
  heroTitle: {
    ...CYCLE_TYPOGRAPHY.displayMd,
    color: '#E4E1E9',
  },
  heroSub: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.85)',
  },
  sectionLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.6)',
    marginTop: 6,
    marginBottom: -8,
    paddingHorizontal: 4,
  },
  sectionCard: {
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CYCLE_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 14,
    color: '#E4E1E9',
  },
  rowSub: {
    fontFamily: CYCLE_FONTS.regular,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.75)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginHorizontal: 18,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: CYCLE_SURFACES.high,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 16,
    color: '#E4E1E9',
    minWidth: 24,
    textAlign: 'center',
  },
  danger: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 12,
    color: CYCLE_PHASE_COLORS.menstrual,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
