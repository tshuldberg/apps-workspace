import type { CSSProperties, ReactNode } from 'react';
import {
  PAY_ACCENT,
  PAY_BORDER,
  PAY_GLASS,
  PAY_RADIUS,
  PAY_SURFACES,
  PAY_TEXT,
  PAY_TEXT_MUTED,
  PAY_TEXT_SECONDARY,
  getPaymentDisclosureMeta,
  getPaymentStatusMeta,
  getPaymentTimelineStepMeta,
  getPaymentVerificationMeta,
} from './tokens';
import {
  PAY_TYPOGRAPHY,
  PAY_WEB_FONT_STACK,
  PAY_WEB_MONO_STACK,
  PAY_WEB_TABULAR_FONT_FEATURES,
} from './typography';
import {
  formatCounterpartyLabel,
  formatPaymentAmount,
  formatPaymentTimestamp,
} from './format';
import type {
  PaymentActivityItem,
  PaymentCounterparty,
  PaymentDisclosure,
  PaymentDisclosureTone,
  PaymentStatus,
  PaymentTimelineStep,
} from '../types';

interface PaymentGlassCardProps {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  footer?: ReactNode;
  accentColor?: string;
  style?: CSSProperties;
}

interface AmountDisplayProps {
  amountCents: number;
  currency: string;
  direction?: 'incoming' | 'outgoing' | 'neutral';
  pending?: boolean;
  compact?: boolean;
  label?: string;
  style?: CSSProperties;
}

interface ContactPillProps {
  counterparty: PaymentCounterparty;
  style?: CSSProperties;
}

interface StatusBadgeProps {
  status?: PaymentStatus;
  tone?: PaymentDisclosureTone;
  label?: string;
  style?: CSSProperties;
}

interface DisclosureCalloutProps {
  disclosure: PaymentDisclosure | {
    tone: PaymentDisclosureTone;
    title: string;
    body: string;
    footnote?: string;
  };
  style?: CSSProperties;
}

interface TimelineStepperProps {
  steps: PaymentTimelineStep[];
  style?: CSSProperties;
}

interface TransactionRowProps {
  item: PaymentActivityItem;
  style?: CSSProperties;
}

export function PaymentGlassCard({
  children,
  title,
  eyebrow,
  footer,
  accentColor = PAY_ACCENT,
  style,
}: PaymentGlassCardProps) {
  return (
    <section
      style={{
        background: `linear-gradient(180deg, ${PAY_GLASS.soft}, ${PAY_GLASS.strong})`,
        border: `1px solid ${PAY_GLASS.border}`,
        borderRadius: PAY_RADIUS.card,
        boxShadow: PAY_GLASS.shadow,
        padding: 22,
        display: 'grid',
        gap: 16,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at top right, rgba(255,255,255,0.12), transparent 38%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '0 auto auto 0',
          width: 112,
          height: 4,
          borderRadius: PAY_RADIUS.pill,
          background: accentColor,
          boxShadow: `0 0 28px ${accentColor}`,
        }}
      />
      {(eyebrow || title) ? (
        <header style={{ display: 'grid', gap: 6 }}>
          {eyebrow ? (
            <span
              style={{
                color: PAY_TEXT_MUTED,
                fontFamily: PAY_WEB_FONT_STACK,
                fontSize: PAY_TYPOGRAPHY.microLabel.fontSize,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {eyebrow}
            </span>
          ) : null}
          {title ? (
            <h2
              style={{
                margin: 0,
                color: PAY_TEXT,
                fontFamily: PAY_WEB_FONT_STACK,
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              {title}
            </h2>
          ) : null}
        </header>
      ) : null}
      <div style={{ display: 'grid', gap: 14, position: 'relative' }}>{children}</div>
      {footer ? <footer>{footer}</footer> : null}
    </section>
  );
}

export function AmountDisplay({
  amountCents,
  currency,
  direction = 'neutral',
  pending = false,
  compact = false,
  label,
  style,
}: AmountDisplayProps) {
  return (
    <div style={{ display: 'grid', gap: 4, ...style }}>
      {label ? (
        <span
          style={{
            color: PAY_TEXT_MUTED,
            fontFamily: PAY_WEB_FONT_STACK,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      ) : null}
      <span
        style={{
          color: PAY_TEXT,
          fontFamily: PAY_WEB_FONT_STACK,
          fontSize: PAY_TYPOGRAPHY.amountInline.fontSize,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: PAY_WEB_TABULAR_FONT_FEATURES,
        }}
      >
        {formatPaymentAmount(
          { amountCents, currency },
          { direction, pending, compact, includeSign: direction !== 'neutral' },
        )}
      </span>
    </div>
  );
}

export function ContactPill({ counterparty, style }: ContactPillProps) {
  const verification = getPaymentVerificationMeta(counterparty.verification);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: PAY_RADIUS.pill,
        background: 'rgba(8, 30, 23, 0.92)',
        border: `1px solid ${PAY_BORDER}`,
        color: PAY_TEXT,
        fontFamily: PAY_WEB_FONT_STACK,
        ...style,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: PAY_RADIUS.pill,
          background: verification.dot,
          boxShadow: `0 0 14px ${verification.dot}`,
        }}
      />
      <span style={{ fontSize: 14, fontWeight: 600 }}>{counterparty.displayName}</span>
      <span style={{ fontSize: 12, color: PAY_TEXT_SECONDARY }}>
        {counterparty.handle ?? verification.label}
      </span>
    </div>
  );
}

export function StatusBadge({ status, tone = 'info', label, style }: StatusBadgeProps) {
  const meta = status ? getPaymentStatusMeta(status) : getPaymentDisclosureMeta(tone);
  const badgeLabel = label ?? ('label' in meta ? meta.label : meta.eyebrow);
  const dot = 'dot' in meta ? meta.dot : meta.text;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: PAY_RADIUS.badge,
        padding: '7px 11px',
        fontFamily: PAY_WEB_FONT_STACK,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: meta.text,
        background: meta.background,
        border: `1px solid ${meta.border}`,
        ...style,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: PAY_RADIUS.badge,
          background: dot,
        }}
      />
      {badgeLabel}
    </span>
  );
}

