/**
 * Phase 4a Insights page (web).
 *
 * Server component. Gates the entire surface on AI permission: with no
 * permissions granted, renders an opt-in banner that routes to
 * /settings/automations (placeholder until /settings/ai ships).
 *
 * Renders three sections: Correlations (client), Trends (server), Discoveries
 * (server). Uses inline SVG for charts — no new chart deps, no LLM.
 */
import Link from 'next/link';
import { fetchInsightsAction } from '@/app/actions';
import { CorrelationPanel } from './CorrelationPanel';
import { TrendsPanel } from './TrendsPanel';
import { DiscoveriesPanel } from './DiscoveriesPanel';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const bootstrap = await fetchInsightsAction();

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#131318',
        color: '#E4E1E9',
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Link
          href="/"
          style={{
            color: '#D6C3B5',
            fontSize: 14,
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: 24,
          }}
        >
          ← Hub
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
            Insights
          </h1>
          <p style={{ color: '#D6C3B5', fontSize: 15, margin: 0, lineHeight: 1.5 }}>
            On-device statistics across permitted modules. No AI, no cloud,
            nothing leaves your device.
          </p>
        </header>

        {!bootstrap.hasAIPermission ? (
          <OptInBanner />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <section>
              <h2 style={sectionHeadingStyle}>Correlations</h2>
              <CorrelationPanel modules={bootstrap.modules} />
            </section>

            <section>
              <h2 style={sectionHeadingStyle}>Trends</h2>
              <TrendsPanel modules={bootstrap.modules} />
            </section>

            <section>
              <h2 style={sectionHeadingStyle}>Discoveries</h2>
              <DiscoveriesPanel discoveries={bootstrap.discoveries} />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function OptInBanner() {
  return (
    <div
      aria-label="insights-optin-banner"
      style={{
        padding: 32,
        background: '#2A292F',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#E4E1E9' }}>
        Requires AI opt-in
      </h2>
      <p style={{ margin: 0, color: '#D6C3B5', fontSize: 14, lineHeight: 1.5 }}>
        Insights read permitted modules' metrics on device to compute
        correlations. No data leaves MyLife. Enable AI access from Settings to
        see trends, correlations, and discoveries.
      </p>
      <Link
        href="/settings/automations"
        style={{
          alignSelf: 'flex-start',
          marginTop: 8,
          background: '#FFB877',
          color: '#131318',
          padding: '10px 18px',
          borderRadius: 999,
          fontWeight: 700,
          fontSize: 14,
          textDecoration: 'none',
        }}
      >
        Manage AI access
      </Link>
    </div>
  );
}

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: '#D6C3B5',
  margin: '0 0 16px 0',
};
