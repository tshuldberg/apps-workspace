import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import {
  getAlertSettings,
  getDeviationEvents,
  getRecording,
  getSetting,
  MaterialSymbol,
  setSetting,
  updateAlertSettings,
  type AlertSettings,
  type DeviationEvent,
} from '@mylife/trails';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { TrailsChip, TrailsEmptyState, TrailsGlassCard, TrailsHero, TrailsScreen } from './_ui';

const ALERT_RULES_KEY = 'trails.alert.rules.v1';

interface ExtendedAlertRules {
  globalEnabled: boolean;
  offTrailEnabled: boolean;
  voiceEnabled: boolean;
  recordingOnly: boolean;
  elevationEnabled: boolean;
  elevationGainFeet: number;
  elevationRateFeetPerHour: number;
  distanceEnabled: boolean;
  distanceIntervalMiles: number;
  celebrationSound: boolean;
  timeEnabled: boolean;
  restReminderMinutes: number;
  turnAroundHour: number;
  sunsetWarning: boolean;
  weatherEnabled: boolean;
  weatherPush: boolean;
  weatherSevereOnly: boolean;
}

const DEFAULT_RULES: ExtendedAlertRules = {
  globalEnabled: true,
  offTrailEnabled: true,
  voiceEnabled: false,
  recordingOnly: true,
  elevationEnabled: false,
  elevationGainFeet: 1500,
  elevationRateFeetPerHour: 800,
  distanceEnabled: false,
  distanceIntervalMiles: 5,
  celebrationSound: true,
  timeEnabled: false,
  restReminderMinutes: 60,
  turnAroundHour: 16,
  sunsetWarning: true,
  weatherEnabled: false,
  weatherPush: true,
  weatherSevereOnly: true,
};

const OFF_TRAIL_FEET = [50, 100, 200, 500];
const ELEVATION_GAIN_OPTIONS = [1000, 1500, 2500, 4000];
const ELEVATION_RATE_OPTIONS = [500, 800, 1200, 1600];
const DISTANCE_INTERVALS = [1, 5, 10, 15];
const REST_INTERVALS = [30, 45, 60, 90];
const TURN_AROUND_HOURS = [14, 15, 16, 18];
const COOLDOWN_OPTIONS = [30, 60, 120, 300];

function readRules(raw: string | null): ExtendedAlertRules {
  if (!raw) {
    return DEFAULT_RULES;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ExtendedAlertRules>;
    return {
      ...DEFAULT_RULES,
      ...parsed,
    };
  } catch {
    return DEFAULT_RULES;
  }
}

function feetToMeters(value: number): number {
  return value * 0.3048;
}

function metersToFeet(value: number): number {
  return Math.round(value / 0.3048);
}

