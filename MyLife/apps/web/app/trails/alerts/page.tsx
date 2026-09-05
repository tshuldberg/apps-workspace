import { fetchAlertSettings, fetchDeviationEvents } from '../actions';
import { formatCompactDate, TEXT, TEXT_SEC, TEXT_TER } from '../ui';
import { TrailsActionLink, TrailsHero, TrailsPanel, TrailsChip } from '../shell';

type AlertSettings = {
  deviationThresholdMeters: number;
  alertCooldownSeconds: number;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  autoPauseOnDeviation: boolean;
};

type DeviationEvent = {
  id: string;
  recordingId: string;
  trailId: string | null;
  deviationMeters: number;
  acknowledged: boolean;
  createdAt: string;
};

export default async function TrailsAlertsPage() {
  const [settings, events] = await Promise.all([
    fetchAlertSettings() as Promise<AlertSettings>,
    fetchDeviationEvents(8) as Promise<DeviationEvent[]>,
  ]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Trail Alerts"
        title="Off-trail, cadence, and safety alert posture at a glance."
        description="Desktop alerts focus on visibility first: core deviation rules, recent off-trail events, and the notification stance that mirrors your mobile setup."
        actions={
          <>
            <TrailsActionLink href="/trails/settings" symbol="settings">
              Module Settings
            </TrailsActionLink>
            <TrailsActionLink href="/trails/export" symbol="ios_share" secondary>
              Export Events
            </TrailsActionLink>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TrailsPanel eyebrow="Deviation" title="Core Alert Settings">
          <div style={{ display: 'grid', gap: 10 }}>
            <SettingRow label="Deviation threshold" value={`${Math.round(settings.deviationThresholdMeters)} m`} />
            <SettingRow label="Cooldown" value={`${settings.alertCooldownSeconds} s`} />
            <SettingRow label="Vibration" value={settings.vibrationEnabled ? 'On' : 'Off'} />
            <SettingRow label="Sound" value={settings.soundEnabled ? 'On' : 'Off'} />
            <SettingRow label="Auto-pause" value={settings.autoPauseOnDeviation ? 'On' : 'Off'} />
          </div>
        </TrailsPanel>

        <TrailsPanel eyebrow="Status" title="Desktop Alert Summary">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <TrailsChip label="Global alerts on" active />
            <TrailsChip label="Deviation focus" subtle />
            <TrailsChip label={`${events.length} recent events`} subtle />
          </div>
        </TrailsPanel>
      </div>

      <TrailsPanel eyebrow="History" title="Recent Deviation Events">
        {events.length > 0 ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {events.map((event) => (
              <div key={event.id} style={rowStyle}>
                <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                  <strong style={{ color: TEXT }}>
                    {Math.round(event.deviationMeters)} m off route
                  </strong>
                  <span style={{ color: TEXT_SEC, fontSize: 13 }}>
                    Recording {event.recordingId.slice(0, 8)} · {formatCompactDate(event.createdAt)}
                  </span>
                </div>
                <span style={{ color: event.acknowledged ? '#84CC16' : TEXT_TER, fontSize: 12, fontWeight: 700 }}>
                  {event.acknowledged ? 'Acknowledged' : 'Active'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: TEXT_SEC }}>No recent deviation events recorded.</p>
        )}
      </TrailsPanel>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={rowStyle}>
      <strong style={{ color: TEXT }}>{label}</strong>
      <span style={{ color: TEXT_SEC }}>{value}</span>
    </div>
  );
}

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};
