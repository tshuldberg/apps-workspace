import type { CertificationRow, OnlineCourseRow } from '@mylife/classes';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  TEXT,
  TEXT_SECONDARY,
} from '../ui';

export const COURSE_STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  abandoned: 'Abandoned',
};

export const GOAL_STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  completed: 'Completed',
  paused: 'Paused',
  abandoned: 'Abandoned',
};

export type CertExpiryBucket = 'expired' | 'soon' | 'soonish' | 'ok' | 'none';

export function bucketCertExpiry(
  expiresAt: string | null,
  now: Date = new Date(),
): CertExpiryBucket {
  if (!expiresAt) return 'none';
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return 'none';
  const days = Math.floor((target - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return 'expired';
  if (days <= 30) return 'soon';
  if (days <= 90) return 'soonish';
  return 'ok';
}

export function expiryColor(bucket: CertExpiryBucket): string {
  switch (bucket) {
    case 'expired':
      return 'var(--danger, #FFB4AB)';
    case 'soon':
      return 'var(--danger, #FFB4AB)';
    case 'soonish':
      return '#FFD166';
    case 'ok':
      return 'var(--success, #30D158)';
    default:
      return TEXT_SECONDARY;
  }
}

export function expiryLabel(
  expiresAt: string | null,
  now: Date = new Date(),
): string {
  if (!expiresAt) return 'No expiry';
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return 'Unknown expiry';
  const days = Math.floor((target - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  if (days <= 90) return `Expires in ${days}d`;
  const months = Math.round(days / 30);
  return `Expires in ${months}mo`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ProgressBar({
  percent,
  accent = CLASSES_ACCENT,
  height = 8,
}: {
  percent: number;
  accent?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div
      style={{
        height,
        borderRadius: height / 2,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: accent,
          borderRadius: height / 2,
        }}
      />
    </div>
  );
}

export function CourseCard({ course }: { course: OnlineCourseRow }) {
  const meta = [
    course.provider,
    course.instructor,
    course.actual_hours
      ? `${course.actual_hours.toFixed(1)}h logged`
      : course.estimated_hours
        ? `${course.estimated_hours.toFixed(1)}h est.`
        : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
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
      <header
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
            {course.title}
          </div>
          {meta ? (
            <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>{meta}</div>
          ) : null}
        </div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            border: `1px solid ${CLASSES_ACCENT_BORDER}`,
            color: CLASSES_ACCENT,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            whiteSpace: 'nowrap',
          }}
        >
          {COURSE_STATUS_LABEL[course.status] ?? course.status}
        </span>
      </header>
      <ProgressBar percent={course.progress_percent} />
      <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
        {course.progress_percent.toFixed(0)}% complete
      </div>
    </article>
  );
}

export function CertCard({ cert }: { cert: CertificationRow }) {
  const bucket = bucketCertExpiry(cert.expires_at);
  const color = expiryColor(bucket);
  const label = expiryLabel(cert.expires_at);

  return (
    <article
      style={{
        borderRadius: 16,
        border: `1px solid ${CLASSES_ACCENT_BORDER}`,
        background: 'var(--surface)',
        padding: 16,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
        {cert.name}
      </div>
      {cert.issuer ? (
        <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>{cert.issuer}</div>
      ) : null}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            border: `1px solid ${color}`,
            color,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {label}
        </span>
        {cert.issued_at ? (
          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
            Issued {formatDate(cert.issued_at)}
          </span>
        ) : null}
      </div>
    </article>
  );
}
