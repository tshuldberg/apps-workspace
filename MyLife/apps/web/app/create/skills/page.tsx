import Link from 'next/link';
import { CreateHero, CreateMetricRow, CreateSection, buttonStyle } from '../ui';

export default function CreateSkillsPage() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <CreateHero
        eyebrow="Skill Tree"
        title="Skills"
        body="MyCreate will track self-assessed proficiency, milestone notes, and practice-hour rollups across mediums without turning the module into a social scoring surface."
        actionHref="/create/settings"
        actionLabel="View Defaults"
      />

      <CreateMetricRow
        items={[
          { label: 'Assessment model', value: 'Self-assessed' },
          { label: 'Milestones', value: 'Planned' },
          { label: 'Cross-links', value: 'Classes / Habits' },
        ]}
      />

      <CreateSection title="Skill data direction">
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <li>Private progress history, not public leaderboards.</li>
          <li>Practice hours roll up into each skill.</li>
          <li>Tool proficiency can attach to creative skills later.</li>
        </ul>
      </CreateSection>

      <Link href="/create/portfolio" style={buttonStyle('ghost')}>
        Portfolio
      </Link>
    </div>
  );
}
