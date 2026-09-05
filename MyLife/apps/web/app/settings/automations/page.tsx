import Link from 'next/link';
import { listAutomationRulesAction } from '@/app/actions';
import { AutomationToggleRow } from './AutomationToggleRow';

export const dynamic = 'force-dynamic';

export default async function AutomationsSettingsPage() {
  const rules = await listAutomationRulesAction();

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#131318',
        color: '#E4E1E9',
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link
          href="/settings"
          style={{
            color: '#D6C3B5',
            fontSize: 14,
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: 24,
          }}
        >
          ← Settings
        </Link>

        <header style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              margin: '0 0 8px 0',
              color: '#E4E1E9',
            }}
          >
            Automations
          </h1>
          <p style={{ color: '#D6C3B5', fontSize: 15, margin: 0, lineHeight: 1.5 }}>
            Every automation is off by default. Turn on the ones you want, and
            MyLife will show a preview card before doing anything — no silent
            automation, ever.
          </p>
        </header>

        {rules.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: '#D6C3B5',
              background: '#2A292F',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            No automation rules are registered yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rules.map((rule) => (
              <AutomationToggleRow
                key={rule.id}
                ruleId={rule.id}
                label={rule.label}
                description={rule.description}
                clusters={rule.clusters}
                initialEnabled={rule.enabled}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
