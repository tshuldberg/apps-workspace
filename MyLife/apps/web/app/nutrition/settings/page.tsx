'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { NUTRITION_MODULE } from '@mylife/nutrition';
import { BRAND_DOMAIN } from '@mylife/ui/src/constants/brand';
import {
  doClearFoodLog,
  doSetSetting,
  fetchActiveGoals,
  fetchAllGoals,
  fetchAllRestaurants,
  fetchAllSettings,
  fetchMealTemplates,
} from '../actions';
import { NUTRITION_CHROME, alpha, formatNutritionDate } from '../_lib/design';
import {
  MaterialSymbol,
  NutritionBadge,
  NutritionButton,
  NutritionEmptyState,
  NutritionKicker,
  NutritionPageHeader,
  NutritionPanel,
} from '../_components/NutritionPrimitives';

type GoalEntry = Awaited<ReturnType<typeof fetchAllGoals>>[number];
type MealType = 'auto' | 'breakfast' | 'lunch' | 'dinner' | 'snack';
type WeightUnit = 'lb' | 'kg';
type HeightUnit = 'ft_in' | 'cm';
type VolumeUnit = 'oz' | 'ml';
type EnergyUnit = 'kcal' | 'kJ';

const INTEGRATIONS = [
  { name: 'MyFast', icon: 'eco', status: 'Insight-ready', href: '/fast' },
  { name: 'MyWorkouts', icon: 'fitness_center', status: 'Insight-ready', href: '/workouts' },
  { name: 'MyMood', icon: 'favorite', status: 'Insight-ready', href: '/mood' },
  { name: 'MyRecipes', icon: 'restaurant_menu', status: 'Ready', href: '/recipes' },
] as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function earliestGoalDate(goals: GoalEntry[]): string {
  if (goals.length === 0) {
    return todayIso();
  }

  return goals.reduce((earliest, goal) => (
    earliest < goal.effectiveDate ? earliest : goal.effectiveDate
  ), goals[0].effectiveDate);
}

