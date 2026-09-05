import Link from 'next/link';
import {
  formatRelativeDayLabel,
  type UpcomingOfficeHour,
} from '@mylife/classes';

const ACCENT = 'var(--accent-classes)';
const ACCENT_DIM = 'var(--accent-classes-dim)';
const ACCENT_BORDER = 'var(--accent-classes-border)';
const TEXT = 'var(--text)';
const TEXT_SECONDARY = 'var(--text-secondary)';
const TEXT_TERTIARY = 'var(--text-tertiary)';
const BORDER = 'var(--border)';

export interface OfficeHoursWidgetProps {
  items: UpcomingOfficeHour[];
}

function mapsHref(location: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(location)}`;
}

function Row({ item }: { item: UpcomingOfficeHour }) {
  const codeLabel =
    item.class_codes.length === 0
      ? null
      : item.class_codes.length === 1
        ? item.class_codes[0]
        : `${item.class_codes.length} classes`;

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          href={`/classes/teacher/${item.teacher_id}`}
          style={{
            color: TEXT,
            fontSize: 15,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          {item.teacher_name}
        </Link>
        {codeLabel ? (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(19,24,36,0.55)',
              color: ACCENT,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.2,
            }}
          >
            {codeLabel}
          </span>
        ) : null}
      </div>
      <div style={{ fontSize: 13, lineHeight: '18px', color: TEXT_SECONDARY }}>
        {formatRelativeDayLabel(item.days_from_today, item.day)} ·{' '}
        {item.start_time}–{item.end_time}
      </div>
      {item.office_location ? (
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 2,
          }}
        >
          <span style={{ fontSize: 12, color: TEXT_TERTIARY }}>
            {item.office_location}
          </span>
          <a
            href={mapsHref(item.office_location)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: ACCENT,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Open in Maps →
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function OfficeHoursWidget({ items }: OfficeHoursWidgetProps) {
  return (
    <section
      style={{
        borderRadius: 20,
        border: `1px solid ${ACCENT_BORDER}`,
        background: ACCENT_DIM,
        padding: 20,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'grid', gap: 2 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: ACCENT,
          }}
        >
          Office Hours
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>
          This Week
        </div>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 14, lineHeight: '20px', color: TEXT_SECONDARY }}>
          No office hours scheduled. Add them in a teacher&apos;s profile.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item, idx) => (
            <div
              key={`${item.teacher_id}-${item.day}-${item.start_time}-${idx}`}
              style={{
                display: 'grid',
                gap: 12,
                paddingTop: idx === 0 ? 0 : 12,
                borderTop: idx === 0 ? 'none' : `1px solid ${BORDER}`,
              }}
            >
              <Row item={item} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