export default function AlertSettingsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((current) => current + 1), []);

  const settings = useMemo<AlertSettings>(() => getAlertSettings(db), [db, tick]);
  const rules = useMemo(() => readRules(getSetting(db, ALERT_RULES_KEY)), [db, tick]);
  const events = useMemo(() => getDeviationEvents(db, 8), [db, tick]);

  const persistRules = useCallback((patch: Partial<ExtendedAlertRules>) => {
    try {
      setSetting(db, ALERT_RULES_KEY, JSON.stringify({
        ...rules,
        ...patch,
      }));
      refresh();
    } catch {
      Alert.alert('Save failed', 'MyTrails could not persist that alert rule.');
    }
  }, [db, refresh, rules]);

  const persistCore = useCallback((patch: Partial<AlertSettings>) => {
    try {
      updateAlertSettings(db, patch);
      refresh();
    } catch {
      Alert.alert('Save failed', 'MyTrails could not update the core alert settings.');
    }
  }, [db, refresh]);

  const offTrailFeet = metersToFeet(settings.deviationThresholdMeters);
  const sectionsDisabled = !rules.globalEnabled;

  return (
    <TrailsScreen>
      <TrailsHero
        title="Alerts"
        subtitle="Tune wrong-turn warnings, milestone nudges, and weather safety rules without leaving the trail."
        action={<MaterialSymbol name="warning" size={22} color={colors.modules.trails} />}
      />

      <TrailsGlassCard style={styles.globalCard}>
        <View style={styles.globalHeader}>
          <View style={{ flex: 1 }}>
            <Text variant="subheading">Trail Alerts</Text>
            <Text variant="caption" color={colors.textSecondary}>
              A single master control for deviation, elevation, distance, time, and weather alerts.
            </Text>
          </View>
          <Switch
            value={rules.globalEnabled}
            onValueChange={(value) => persistRules({ globalEnabled: value })}
            trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(101,163,13,0.28)' }}
            thumbColor={rules.globalEnabled ? colors.modules.trails : colors.textTertiary}
          />
        </View>
        <View style={styles.quickPills}>
          <StatusPill label="Deviation" active={rules.offTrailEnabled && rules.globalEnabled} />
          <StatusPill label="Milestones" active={rules.distanceEnabled && rules.globalEnabled} />
          <StatusPill label="Weather" active={rules.weatherEnabled && rules.globalEnabled} />
        </View>
      </TrailsGlassCard>

      <RuleCard
        title="Off-Trail Alert"
        icon="route"
        disabled={sectionsDisabled}
        enabled={rules.offTrailEnabled}
        onToggle={(value) => persistRules({ offTrailEnabled: value })}
      >
        <OptionGroup label="Distance threshold">
          {OFF_TRAIL_FEET.map((feet) => (
            <TrailsChip
              key={feet}
              label={`${feet} ft`}
              active={Math.abs(offTrailFeet - feet) < 10}
              onPress={() => persistCore({ deviationThresholdMeters: feetToMeters(feet) })}
            />
          ))}
        </OptionGroup>

        <OptionGroup label="Alert cooldown">
          {COOLDOWN_OPTIONS.map((seconds) => (
            <TrailsChip
              key={seconds}
              label={seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}
              active={settings.alertCooldownSeconds === seconds}
              onPress={() => persistCore({ alertCooldownSeconds: seconds })}
            />
          ))}
        </OptionGroup>

        <ToggleRow
          label="Vibrate"
          description="Immediate haptic feedback when you leave the route corridor."
          value={settings.vibrationEnabled}
          onToggle={(value) => persistCore({ vibrationEnabled: value })}
          disabled={sectionsDisabled || !rules.offTrailEnabled}
        />
        <ToggleRow
          label="Sound"
          description="Play an audible alert when off-trail movement is detected."
          value={settings.soundEnabled}
          onToggle={(value) => persistCore({ soundEnabled: value })}
          disabled={sectionsDisabled || !rules.offTrailEnabled}
        />
        <ToggleRow
          label="Voice cue"
          description="Speak turn-back guidance over your device audio."
          value={rules.voiceEnabled}
          onToggle={(value) => persistRules({ voiceEnabled: value })}
          disabled={sectionsDisabled || !rules.offTrailEnabled}
        />
        <ToggleRow
          label="Only while recording"
          description="Suppress off-trail warnings when you are just browsing maps."
          value={rules.recordingOnly}
          onToggle={(value) => persistRules({ recordingOnly: value })}
          disabled={sectionsDisabled || !rules.offTrailEnabled}
        />
        <ToggleRow
          label="Auto-pause recording"
          description="Pause route capture automatically during prolonged deviation."
          value={settings.autoPauseOnDeviation}
          onToggle={(value) => persistCore({ autoPauseOnDeviation: value })}
          disabled={sectionsDisabled || !rules.offTrailEnabled}
        />
      </RuleCard>

      <RuleCard
        title="Elevation Gain Warning"
        icon="elevation"
        disabled={sectionsDisabled}
        enabled={rules.elevationEnabled}
        onToggle={(value) => persistRules({ elevationEnabled: value })}
      >
        <OptionGroup label="Gain threshold">
          {ELEVATION_GAIN_OPTIONS.map((feet) => (
            <TrailsChip
              key={feet}
              label={`${feet} ft`}
              active={rules.elevationGainFeet === feet}
              onPress={() => persistRules({ elevationGainFeet: feet })}
            />
          ))}
        </OptionGroup>
        <OptionGroup label="Rate threshold">
          {ELEVATION_RATE_OPTIONS.map((feet) => (
            <TrailsChip
              key={feet}
              label={`${feet}/hr`}
              active={rules.elevationRateFeetPerHour === feet}
              onPress={() => persistRules({ elevationRateFeetPerHour: feet })}
            />
          ))}
        </OptionGroup>
      </RuleCard>

      <RuleCard
        title="Distance Milestones"
        icon="straighten"
        disabled={sectionsDisabled}
        enabled={rules.distanceEnabled}
        onToggle={(value) => persistRules({ distanceEnabled: value })}
      >
        <OptionGroup label="Milestone interval">
          {DISTANCE_INTERVALS.map((miles) => (
            <TrailsChip
              key={miles}
              label={`${miles} mi`}
              active={rules.distanceIntervalMiles === miles}
              onPress={() => persistRules({ distanceIntervalMiles: miles })}
            />
          ))}
        </OptionGroup>
        <ToggleRow
          label="Celebratory sound"
          description="Play a subtle sound when you cross a milestone."
          value={rules.celebrationSound}
          onToggle={(value) => persistRules({ celebrationSound: value })}
          disabled={sectionsDisabled || !rules.distanceEnabled}
        />
      </RuleCard>

      <RuleCard
        title="Time-Based Alerts"
        icon="schedule"
        disabled={sectionsDisabled}
        enabled={rules.timeEnabled}
        onToggle={(value) => persistRules({ timeEnabled: value })}
      >
        <OptionGroup label="Rest reminder">
          {REST_INTERVALS.map((minutes) => (
            <TrailsChip
              key={minutes}
              label={`${minutes}m`}
              active={rules.restReminderMinutes === minutes}
              onPress={() => persistRules({ restReminderMinutes: minutes })}
            />
          ))}
        </OptionGroup>
        <OptionGroup label="Turn-around time">
          {TURN_AROUND_HOURS.map((hour) => (
            <TrailsChip
              key={hour}
              label={`${hour}:00`}
              active={rules.turnAroundHour === hour}
              onPress={() => persistRules({ turnAroundHour: hour })}
            />
          ))}
        </OptionGroup>
        <ToggleRow
          label="Sunset warning"
          description="Warn before the light drops based on the local trail weather forecast."
          value={rules.sunsetWarning}
          onToggle={(value) => persistRules({ sunsetWarning: value })}
          disabled={sectionsDisabled || !rules.timeEnabled}
        />
      </RuleCard>

      <RuleCard
        title="Weather Alerts"
        icon="cloud"
        disabled={sectionsDisabled}
        enabled={rules.weatherEnabled}
        onToggle={(value) => persistRules({ weatherEnabled: value })}
      >
        <ToggleRow
          label="Push severe changes"
          description="Notify when storms, wind, or heat spikes threaten the route."
          value={rules.weatherPush}
          onToggle={(value) => persistRules({ weatherPush: value })}
          disabled={sectionsDisabled || !rules.weatherEnabled}
        />
        <ToggleRow
          label="Severe conditions only"
          description="Keep warnings quiet unless the incoming conditions are genuinely risky."
          value={rules.weatherSevereOnly}
          onToggle={(value) => persistRules({ weatherSevereOnly: value })}
          disabled={sectionsDisabled || !rules.weatherEnabled}
        />
      </RuleCard>

      <TrailsGlassCard style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <View>
            <Text variant="subheading">Deviation Events</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Recent off-route detections pulled from `tr_deviation_events`.
            </Text>
          </View>
          <Text variant="caption" style={styles.historyCount}>
            {events.length} recent
          </Text>
        </View>

        {events.length === 0 ? (
          <TrailsEmptyState
            icon="🧭"
            title="No deviations logged"
            copy="Once you record a route and leave the trail corridor, recent events will show here."
          />
        ) : (
          <View style={styles.eventList}>
            {events.map((event) => (
              <DeviationEventRow key={event.id} event={event} recordingName={getRecording(db, event.recordingId)?.name ?? 'Trail recording'} />
            ))}
          </View>
        )}
      </TrailsGlassCard>
    </TrailsScreen>
  );
}

