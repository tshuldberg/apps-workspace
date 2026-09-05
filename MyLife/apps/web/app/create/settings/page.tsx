import { getCreateSettings } from '@mylife/create';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import { CreateHero, CreateSection } from '../ui';

export default function CreateSettingsPage() {
  ensureModuleMigrations('create');
  const settings = getCreateSettings(getAdapter());

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <CreateHero
        eyebrow="Persisted Defaults"
        title="Settings"
        body="These defaults already live in the local MyCreate SQLite store. Later phases will expose editable controls on top of the same schema."
      />

      <CreateSection title="Current local settings">
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          {[
            ['Default landing tab', settings.defaultLandingTab],
            ['Default session minutes', `${settings.defaultSessionMinutes} min`],
            ['Weekly practice goal', `${settings.weeklyPracticeGoalMinutes} min`],
            ['Portfolio visibility', settings.portfolioVisibility],
            [
              'Reflection prompts',
              settings.captureReflectionPrompts ? 'Enabled' : 'Disabled',
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                borderRadius: 16,
                border: '1px solid var(--glass-border)',
                background: 'rgba(217,70,239,0.08)',
                padding: 16,
                display: 'grid',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </CreateSection>
    </div>
  );
}
