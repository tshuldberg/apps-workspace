import { fetchAlertSettings, fetchStats, fetchTrailSetting } from '../actions';
import { TEXT, TEXT_SEC } from '../ui';
import { TrailsActionLink, TrailsHero, TrailsPanel } from '../shell';

export default async function TrailsSettingsPage() {
  const [stats, alertSettings, gearMeta] = await Promise.all([
    fetchStats(),
    fetchAlertSettings(),
    fetchTrailSetting('trails.gear.meta.v1'),
  ]);

  const typedStats = stats as {
    totalRecordings: number;
    totalDistanceMeters: number;
    totalElevationGainMeters: number;
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Settings"
        title="Grouped desktop controls for units, maps, alerts, and routing defaults."
        description="Phase 9 settings keep the surface simple but structured: measurement defaults, map preferences, notification posture, and a quick module status readout."
        actions={
          <>
            <TrailsActionLink href="/trails/alerts" symbol="warning">
              Alert Rules
            </TrailsActionLink>
            <TrailsActionLink href="/trails/export" symbol="ios_share" secondary>
              Export Data
            </TrailsActionLink>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TrailsPanel eyebrow="Units" title="Measurement Defaults">
          <SettingList
            items={[
              'Distance · kilometers',
              'Elevation · meters',
              'Pace · minutes per kilometer',
              'Temperature · fahrenheit',
            ]}
          />
        </TrailsPanel>

        <TrailsPanel eyebrow="Map" title="Navigation Preferences">
          <SettingList
            items={[
              'Desktop map style · terrain',
              `Deviation threshold · ${Math.round(alertSettings.deviationThresholdMeters)} m`,
              `Alert cooldown · ${alertSettings.alertCooldownSeconds} s`,
              `Auto pause on deviation · ${alertSettings.autoPauseOnDeviation ? 'enabled' : 'disabled'}`,
            ]}
          />
        </TrailsPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TrailsPanel eyebrow="Notifications" title="Alert Posture">
          <SettingList
            items={[
              `Vibration · ${alertSettings.vibrationEnabled ? 'on' : 'off'}`,
              `Sound · ${alertSettings.soundEnabled ? 'on' : 'off'}`,
              'Trail deviation alerts · desktop mirrored',
              'Weather warnings · trip-planner aware',
            ]}
          />
        </TrailsPanel>

        <TrailsPanel eyebrow="Status" title="Module Health">
          <SettingList
            items={[
              `Recordings captured · ${typedStats.totalRecordings}`,
              `Distance logged · ${Math.round(typedStats.totalDistanceMeters / 1000)} km`,
              `Elevation gain · ${Math.round(typedStats.totalElevationGainMeters)} m`,
              `Gear metadata stored · ${gearMeta ? 'yes' : 'not yet'}`,
            ]}
          />
        </TrailsPanel>
      </div>
    </div>
  );
}

function SettingList({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item) => (
        <div key={item} style={rowStyle}>
          <strong style={{ color: TEXT }}>{item}</strong>
          <span style={{ color: TEXT_SEC }}>Ready</span>
        </div>
      ))}
    </div>
  );
}

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};
