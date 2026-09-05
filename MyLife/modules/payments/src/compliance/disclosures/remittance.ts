import {
  assertPaymentsInvariant,
} from '../../engine/errors';
import {
  buildPaymentsLegalCopyBlocks,
} from './legal';
import {
  createPaymentsContentMeta,
  createPaymentsContentSection,
  createPaymentsDisclosureBundle,
  createPaymentsDisclosureCallout,
  createPaymentsFactLine,
  formatPaymentsAbsoluteDateTime,
  formatPaymentsExchangeRate,
  formatPaymentsMoney,
  resolvePaymentsDisclosureLocale,
} from './content';
import type {
  BuildPaymentsRemittanceQuoteDisclosureInput,
  PaymentsDeliveryEstimate,
  PaymentsRecordkeepingInput,
  PaymentsRecordkeepingParty,
  PaymentsRecordkeepingPayload,
  PaymentsRemittanceCancellationWindow,
  PaymentsRemittanceCancellationWindowInput,
  PaymentsRemittanceCorridorAvailability,
  PaymentsRemittanceQuotePayload,
} from './types';

const DEFAULT_CANCELLATION_VERSION =
  'remittance_cancellation@2026-04-22.v1';
const DEFAULT_CANCELLATION_EFFECTIVE_AT = '2026-04-22T00:00:00.000Z';

function normalizeCorridorAvailability(
  input: BuildPaymentsRemittanceQuoteDisclosureInput,
): PaymentsRemittanceCorridorAvailability {
  return {
    status: input.corridorAvailability?.status ?? 'available',
    corridor: input.corridorAvailability?.corridor ?? input.corridor,
    reason: input.corridorAvailability?.reason ?? null,
    availablePayoutMethods:
      input.corridorAvailability?.availablePayoutMethods ?? [],
    checkedAt: input.corridorAvailability?.checkedAt ?? null,
  };
}

function normalizeDeliveryEstimate(
  estimate?: PaymentsDeliveryEstimate | null,
): PaymentsDeliveryEstimate | null {
  if (!estimate) {
    return null;
  }

  return {
    label: estimate.label ?? null,
    estimatedAt: estimate.estimatedAt ?? null,
    earliestAt: estimate.earliestAt ?? null,
    latestAt: estimate.latestAt ?? null,
  };
}

function normalizeCancellationWindow(
  input: PaymentsRemittanceCancellationWindowInput | null | undefined,
  expiresAt: string,
): PaymentsRemittanceCancellationWindow {
  return {
    cancelable: input?.cancelable ?? true,
    cancelBy: input?.cancelBy ?? expiresAt,
    reason: input?.reason ?? null,
    version: input?.version ?? DEFAULT_CANCELLATION_VERSION,
    effectiveAt:
      input?.effectiveAt ?? DEFAULT_CANCELLATION_EFFECTIVE_AT,
  };
}

function normalizeRecordkeepingParty(
  input?: PaymentsRecordkeepingInput['originator'] | null,
): PaymentsRecordkeepingParty {
  return {
    fullName: input?.fullName ?? null,
    countryCode: input?.countryCode ?? null,
    accountReference: input?.accountReference ?? null,
    addressLine: input?.addressLine ?? null,
    phoneE164: input?.phoneE164 ?? null,
    walletHandle: input?.walletHandle ?? null,
  };
}

function normalizeRecordkeeping(
  input?: PaymentsRecordkeepingInput | null,
): PaymentsRecordkeepingPayload {
  return {
    requirement: input?.requirement ?? 'prepared',
    reference: input?.reference ?? null,
    originator: normalizeRecordkeepingParty(input?.originator),
    recipient: normalizeRecordkeepingParty(input?.recipient),
    notes:
      input?.notes ?? [
        'Prepare originator and recipient records before settling corridors that require Travel Rule or local remittance recordkeeping.',
      ],
  };
}

