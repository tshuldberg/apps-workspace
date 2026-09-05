import Link from 'next/link';
import { CreateHero, CreateMetricRow, CreateSection, buttonStyle } from '../ui';

export default function CreatePracticePage() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <CreateHero
        eyebrow="Practice Loop"
        title="Daily Practice"
        body="Practice sessions, gentle streaks, and medium tracking are queued for the next data phase. The hidden shell already carries your default session minutes and weekly practice goal."
        actionHref="/create/settings"
        actionLabel="Open Settings"
      />

      <CreateMetricRow
        items={[
          { label: 'Default timer', value: 'Local only' },
          { label: 'Streak engine', value: 'Planned' },
          { label: 'Session logs', value: 'Planned' },
        ]}
      />

      <CreateSection title="What lands next">
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <li>Daily log table and CRUD.</li>
          <li>Practice timer and streak calculations.</li>
          <li>Monthly creative summary cards.</li>
        </ul>
      </CreateSection>

      <Link href="/create" style={buttonStyle('ghost')}>
        Back to Projects
      </Link>
    </div>
  );
}
