import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getSetting, setSetting } from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_FONTS,
  MD_SURFACES,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { sendMedsTestNotificationAsync } from '../../lib/meds-notifications';

type SettingsState = {
  masterEnabled: boolean;
  showMedicationNames: boolean;
  doseEnabled: boolean;
  doseLeadMinutes: string;
  doseSound: string;
  snoozeMinutes: string;
  refillEnabled: boolean;
  missedDoseEnabled: boolean;
  vitalsEnabled: boolean;
  appointmentEnabled: boolean;
  caregiverEnabled: boolean;
  weatherEnabled: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
};

const LEAD_OPTIONS = ['5', '15', '30', '60'] as const;
const SOUND_OPTIONS = ['Default', 'Gentle', 'Bell', 'Silent'] as const;
const SNOOZE_OPTIONS = ['5', '10', '15', '30'] as const;
const QUIET_HOUR_OPTIONS = ['9:00 PM', '10:00 PM', '11:00 PM', '12:00 AM'] as const;
const QUIET_END_OPTIONS = ['5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM'] as const;

const ALERT_SECTIONS = [
  {
    key: 'refillEnabled',
    settingKey: 'notifications.refill.enabled',
    icon: 'inventory_2',
    title: 'Refill reminders',
    body: 'Warn when supply is running low or your refill window opens.',
  },
  {
    key: 'missedDoseEnabled',
    settingKey: 'notifications.missed_dose.enabled',
    icon: 'warning',
    title: 'Missed dose alerts',
    body: 'Escalate when a scheduled dose has not been logged on time.',
  },
  {
    key: 'vitalsEnabled',
    settingKey: 'notifications.vitals.enabled',
    icon: 'monitor_heart',
    title: 'Vitals log nudges',
    body: 'Prompt for BP, glucose, insulin, mood, or pain check-ins.',
  },
  {
    key: 'appointmentEnabled',
    settingKey: 'notifications.appointments.enabled',
    icon: 'event',
    title: 'Appointment reminders',
    body: 'Surface upcoming visits, prep notes, and linked medication lists.',
  },
  {
    key: 'caregiverEnabled',
    settingKey: 'notifications.caregiver.enabled',
    icon: 'family_restroom',
    title: 'Caregiver alerts',
    body: 'Mirror missed-dose or wellness issues to your caregiver workflow.',
  },
  {
    key: 'weatherEnabled',
    settingKey: 'notifications.weather.enabled',
    icon: 'cloud',
    title: 'Weather trigger alerts',
    body: 'Send symptom-risk nudges when pressure, temperature, or humidity shifts.',
  },
] as const;

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }
  return value === 'true';
}

function buildInitialState(db: ReturnType<typeof useDatabase>): SettingsState {
  return {
    masterEnabled: readBoolean(getSetting(db, 'notifications.master_enabled'), true),
    showMedicationNames: readBoolean(getSetting(db, 'notifications.show_medication_names'), true),
    doseEnabled: readBoolean(getSetting(db, 'notifications.dose.enabled'), true),
    doseLeadMinutes: getSetting(db, 'notifications.dose.lead_minutes') ?? '15',
    doseSound: getSetting(db, 'notifications.dose.sound') ?? 'Default',
    snoozeMinutes: getSetting(db, 'notifications.dose.snooze_minutes') ?? '10',
    refillEnabled: readBoolean(getSetting(db, 'notifications.refill.enabled'), true),
    missedDoseEnabled: readBoolean(getSetting(db, 'notifications.missed_dose.enabled'), true),
    vitalsEnabled: readBoolean(getSetting(db, 'notifications.vitals.enabled'), false),
    appointmentEnabled: readBoolean(getSetting(db, 'notifications.appointments.enabled'), true),
    caregiverEnabled: readBoolean(getSetting(db, 'notifications.caregiver.enabled'), false),
    weatherEnabled: readBoolean(getSetting(db, 'notifications.weather.enabled'), false),
    quietHoursEnabled: readBoolean(getSetting(db, 'notifications.quiet_hours.enabled'), false),
    quietStart: getSetting(db, 'notifications.quiet_hours.start') ?? '10:00 PM',
    quietEnd: getSetting(db, 'notifications.quiet_hours.end') ?? '7:00 AM',
  };
}

