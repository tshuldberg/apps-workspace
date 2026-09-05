import type {
  PaymentDisclosureTone,
  PaymentStatus,
  PaymentTimelineStepState,
  PaymentVerificationState,
} from '../types';

export const PAY_ACCENT = '#00C389';
export const PAY_POSITIVE = '#34D399';
export const PAY_NEGATIVE = '#FB7185';
export const PAY_TRANSFER = '#38BDF8';
export const PAY_PENDING = '#FBBF24';
export const PAY_INTERNATIONAL = '#A78BFA';
export const PAY_WARNING = '#FB923C';
export const PAY_DANGER = '#F87171';
export const PAY_TEXT = '#F5FBF8';
export const PAY_TEXT_SECONDARY = 'rgba(228, 247, 240, 0.72)';
export const PAY_TEXT_MUTED = 'rgba(228, 247, 240, 0.54)';
export const PAY_BORDER = 'rgba(171, 244, 215, 0.18)';

export const PAY_SURFACES = {
  canvas: '#061511',
  panel: '#0C1E18',
  card: '#10271F',
  elevated: '#143125',
  inverse: '#EBFFF7',
} as const;

export const PAY_GLASS = {
  soft: 'rgba(10, 39, 30, 0.72)',
  strong: 'rgba(17, 54, 42, 0.88)',
  border: 'rgba(171, 244, 215, 0.18)',
  shadow: '0 28px 60px rgba(0, 0, 0, 0.28)',
} as const;

export const PAY_RADIUS = {
  card: 28,
  row: 22,
  pill: 999,
  badge: 999,
} as const;

export const PAY_STATUS_META: Record<
  PaymentStatus,
  { label: string; background: string; border: string; text: string; dot: string }
> = {
  pending: {
    label: 'Pending',
    background: 'rgba(251, 191, 36, 0.16)',
    border: 'rgba(251, 191, 36, 0.28)',
    text: '#FCD34D',
    dot: PAY_PENDING,
  },
  posted: {
    label: 'Posted',
    background: 'rgba(52, 211, 153, 0.16)',
    border: 'rgba(52, 211, 153, 0.28)',
    text: '#A7F3D0',
    dot: PAY_POSITIVE,
  },
  held: {
    label: 'Held',
    background: 'rgba(167, 139, 250, 0.16)',
    border: 'rgba(167, 139, 250, 0.28)',
    text: '#DDD6FE',
    dot: PAY_INTERNATIONAL,
  },
  failed: {
    label: 'Failed',
    background: 'rgba(248, 113, 113, 0.16)',
    border: 'rgba(248, 113, 113, 0.28)',
    text: '#FECACA',
    dot: PAY_DANGER,
  },
  canceled: {
    label: 'Canceled',
    background: 'rgba(148, 163, 184, 0.18)',
    border: 'rgba(148, 163, 184, 0.28)',
    text: '#CBD5E1',
    dot: '#94A3B8',
  },
  reversed: {
    label: 'Reversed',
    background: 'rgba(251, 146, 60, 0.18)',
    border: 'rgba(251, 146, 60, 0.28)',
    text: '#FED7AA',
    dot: PAY_WARNING,
  },
};

export const PAY_DISCLOSURE_META: Record<
  PaymentDisclosureTone,
  { eyebrow: string; background: string; border: string; text: string }
> = {
  info: {
    eyebrow: 'Disclosure',
    background: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.24)',
    text: '#BAE6FD',
  },
  warning: {
    eyebrow: 'Attention',
    background: 'rgba(251, 146, 60, 0.12)',
    border: 'rgba(251, 146, 60, 0.24)',
    text: '#FED7AA',
  },
  danger: {
    eyebrow: 'Required',
    background: 'rgba(248, 113, 113, 0.12)',
    border: 'rgba(248, 113, 113, 0.24)',
    text: '#FECACA',
  },
  success: {
    eyebrow: 'Protected',
    background: 'rgba(52, 211, 153, 0.12)',
    border: 'rgba(52, 211, 153, 0.24)',
    text: '#A7F3D0',
  },
};

export const PAY_TIMELINE_STEP_META: Record<
  PaymentTimelineStepState,
  { dot: string; border: string; text: string }
> = {
  complete: {
    dot: PAY_POSITIVE,
    border: 'rgba(52, 211, 153, 0.28)',
    text: '#D1FAE5',
  },
  current: {
    dot: PAY_ACCENT,
    border: 'rgba(0, 195, 137, 0.32)',
    text: PAY_TEXT,
  },
  upcoming: {
    dot: '#64748B',
    border: 'rgba(100, 116, 139, 0.22)',
    text: '#CBD5E1',
  },
  blocked: {
    dot: PAY_DANGER,
    border: 'rgba(248, 113, 113, 0.28)',
    text: '#FECACA',
  },
};

export const PAY_VERIFICATION_META: Record<
  PaymentVerificationState,
  { label: string; dot: string }
> = {
  verified: { label: 'Verified', dot: PAY_POSITIVE },
  review: { label: 'Under review', dot: PAY_PENDING },
  unverified: { label: 'Unverified', dot: '#94A3B8' },
};

export function getPaymentStatusMeta(status: PaymentStatus) {
  return PAY_STATUS_META[status];
}

export function getPaymentDisclosureMeta(tone: PaymentDisclosureTone) {
  return PAY_DISCLOSURE_META[tone];
}

export function getPaymentTimelineStepMeta(state: PaymentTimelineStepState) {
  return PAY_TIMELINE_STEP_META[state];
}

export function getPaymentVerificationMeta(state: PaymentVerificationState) {
  return PAY_VERIFICATION_META[state];
}
