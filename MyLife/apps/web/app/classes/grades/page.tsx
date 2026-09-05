import Link from 'next/link';
import { loadGradesView, type GradeRow } from '../data';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  ClassesEmptyPanel,
  ClassesHero,
  ClassesMetricRow,
  ClassesSection,
  pillLinkStyle,
  TEXT,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
} from '../ui';
import { GradePredictionCard } from '@/components/classes/GradePredictionCard';
import type { TrendResult } from '@mylife/classes';

export default function ClassesGradesPage() {
  const view = loadGradesView();

  if (!view.semester) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Grades"
          title="No active semester"
          body="Create a semester from settings to start tracking grades and GPA."
        />
        <ClassesEmptyPanel
          title="Set up a semester first"
          body="Grades roll up by semester. Add one to unlock GPA, what-if predictions, and trends."
          actionHref="/classes/settings"
          actionLabel="Open settings"
        />
      </div>
    );
  }

  if (view.rows.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge={view.semester.name}
          title="No classes yet"
          body="Add a class to this semester to start tracking grades, weights, and predictions."
          actionHref="/classes"
          actionLabel="Open schedule"
        />
        <ClassesEmptyPanel
          title="Empty grade book"
          body="Once classes and graded assignments exist, this dashboard fills in automatically."
          actionHref="/classes"
          actionLabel="Add classes"
        />
      </div>
    );
  }

  const gpaText =
    view.semesterGPA.gpa === null ? '—' : view.semesterGPA.gpa.toFixed(2);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge={view.semester.name}
        title="Semester grades"
        body="Credit-weighted GPA across graded classes, per-class breakdown, what-if predictions, and trend pills."
        actionHref="/classes/settings"
        actionLabel="Settings"
      />

      <ClassesMetricRow
        items={[
          { label: 'Semester GPA', value: gpaText },
          { label: 'Credit hours', value: String(view.semesterGPA.credit_hours) },
          {
            label: 'Graded credits',
            value: String(view.semesterGPA.graded_credits),
          },
        ]}
      />

      <ClassesSection title="Class grades">
        <div style={{ display: 'grid', gap: 16 }}>
          {view.rows.map((row) => (
            <GradeRowCard key={row.cls.id} row={row} />
          ))}
        </div>
      </ClassesSection>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/classes" style={pillLinkStyle(false)}>
          Schedule
        </Link>
        <Link href="/classes/assignments" style={pillLinkStyle(false)}>
          Assignments
        </Link>
      </div>
    </div>
  );
}

function GradeRowCard({ row }: { row: GradeRow }) {
  const accent = row.cls.color || CLASSES_ACCENT;
  const percentLabel =
    row.grade.percent === null ? '—' : `${row.grade.percent.toFixed(1)}%`;
  const letter = row.grade.letter ?? '—';
  const trendLabel = trendToLabel(row.trend);
  const trendColor = trendToColor(row.trend);
  const defaultTarget =
    typeof row.cls.target_grade === 'number' && Number.isFinite(row.cls.target_grade)
      ? row.cls.target_grade
      : 90;

  const categoryEntries = Object.entries(row.grade.by_category)
    .filter(([, r]) => r.possible > 0 && r.percent !== null)
    .sort((a, b) => (b[1].percent ?? 0) - (a[1].percent ?? 0));

  return (
    <article
      style={{
        position: 'relative',
        borderRadius: 20,
        border: `1px solid ${CLASSES_ACCENT_BORDER}`,
        background: 'var(--surface)',
        padding: 20,
        paddingLeft: 24,
        display: 'grid',
        gap: 16,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 4,
          background: accent,
        }}
      />
      <header
        style={{
          display: 'flex',
          gap: 16,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{row.cls.name}</div>
          {row.cls.code ? (
            <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
              {row.cls.code}
              {row.cls.section ? ` · ${row.cls.section}` : ''}
            </div>
          ) : null}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: accent, lineHeight: '28px' }}>
            {percentLabel}
          </div>
          <div style={{ fontSize: 13, color: TEXT_SECONDARY, fontWeight: 700 }}>
            {letter}
          </div>
        </div>
      </header>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
          {row.grade.graded_count} graded · {row.cls.credits} credit
          {row.cls.credits === 1 ? '' : 's'}
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 10px',
            borderRadius: 999,
            border: `1px solid ${trendColor}`,
            color: trendColor,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
          }}
        >
          {trendLabel}
        </span>
      </div>

      {categoryEntries.length > 0 ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div
            style={{
              fontSize: 11,
              color: TEXT_SECONDARY,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            By category
          </div>
          {categoryEntries.map(([key, rollup]) => {
            const pct = Math.max(0, Math.min(100, rollup.percent ?? 0));
            return (
              <div key={key} style={{ display: 'grid', gap: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: TEXT_SECONDARY,
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{key}</span>
                  <span>{pct.toFixed(0)}%</span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: accent,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: TEXT_TERTIARY }}>No category breakdown yet.</div>
      )}

      <GradePredictionCard
        className={row.cls.name}
        accent={accent}
        assignments={row.assignments}
        weights={row.weights}
        defaultTarget={defaultTarget}
      />
    </article>
  );
}

function trendToLabel(t: TrendResult): string {
  if (t.confidence === 'low') return 'Not enough data';
  const arrow = t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→';
  return `${arrow} ${Math.abs(t.slope_per_week).toFixed(1)}/wk · ${t.confidence}`;
}

function trendToColor(t: TrendResult): string {
  if (t.direction === 'up') return 'var(--success, #30D158)';
  if (t.direction === 'down') return 'var(--danger, #FFB4AB)';
  return 'var(--text-tertiary)';
}
