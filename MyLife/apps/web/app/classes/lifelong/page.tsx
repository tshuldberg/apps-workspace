import Link from 'next/link';
import { loadLifelongHubView } from '../data';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  ClassesEmptyPanel,
  ClassesHero,
  ClassesMetricRow,
  ClassesSection,
  TEXT,
  TEXT_SECONDARY,
  pillLinkStyle,
} from '../ui';
import {
  CertCard,
  CourseCard,
  ProgressBar,
  formatDate,
} from './ui';

export default async function LifelongHubPage() {
  let view;
  try {
    view = loadLifelongHubView();
  } catch (err) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Lifelong"
          title="Lifelong learning"
          body="We hit a snag loading your learning hub. Try refreshing in a moment."
        />
        <ClassesEmptyPanel
          title="Hub unavailable"
          body={String(err)}
          actionHref="/classes"
          actionLabel="Back to schedule"
        />
      </div>
    );
  }

  const { active_courses, expiring_certs, active_goals, course_stats, cert_total, goal_total } = view;
  const isEmpty =
    course_stats.total === 0 && cert_total === 0 && goal_total === 0;

  if (isEmpty) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Lifelong"
          title="Build a learning life that compounds"
          body="Track Coursera, Udemy, YouTube series, professional certifications, and the long-arc goals that tie them together."
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          <ClassesEmptyPanel
            title="No courses yet"
            body="Track Coursera, Udemy, YouTube series — anywhere you are learning."
            actionHref="/classes/lifelong/courses/add"
            actionLabel="Add a course"
          />
          <ClassesEmptyPanel
            title="No certifications yet"
            body="Log professional credentials so renewals and expirations never sneak up."
            actionHref="/classes/lifelong/certifications/add"
            actionLabel="Add a credential"
          />
          <ClassesEmptyPanel
            title="No learning goals yet"
            body="Frame the why. Tie courses and certs to the version of you they unlock."
            actionHref="/classes/lifelong/goals/add"
            actionLabel="Set a goal"
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge="Lifelong"
        title="Lifelong learning"
        body="Self-directed courses, professional certifications, and the goals that connect them."
      />

      <ClassesMetricRow
        items={[
          { label: 'Courses in progress', value: String(course_stats.in_progress) },
          { label: 'Hours logged', value: course_stats.total_hours_spent.toFixed(1) },
          { label: 'Certifications', value: String(cert_total) },
          { label: 'Active goals', value: String(active_goals.length) },
        ]}
      />

      <ClassesSection title="Active courses">
        {active_courses.length === 0 ? (
          <ClassesEmptyPanel
            title="No courses in progress"
            body="Start one to see it here. Anything self-directed counts."
            actionHref="/classes/lifelong/courses"
            actionLabel="See all courses"
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {active_courses.map((c) => (
              <Link
                key={c.id}
                href={`/classes/lifelong/courses/${c.id}`}
                style={{ textDecoration: 'none' }}
              >
                <CourseCard course={c} />
              </Link>
            ))}
          </div>
        )}
        <div>
          <Link href="/classes/lifelong/courses" style={pillLinkStyle(false)}>
            See all courses
          </Link>
        </div>
      </ClassesSection>

      <ClassesSection title="Expiring soon">
        {expiring_certs.length === 0 ? (
          <ClassesEmptyPanel
            title="Nothing expiring in the next 90 days"
            body="Renewal pressure stays low. We'll surface anything within 90 days here."
            actionHref="/classes/lifelong/certifications"
            actionLabel="See all certifications"
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {expiring_certs.map((c) => (
              <Link
                key={c.id}
                href={`/classes/lifelong/certifications/${c.id}`}
                style={{ textDecoration: 'none' }}
              >
                <CertCard cert={c} />
              </Link>
            ))}
          </div>
        )}
        <div>
          <Link href="/classes/lifelong/certifications" style={pillLinkStyle(false)}>
            See all certifications
          </Link>
        </div>
      </ClassesSection>

      <ClassesSection title="Active goals">
        {active_goals.length === 0 ? (
          <ClassesEmptyPanel
            title="No active goals"
            body="Goals turn scattered learning into a story arc. Add one with linked courses or certs."
            actionHref="/classes/lifelong/goals/add"
            actionLabel="Set a goal"
          />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {active_goals.map(({ goal, progress }) => (
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
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
                      {goal.title}
                    </div>
                    <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                      {goal.target_date ? `Target ${formatDate(goal.target_date)}` : 'No target date'}
                    </div>
                  </div>
                  <ProgressBar percent={progress.percent} accent={CLASSES_ACCENT} />
                  <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                    {progress.completed_items} of {progress.total_items} items complete
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
        <div>
          <Link href="/classes/lifelong/goals" style={pillLinkStyle(false)}>
            See all goals
          </Link>
        </div>
      </ClassesSection>
    </div>
  );
}
