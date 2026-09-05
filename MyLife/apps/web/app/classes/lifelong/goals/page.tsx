import Link from 'next/link';
import { loadLearningGoalsView } from '../../data';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  ClassesEmptyPanel,
  ClassesHero,
  ClassesSection,
  TEXT,
  TEXT_SECONDARY,
} from '../../ui';
import { GOAL_STATUS_LABEL, ProgressBar, formatDate } from '../ui';

export default async function GoalsListPage() {
  let view;
  try {
    view = loadLearningGoalsView();
  } catch (err) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Goals"
          title="Learning goals"
          body="We hit a snag loading your goals."
        />
        <ClassesEmptyPanel
          title="Goals unavailable"
          body={String(err)}
          actionHref="/classes/lifelong"
          actionLabel="Back to lifelong"
        />
      </div>
    );
  }

  if (view.rows.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Goals"
          title="Goals turn courses into a story"
          body="Pick the version of you that you are building. Tie courses and certs to it. Track the arc."
          actionHref="/classes/lifelong/goals/add"
          actionLabel="Set a goal"
        />
        <ClassesEmptyPanel
          title="No learning goals yet"
          body="Frame the why. Tie courses and certs to the version of you they unlock."
          actionHref="/classes/lifelong/goals/add"
          actionLabel="Set a goal"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge="Goals"
        title="Learning goals"
        body="Long-arc objectives with linked courses and certifications. Watch the percent climb."
        actionHref="/classes/lifelong/goals/add"
        actionLabel="Set a goal"
      />

      <ClassesSection title="All goals">
        <div style={{ display: 'grid', gap: 12 }}>
          {view.rows.map(({ goal, progress }) => (
            <Link
              key={goal.id}
              href={`/classes/lifelong/goals/${goal.id}`}
              style={{ textDecoration: 'none' }}
            >
              <article
                style={{
                  borderRadius: 16,
                  border: `1px solid ${CLASSES_ACCENT_BORDER}`,
                  background: 'var(--surface)',
                  padding: 16,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
                      {goal.title}
                    </div>
                    <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                      {goal.target_date
                        ? `Target ${formatDate(goal.target_date)}`
                        : 'No target date'}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      border: `1px solid ${CLASSES_ACCENT_BORDER}`,
                      color: CLASSES_ACCENT,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {GOAL_STATUS_LABEL[goal.status] ?? goal.status}
                  </span>
                </div>
                <ProgressBar percent={progress.percent} />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: TEXT_SECONDARY,
                  }}
                >
                  <span>
                    {progress.completed_items} of {progress.total_items} items
                  </span>
                  <span>{progress.percent.toFixed(0)}%</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </ClassesSection>
    </div>
  );
}