export function DisclosureCallout({ disclosure, style }: DisclosureCalloutProps) {
  const meta = getPaymentDisclosureMeta(disclosure.tone);
  return (
    <aside
      style={{
        display: 'grid',
        gap: 8,
        padding: 16,
        borderRadius: PAY_RADIUS.row,
        background: meta.background,
        border: `1px solid ${meta.border}`,
        ...style,
      }}
    >
      <span
        style={{
          color: meta.text,
          fontFamily: PAY_WEB_FONT_STACK,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {meta.eyebrow}
      </span>
      <strong style={{ color: PAY_TEXT, fontFamily: PAY_WEB_FONT_STACK, fontSize: 15 }}>
        {disclosure.title}
      </strong>
      <p
        style={{
          margin: 0,
          color: PAY_TEXT_SECONDARY,
          fontFamily: PAY_WEB_FONT_STACK,
          lineHeight: 1.5,
        }}
      >
        {disclosure.body}
      </p>
      {disclosure.footnote ? (
        <small style={{ color: PAY_TEXT_MUTED, fontFamily: PAY_WEB_MONO_STACK }}>
          {disclosure.footnote}
        </small>
      ) : null}
    </aside>
  );
}

export function TimelineStepper({ steps, style }: TimelineStepperProps) {
  return (
    <div style={{ display: 'grid', gap: 12, ...style }}>
      {steps.map((step, index) => {
        const meta = getPaymentTimelineStepMeta(step.state);
        return (
          <div
            key={step.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '18px 1fr',
              gap: 14,
              alignItems: 'start',
            }}
          >
            <div
              style={{
                display: 'grid',
                justifyItems: 'center',
                gap: 6,
                paddingTop: 4,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: PAY_RADIUS.badge,
                  background: meta.dot,
                  border: `2px solid ${meta.border}`,
                }}
              />
              {index < steps.length - 1 ? (
                <span
                  style={{
                    width: 2,
                    minHeight: 28,
                    background: 'rgba(148, 163, 184, 0.24)',
                    borderRadius: PAY_RADIUS.badge,
                  }}
                />
              ) : null}
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <span
                style={{
                  color: meta.text,
                  fontFamily: PAY_WEB_FONT_STACK,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {step.title}
              </span>
              {step.detail ? (
                <span
                  style={{
                    color: PAY_TEXT_SECONDARY,
                    fontFamily: PAY_WEB_FONT_STACK,
                    fontSize: 13,
                  }}
                >
                  {step.detail}
                </span>
              ) : null}
              {step.timestamp ? (
                <small style={{ color: PAY_TEXT_MUTED, fontFamily: PAY_WEB_MONO_STACK }}>
                  {step.timestamp}
                </small>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TransactionRow({ item, style }: TransactionRowProps) {
  return (
    <article
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 18,
        alignItems: 'center',
        padding: 16,
        borderRadius: PAY_RADIUS.row,
        background: PAY_SURFACES.card,
        border: `1px solid ${PAY_BORDER}`,
        ...style,
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong
            style={{
              color: PAY_TEXT,
              fontFamily: PAY_WEB_FONT_STACK,
              fontSize: 15,
            }}
          >
            {item.title}
          </strong>
          <StatusBadge status={item.status} />
        </div>
        <span
          style={{
            color: PAY_TEXT_SECONDARY,
            fontFamily: PAY_WEB_FONT_STACK,
            fontSize: 13,
          }}
        >
          {item.subtitle ?? formatCounterpartyLabel(item.counterparty)}
        </span>
        <small
          style={{
            color: PAY_TEXT_MUTED,
            fontFamily: PAY_WEB_MONO_STACK,
            fontSize: 12,
          }}
        >
          {formatPaymentTimestamp(item.occurredAt)}
        </small>
      </div>
      <AmountDisplay
        amountCents={item.amountCents}
        currency={item.currency}
        direction={item.direction}
        pending={item.status === 'pending'}
        style={{ justifyItems: 'end' }}
      />
    </article>
  );
}
