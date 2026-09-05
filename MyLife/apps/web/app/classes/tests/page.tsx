import Link from 'next/link';
import { loadTestsView } from '../data';
import {
  ClassesEmptyPanel,
  ClassesHero,
  ClassesMetricRow,
  ClassesSection,
  TEXT,
  TEXT_SECONDARY,
  pillLinkStyle,
} from '../ui';
import {
  TEST_CATEGORIES,
  TEST_CATEGORY_LABEL,
  TEST_STATUS_LABEL,
  cardStyle,
  formatDate,
  pillStyle,
} from '../applications/ui';
import { CLASSES_ACCENT, CLASSES_ACCENT_BORDER, CLASSES_ACCENT_DIM } from '../ui';

function countdown(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const days = Math.floor((t - now.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return 'today';
  if (days <= 60) return `in ${days}d`;
  return `in ${Math.round(days / 30)}mo`;
}

export default function TestsPage() {
  const view = loadTestsView();

  if (view.total === 0) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Tests"
          title="Track every score that matters"
          body="Plan upcoming sittings, log scores by section, and superscore across attempts."
          actionHref="/classes/tests/add"
          actionLabel="Add test"
        />
        <ClassesEmptyPanel
          title="No tests tracked yet"
          body="Log a planned test or a past score to get started."
          actionHref="/classes/tests/add"
          actionLabel="Add a test"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, color: TEXT }}>Tests</h1>
        <Link href="/classes/tests/add" style={pillLinkStyle(true)}>
          + Add test
        </Link>
      </div>

      <ClassesMetricRow
        items={[
          { label: 'Total', value: String(view.total) },
          { label: 'Upcoming', value: String(view.upcoming.length) },
          { label: 'Best scores', value: String(view.best.length) },
        ]}
      />

      {view.upcoming.length > 0 ? (
        <ClassesSection title="Upcoming">
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}
          >
            {view.upcoming.map((t) => (
              <Link key={t.id} href={`/classes/tests/${t.id}`} style={cardStyle}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div style={{ color: TEXT, fontSize: 16, fontWeight: 700 }}>{t.name}</div>
                  <span style={pillStyle()}>{TEST_STATUS_LABEL[t.status]}</span>
                </div>
                <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                  {TEST_CATEGORY_LABEL[t.category]}
                  {t.test_date ? ` · ${formatDate(t.test_date)}` : ''}
                  {t.test_date ? ` · ${countdown(t.test_date)}` : ''}
                </div>
              </Link>
            ))}
          </div>
        </ClassesSection>
      ) : null}

      {view.best.length > 0 ? (
        <ClassesSection title="Best scores">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {view.best.map((b) => (
              <div
                key={b.name}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: `1px solid ${CLASSES_ACCENT}`,
                  background: CLASSES_ACCENT_DIM,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ color: TEXT_SECONDARY, fontSize: 12, fontWeight: 600 }}>
                  {b.name}
                </span>
                <span style={{ color: CLASSES_ACCENT, fontSize: 13, fontWeight: 800 }}>
                  {b.score}
                </span>
              </div>
            ))}
          </div>
        </ClassesSection>
      ) : null}

      {TEST_CATEGORIES.filter((c) => view.groups[c].length > 0).map((cat) => (
        <ClassesSection key={cat} title={`${TEST_CATEGORY_LABEL[cat]} (${view.groups[cat].length})`}>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}
          >
            {view.groups[cat].map((t) => (
              <Link
                key={t.id}
                href={`/classes/tests/${t.id}`}
                style={{ ...cardStyle, borderColor: CLASSES_ACCENT_BORDER }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div style={{ color: TEXT, fontSize: 16, fontWeight: 700 }}>{t.name}</div>
                  <span style={pillStyle()}>{TEST_STATUS_LABEL[t.status]}</span>
                </div>
                <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                  {t.score != null
                    ? `Score ${t.score}${t.max_score ? ` / ${t.max_score}` : ''}`
                    : 'No score yet'}
                  {t.test_date ? ` · ${formatDate(t.test_date)}` : ''}
                </div>
              </Link>
            ))}
          </div>
        </ClassesSection>
      ))}
    </div>
  );
}
