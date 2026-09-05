import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteStandardizedTestAction } from '../../actions';
import { loadTestDetail } from '../../data';
import {
  ClassesSection,
  TEXT,
  TEXT_SECONDARY,
  pillLinkStyle,
} from '../../ui';
import {
  TEST_CATEGORY_LABEL,
  TEST_STATUS_LABEL,
  cardStyle,
  formatDate,
  pillStyle,
} from '../../applications/ui';

interface Params {
  params: Promise<{ id: string }>;
}

function daysFromIso(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((t - now.getTime()) / 86_400_000);
}

export default async function TestDetailPage({ params }: Params) {
  const { id } = await params;
  const view = loadTestDetail(id);
  if (!view) notFound();

  const { test } = view;
  const sectionEntries: [string, number][] = (() => {
    if (!test.section_scores) return [];
    try {
      const obj = JSON.parse(test.section_scores) as Record<string, number>;
      return Object.entries(obj);
    } catch {
      return [];
    }
  })();

  const dDays = daysFromIso(test.test_date);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>{test.name}</h1>
        <div style={{ color: TEXT_SECONDARY, fontSize: 14 }}>
          {TEST_CATEGORY_LABEL[test.category]}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <span style={pillStyle()}>{TEST_STATUS_LABEL[test.status]}</span>
          {test.superscore_eligible ? <span style={pillStyle()}>Superscore eligible</span> : null}
        </div>
      </div>

      <ClassesSection title="Score">
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          }}
        >
          <InfoCard
            label="Score"
            value={
              test.score != null
                ? `${test.score}${test.max_score ? ` / ${test.max_score}` : ''}`
                : '—'
            }
          />
          {test.percentile != null ? <InfoCard label="Percentile" value={`${test.percentile}`} /> : null}
          <InfoCard label="Test date" value={formatDate(test.test_date)} />
          {dDays != null ? (
            <InfoCard
              label="Countdown"
              value={dDays < 0 ? `${Math.abs(dDays)}d ago` : dDays === 0 ? 'today' : `in ${dDays}d`}
            />
          ) : null}
          {test.registration_deadline ? (
            <InfoCard
              label="Registration deadline"
              value={formatDate(test.registration_deadline)}
            />
          ) : null}
          {test.location ? <InfoCard label="Location" value={test.location} /> : null}
        </div>
      </ClassesSection>

      {sectionEntries.length > 0 ? (
        <ClassesSection title="Section scores">
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            }}
          >
            {sectionEntries.map(([k, v]) => (
              <InfoCard key={k} label={k} value={String(v)} />
            ))}
          </div>
        </ClassesSection>
      ) : null}

      {test.notes_md ? (
        <ClassesSection title="Notes">
          <div style={cardStyle}>
            <div style={{ color: TEXT, fontSize: 14, whiteSpace: 'pre-wrap' }}>
              {test.notes_md}
            </div>
          </div>
        </ClassesSection>
      ) : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <form action={deleteStandardizedTestAction}>
          <input type="hidden" name="id" value={test.id} />
          <button type="submit" style={pillLinkStyle(false)}>
            Delete test
          </button>
        </form>
        <Link href="/classes/tests" style={pillLinkStyle(false)}>
          Back
        </Link>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>{label}</div>
      <div style={{ color: TEXT, fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