function buildCorridorAvailabilityCallout(
  availability: PaymentsRemittanceCorridorAvailability,
): ReturnType<typeof createPaymentsDisclosureCallout> {
  if (availability.status === 'unavailable') {
    return createPaymentsDisclosureCallout({
      id: 'remittance_quote_corridor',
      tone: 'danger',
      title: 'Corridor unavailable',
      body:
        availability.reason ??
        'This corridor cannot be quoted or settled right now.',
      footnote:
        availability.availablePayoutMethods.length > 0
          ? `Available payout methods: ${availability.availablePayoutMethods.join(', ')}.`
          : null,
    });
  }

  if (availability.status === 'limited') {
    return createPaymentsDisclosureCallout({
      id: 'remittance_quote_corridor',
      tone: 'warning',
      title: 'Corridor available with limits',
      body:
        availability.reason ??
        'This corridor is available, but the payout method or partner availability is constrained.',
      footnote:
        availability.availablePayoutMethods.length > 0
          ? `Available payout methods: ${availability.availablePayoutMethods.join(', ')}.`
          : null,
    });
  }

  return createPaymentsDisclosureCallout({
    id: 'remittance_quote_corridor',
    tone: 'info',
    title: 'Corridor available',
    body: 'The selected corridor is currently quotable and can proceed through the remittance rail.',
    footnote:
      availability.availablePayoutMethods.length > 0
        ? `Available payout methods: ${availability.availablePayoutMethods.join(', ')}.`
        : null,
  });
}

function buildDeliveryEstimateCallout(input: {
  estimate: PaymentsDeliveryEstimate | null;
  locale: string;
}) {
  if (!input.estimate) {
    return createPaymentsDisclosureCallout({
      id: 'remittance_quote_delivery',
      tone: 'warning',
      title: 'Delivery estimate pending',
      body: 'Delivery timing depends on provider availability and corridor-specific review outcomes.',
    });
  }

  if (input.estimate.estimatedAt) {
    return createPaymentsDisclosureCallout({
      id: 'remittance_quote_delivery',
      tone: 'info',
      title: input.estimate.label ?? 'Delivery estimate',
      body: `Estimated delivery by ${formatPaymentsAbsoluteDateTime(input.estimate.estimatedAt, input.locale)}.`,
    });
  }

  if (input.estimate.earliestAt && input.estimate.latestAt) {
    return createPaymentsDisclosureCallout({
      id: 'remittance_quote_delivery',
      tone: 'info',
      title: input.estimate.label ?? 'Delivery window',
      body: `Estimated delivery between ${formatPaymentsAbsoluteDateTime(input.estimate.earliestAt, input.locale)} and ${formatPaymentsAbsoluteDateTime(input.estimate.latestAt, input.locale)}.`,
    });
  }

  return createPaymentsDisclosureCallout({
    id: 'remittance_quote_delivery',
    tone: 'warning',
    title: input.estimate.label ?? 'Delivery estimate pending',
    body: 'A corridor-specific delivery estimate is not available yet.',
  });
}

function buildCancellationCallout(input: {
  cancellationWindow: PaymentsRemittanceCancellationWindow;
  locale: string;
}) {
  if (!input.cancellationWindow.cancelable) {
    return createPaymentsDisclosureCallout({
      id: 'remittance_quote_cancellation',
      tone: 'warning',
      title: 'Cancellation restricted',
      body:
        input.cancellationWindow.reason ??
        'Cancellation is not available for this transfer state or payout method.',
    });
  }

  const deadline = input.cancellationWindow.cancelBy
    ? formatPaymentsAbsoluteDateTime(
        input.cancellationWindow.cancelBy,
        input.locale,
      )
    : null;

  return createPaymentsDisclosureCallout({
    id: 'remittance_quote_cancellation',
    tone: 'info',
    title: 'Cancellation window',
    body: deadline
      ? `Cancellation requests are typically available until ${deadline}.`
      : 'Cancellation requests are available only before the transfer leaves a cancelable provider state.',
    footnote: input.cancellationWindow.reason,
  });
}

