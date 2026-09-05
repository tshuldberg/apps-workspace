import type { PaymentsRail } from '../../cloud/rpc';
import type { PaymentsTransferStatus } from '../../engine/types';
import {
  assertPaymentsInvariant,
} from '../../engine/errors';
import type {
  CurrencyCode,
  PaymentDisclosure,
  PaymentDisclosureTone,
} from '../../types';
import type {
  PaymentsContentMeta,
  PaymentsContentSection,
  PaymentsDisclosureBundle,
  PaymentsDisclosureLocale,
  PaymentsDisclosureSurface,
  PaymentsFactLine,
  PaymentsLegalCopyBlock,
} from './types';

export const PAYMENTS_DISCLOSURE_TEMPLATE_VERSION =
  '2026-04-22.phase-2d.v1';

const DEFAULT_SURFACES: PaymentsDisclosureSurface[] = [
  'mobile',
  'web',
  'email',
  'pdf',
  'support_export',
];

function uniqueBy<TItem>(
  items: TItem[],
  keyFn: (item: TItem) => string,
): TItem[] {
  const seen = new Set<string>();
  const result: TItem[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}

export function resolvePaymentsDisclosureLocale(
  locale?: string,
): PaymentsDisclosureLocale {
  if (!locale) {
    return 'en-US';
  }

  const normalized = locale.trim();
  if (normalized === 'en-US' || normalized.toLowerCase().startsWith('en')) {
    return 'en-US';
  }

  return 'en-US';
}

export function createPaymentsContentMeta(input: {
  locale?: string;
  generatedAt?: string;
  templateVersion?: string;
  surfaces?: PaymentsDisclosureSurface[];
} = {}): PaymentsContentMeta {
  const resolvedLocale = resolvePaymentsDisclosureLocale(input.locale);
  return {
    locale: input.locale?.trim() || resolvedLocale,
    resolvedLocale,
    generatedAt:
      input.generatedAt ?? new Date().toISOString(),
    templateVersion:
      input.templateVersion ?? PAYMENTS_DISCLOSURE_TEMPLATE_VERSION,
    surfaces: input.surfaces?.length ? [...input.surfaces] : DEFAULT_SURFACES,
  };
}

export function formatPaymentsMoney(
  amountCents: number,
  currency: CurrencyCode,
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  }).format(amountCents / 100);
}

