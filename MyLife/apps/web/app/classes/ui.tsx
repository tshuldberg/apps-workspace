import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type {
  ClassesFoundationChecklistItem,
  ClassesSettings,
  ClassesStarterStats,
} from '@mylife/classes';

export const CLASSES_ACCENT = 'var(--accent-classes)';
export const CLASSES_ACCENT_DIM = 'var(--accent-classes-dim)';
export const CLASSES_ACCENT_BORDER = 'var(--accent-classes-border)';
export const SURFACE = 'var(--surface)';
export const SURFACE_ELEVATED = 'var(--surface-elevated)';
export const BORDER = 'var(--border)';
export const TEXT = 'var(--text)';
export const TEXT_SECONDARY = 'var(--text-secondary)';
export const TEXT_TERTIARY = 'var(--text-tertiary)';
export const GLASS = 'var(--glass)';

export function ClassesHero({
  badge,
  title,
  body,
  actionHref,
  actionLabel,
}: {
  badge: string;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section
      style={{
        borderRadius: 24,
        border: `1px solid ${CLASSES_ACCENT_BORDER}`,
        background: `linear-gradient(135deg, ${CLASSES_ACCENT_DIM}, rgba(19,24,36,0.82))`,
        padding: 24,
        display: 'grid',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            padding: '8px 12px',
            borderRadius: 999,
            background: 'rgba(19,24,36,0.7)',
            color: CLASSES_ACCENT,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          {badge}
        </span>
        {actionHref && actionLabel ? (
          <Link href={actionHref} style={pillLinkStyle(false)}>
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <h1 style={{ margin: 0, fontSize: 30, lineHeight: '34px', color: TEXT }}>
        {title}
      </h1>
      <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', color: TEXT_SECONDARY }}>
        {body}
      </p>
    </section>
  );
}

export function ClassesMetricRow({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            borderRadius: 18,
            border: `1px solid ${BORDER}`,
            background: SURFACE_ELEVATED,
            padding: 18,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>{item.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: CLASSES_ACCENT }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClassesSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 12,
          color: TEXT_SECONDARY,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ClassesChecklist({
  items,
}: {
  items: ClassesFoundationChecklistItem[];
}) {
  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        overflow: 'hidden',
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '12px 1fr auto',
            gap: 14,
            padding: 18,
            borderTop: index === 0 ? 'none' : `1px solid ${BORDER}`,
            alignItems: 'start',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              marginTop: 5,
              borderRadius: 999,
              background: item.ready ? CLASSES_ACCENT : TEXT_TERTIARY,
            }}
          />
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>{item.label}</div>
            <div style={{ fontSize: 13, lineHeight: '19px', color: TEXT_SECONDARY }}>
              {item.description}
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: item.ready ? CLASSES_ACCENT : TEXT_TERTIARY,
              letterSpacing: 0.4,
            }}
          >
            {item.ready ? 'READY' : 'TODO'}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClassesEmptyPanel({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div
      style={{
        borderRadius: 22,
        border: `1px dashed ${CLASSES_ACCENT_BORDER}`,
        background: GLASS,
        padding: 24,
        display: 'grid',
        gap: 12,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 24, lineHeight: '30px', color: TEXT }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', color: TEXT_SECONDARY }}>
        {body}
      </p>
      {actionHref && actionLabel ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={actionHref} style={pillLinkStyle(true)}>
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function ClassesSettingsSummary({
  settings,
  stats,
}: {
  settings: ClassesSettings;
  stats: ClassesStarterStats;
}) {
  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px solid ${CLASSES_ACCENT_BORDER}`,
        background: CLASSES_ACCENT_DIM,
        padding: 20,
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>Starter preferences</div>
      <div style={{ fontSize: 14, lineHeight: '21px', color: TEXT_SECONDARY }}>
        Term: {stats.currentTermLabel} · Week starts {settings.weekStartsOn} · Study rhythm {stats.dailyFocusLabel}
      </div>
      <div style={{ fontSize: 13, lineHeight: '20px', color: TEXT_SECONDARY }}>
        Reminders: {stats.reminderSummary}
      </div>
    </div>
  );
}

export function ClassesFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        padding: 20,
        display: 'grid',
        gap: 16,
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{title}</div>
        <div style={{ fontSize: 14, lineHeight: '21px', color: TEXT_SECONDARY }}>
          {description}
        </div>
      </div>
      {children}
    </div>
  );
}

export function fieldLabel(label: string) {
  return (
    <label
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: TEXT_SECONDARY,
      }}
    >
      {label}
    </label>
  );
}

export const textInputStyle: CSSProperties = {
  width: '100%',
  marginTop: 8,
  padding: '12px 14px',
  borderRadius: 12,
  border: `1px solid ${BORDER}`,
  background: SURFACE_ELEVATED,
  color: TEXT,
  fontSize: 15,
};

export function pillLinkStyle(primary: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: primary ? '11px 16px' : '10px 16px',
    borderRadius: 999,
    border: primary ? `1px solid ${CLASSES_ACCENT}` : `1px solid ${BORDER}`,
    background: primary ? CLASSES_ACCENT : 'rgba(19,24,36,0.74)',
    color: primary ? 'var(--background)' : TEXT,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
  };
}

export const checkboxLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 999,
  border: `1px solid ${BORDER}`,
  background: SURFACE_ELEVATED,
  color: TEXT_SECONDARY,
  fontSize: 14,
};
