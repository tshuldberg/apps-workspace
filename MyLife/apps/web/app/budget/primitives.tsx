import type {
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import Link from 'next/link';
import {
  ACCENT,
  ACCENT_LIGHT,
  BORDER,
  BudgetCard,
  BudgetPill,
  BudgetSectionHeader,
  BudgetSymbol,
  DANGER,
  GLASS_BORDER,
  INFO,
  MONEY,
  SURFACE_LOW,
  TEXT,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  buttonStyle,
  eyebrowStyle,
  inputStyle,
  withAlpha,
} from './ui';

export function BudgetPage({
  children,
  maxWidth = 1440,
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 24,
        margin: '0 auto',
        maxWidth,
      }}
    >
      {children}
    </div>
  );
}

export function BudgetHero({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  actions?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <BudgetCard glow padding={28}>
      <div style={{ display: 'grid', gap: 22 }}>
        <div
          style={{
            alignItems: 'flex-start',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'grid', gap: 10, maxWidth: 780 }}>
            {eyebrow ? <p style={eyebrowStyle()}>{eyebrow}</p> : null}
            <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.05em', margin: 0 }}>
              {title}
            </h1>
            {description ? (
              <p style={{ color: TEXT_SECONDARY, fontSize: 15, lineHeight: 1.8, margin: 0 }}>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{actions}</div> : null}
        </div>
        {children}
      </div>
    </BudgetCard>
  );
}

export function BudgetMetricGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      }}
    >
      {children}
    </div>
  );
}

export function BudgetColumns({
  primary,
  secondary,
  secondaryWidth = 360,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  secondaryWidth?: number;
}) {
  return (
    <div
      style={{
        alignItems: 'start',
        display: 'grid',
        gap: 24,
        gridTemplateColumns: secondary ? `minmax(0, 1fr) minmax(300px, ${secondaryWidth}px)` : '1fr',
      }}
    >
      <div style={{ display: 'grid', gap: 24, minWidth: 0 }}>{primary}</div>
      {secondary ? <div style={{ display: 'grid', gap: 24 }}>{secondary}</div> : null}
    </div>
  );
}

export function BudgetPanel({
  title,
  description,
  action,
  children,
}: {
  action?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <BudgetCard padding={22}>
      <BudgetSectionHeader action={action} description={description} title={title} />
      <div style={{ display: 'grid', gap: 16 }}>{children}</div>
    </BudgetCard>
  );
}

export function BudgetRouteGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      }}
    >
      {children}
    </div>
  );
}

