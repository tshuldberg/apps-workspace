'use client';

import { useEffect, useState } from 'react';
import {
  fetchAllActiveHealthKitLinks,
  fetchAllActiveLocationReminders,
  fetchSetting,
  doSetSetting,
} from '../actions';
import {
  EmptyState,
  GlassPanel,
  PageIntro,
  ProgressBar,
  SecondaryButton,
  SectionHeading,
  SymbolIcon,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_AREAS, HB_TEXT_SECONDARY, withAlpha } from '@mylife/habits';

type SettingState = {
  defaultReminderTime: string;
  notificationSound: string;
  doNotDisturb: string;
  weekStartsOn: string;
  healthkitEnabled: boolean;
  siriEnabled: boolean;
  locationEnabled: boolean;
  petEnabled: boolean;
  xpNotifications: boolean;
};

const DEFAULTS: SettingState = {
  defaultReminderTime: '08:00',
  notificationSound: 'Soft',
  doNotDisturb: '22:00-06:00',
  weekStartsOn: 'monday',
  healthkitEnabled: true,
  siriEnabled: false,
  locationEnabled: false,
  petEnabled: true,
  xpNotifications: true,
};

type ToggleSetting = {
  key: string;
  label: string;
  value: boolean;
  makePatch: (value: boolean) => Partial<SettingState>;
};