export function formatPaymentsAbsoluteDateTime(
  isoLike: string,
  locale = 'en-US',
): string {
  const value = new Date(isoLike);
  if (Number.isNaN(value.getTime())) {
    return isoLike;
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(value);
}

export function formatPaymentsAbsoluteDate(
  isoLike: string,
  locale = 'en-US',
): string {
  const value = new Date(isoLike);
  if (Number.isNaN(value.getTime())) {
    return isoLike;
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

export function formatPaymentsExchangeRate(
  exchangeRate: string,
  sourceCurrency: CurrencyCode,
  destinationCurrency: CurrencyCode,
  locale = 'en-US',
): string {
  const parsed = Number.parseFloat(exchangeRate);
  assertPaymentsInvariant(
    Number.isFinite(parsed) && parsed > 0,
    'invalid_command',
    'exchangeRate must be a positive numeric string',
    {
      exchangeRate,
      sourceCurrency,
      destinationCurrency,
    },
  );

  const formattedRate = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(parsed);

  return `1 ${sourceCurrency} = ${formattedRate} ${destinationCurrency}`;
}

export function createPaymentsFactLine(input: {
  lineId: string;
  label: string;
  value: string;
  emphasis?: PaymentsFactLine['emphasis'];
  footnote?: string | null;
}): PaymentsFactLine {
  return {
    lineId: input.lineId,
    label: input.label,
    value: input.value,
    emphasis: input.emphasis ?? 'neutral',
    footnote: input.footnote ?? null,
  };
}

export function createPaymentsContentSection(input: {
  sectionId: string;
  title: string;
  summary?: string | null;
  paragraphs?: string[];
  bullets?: string[];
  facts?: PaymentsFactLine[];
}): PaymentsContentSection {
  return {
    sectionId: input.sectionId,
    title: input.title,
    summary: input.summary ?? null,
    paragraphs: input.paragraphs ?? [],
    bullets: input.bullets ?? [],
    facts: input.facts ?? [],
  };
}

export function createPaymentsDisclosureCallout(input: {
  id: string;
  tone: PaymentDisclosureTone;
  title: string;
  body: string;
  footnote?: string | null;
}): PaymentDisclosure {
  return {
    id: input.id,
    tone: input.tone,
    title: input.title,
    body: input.body,
    footnote: input.footnote ?? undefined,
  };
}

export function createPaymentsDisclosureBundle(input: {
  bundleId: string;
  meta: PaymentsContentMeta;
  callouts?: PaymentDisclosure[];
  sections?: PaymentsContentSection[];
  legalCopyBlocks?: PaymentsLegalCopyBlock[];
}): PaymentsDisclosureBundle {
  return {
    bundleId: input.bundleId,
    meta: input.meta,
    callouts: input.callouts ?? [],
    sections: input.sections ?? [],
    legalCopyBlocks: input.legalCopyBlocks ?? [],
  };
}

export function mergePaymentsDisclosureBundles(
  ...bundles: PaymentsDisclosureBundle[]
): PaymentsDisclosureBundle {
  assertPaymentsInvariant(
    bundles.length > 0,
    'invalid_command',
    'At least one disclosure bundle is required',
  );

  const [first] = bundles;
  return {
    bundleId: bundles.map((bundle) => bundle.bundleId).join('+'),
    meta: first.meta,
    callouts: uniqueBy(
      bundles.flatMap((bundle) => bundle.callouts),
      (callout) => callout.id,
    ),
    sections: uniqueBy(
      bundles.flatMap((bundle) => bundle.sections),
      (section) => section.sectionId,
    ),
    legalCopyBlocks: uniqueBy(
      bundles.flatMap((bundle) => bundle.legalCopyBlocks),
      (block) => `${block.blockId}:${block.version}`,
    ),
  };
}

export function getPaymentsTransferStatusLabel(
  status: PaymentsTransferStatus,
): string {
  switch (status) {
    case 'pending_review':
      return 'Pending review';
    case 'pending_provider':
      return 'Pending provider';
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'reversed':
      return 'Reversed';
    case 'canceled':
      return 'Canceled';
    case 'disputed':
      return 'Disputed';
  }
}

export function getPaymentsRailLabel(rail: PaymentsRail): string {
  switch (rail) {
    case 'wallet':
      return 'Wallet';
    case 'bank':
      return 'Bank';
    case 'card':
      return 'Card';
    case 'internal':
      return 'Internal';
    case 'remittance':
      return 'Remittance';
    case 'ach':
      return 'ACH';
    case 'wire':
      return 'Wire';
    case 'merchant':
      return 'Merchant';
  }
}

export function resolvePrimaryRail(input: {
  sourceRail: PaymentsRail;
  destinationRail: PaymentsRail;
}): PaymentsRail {
  if (
    input.sourceRail === 'remittance' ||
    input.destinationRail === 'remittance'
  ) {
    return 'remittance';
  }
  if (input.sourceRail === 'card' || input.destinationRail === 'card') {
    return 'card';
  }
  if (input.sourceRail === 'bank' || input.destinationRail === 'bank') {
    return 'bank';
  }
  if (input.sourceRail === 'merchant' || input.destinationRail === 'merchant') {
    return 'merchant';
  }
  if (input.sourceRail === 'ach' || input.destinationRail === 'ach') {
    return 'ach';
  }
  if (input.sourceRail === 'wire' || input.destinationRail === 'wire') {
    return 'wire';
  }
  if (input.sourceRail === 'wallet' || input.destinationRail === 'wallet') {
    return 'wallet';
  }
  return input.destinationRail;
}

export function buildPaymentsTransferStatusDisclosure(input: {
  status: PaymentsTransferStatus;
  rail: PaymentsRail;
  userSafeExplanation?: string | null;
}): PaymentDisclosure {
  const railLabel = getPaymentsRailLabel(input.rail);

  switch (input.status) {
    case 'pending_review':
      return createPaymentsDisclosureCallout({
        id: 'transfer_status_pending_review',
        tone: 'warning',
        title: 'Review in progress',
        body:
          input.userSafeExplanation ??
          `${railLabel} transfer is being reviewed before value moves or settles.`,
      });
    case 'pending_provider':
      return createPaymentsDisclosureCallout({
        id: 'transfer_status_pending_provider',
        tone: 'info',
        title: 'Submitted to provider',
        body: `${railLabel} transfer has been handed to the partner rail and is awaiting confirmation.`,
      });
    case 'processing':
      return createPaymentsDisclosureCallout({
        id: 'transfer_status_processing',
        tone: 'info',
        title: 'Transfer processing',
        body: `${railLabel} transfer is in flight and can still receive provider updates before completion.`,
      });
    case 'completed':
      return createPaymentsDisclosureCallout({
        id: 'transfer_status_completed',
        tone: 'success',
        title: 'Transfer complete',
        body: `${railLabel} transfer finished successfully and the current receipt reflects the server-authoritative result.`,
      });
    case 'failed':
      return createPaymentsDisclosureCallout({
        id: 'transfer_status_failed',
        tone: 'danger',
        title: 'Transfer failed',
        body:
          input.userSafeExplanation ??
          `${railLabel} transfer could not be completed. Use the receipt references before retrying or escalating.`,
      });
    case 'reversed':
      return createPaymentsDisclosureCallout({
        id: 'transfer_status_reversed',
        tone: 'warning',
        title: 'Transfer reversed',
        body: `${railLabel} transfer was reversed after posting, and the receipt keeps the original references for support and audit review.`,
      });
    case 'canceled':
      return createPaymentsDisclosureCallout({
        id: 'transfer_status_canceled',
        tone: 'warning',
        title: 'Transfer canceled',
        body: `${railLabel} transfer was canceled before final completion.`,
      });
    case 'disputed':
      return createPaymentsDisclosureCallout({
        id: 'transfer_status_disputed',
        tone: 'warning',
        title: 'Dispute in progress',
        body: `${railLabel} transfer has an active dispute or error-resolution workflow attached to it.`,
      });
  }
}