export function BudgetRouteCard({
  href,
  icon,
  title,
  description,
}: {
  description: string;
  href: string;
  icon: string;
  title: string;
}) {
  return (
    <Link
      href={href}
      style={{
        ...cardLinkStyle,
        background: `linear-gradient(180deg, ${withAlpha(SURFACE_LOW, 0.92)}, ${withAlpha('#111219', 0.96)})`,
      }}
    >
      <div
        style={{
          alignItems: 'center',
          background: `linear-gradient(135deg, ${withAlpha(ACCENT_LIGHT, 0.24)}, ${withAlpha(MONEY, 0.18)})`,
          borderRadius: 18,
          display: 'inline-flex',
          height: 42,
          justifyContent: 'center',
          width: 42,
        }}
      >
        <BudgetSymbol color={ACCENT_LIGHT} name={icon} size={22} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <strong style={{ color: TEXT, fontSize: 16 }}>{title}</strong>
        <span style={{ color: TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>{description}</span>
      </div>
    </Link>
  );
}

export function BudgetProgressBar({
  value,
  max,
  color = MONEY,
}: {
  color?: string;
  max: number;
  value: number;
}) {
  const safeMax = Math.max(max, 1);
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div
      style={{
        background: withAlpha('#ffffff', 0.04),
        borderRadius: 999,
        height: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: `linear-gradient(90deg, ${color}, ${withAlpha(color, 0.75)})`,
          borderRadius: 999,
          height: '100%',
          width: `${pct}%`,
        }}
      />
    </div>
  );
}

export function BudgetKeyValueList({
  items,
}: {
  items: Array<{ label: string; tone?: 'danger' | 'info' | 'money' | 'neutral'; value: ReactNode }>;
}) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            alignItems: 'center',
            borderTop: `1px solid ${withAlpha(GLASS_BORDER, 0.5)}`,
            display: 'flex',
            gap: 12,
            justifyContent: 'space-between',
            paddingTop: 12,
          }}
        >
          <span style={{ color: TEXT_SECONDARY, fontSize: 13 }}>{item.label}</span>
          <span style={{ color: toneColor(item.tone), fontSize: 14, fontWeight: 700 }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function BudgetTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div
      className="budget-scroll"
      style={{
        border: `1px solid ${withAlpha(GLASS_BORDER, 0.55)}`,
        borderRadius: 22,
        overflow: 'auto',
      }}
    >
      <table style={{ borderCollapse: 'collapse', minWidth: '100%', width: '100%' }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                style={{
                  background: withAlpha('#ffffff', 0.02),
                  color: TEXT_TERTIARY,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  padding: '12px 14px',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`row-${index}`}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`cell-${index}-${cellIndex}`}
                  style={{
                    borderTop: `1px solid ${withAlpha(BORDER, 0.8)}`,
                    color: TEXT,
                    fontSize: 14,
                    padding: '14px',
                    verticalAlign: 'top',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BudgetStack({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 12 }}>{children}</div>;
}

export function BudgetRow({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div
      style={{
        background: tone ?? withAlpha('#ffffff', 0.02),
        border: `1px solid ${withAlpha(GLASS_BORDER, 0.5)}`,
        borderRadius: 20,
        display: 'grid',
        gap: 12,
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

export function BudgetForm({
  action,
  children,
  title,
  description,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <BudgetCard padding={22} tone={withAlpha('#15171f', 0.96)}>
      <form action={action} style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <strong style={{ color: TEXT, fontSize: 16 }}>{title}</strong>
          {description ? (
            <span style={{ color: TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>{description}</span>
          ) : null}
        </div>
        {children}
      </form>
    </BudgetCard>
  );
}

export function BudgetField({
  label,
  children,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={{ color: TEXT_TERTIARY, fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

export function BudgetInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle(), ...(props.style ?? {}) }} />;
}

export function BudgetSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputStyle(), ...(props.style ?? {}) }} />;
}

export function BudgetTextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle(), minHeight: 112, resize: 'vertical', ...(props.style ?? {}) }} />;
}

export function BudgetFormGrid({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 14,
        gridTemplateColumns:
          columns === 1 ? '1fr' : columns === 3 ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
      }}
    >
      {children}
    </div>
  );
}

export function BudgetSubmitRow({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
      {children}
    </div>
  );
}

export function BudgetActionButton({
  children,
  href,
  tone = 'primary',
}: {
  children: ReactNode;
  href: string;
  tone?: 'danger' | 'ghost' | 'primary' | 'secondary';
}) {
  return (
    <Link href={href} style={buttonStyle(tone)}>
      {children}
    </Link>
  );
}

export function BudgetHint({ children }: { children: ReactNode }) {
  return <span style={{ color: TEXT_TERTIARY, fontSize: 12, lineHeight: 1.6 }}>{children}</span>;
}

export function BudgetTonePill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'accent' | 'danger' | 'info' | 'money' | 'neutral';
}) {
  return <BudgetPill accent={toneColor(tone)}>{children}</BudgetPill>;
}

export const cardLinkStyle: CSSProperties = {
  border: `1px solid ${withAlpha(GLASS_BORDER, 0.55)}`,
  borderRadius: 22,
  color: TEXT,
  display: 'grid',
  gap: 14,
  padding: 18,
  textDecoration: 'none',
};

function toneColor(tone?: 'accent' | 'danger' | 'info' | 'money' | 'neutral') {
  if (tone === 'money') return MONEY;
  if (tone === 'danger') return DANGER;
  if (tone === 'info') return INFO;
  if (tone === 'accent') return ACCENT_LIGHT;
  return TEXT;
}

export function buildStatPill(icon: string, label: string, value: ReactNode) {
  return (
    <div
      style={{
        alignItems: 'center',
        background: withAlpha('#ffffff', 0.03),
        border: `1px solid ${withAlpha(GLASS_BORDER, 0.45)}`,
        borderRadius: 20,
        display: 'flex',
        gap: 12,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          alignItems: 'center',
          background: `linear-gradient(135deg, ${withAlpha(ACCENT, 0.2)}, ${withAlpha(ACCENT_LIGHT, 0.16)})`,
          borderRadius: 14,
          display: 'inline-flex',
          height: 38,
          justifyContent: 'center',
          width: 38,
        }}
      >
        <BudgetSymbol color={ACCENT_LIGHT} name={icon} size={20} />
      </div>
      <div style={{ display: 'grid', gap: 2 }}>
        <span style={{ color: TEXT_TERTIARY, fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase' }}>
          {label}
        </span>
        <strong style={{ color: TEXT, fontSize: 16 }}>{value}</strong>
      </div>
    </div>
  );
}