export default function HabitsSettingsPage() {
  const [settings, setSettings] = useState<SettingState>(DEFAULTS);
  const [healthLinks, setHealthLinks] = useState(0);
  const [locationLinks, setLocationLinks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const [
          defaultReminderTime,
          notificationSound,
          doNotDisturb,
          weekStartsOn,
          healthkitEnabled,
          siriEnabled,
          locationEnabled,
          petEnabled,
          xpNotifications,
          healthLinkRows,
          locationRows,
        ] = await Promise.all([
          fetchSetting('default_reminder_time'),
          fetchSetting('notification_sound'),
          fetchSetting('do_not_disturb_window'),
          fetchSetting('week_starts_on'),
          fetchSetting('healthkit_enabled'),
          fetchSetting('siri_enabled'),
          fetchSetting('location_enabled'),
          fetchSetting('pet_companion_enabled'),
          fetchSetting('xp_notifications'),
          fetchAllActiveHealthKitLinks(),
          fetchAllActiveLocationReminders(),
        ]);

        setSettings({
          defaultReminderTime: (defaultReminderTime as string | undefined) ?? DEFAULTS.defaultReminderTime,
          notificationSound: (notificationSound as string | undefined) ?? DEFAULTS.notificationSound,
          doNotDisturb: (doNotDisturb as string | undefined) ?? DEFAULTS.doNotDisturb,
          weekStartsOn: (weekStartsOn as string | undefined) ?? DEFAULTS.weekStartsOn,
          healthkitEnabled: (healthkitEnabled as string | undefined) !== 'false',
          siriEnabled: (siriEnabled as string | undefined) === 'true',
          locationEnabled: (locationEnabled as string | undefined) === 'true',
          petEnabled: (petEnabled as string | undefined) !== 'false',
          xpNotifications: (xpNotifications as string | undefined) !== 'false',
        });
        setHealthLinks(((healthLinkRows as unknown[]) ?? []).length);
        setLocationLinks(((locationRows as unknown[]) ?? []).length);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const persist = async (key: string, value: string, patch: Partial<SettingState>) => {
    setSettings((current) => ({ ...current, ...patch }));
    try {
      await doSetSetting(key, value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save setting.');
    }
  };

  const toggleSettings: ToggleSetting[] = [
    {
      key: 'show_streak_freezes',
      label: 'Show streak-freeze affordances',
      value: true,
      makePatch: () => ({}),
    },
    {
      key: 'pet_companion_enabled',
      label: 'Pet companion active',
      value: settings.petEnabled,
      makePatch: (value) => ({ petEnabled: value }),
    },
    {
      key: 'xp_notifications',
      label: 'XP notifications',
      value: settings.xpNotifications,
      makePatch: (value) => ({ xpNotifications: value }),
    },
  ];

  if (error && loading) {
    return <EmptyState body={error} title="Settings unavailable" />;
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Settings"
        title="Preferences, automation, and data controls."
        description="Tune reminders, automation, integrations, and backups from one desktop workspace. The linked HealthKit, Siri, and location sections live here so the sidebar can keep them one click away."
        actions={
          <>
            <SecondaryButton href="/habits/export">
              <SymbolIcon name="download" size={18} />
              Export data
            </SecondaryButton>
            <SecondaryButton href="/habits/areas">
              <SymbolIcon name="category" size={18} />
              Manage areas
            </SecondaryButton>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '0.92fr 1.08fr', gap: 20, alignItems: 'start' }}>
        <GlassPanel level={1} style={{ padding: 22, display: 'grid', gap: 14 }}>
          <SectionHeading detail="Quick section jump" title="Sections" />
          {[
            ['core', 'Core preferences', 'alarm'],
            ['healthkit', 'HealthKit', 'monitor_heart'],
            ['locations', 'Locations', 'location_on'],
            ['siri', 'Siri shortcuts', 'mic'],
          ].map(([id, label, icon]) => (
            <a
              href={`#${id}`}
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 18,
                background: withAlpha('#ffffff', 0.04),
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 12, display: 'grid', placeItems: 'center', background: withAlpha(HB_ACCENT_LIGHT, 0.16) }}>
                <SymbolIcon color={HB_ACCENT_LIGHT} filled name={icon} size={18} />
              </div>
              <div style={{ fontWeight: 700 }}>{label}</div>
            </a>
          ))}
        </GlassPanel>

        <div style={{ display: 'grid', gap: 20 }}>
          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }} id="core">
            <SectionHeading detail="Defaults for reminders, quiet hours, and reward feedback." title="Core preferences" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>Default reminder time</span>
                <input
                  type="time"
                  value={settings.defaultReminderTime}
                  onChange={(event) => void persist('default_reminder_time', event.target.value, { defaultReminderTime: event.target.value })}
                  style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>Quiet hours</span>
                <input
                  value={settings.doNotDisturb}
                  onChange={(event) => void persist('do_not_disturb_window', event.target.value, { doNotDisturb: event.target.value })}
                  style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>Notification sound</span>
                <select
                  value={settings.notificationSound}
                  onChange={(event) => void persist('notification_sound', event.target.value, { notificationSound: event.target.value })}
                  style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
                >
                  <option value="Soft">Soft</option>
                  <option value="Bright">Bright</option>
                  <option value="None">None</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>Week starts on</span>
                <select
                  value={settings.weekStartsOn}
                  onChange={(event) => void persist('week_starts_on', event.target.value, { weekStartsOn: event.target.value })}
                  style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
                >
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {toggleSettings.map(({ key, label, value, makePatch }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 16, borderRadius: 18, background: withAlpha('#ffffff', 0.04) }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <input
                    checked={value}
                    onChange={(event) => void persist(key, String(event.target.checked), makePatch(event.target.checked))}
                    style={{ width: 18, height: 18, accentColor: HB_ACCENT_LIGHT }}
                    type="checkbox"
                  />
                </label>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 16 }} id="healthkit">
            <SectionHeading detail="Sync habits with Apple Health signals." title="HealthKit" />
            <div style={{ color: HB_TEXT_SECONDARY, lineHeight: 1.7 }}>
              {healthLinks} active health mapping{healthLinks === 1 ? '' : 's'} currently connected.
            </div>
            <ProgressBar tone={HB_AREAS.health} value={Math.min(100, healthLinks * 24)} />
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 16, borderRadius: 18, background: withAlpha(HB_AREAS.health, 0.12) }}>
              <span style={{ fontWeight: 600 }}>HealthKit auto-tracking</span>
              <input
                checked={settings.healthkitEnabled}
                onChange={(event) => void persist('healthkit_enabled', String(event.target.checked), { healthkitEnabled: event.target.checked })}
                style={{ width: 18, height: 18, accentColor: HB_AREAS.health }}
                type="checkbox"
              />
            </label>
          </GlassPanel>

          <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 16 }} id="locations">
            <SectionHeading detail="Trigger habits as you arrive or leave the right places." title="Locations" />
            <div style={{ color: HB_TEXT_SECONDARY, lineHeight: 1.7 }}>
              {locationLinks} active location reminder{locationLinks === 1 ? '' : 's'} currently configured.
            </div>
            <ProgressBar tone={HB_AREAS.social} value={Math.min(100, locationLinks * 30)} />
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 16, borderRadius: 18, background: withAlpha(HB_AREAS.social, 0.12) }}>
              <span style={{ fontWeight: 600 }}>Location automations</span>
              <input
                checked={settings.locationEnabled}
                onChange={(event) => void persist('location_enabled', String(event.target.checked), { locationEnabled: event.target.checked })}
                style={{ width: 18, height: 18, accentColor: HB_AREAS.social }}
                type="checkbox"
              />
            </label>
          </GlassPanel>

          <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 16 }} id="siri">
            <SectionHeading detail="Voice shortcuts for fast check-ins and automations." title="Siri shortcuts" />
            <div style={{ color: HB_TEXT_SECONDARY, lineHeight: 1.7 }}>
              Keep voice-triggered completions available on supported Apple devices, or leave them disabled when you want the habits shell to stay manual.
            </div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 16, borderRadius: 18, background: withAlpha(HB_AREAS.mind, 0.12) }}>
              <span style={{ fontWeight: 600 }}>Siri shortcuts enabled</span>
              <input
                checked={settings.siriEnabled}
                onChange={(event) => void persist('siri_enabled', String(event.target.checked), { siriEnabled: event.target.checked })}
                style={{ width: 18, height: 18, accentColor: HB_AREAS.mind }}
                type="checkbox"
              />
            </label>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
