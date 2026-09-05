import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { countFavoriteSpots, countSessions, countSpots } from '@mylife/surf';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  SURF_ACCENT,
  SurfChip,
  SurfGlassCard,
  SurfMetricCard,
  SurfScreen,
  SurfSection,
} from './_ui';

export default function SurfSettingsScreen() {
  const db = useDatabase();
  const [waveUnit, setWaveUnit] = useState<'ft' | 'm'>('ft');
  const [windUnit, setWindUnit] = useState<'kts' | 'mph'>('kts');
  const [distanceUnit, setDistanceUnit] = useState<'mi' | 'km'>('mi');
  const [defaultRegion, setDefaultRegion] = useState('California');
  const [dailyForecast, setDailyForecast] = useState(true);
  const [swellAlerts, setSwellAlerts] = useState(true);
  const [sessionReminders, setSessionReminders] = useState(false);
  const [crewActivity, setCrewActivity] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  const metrics = useMemo(
    () => ({
      spots: countSpots(db),
      favorites: countFavoriteSpots(db),
      sessions: countSessions(db),
    }),
    [db],
  );

  return (
    <SurfScreen>
      <SurfSection eyebrow="Settings" title="Session + Forecast Preferences">
        <View style={styles.metricGrid}>
          <SurfMetricCard label="Tracked Spots" value={String(metrics.spots)} />
          <SurfMetricCard label="Favorites" value={String(metrics.favorites)} />
          <SurfMetricCard label="Sessions" value={String(metrics.sessions)} />
        </View>
      </SurfSection>

      <SurfSection title="Units">
        <SurfGlassCard>
          <Text variant="caption" color={colors.textSecondary}>
            Waves
          </Text>
          <View style={styles.rowWrap}>
            <SurfChip label="Wave ft" active={waveUnit === 'ft'} onPress={() => setWaveUnit('ft')} />
            <SurfChip label="Wave m" active={waveUnit === 'm'} onPress={() => setWaveUnit('m')} />
          </View>
          <Text variant="caption" color={colors.textSecondary}>
            Wind
          </Text>
          <View style={styles.rowWrap}>
            <SurfChip label="Wind kts" active={windUnit === 'kts'} onPress={() => setWindUnit('kts')} />
            <SurfChip label="Wind mph" active={windUnit === 'mph'} onPress={() => setWindUnit('mph')} />
          </View>
          <Text variant="caption" color={colors.textSecondary}>
            Distance
          </Text>
          <View style={styles.rowWrap}>
            <SurfChip label="Distance mi" active={distanceUnit === 'mi'} onPress={() => setDistanceUnit('mi')} />
            <SurfChip label="Distance km" active={distanceUnit === 'km'} onPress={() => setDistanceUnit('km')} />
          </View>
        </SurfGlassCard>
      </SurfSection>

      <SurfSection title="Default Region">
        <SurfGlassCard>
          <View style={styles.rowWrap}>
            {['California', 'Hawaii', 'East Coast', 'Portugal'].map((region) => (
              <SurfChip
                key={region}
                label={region}
                active={defaultRegion === region}
                onPress={() => setDefaultRegion(region)}
              />
            ))}
          </View>
        </SurfGlassCard>
      </SurfSection>

      <SurfSection title="Sync">
        <SurfGlassCard>
          <SettingRow
            label="Supabase Sync"
            value="Synced 4m ago"
            valueColor={colors.success}
          />
          <Divider />
          <SettingRow
            label="Offline Mode"
            value={offlineMode ? 'ON' : 'OFF'}
            valueColor={offlineMode ? SURF_ACCENT : colors.textTertiary}
            onPress={() => setOfflineMode((value) => !value)}
          />
        </SurfGlassCard>
      </SurfSection>

      <SurfSection title="Notifications">
        <SurfGlassCard>
          <SettingRow
            label="Daily Forecast"
            value={dailyForecast ? 'ON' : 'OFF'}
            valueColor={dailyForecast ? SURF_ACCENT : colors.textTertiary}
            onPress={() => setDailyForecast((value) => !value)}
          />
          <Divider />
          <SettingRow
            label="Swell Alerts"
            value={swellAlerts ? 'ON' : 'OFF'}
            valueColor={swellAlerts ? SURF_ACCENT : colors.textTertiary}
            onPress={() => setSwellAlerts((value) => !value)}
          />
          <Divider />
          <SettingRow
            label="Session Reminders"
            value={sessionReminders ? 'ON' : 'OFF'}
            valueColor={sessionReminders ? SURF_ACCENT : colors.textTertiary}
            onPress={() => setSessionReminders((value) => !value)}
          />
          <Divider />
          <SettingRow
            label="Crew Activity"
            value={crewActivity ? 'ON' : 'OFF'}
            valueColor={crewActivity ? SURF_ACCENT : colors.textTertiary}
            onPress={() => setCrewActivity((value) => !value)}
          />
        </SurfGlassCard>
      </SurfSection>
    </SurfScreen>
  );
}

function SettingRow({
  label,
  value,
  valueColor,
  onPress,
}: {
  label: string;
  value: string;
  valueColor?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.settingRow} onPress={onPress}>
      <Text variant="body">{label}</Text>
      <Text variant="body" style={{ color: valueColor ?? colors.textSecondary, fontWeight: '700' }}>
        {value}
      </Text>
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
