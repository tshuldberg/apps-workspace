import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getOverallStats,
  getSetting,
  setSetting,
} from '@mylife/meds';
import {
  GlassCard,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TYPOGRAPHY,
  SectionHeader,
  withAlpha,
} from '@mylife/meds/ui';
import {
  ExpandablePanel,
  FeatureTile,
  FilterChip,
  LabeledValueRow,
  MetricBadge,
  ScreenTitleBlock,
  SectionStack,
} from '../../../components/meds/phase1';
import { useDatabase } from '../../../components/DatabaseProvider';

const CLEAR_TABLES = [
  'md_dose_logs',
  'md_doses',
  'md_reminders',
  'md_refills',
  'md_interactions',
  'md_measurements',
  'md_mood_entries',
  'md_mood_activities',
  'md_symptom_logs',
  'md_bp_readings',
  'md_glucose_readings',
  'md_insulin_entries',
  'md_injection_sites',
  'md_caregivers',
  'md_caregiver_alert_config',
  'md_caregiver_alerts',
  'md_a1c_records',
  'md_fodmap_foods',
  'md_food_diary',
  'md_stool_logs',
  'md_weather_snapshots',
  'md_weather_symptom_links',
  'md_pain_entries',
  'md_cgm_readings',
  'md_cgm_sync_state',
  'md_medications',
];

type PanelKey = 'general' | 'notifications' | 'security' | 'data' | 'integrations';

