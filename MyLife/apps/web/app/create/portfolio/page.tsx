import Link from 'next/link';
import { CreateHero, CreateMetricRow, CreateSection, buttonStyle } from '../ui';

export default function CreatePortfolioPage() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <CreateHero
        eyebrow="Private Portfolio"
        title="Portfolio"
        body="Portfolio pieces, temporary share links, and PDF export are planned on top of the private-first local foundation. Nothing publishes automatically."
        actionHref="/create/settings"
        actionLabel="Check Privacy Defaults"
      />

      <CreateMetricRow
        items={[
          { label: 'Visibility', value: 'Private by default' },
          { label: 'Share links', value: 'Later phase' },
          { label: 'PDF export', value: 'Later phase' },
        ]}
      />

      <CreateSection title="Portfolio principles">
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <li>Temporary links instead of permanent public profiles.</li>
          <li>Process photos and final outputs can live in the same project story.</li>
          <li>The creator owns the archive even when nothing is shared.</li>
        </ul>
      </CreateSection>

      <Link href="/create/skills" style={buttonStyle('ghost')}>
        Skills
      </Link>
    </div>
  );
}