export default function NotificationSettingsScreen() {
  const db = useDatabase();
  const [settings, setSettings] = useState<SettingsState>(() => buildInitialState(db));
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setSettings(buildInitialState(db));
  }, [db]);

  const updateBoolean = (stateKey: keyof SettingsState, settingKey: string, value: boolean) => {
    setSettings((current) => ({ ...current, [stateKey]: value }));
    setSetting(db, settingKey, value ? 'true' : 'false');
  };

  const updateValue = (stateKey: keyof SettingsState, settingKey: string, value: string) => {
    setSettings((current) => ({ ...current, [stateKey]: value }));
    setSetting(db, settingKey, value);
  };

  const handleTestNotification = async () => {
    if (!settings.masterEnabled) {
      Alert.alert('Notifications disabled', 'Enable the master notifications toggle before sending a test alert.');
      return;
    }

    setTesting(true);
    try {
      await sendMedsTestNotificationAsync(
        'MyMeds reminder test',
        settings.showMedicationNames
          ? 'Dose alerts will include medication names in the notification body.'
          : 'Dose alerts are configured to hide medication names for privacy.',
      );
      Alert.alert('Test scheduled', 'A reminder test should arrive in a few seconds.');
    } catch {
      Alert.alert('Test failed', 'MyMeds could not schedule the test reminder.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCopy}>
        <Text style={styles.heroTitle}>Notifications</Text>
        <Text style={styles.heroBody}>
          Fine-tune reminder timing, privacy, quiet hours, and escalation rules for your care schedule.
        </Text>
      </View>

      <GlassCard style={styles.heroCard}>
        <View style={styles.rowBetween}>
          <View style={styles.heroCardCopy}>
            <Text style={styles.sectionEyebrow}>Master Channel</Text>
            <Text style={styles.sectionTitle}>Keep MyMeds allowed to notify you</Text>
            <Text style={styles.sectionBody}>
              Turn the full reminder stack on or off while preserving your per-alert preferences.
            </Text>
          </View>
          <TogglePill
            enabled={settings.masterEnabled}
            onPress={() =>
              updateBoolean('masterEnabled', 'notifications.master_enabled', !settings.masterEnabled)
            }
          />
        </View>

        <View style={styles.heroFooter}>
          <View style={styles.heroMetric}>
            <MaterialSymbol color={MD_ACCENT_LIGHT} name="notifications" size={16} />
            <Text style={styles.heroMetricText}>
              {settings.masterEnabled ? 'Channel live' : 'Channel muted'}
            </Text>
          </View>
          <Pressable disabled={testing} onPress={() => void handleTestNotification()} style={[styles.inlineButton, testing ? styles.disabled : null]}>
            <MaterialSymbol color={MD_CHROME_GOLD} name="alarm" size={14} />
            <Text style={styles.inlineButtonText}>{testing ? 'Scheduling...' : 'Send test alert'}</Text>
          </Pressable>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.rowBetween}>
          <View style={styles.sectionMainCopy}>
            <Text style={styles.sectionTitle}>Notification privacy</Text>
            <Text style={styles.sectionBody}>
              Choose whether medication names appear in lock-screen alerts.
            </Text>
          </View>
          <TogglePill
            enabled={settings.showMedicationNames}
            onPress={() =>
              updateBoolean(
                'showMedicationNames',
                'notifications.show_medication_names',
                !settings.showMedicationNames,
              )
            }
          />
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.rowBetween}>
          <View style={styles.sectionMainCopy}>
            <Text style={styles.sectionTitle}>Dose reminders</Text>
            <Text style={styles.sectionBody}>
              Configure how early MyMeds alerts you and how the reminder behaves after a snooze.
            </Text>
          </View>
          <TogglePill
            enabled={settings.doseEnabled}
            onPress={() =>
              updateBoolean('doseEnabled', 'notifications.dose.enabled', !settings.doseEnabled)
            }
          />
        </View>

        <OptionGroup
          label="Lead time"
          options={LEAD_OPTIONS}
          selected={settings.doseLeadMinutes}
          renderLabel={(value) => `${value} min`}
          onSelect={(value) => updateValue('doseLeadMinutes', 'notifications.dose.lead_minutes', value)}
        />

        <OptionGroup
          label="Alert tone"
          options={SOUND_OPTIONS}
          selected={settings.doseSound}
          renderLabel={(value) => value}
          onSelect={(value) => updateValue('doseSound', 'notifications.dose.sound', value)}
        />

        <OptionGroup
          label="Snooze duration"
          options={SNOOZE_OPTIONS}
          selected={settings.snoozeMinutes}
          renderLabel={(value) => `${value} min`}
          onSelect={(value) => updateValue('snoozeMinutes', 'notifications.dose.snooze_minutes', value)}
        />
      </GlassCard>

      {ALERT_SECTIONS.map((section) => (
        <GlassCard key={section.settingKey} style={styles.sectionCard}>
          <View style={styles.rowBetween}>
            <View style={styles.alertRow}>
              <View style={styles.alertIconShell}>
                <MaterialSymbol color={MD_ACCENT_LIGHT} name={section.icon} size={18} />
              </View>
              <View style={styles.alertCopy}>
                <Text style={styles.alertTitle}>{section.title}</Text>
                <Text style={styles.alertBody}>{section.body}</Text>
              </View>
            </View>
            <TogglePill
              enabled={settings[section.key]}
              onPress={() => updateBoolean(section.key, section.settingKey, !settings[section.key])}
            />
          </View>
        </GlassCard>
      ))}

      <GlassCard style={styles.sectionCard}>
        <View style={styles.rowBetween}>
          <View style={styles.sectionMainCopy}>
            <Text style={styles.sectionTitle}>Quiet hours</Text>
            <Text style={styles.sectionBody}>
              Pause non-critical reminders overnight while keeping your schedule intact.
            </Text>
          </View>
          <TogglePill
            enabled={settings.quietHoursEnabled}
            onPress={() =>
              updateBoolean(
                'quietHoursEnabled',
                'notifications.quiet_hours.enabled',
                !settings.quietHoursEnabled,
              )
            }
          />
        </View>

        <OptionGroup
          label="Quiet starts"
          options={QUIET_HOUR_OPTIONS}
          selected={settings.quietStart}
          renderLabel={(value) => value}
          onSelect={(value) => updateValue('quietStart', 'notifications.quiet_hours.start', value)}
        />

        <OptionGroup
          label="Quiet ends"
          options={QUIET_END_OPTIONS}
          selected={settings.quietEnd}
          renderLabel={(value) => value}
          onSelect={(value) => updateValue('quietEnd', 'notifications.quiet_hours.end', value)}
        />
      </GlassCard>
    </ScrollView>
  );
}