function RuleCard({
  title,
  icon,
  enabled,
  disabled,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <TrailsGlassCard style={[styles.ruleCard, disabled && styles.ruleCardDisabled]}>
      <View style={styles.ruleHeader}>
        <View style={styles.ruleTitleWrap}>
          <View style={styles.ruleIconWrap}>
            <MaterialSymbol name={icon} size={18} color={colors.modules.trails} />
          </View>
          <Text variant="subheading">{title}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(101,163,13,0.28)' }}
          thumbColor={enabled ? colors.modules.trails : colors.textTertiary}
        />
      </View>
      <View style={styles.ruleBody}>
        {children}
      </View>
    </TrailsGlassCard>
  );
}

function OptionGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.optionGroup}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onToggle,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}>
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(101,163,13,0.28)' }}
        thumbColor={value ? colors.modules.trails : colors.textTertiary}
      />
    </View>
  );
}

function StatusPill({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <View style={[styles.statusPill, active && styles.statusPillActive]}>
      <Text variant="caption" style={[styles.statusPillText, active && styles.statusPillTextActive]}>
        {label}
      </Text>
    </View>
  );
}

function DeviationEventRow({
  event,
  recordingName,
}: {
  event: DeviationEvent;
  recordingName: string;
}) {
  return (
    <Pressable style={styles.eventRow}>
      <View style={styles.eventLeading}>
        <View style={styles.eventIconWrap}>
          <MaterialSymbol
            name={event.acknowledged ? 'check_circle' : 'warning'}
            size={16}
            color={event.acknowledged ? colors.success : colors.modules.trails}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="body">{recordingName}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {Math.round(event.deviationMeters)} m off-route · {new Date(event.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>
      <Text
        variant="caption"
        style={[styles.eventBadge, event.acknowledged ? styles.eventBadgeMuted : styles.eventBadgeActive]}
      >
        {event.acknowledged ? 'Acknowledged' : 'New'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  globalCard: {
    gap: spacing.md,
  },
  globalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quickPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  statusPillActive: {
    backgroundColor: 'rgba(101,163,13,0.18)',
  },
  statusPillText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  statusPillTextActive: {
    color: colors.modules.trails,
  },
  ruleCard: {
    gap: spacing.md,
  },
  ruleCardDisabled: {
    opacity: 0.58,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  ruleTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ruleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(101,163,13,0.14)',
  },
  ruleBody: {
    gap: spacing.md,
  },
  optionGroup: {
    gap: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.sm,
  },
  toggleRowDisabled: {
    opacity: 0.65,
  },
  historyCard: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  historyCount: {
    color: colors.modules.trails,
    fontWeight: '700',
  },
  eventList: {
    gap: spacing.sm,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: spacing.sm,
  },
  eventLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  eventIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  eventBadge: {
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontWeight: '700',
  },
  eventBadgeActive: {
    backgroundColor: 'rgba(101,163,13,0.16)',
    color: colors.modules.trails,
  },
  eventBadgeMuted: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: colors.textSecondary,
  },
});
