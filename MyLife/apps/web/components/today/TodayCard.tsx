'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import type { TodayCard as TodayCardType } from '@mylife/module-registry';
import { dismissTodayCardAction } from '@/app/actions';

const SURFACE = '#131318';
const SURFACE_EL = '#2A292F';
const TEXT = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const BORDER = 'rgba(255,255,255,0.10)';
const PRIMARY = '#FFB877';
const PRIMARY_CONTAINER = '#C9894D';

const KIND_ACCENT: Record<TodayCardType['kind'], string> = {
  reminder: '#FFB877',
  event: '#8BCFF0',
  action: '#FFB877',
  progress: '#9F8E81',
  insight: '#C9B3E3',
};

export function TodayCard({ card }: { card: TodayCardType }) {
  const [pending, startTransition] = useTransition();

  const handleDismiss = () => {
    if (pending) return;
    startTransition(async () => {
      await dismissTodayCardAction(card.id);
    });
  };

  const accent = KIND_ACCENT[card.kind] ?? PRIMARY;
  const highPriority = card.priority >= 70;

  const content = (
    <div
      style={{
        background: SURFACE_EL,
        border: `1px solid ${BORDER}`,
        borderLeft: highPriority ? `3px solid ${accent}` : `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        color: TEXT,
        textDecoration: 'none',
        opacity: pending ? 0.5 : 1,
        transition: 'opacity 120ms ease',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: '20px' }}>{card.title}</div>
        {card.subtitle ? (
          <div
            style={{
              fontSize: 13,
              color: TEXT_SECONDARY,
              lineHeight: '18px',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {card.subtitle}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {card.cta ? (
          <span
            style={{
              background: PRIMARY_CONTAINER,
              color: SURFACE,
              fontSize: 13,
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 8,
            }}
          >
            {card.cta.label}
          </span>
        ) : null}
        {card.dismissible ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleDismiss();
            }}
            aria-label="Dismiss card"
            disabled={pending}
            style={{
              background: 'transparent',
              border: `1px solid ${BORDER}`,
              color: TEXT_SECONDARY,
              width: 28,
              height: 28,
              borderRadius: 8,
              cursor: pending ? 'default' : 'pointer',
              fontSize: 14,
              lineHeight: '24px',
              padding: 0,
            }}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );

  if (card.cta?.route) {
    return (
      <Link href={card.cta.route} style={{ textDecoration: 'none', display: 'block' }}>
        {content}
      </Link>
    );
  }
  return content;
}