function OptionGroup<T extends string>({
  label,
  options,
  selected,
  renderLabel,
  onSelect,
}: {
  label: string;
  options: readonly T[];
  selected: T | string;
  renderLabel: (value: T) => string;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const active = option === selected;
          return (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              style={[
                styles.optionChip,
                active ? styles.optionChipActive : null,
              ]}
            >
              <Text style={[styles.optionChipText, active ? styles.optionChipTextActive : null]}>
                {renderLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TogglePill({
  enabled,
  onPress,
}: {
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={onPress}
      style={[
        styles.toggleTrack,
        enabled ? styles.toggleTrackActive : null,
      ]}
    >
      <View style={[styles.toggleThumb, enabled ? styles.toggleThumbActive : null]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    gap: 14,
    paddingBottom: 140,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  heroCopy: {
    gap: 8,
  },
  heroTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.extraBold,
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  heroBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  heroCard: {
    gap: 18,
    padding: 18,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroCardCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 16,
  },
  sectionEyebrow: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  sectionBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  heroFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroMetric: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  heroMetricText: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 13,
  },
  inlineButton: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_CHROME_GOLD, 0.12),
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  inlineButtonText: {
    color: MD_CHROME_GOLD,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  sectionCard: {
    gap: 16,
    padding: 18,
  },
  sectionMainCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 16,
  },
  optionGroup: {
    gap: 10,
  },
  optionLabel: {
    color: '#9F8E81',
    fontFamily: MD_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 999,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  optionChipActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.2),
  },
  optionChipText: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 12,
  },
  optionChipTextActive: {
    color: '#E4E1E9',
  },
  alertRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    paddingRight: 16,
  },
  alertIconShell: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.14),
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  alertCopy: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    color: '#E4E1E9',
    fontFamily: MD_FONTS.semiBold,
    fontSize: 15,
  },
  alertBody: {
    color: '#D6C3B5',
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  toggleTrack: {
    backgroundColor: withAlpha('#FFFFFF', 0.12),
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 4,
    width: 54,
  },
  toggleTrackActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.4),
  },
  toggleThumb: {
    backgroundColor: '#9F8E81',
    borderRadius: 11,
    height: 22,
    width: 22,
  },
  toggleThumbActive: {
    backgroundColor: MD_ACCENT,
    marginLeft: 24,
  },
  disabled: {
    opacity: 0.55,
  },
});