export default function SettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    data: false,
    general: true,
    integrations: false,
    notifications: true,
    security: false,
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const settingsState = useMemo(() => {
    try {
      return {
        error: null,
        glucoseUnit: getSetting(db, 'glucose_unit') ?? 'mg/dL',
        passcodeEnabled: getSetting(db, 'passcode_enabled') ?? 'false',
        reminderLead: getSetting(db, 'reminder_lead_minutes') ?? '15',
        reportFormat: getSetting(db, 'default_report_format') ?? 'pdf',
        stats: getOverallStats(db),
      };
    } catch (error) {
      console.error('SettingsScreen load failed', error);
      return {
        error: 'Unable to load settings.',
        glucoseUnit: 'mg/dL',
        passcodeEnabled: 'false',
        reminderLead: '15',
        reportFormat: 'pdf',
        stats: null,
      };
    }
  }, [db, refreshKey]);

  const updateSetting = useCallback((key: string, value: string) => {
    setSetting(db, key, value);
    setRefreshKey((current) => current + 1);
  }, [db]);

  const togglePanel = useCallback((panel: PanelKey) => {
    setOpenPanels((current) => ({
      ...current,
      [panel]: !current[panel],
    }));
  }, []);

  const handleClearData = useCallback(() => {
    Alert.alert(
      'Clear all MyMeds data',
      'This deletes medications, logs, vitals, and exports from the local device database.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            db.transaction(() => {
              for (const table of CLEAR_TABLES) {
                db.execute(`DELETE FROM ${table}`);
              }
            });
            setRefreshKey((current) => current + 1);
          },
        },
      ],
    );
  }, [db]);

  if (settingsState.error || !settingsState.stats) {
    return (
      <View style={styles.screen}>
        <GlassCard padding={18} style={styles.panel}>
          <Text style={styles.errorTitle}>Settings unavailable</Text>
          <Text style={styles.errorBody}>{settingsState.error ?? 'Unable to load settings.'}</Text>
          <FilterChip label="Retry" onPress={onRefresh} selected />
        </GlassCard>
      </View>
    );
  }

  const featureTiles = [
    { key: 'a1c', icon: 'assignment', label: 'A1c Dashboard', onPress: () => router.push('/(meds)/a1c') },
    { key: 'cgm', icon: 'timeline', label: 'CGM Tracking', onPress: () => router.push('/(meds)/cgm') },
    { key: 'fodmap', icon: 'restaurant_menu', label: 'FODMAP Tracker', onPress: () => router.push('/(meds)/fodmap') },
    { key: 'pain', icon: 'healing', label: 'Pain Map', onPress: () => router.push('/(meds)/pain-map') },
    { key: 'weather', icon: 'cloud', label: 'Weather', onPress: () => router.push('/(meds)/weather') },
    { key: 'mood', icon: 'mood', label: 'Mood Journal', onPress: () => router.push('/(meds)/mood') },
    { key: 'caregivers', icon: 'family_restroom', label: 'Caregivers', onPress: () => router.push('/(meds)/caregivers') },
    { key: 'contacts', icon: 'contacts', label: 'Contacts', onPress: () => router.push('/(meds)/contacts') },
    { key: 'appointments', icon: 'event', label: 'Appointments', onPress: () => router.push('/(meds)/appointments') },
    { key: 'reports', icon: 'assignment', label: 'Clinical Reports', onPress: () => router.push('/(meds)/reports') },
    { key: 'export', icon: 'share', label: 'Export Data', onPress: () => router.push('/(meds)/export') },
    { key: 'interactions', icon: 'warning', label: 'Interactions', onPress: () => router.push('/(meds)/interactions') },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[MD_ACCENT_LIGHT]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={MD_ACCENT_LIGHT}
        />
      }
      style={styles.screen}
    >
      <SectionStack>
        <ScreenTitleBlock
          subtitle="Clinical shortcuts, dashboard customization, notifications, and data controls."
          title="More"
        />

        <View style={styles.metricsRow}>
          <MetricBadge label="Active meds" value={`${settingsState.stats.activeMedications}`} />
          <MetricBadge label="30D adherence" value={`${settingsState.stats.overallAdherence30d}%`} />
          <MetricBadge label="Mood logs" tone={MD_CHROME_GOLD} value={`${settingsState.stats.moodEntries30d}`} />
        </View>

        <GlassCard padding={18} style={styles.panel}>
          <SectionHeader title="Feature grid" />
          <View style={styles.featureGrid}>
            {featureTiles.map((tile) => (
              <FeatureTile
                key={tile.key}
                icon={tile.icon}
                label={tile.label}
                onPress={tile.onPress}
              />
            ))}
          </View>
        </GlassCard>

        <ExpandablePanel
          caption="Units, dashboard layout, and default display preferences."
          onToggle={() => togglePanel('general')}
          open={openPanels.general}
          title="General"
        >
          <LabeledValueRow label="Blood pressure unit" value="mmHg" />
          <LabeledValueRow
            detail="Switch between mg/dL and mmol/L on glucose surfaces."
            label="Glucose unit"
            value={settingsState.glucoseUnit}
          />
          <View style={styles.chipRail}>
            {['mg/dL', 'mmol/L'].map((unit) => (
              <FilterChip
                key={unit}
                label={unit}
                onPress={() => updateSetting('glucose_unit', unit)}
                selected={settingsState.glucoseUnit === unit}
              />
            ))}
          </View>
          <LabeledValueRow
            detail="Reorder sections and choose the layout style for the Today tab."
            label="Customize dashboard"
            onPress={() => router.push('/(meds)/home-style')}
            value="Open editor"
          />
        </ExpandablePanel>

        <ExpandablePanel
          caption="Reminder lead times, refill nudges, and the dose setup flow."
          onToggle={() => togglePanel('notifications')}
          open={openPanels.notifications}
          title="Notifications"
        >
          <LabeledValueRow label="Reminder lead time" value={`${settingsState.reminderLead} min`} />
          <View style={styles.chipRail}>
            {['5', '15', '30', '60'].map((minutes) => (
              <FilterChip
                key={minutes}
                label={`${minutes}m`}
                onPress={() => updateSetting('reminder_lead_minutes', minutes)}
                selected={settingsState.reminderLead === minutes}
              />
            ))}
          </View>
          <LabeledValueRow
            label="Dose reminder setup"
            onPress={() => router.push('/(meds)/notification-setup')}
            value="Configure"
          />
          <LabeledValueRow
            label="Notification settings"
            onPress={() => router.push('/(meds)/notification-settings')}
            value="Open"
          />
        </ExpandablePanel>

        <ExpandablePanel
          caption="Passcode, biometric lock, and local data protection."
          onToggle={() => togglePanel('security')}
          open={openPanels.security}
          title="Security"
        >
          <LabeledValueRow label="Passcode lock" value={settingsState.passcodeEnabled === 'true' ? 'On' : 'Off'} />
          <View style={styles.chipRail}>
            {['false', 'true'].map((value) => (
              <FilterChip
                key={value}
                label={value === 'true' ? 'Enable' : 'Disable'}
                onPress={() => updateSetting('passcode_enabled', value)}
                selected={settingsState.passcodeEnabled === value}
              />
            ))}
          </View>
          <LabeledValueRow
            label="Passcode and biometrics"
            onPress={() => router.push('/(meds)/passcode-lock')}
            value="Manage"
          />
        </ExpandablePanel>

        <ExpandablePanel
          caption="Exports, backups, and destructive local-device controls."
          onToggle={() => togglePanel('data')}
          open={openPanels.data}
          title="Data"
        >
          <LabeledValueRow label="Default report format" value={settingsState.reportFormat.toUpperCase()} />
          <View style={styles.chipRail}>
            {['pdf', 'csv', 'json'].map((format) => (
              <FilterChip
                key={format}
                label={format.toUpperCase()}
                onPress={() => updateSetting('default_report_format', format)}
                selected={settingsState.reportFormat === format}
              />
            ))}
          </View>
          <LabeledValueRow
            label="Export data"
            onPress={() => router.push('/(meds)/export')}
            value="Open"
          />
          <LabeledValueRow
            label="Clinical reports"
            onPress={() => router.push('/(meds)/reports')}
            value="Generate"
          />
          <LabeledValueRow
            detail="Removes medications, vitals, symptoms, and reminders from local storage."
            label="Clear all data"
            onPress={handleClearData}
            tone="#FFB4AB"
            value="Delete"
          />
        </ExpandablePanel>

        <ExpandablePanel
          caption="Current module connections and external health-device hooks."
          onToggle={() => togglePanel('integrations')}
          open={openPanels.integrations}
          title="Integrations"
        >
          <LabeledValueRow label="HealthKit sync" value="Planned" />
          <LabeledValueRow label="CGM device connection" onPress={() => router.push('/(meds)/cgm')} value="Review" />
          <LabeledValueRow label="Caregiver sharing" onPress={() => router.push('/(meds)/caregivers')} value="Manage" />
        </ExpandablePanel>
      </SectionStack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  panel: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 14,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  errorTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
  },
  errorBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
});
