import Link from 'next/link';
import type { OnlineCourseStatus } from '@mylife/classes';
import { loadCoursesView } from '../../data';
import {
  ClassesEmptyPanel,
  ClassesHero,
  ClassesMetricRow,
  ClassesSection,
  pillLinkStyle,
} from '../../ui';
import { CourseCard } from '../ui';

const STATUS_FILTERS: Array<{ id: OnlineCourseStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'not_started', label: 'Not started' },
  { id: 'abandoned', label: 'Abandoned' },
];

function isStatus(value: unknown): value is OnlineCourseStatus | 'all' {
  return typeof value === 'string' && STATUS_FILTERS.some((f) => f.id === value);
}

export default async function CoursesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const requested = sp.status;
  const status = isStatus(requested) ? requested : 'all';

  let view;
  try {
    view = loadCoursesView({ status });
  } catch (err) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Courses"
          title="Courses"
          body="We hit a snag loading your courses."
        />
        <ClassesEmptyPanel
          title="Course list unavailable"
          body={String(err)}
          actionHref="/classes/lifelong"
          actionLabel="Back to lifelong"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge="Courses"
        title="Self-directed courses"
        body="Anywhere you are learning. Coursera, Udemy, edX, YouTube series, books with companion videos."
        actionHref="/classes/lifelong/courses/add"
        actionLabel="Add course"
      />

      <ClassesMetricRow
        items={[
          { label: 'Total', value: String(view.stats.total) },
          { label: 'In progress', value: String(view.stats.in_progress) },
          { label: 'Completed', value: String(view.stats.completed) },
          { label: 'Hours logged', value: view.stats.total_hours_spent.toFixed(1) },
        ]}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((f) => {
          const active = f.id === status;
          const href = f.id === 'all'
            ? '/classes/lifelong/courses'
            : `/classes/lifelong/courses?status=${f.id}`;
          return (
            <Link
              key={f.id}
              href={href}
              style={{
                ...pillLinkStyle(active),
                fontSize: 12,
                padding: '6px 14px',
              }}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <ClassesSection title={status === 'all' ? 'All courses' : `${STATUS_FILTERS.find((f) => f.id === status)?.label}`}>
        {view.rows.length === 0 ? (
          <ClassesEmptyPanel
            title="No courses yet"
            body="Track Coursera, Udemy, YouTube series — anywhere you are learning."
            actionHref="/classes/lifelong/courses/add"
            actionLabel="Add a course"
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {view.rows.map((course) => (
              <Link
                key={course.id}
                href={`/classes/lifelong/courses/${course.id}`}
                style={{ textDecoration: 'none' }}
              >
                <CourseCard course={course} />
              </Link>
            ))}
          </div>
        )}
      </ClassesSection>
    </div>
  );
}
