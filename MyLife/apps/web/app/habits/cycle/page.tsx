'use client';

import {
  EmptyState,
  GlassPanel,
  MetricTile,
  PageIntro,
  PrimaryButton,
  SecondaryButton,
  SymbolIcon,
  ProgressBar,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_AREAS, HB_STREAK, HB_TEXT_SECONDARY, withAlpha } from '@mylife/habits';

const syncStats = [
  { label: 'Cycle patterns', value: '4', detail: 'linked rhythm insights from the dedicated cycle module', tone: HB_AREAS.body },
  { label: 'Habits connected', value: '6', detail: 'energy, recovery, hydration, and sleep rituals', tone: HB_ACCENT_LIGHT },
  { label: 'Prediction confidence', value: '86%', detail: 'based on the latest synced period history', tone: HB_STREAK.fire },
];

export default function HabitsCyclePage() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Cycle Bridge"
        title="Cycle context, kept inside the habits command center."
        description="MyHabits uses the dedicated MyCycle engine for tracking and prediction, then brings the relevant signals back into your routines. This bridge route keeps that connection visible without duplicating the full cycle workspace."
        actions={
          <>
            <PrimaryButton href="/cycle">
              <SymbolIcon color="#0E0E13" filled name="open_in_new" size={18} />
              Open MyCycle
            </PrimaryButton>
            <SecondaryButton href="/habits/settings#healthkit">
              <SymbolIcon name="monitor_heart" size={18} />
              Review integrations
            </SecondaryButton>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        {syncStats.map((item) => (
          <MetricTile key={item.label} detail={item.detail} label={item.label} tone={item.tone} value={item.value} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
        <GlassPanel level={2} style={{ padding: 26 }}>
          <div style={{ color: HB_ACCENT_LIGHT, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>
            Cycle-aware habits
          </div>
          <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.1 }}>Use phase context to tune your routine.</h2>
          <p style={{ margin: '12px 0 0', color: HB_TEXT_SECONDARY, lineHeight: 1.7 }}>
            Keep workouts, recovery, cravings, and sleep rituals in sync with the signals coming from MyCycle.
            When you want detailed symptom tracking, predictions, or charts, jump into the dedicated module.
          </p>

          <div style={{ display: 'grid', gap: 18, marginTop: 24 }}>
            {[
              { icon: 'favorite', title: 'Recovery windows', copy: 'Shift intensity during low-energy phases and protect streaks with lighter versions of key habits.', progress: 72, tone: HB_AREAS.body },
              { icon: 'bedtime', title: 'Sleep + mood watch', copy: 'Use cycle notes to explain recovery dips before they snowball into broken routines.', progress: 64, tone: HB_AREAS.mind },
              { icon: 'nutrition', title: 'Nutrition reminders', copy: 'Adjust hydration, supplements, and cravings-prevention habits when your pattern predicts it.', progress: 88, tone: HB_STREAK.fire },
            ].map((item) => (
              <div key={item.title} style={{ padding: 18, borderRadius: 22, background: withAlpha('#ffffff', 0.04) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 14, display: 'grid', placeItems: 'center', background: withAlpha(item.tone, 0.18) }}>
                    <SymbolIcon color={item.tone} filled name={item.icon} />
                  </div>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                </div>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>{item.copy}</div>
                <ProgressBar tone={item.tone} value={item.progress} />
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel level={1} style={{ padding: 24 }}>
          <div style={{ color: HB_ACCENT_LIGHT, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>
            Suggested next step
          </div>
          <EmptyState
            title="MyCycle remains the source of truth."
            body="This surface stays intentionally lightweight. Open MyCycle when you need logging, forecasting, or the full analytics workspace."
            action={
              <PrimaryButton href="/cycle">
                <SymbolIcon color="#0E0E13" filled name="open_in_new" size={18} />
                Launch cycle workspace
              </PrimaryButton>
            }
          />
        </GlassPanel>
      </div>
    </div>
  );
}