export default function NutritionSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [goals, setGoals] = useState<GoalEntry[]>([]);
  const [activeGoal, setActiveGoal] = useState<GoalEntry | null>(null);
  const [restaurantCount, setRestaurantCount] = useState(0);
  const [templateCount, setTemplateCount] = useState(0);
  const [displayName, setDisplayName] = useState('Nutrition Curator');
  const [reminderTime, setReminderTime] = useState('7:30 PM');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [allSettings, goalHistory, currentGoal, restaurants, templates] = await Promise.all([
        fetchAllSettings(),
        fetchAllGoals(),
        fetchActiveGoals(todayIso()),
        fetchAllRestaurants(),
        fetchMealTemplates(),
      ]);

      const typedSettings = allSettings as Record<string, string>;

      setSettings(typedSettings);
      setGoals(goalHistory);
      setActiveGoal(currentGoal as GoalEntry | null);
      setRestaurantCount(restaurants.length);
      setTemplateCount(templates.length);
      setDisplayName(typedSettings.display_name ?? 'Nutrition Curator');
      setReminderTime(typedSettings.daily_reminder_time ?? '7:30 PM');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load nutrition settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const snapshot = useMemo(() => ({
    joinedDate: earliestGoalDate(goals),
    weightUnit: settings.weight_unit === 'kg' ? 'kg' as WeightUnit : 'lb' as WeightUnit,
    heightUnit: settings.height_unit === 'cm' ? 'cm' as HeightUnit : 'ft_in' as HeightUnit,
    volumeUnit: settings.waterUnit === 'oz' ? 'oz' as VolumeUnit : 'ml' as VolumeUnit,
    energyUnit: settings.energy_unit === 'kJ' ? 'kJ' as EnergyUnit : 'kcal' as EnergyUnit,
    defaultMealType: (settings.default_meal_type as MealType | undefined) ?? 'auto',
    showMicronutrients: settings.show_micronutrients !== '0',
    showSourceBadges: settings.show_source_badges !== '0',
    dailyReminderTime: settings.daily_reminder_time ?? '7:30 PM',
    communityEnabled: settings.community_enabled !== '0',
    syncEnabled: settings.syncEnabled === 'true',
  }), [goals, settings]);

  const activeGoalSummary = activeGoal
    ? `${activeGoal.calories} kcal • ${activeGoal.proteinG}P / ${activeGoal.carbsG}C / ${activeGoal.fatG}F`
    : 'No active nutrition goal saved yet.';

  const persistSetting = useCallback(async (key: string, value: string, message?: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);

    try {
      await doSetSetting(key, value);
      if (message) {
        setNotice(message);
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update this setting.');
    } finally {
      setBusy(null);
    }
  }, [load]);

  const saveDisplayName = useCallback(async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setNotice('Choose a profile name before saving.');
      return;
    }

    await persistSetting('display_name', trimmed, 'Profile name updated.');
  }, [displayName, persistSetting]);

  const clearFoodLog = useCallback(async () => {
    if (!window.confirm('Clear the food log? This removes diary entries and logged food items, but keeps saved foods, goals, and restaurants.')) {
      return;
    }

    setBusy('clear_food_log');
    setError(null);
    setNotice(null);

    try {
      await doClearFoodLog();
      setNotice('Food log cleared.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to clear the food log.');
    } finally {
      setBusy(null);
    }
  }, [load]);

  const resetDefaults = useCallback(async () => {
    if (!window.confirm('Reset nutrition preferences? This keeps your food data but resets units, reminders, and UI preferences to their defaults.')) {
      return;
    }

    setBusy('reset_defaults');
    setError(null);
    setNotice(null);

    try {
      await Promise.all([
        doSetSetting('weight_unit', 'lb'),
        doSetSetting('height_unit', 'in'),
        doSetSetting('waterUnit', 'ml'),
        doSetSetting('energy_unit', 'kcal'),
        doSetSetting('default_meal_type', 'auto'),
        doSetSetting('show_micronutrients', '1'),
        doSetSetting('show_source_badges', '1'),
        doSetSetting('daily_reminder_time', '7:30 PM'),
        doSetSetting('community_enabled', '1'),
      ]);
      setNotice('Nutrition preferences reset to defaults.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reset preferences.');
    } finally {
      setBusy(null);
    }
  }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 20 }}>
        <NutritionPageHeader
          kicker={<NutritionKicker color={NUTRITION_CHROME.accentLight}>Settings</NutritionKicker>}
          title="Settings"
          description="Loading account, unit preferences, data controls, and integration status."
        />
        <NutritionPanel tone="focus" style={{ minHeight: 320, opacity: 0.4 }} />
      </div>
    );
  }

  if (error && Object.keys(settings).length === 0) {
    return (
      <NutritionEmptyState
        title="Settings unavailable"
        description={error}
        action={<NutritionButton onClick={() => void load()}>Retry</NutritionButton>}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1120 }}>
      <NutritionPageHeader
        kicker={<NutritionKicker color={NUTRITION_CHROME.accentLight}>Configuration</NutritionKicker>}
        title="Settings"
        description="Tune units, reminders, privacy, exports, and cross-module nutrition surfaces from a single desktop panel."
        action={
          <Link href="/nutrition/export">
            <NutritionButton tone="calorie">Open Export</NutritionButton>
          </Link>
        }
      />

      {notice ? (
        <div style={noticeStyle}>
          <MaterialSymbol name="check_circle" size={16} color={NUTRITION_CHROME.success} />
          {notice}
        </div>
      ) : null}

      {error ? (
        <div style={errorStyle}>
          <MaterialSymbol name="error" size={16} color={NUTRITION_CHROME.danger} />
          {error}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <SectionPanel
          title="Account"
          accent={NUTRITION_CHROME.accentLight}
          content={
            <>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={accountAvatarStyle}>
                  <MaterialSymbol name="account_circle" size={32} color={NUTRITION_CHROME.accentLight} />
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ fontSize: 18 }}>{displayName.trim() || 'Nutrition Curator'}</strong>
                  <span style={subtleTextStyle}>Joined {formatNutritionDate(snapshot.joinedDate)}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={fieldLabelStyle}>Profile Name</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    style={{ ...inputStyle, flex: '1 1 260px' }}
                    placeholder="Nutrition Curator"
                  />
                  <NutritionButton onClick={() => void saveDisplayName()} disabled={busy === 'display_name'}>
                    Save
                  </NutritionButton>
                </div>
              </div>
            </>
          }
        />

        <SectionPanel
          title="Goals"
          accent={NUTRITION_CHROME.calorie}
          content={
            <>
              <div style={{ display: 'grid', gap: 8 }}>
                <strong style={{ fontSize: 18 }}>Current targets</strong>
                <div style={subtleTextStyle}>{activeGoalSummary}</div>
              </div>
              <Link href="/nutrition/goals" style={{ width: 'fit-content' }}>
                <NutritionButton>Edit Goals</NutritionButton>
              </Link>
            </>
          }
        />

        <SectionPanel
          title="Units"
          accent={NUTRITION_CHROME.water}
          content={
            <>
              <SegmentedRow
                label="Weight"
                value={snapshot.weightUnit}
                options={[
                  { key: 'lb', label: 'LB' },
                  { key: 'kg', label: 'KG' },
                ]}
                onChange={(value) => void persistSetting('weight_unit', value, 'Weight unit updated.')}
              />
              <SegmentedRow
                label="Volume"
                value={snapshot.volumeUnit}
                options={[
                  { key: 'oz', label: 'OZ' },
                  { key: 'ml', label: 'ML' },
                ]}
                onChange={(value) => void persistSetting('waterUnit', value, 'Water unit updated.')}
              />
              <SegmentedRow
                label="Height"
                value={snapshot.heightUnit}
                options={[
                  { key: 'ft_in', label: 'FT + IN' },
                  { key: 'cm', label: 'CM' },
                ]}
                onChange={(value) => void persistSetting('height_unit', value === 'cm' ? 'cm' : 'in', 'Height unit updated.')}
              />
              <SegmentedRow
                label="Energy"
                value={snapshot.energyUnit}
                options={[
                  { key: 'kcal', label: 'KCAL' },
                  { key: 'kJ', label: 'KJ' },
                ]}
                onChange={(value) => void persistSetting('energy_unit', value, 'Energy unit updated.')}
              />
            </>
          }
        />

        <SectionPanel
          title="Preferences"
          accent={NUTRITION_CHROME.protein}
          content={
            <>
              <SegmentedRow
                label="Default Meal"
                value={snapshot.defaultMealType}
                options={[
                  { key: 'auto', label: 'AUTO' },
                  { key: 'breakfast', label: 'BREAKFAST' },
                  { key: 'lunch', label: 'LUNCH' },
                  { key: 'dinner', label: 'DINNER' },
                  { key: 'snack', label: 'SNACK' },
                ]}
                onChange={(value) => void persistSetting('default_meal_type', value, 'Default meal updated.')}
                compact
              />
              <ToggleRow
                title="Show micronutrients"
                subtitle="Display vitamins and minerals throughout food detail and dashboard surfaces."
                value={snapshot.showMicronutrients}
                onToggle={() => void persistSetting('show_micronutrients', snapshot.showMicronutrients ? '0' : '1', 'Micronutrient visibility updated.')}
              />
              <ToggleRow
                title="Show source badges"
                subtitle="Keep USDA, OFF, FatSecret, AI, and custom source markers visible."
                value={snapshot.showSourceBadges}
                onToggle={() => void persistSetting('show_source_badges', snapshot.showSourceBadges ? '0' : '1', 'Source badge visibility updated.')}
              />
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={fieldLabelStyle}>Daily Reminder Time</label>
                <input
                  value={reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                  onBlur={() => {
                    const nextValue = reminderTime.trim() || '7:30 PM';
                    if (nextValue !== snapshot.dailyReminderTime) {
                      void persistSetting('daily_reminder_time', nextValue, 'Daily reminder updated.');
                    }
                  }}
                  style={inputStyle}
                />
              </div>
            </>
          }
        />

        <SectionPanel
          title="Privacy"
          accent={NUTRITION_CHROME.success}
          content={
            <>
              <div style={infoBannerStyle}>
                <MaterialSymbol name="lock" size={18} color={NUTRITION_CHROME.accentLight} />
                <span>All nutrition data stays on your device by default.</span>
              </div>
              <StatusRow
                icon="cloud_off"
                title="Cloud sync"
                subtitle="Core nutrition data remains offline-first in this build."
                status={snapshot.syncEnabled ? 'Enabled' : 'Disabled'}
                tone={snapshot.syncEnabled ? NUTRITION_CHROME.success : NUTRITION_CHROME.textMuted}
              />
              <ToggleRow
                title="Community features"
                subtitle="Keep the community tab and challenge surfaces available."
                value={snapshot.communityEnabled}
                onToggle={() => void persistSetting('community_enabled', snapshot.communityEnabled ? '0' : '1', 'Community setting updated.')}
              />
            </>
          }
        />

        <SectionPanel
          title="Data"
          accent={NUTRITION_CHROME.calorie}
          content={
            <>
              <LinkRow
                icon="download"
                title="Export data"
                subtitle="Build CSV or JSON exports from your diary history."
                href="/nutrition/export"
                actionLabel="Open"
              />
              <LinkRow
                icon="restaurant"
                title="Restaurants list"
                subtitle={`${restaurantCount} saved restaurants and menus.`}
                href="/nutrition/restaurants"
                actionLabel="View"
              />
              <LinkRow
                icon="library_books"
                title="Meal templates"
                subtitle={`${templateCount} reusable templates managed from the log flow.`}
                href="/nutrition/log"
                actionLabel="Manage"
              />
              <ActionRow
                icon="delete"
                title="Clear food log"
                subtitle="Remove diary entries and logged foods. Saved foods, goals, and restaurants stay intact."
                action={
                  <NutritionButton tone="danger" onClick={() => void clearFoodLog()} disabled={busy === 'clear_food_log'}>
                    Clear
                  </NutritionButton>
                }
              />
              <ActionRow
                icon="restart_alt"
                title="Reset to defaults"
                subtitle="Restore units, reminder time, and UI preferences without deleting nutrition data."
                action={
                  <NutritionButton tone="danger" onClick={() => void resetDefaults()} disabled={busy === 'reset_defaults'}>
                    Reset
                  </NutritionButton>
                }
              />
            </>
          }
        />

        <SectionPanel
          title="Integrations"
          accent={NUTRITION_CHROME.water}
          content={
            <>
              {INTEGRATIONS.map((integration) => (
                <Link key={integration.name} href={integration.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={rowCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={accountAvatarStyle}>
                        <MaterialSymbol name={integration.icon} size={20} color={NUTRITION_CHROME.water} />
                      </div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong>{integration.name}</strong>
                        <span style={subtleTextStyle}>{integration.status}</span>
                      </div>
                    </div>
                    <NutritionBadge color={NUTRITION_CHROME.water}>{integration.status}</NutritionBadge>
                  </div>
                </Link>
              ))}
            </>
          }
        />

        <SectionPanel
          title="About"
          accent={NUTRITION_CHROME.accentLight}
          content={
            <>
              <StatusRow
                icon="info"
                title="Version"
                subtitle="Module definition shipped to the web nutrition shell."
                status={NUTRITION_MODULE.version}
                tone={NUTRITION_CHROME.accentLight}
              />
              <ActionRow
                icon="science"
                title="Data sources"
                subtitle="USDA, Open Food Facts, and FatSecret support nutrition search and attribution."
                action={<NutritionBadge color={NUTRITION_CHROME.textMuted}>Source Credits</NutritionBadge>}
              />
              <a
                href={`https://${BRAND_DOMAIN}/privacy`}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...rowCardStyle,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={accountAvatarStyle}>
                    <MaterialSymbol name="shield" size={20} color={NUTRITION_CHROME.accentLight} />
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong>Privacy policy</strong>
                    <span style={subtleTextStyle}>Open the current MyLife privacy policy in a new tab.</span>
                  </div>
                </div>
                <MaterialSymbol name="open_in_new" size={18} color={NUTRITION_CHROME.textMuted} />
              </a>
            </>
          }
        />
      </div>
    </div>
  );
}

function SectionPanel({
  title,
  accent,
  content,
}: {
  title: string;
  accent: string;
  content: ReactNode;
}) {
  return (
    <NutritionPanel style={{ padding: 22 }}>
      <div style={{ display: 'grid', gap: 18 }}>
        <NutritionKicker color={accent}>{title}</NutritionKicker>
        {content}
      </div>
    </NutritionPanel>
  );
}

function SegmentedRow<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: T;
  options: Array<{ key: T; label: string }>;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label style={fieldLabelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map((option) => {
          const active = option.key === value;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              style={{
                ...pillStyle,
                minHeight: compact ? 34 : 38,
                background: active ? alpha(NUTRITION_CHROME.accent, 0.16) : alpha('#FFFFFF', 0.05),
                color: active ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
                boxShadow: active
                  ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accentLight, 0.28)}`
                  : `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.04)}`,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onToggle,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <ActionRow
      icon={value ? 'toggle_on' : 'toggle_off'}
      title={title}
      subtitle={subtitle}
      action={
        <button
          type="button"
          onClick={onToggle}
          style={{
            ...pillStyle,
            background: value ? alpha(NUTRITION_CHROME.success, 0.14) : alpha('#FFFFFF', 0.05),
            color: value ? NUTRITION_CHROME.success : NUTRITION_CHROME.textMuted,
          }}
        >
          {value ? 'On' : 'Off'}
        </button>
      }
    />
  );
}

function StatusRow({
  icon,
  title,
  subtitle,
  status,
  tone,
}: {
  icon: string;
  title: string;
  subtitle: string;
  status: string;
  tone: string;
}) {
  return (
    <ActionRow
      icon={icon}
      title={title}
      subtitle={subtitle}
      action={<NutritionBadge color={tone}>{status}</NutritionBadge>}
    />
  );
}

function LinkRow({
  icon,
  title,
  subtitle,
  href,
  actionLabel,
}: {
  icon: string;
  title: string;
  subtitle: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <ActionRow
        icon={icon}
        title={title}
        subtitle={subtitle}
        action={<NutritionBadge color={NUTRITION_CHROME.accentLight}>{actionLabel}</NutritionBadge>}
      />
    </Link>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string;
  title: string;
  subtitle: string;
  action: ReactNode;
}) {
  return (
    <div style={rowCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={accountAvatarStyle}>
          <MaterialSymbol name={icon} size={20} color={NUTRITION_CHROME.accentLight} />
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <strong>{title}</strong>
          <span style={subtleTextStyle}>{subtitle}</span>
        </div>
      </div>
      {action}
    </div>
  );
}

const subtleTextStyle: CSSProperties = {
  color: NUTRITION_CHROME.textMuted,
  lineHeight: 1.7,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1.8,
  textTransform: 'uppercase',
  color: NUTRITION_CHROME.textMuted,
};

const inputStyle: CSSProperties = {
  minHeight: 50,
  width: '100%',
  border: 'none',
  borderRadius: 18,
  padding: '0 16px',
  background: alpha('#FFFFFF', 0.05),
  color: NUTRITION_CHROME.text,
  boxShadow: `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.04)}`,
};

const pillStyle: CSSProperties = {
  minHeight: 38,
  padding: '0 14px',
  border: 'none',
  borderRadius: 999,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
};

const accountAvatarStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 18,
  display: 'grid',
  placeItems: 'center',
  background: alpha('#FFFFFF', 0.05),
};

const rowCardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: 16,
  borderRadius: 20,
  background: alpha('#FFFFFF', 0.04),
};

const infoBannerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 50,
  padding: '0 16px',
  borderRadius: 18,
  background: alpha(NUTRITION_CHROME.accent, 0.1),
  color: NUTRITION_CHROME.text,
};

const noticeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 52,
  padding: '0 16px',
  borderRadius: 18,
  background: alpha(NUTRITION_CHROME.success, 0.12),
  color: NUTRITION_CHROME.text,
  boxShadow: `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.success, 0.18)}`,
};

const errorStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 52,
  padding: '0 16px',
  borderRadius: 18,
  background: alpha(NUTRITION_CHROME.danger, 0.12),
  color: NUTRITION_CHROME.text,
  boxShadow: `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.danger, 0.2)}`,
};