function buildErrorResolutionCallout() {
  return createPaymentsDisclosureCallout({
    id: 'remittance_quote_error_resolution',
    tone: 'info',
    title: 'Error resolution path',
    body: 'The same content system can attach support, dispute, and provider references to quote, confirmation, and history surfaces.',
  });
}

export function buildPaymentsRemittanceQuotePayload(
  input: BuildPaymentsRemittanceQuoteDisclosureInput,
): PaymentsRemittanceQuotePayload {
  assertPaymentsInvariant(
    input.sourceAmountCents > 0,
    'invalid_command',
    'sourceAmountCents must be positive',
    { sourceAmountCents: input.sourceAmountCents },
  );
  assertPaymentsInvariant(
    input.destinationAmountCents > 0,
    'invalid_command',
    'destinationAmountCents must be positive',
    { destinationAmountCents: input.destinationAmountCents },
  );
  assertPaymentsInvariant(
    input.feeCents >= 0,
    'invalid_command',
    'feeCents must be non-negative',
    { feeCents: input.feeCents },
  );
  assertPaymentsInvariant(
    input.corridor.trim().length > 0,
    'invalid_command',
    'corridor is required',
  );

  const locale = resolvePaymentsDisclosureLocale(input.locale);
  const meta = createPaymentsContentMeta({
    locale,
    generatedAt: input.generatedAt,
    surfaces: input.surfaces,
  });
  const availability = normalizeCorridorAvailability(input);
  const deliveryEstimate = normalizeDeliveryEstimate(input.deliveryEstimate);
  const cancellationWindow = normalizeCancellationWindow(
    input.cancellationWindow,
    input.expiresAt,
  );
  const recordkeeping = normalizeRecordkeeping(input.recordkeeping);
  const totalDebitCents = input.sourceAmountCents + input.feeCents;

  const breakdown = [
    createPaymentsFactLine({
      lineId: 'sender_amount',
      label: 'Sender amount',
      value: formatPaymentsMoney(
        input.sourceAmountCents,
        input.sourceCurrency,
        locale,
      ),
      emphasis: 'strong',
    }),
    createPaymentsFactLine({
      lineId: 'fee_amount',
      label: 'Fee',
      value: formatPaymentsMoney(input.feeCents, input.sourceCurrency, locale),
    }),
    createPaymentsFactLine({
      lineId: 'exchange_rate',
      label: 'Exchange rate',
      value: formatPaymentsExchangeRate(
        input.exchangeRate,
        input.sourceCurrency,
        input.destinationCurrency,
        locale,
      ),
    }),
    createPaymentsFactLine({
      lineId: 'recipient_amount',
      label: 'Recipient amount',
      value: formatPaymentsMoney(
        input.destinationAmountCents,
        input.destinationCurrency,
        locale,
      ),
      emphasis: 'positive',
    }),
    createPaymentsFactLine({
      lineId: 'total_debit',
      label: 'Total debit',
      value: formatPaymentsMoney(totalDebitCents, input.sourceCurrency, locale),
      emphasis: 'strong',
      footnote: `Quote expires ${formatPaymentsAbsoluteDateTime(input.expiresAt, locale)}.`,
    }),
  ];

  const sections = [
    createPaymentsContentSection({
      sectionId: 'remittance_quote_breakdown',
      title: 'Quote breakdown',
      summary: `Quote for corridor ${input.corridor}.`,
      facts: breakdown,
    }),
    createPaymentsContentSection({
      sectionId: 'remittance_quote_delivery',
      title: 'Delivery and cancellation',
      summary:
        deliveryEstimate?.label ??
        'Delivery timing and cancellation are corridor-dependent.',
      facts: [
        createPaymentsFactLine({
          lineId: 'corridor_status',
          label: 'Corridor status',
          value: availability.status,
          emphasis:
            availability.status === 'available'
              ? 'positive'
              : availability.status === 'limited'
                ? 'warning'
                : 'strong',
          footnote: availability.reason,
        }),
        createPaymentsFactLine({
          lineId: 'cancellation_deadline',
          label: 'Cancellation',
          value: cancellationWindow.cancelable
            ? cancellationWindow.cancelBy
              ? `Until ${formatPaymentsAbsoluteDateTime(cancellationWindow.cancelBy, locale)}`
              : 'Before final provider submission'
            : 'Not currently available',
          footnote: cancellationWindow.reason,
        }),
        ...(deliveryEstimate
          ? [
              createPaymentsFactLine({
                lineId: 'delivery_estimate',
                label: deliveryEstimate.label ?? 'Delivery estimate',
                value: deliveryEstimate.estimatedAt
                  ? formatPaymentsAbsoluteDateTime(
                      deliveryEstimate.estimatedAt,
                      locale,
                    )
                  : deliveryEstimate.earliestAt && deliveryEstimate.latestAt
                    ? `${formatPaymentsAbsoluteDateTime(deliveryEstimate.earliestAt, locale)} to ${formatPaymentsAbsoluteDateTime(deliveryEstimate.latestAt, locale)}`
                    : 'Pending provider estimate',
              }),
            ]
          : []),
      ],
    }),
    createPaymentsContentSection({
      sectionId: 'remittance_quote_recordkeeping',
      title: 'Recordkeeping readiness',
      summary:
        recordkeeping.requirement === 'required'
          ? 'Originator and recipient records are required before settlement.'
          : 'Prepare originator and recipient records for supported corridors.',
      bullets: recordkeeping.notes,
      facts: [
        createPaymentsFactLine({
          lineId: 'recordkeeping_requirement',
          label: 'Requirement',
          value: recordkeeping.requirement,
        }),
        ...(recordkeeping.reference
          ? [
              createPaymentsFactLine({
                lineId: 'recordkeeping_reference',
                label: 'Reference',
                value: recordkeeping.reference,
              }),
            ]
          : []),
      ],
    }),
  ];

  const legalCopyBlocks = buildPaymentsLegalCopyBlocks({
    blockIds: [
      'stored_balance',
      'partner_bank',
      'custodial_account',
      'remittance_cancellation',
      'error_resolution',
      'stablecoin_rail',
    ],
    locale,
    generatedAt: input.generatedAt,
    surfaces: input.surfaces,
    partnerBankName: input.partnerBankName,
    custodialEntityName: input.custodialEntityName,
    productName: input.productName,
    supportLabel: input.supportLabel,
    supportContact: input.supportContact,
    supportReference: input.quoteId ?? null,
    stablecoinRailEnabled: input.stablecoinRailEnabled,
    cancellationWindow,
  });

  return {
    kind: 'remittance_quote',
    quoteId: input.quoteId ?? null,
    providerName: input.providerName,
    corridor: input.corridor,
    breakdown,
    availability,
    deliveryEstimate,
    cancellationWindow,
    recordkeeping,
    disclosureBundle: createPaymentsDisclosureBundle({
      bundleId: `remittance_quote_${input.quoteId ?? input.corridor}`,
      meta,
      callouts: [
        createPaymentsDisclosureCallout({
          id: 'remittance_quote_rate',
          tone: 'info',
          title: 'Exchange rate and fee',
          body: `${formatPaymentsExchangeRate(input.exchangeRate, input.sourceCurrency, input.destinationCurrency, locale)} with ${formatPaymentsMoney(input.feeCents, input.sourceCurrency, locale)} in fees.`,
          footnote: `Quote expires ${formatPaymentsAbsoluteDateTime(input.expiresAt, locale)}.`,
        }),
        buildCorridorAvailabilityCallout(availability),
        buildDeliveryEstimateCallout({
          estimate: deliveryEstimate,
          locale,
        }),
        buildCancellationCallout({
          cancellationWindow,
          locale,
        }),
        buildErrorResolutionCallout(),
      ],
      sections,
      legalCopyBlocks,
    }),
  };
}
