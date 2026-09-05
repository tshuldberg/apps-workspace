import {
  buildPaymentsLegalCopyBlocks,
} from './legal';
import {
  buildPaymentsTransferStatusDisclosure,
  createPaymentsContentMeta,
  createPaymentsContentSection,
  createPaymentsFactLine,
  formatPaymentsAbsoluteDateTime,
  formatPaymentsExchangeRate,
  formatPaymentsMoney,
  getPaymentsRailLabel,
  getPaymentsTransferStatusLabel,
  resolvePrimaryRail,
} from './content';
import type {
  BuildPaymentsReceiptInput,
  PaymentsReceiptKind,
  PaymentsReceiptParty,
  PaymentsReceiptPayload,
  PaymentsRecordkeepingInput,
  PaymentsRecordkeepingParty,
  PaymentsRecordkeepingPayload,
  PaymentsRemittanceCancellationWindow,
  PaymentsRemittanceCancellationWindowInput,
} from './types';

const DEFAULT_CANCELLATION_VERSION =
  'remittance_cancellation@2026-04-22.v1';
const DEFAULT_CANCELLATION_EFFECTIVE_AT = '2026-04-22T00:00:00.000Z';

function resolveReceiptKind(input: BuildPaymentsReceiptInput): PaymentsReceiptKind {
  const { transfer } = input;

  if (transfer.kind === 'reversal') {
    return 'reversal';
  }

  if (
    transfer.kind === 'merchant_refund' ||
    transfer.kind === 'card_refund' ||
    transfer.kind === 'remittance_refund'
  ) {
    return 'refund';
  }

  if (
    transfer.kind === 'merchant_charge' ||
    transfer.kind === 'escrow_hold' ||
    transfer.kind === 'escrow_release'
  ) {
    return 'merchant';
  }

  if (
    transfer.kind === 'card_authorization' ||
    transfer.kind === 'card_capture' ||
    transfer.sourceRail === 'card' ||
    transfer.destinationRail === 'card'
  ) {
    return 'card';
  }

  if (
    transfer.kind === 'remittance_send' ||
    transfer.sourceRail === 'remittance' ||
    transfer.destinationRail === 'remittance'
  ) {
    return 'remittance';
  }

  return 'p2p';
}

function resolveReceiptTitle(kind: PaymentsReceiptKind): string {
  switch (kind) {
    case 'p2p':
      return 'P2P receipt';
    case 'merchant':
      return 'Merchant payment receipt';
    case 'card':
      return 'Card activity receipt';
    case 'remittance':
      return 'Remittance receipt';
    case 'refund':
      return 'Refund receipt';
    case 'reversal':
      return 'Reversal receipt';
  }
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
        'Prepare originator and recipient records before settling corridors that require remittance recordkeeping.',
      ],
  };
}

function normalizeCancellationWindow(
  input: PaymentsRemittanceCancellationWindowInput | null | undefined,
): PaymentsRemittanceCancellationWindow | null {
  if (!input) {
    return null;
  }

  return {
    cancelable: input.cancelable,
    cancelBy: input.cancelBy ?? null,
    reason: input.reason ?? null,
    version: input.version ?? DEFAULT_CANCELLATION_VERSION,
    effectiveAt: input.effectiveAt ?? DEFAULT_CANCELLATION_EFFECTIVE_AT,
  };
}

function buildReceiptParties(input: BuildPaymentsReceiptInput): PaymentsReceiptParty[] {
  const receiptKind = resolveReceiptKind(input);
  const senderValue =
    input.sourceDisplayName ??
    input.transfer.sourceWalletId ??
    'Source wallet';
  const recipientValue =
    input.remittance?.recipientName ??
    input.counterparty?.displayName ??
    input.destinationDisplayName ??
    input.transfer.destinationWalletId ??
    'Destination wallet';

  const parties: PaymentsReceiptParty[] = [
    {
      role: receiptKind === 'card' ? 'cardholder' : 'sender',
      label: receiptKind === 'card' ? 'Cardholder' : 'Sender',
      value: senderValue,
    },
  ];

  if (receiptKind === 'merchant') {
    parties.push({
      role: 'merchant',
      label: 'Merchant',
      value: recipientValue,
    });
    return parties;
  }

  parties.push({
    role: 'recipient',
    label:
      receiptKind === 'card'
        ? 'Merchant'
        : receiptKind === 'remittance'
          ? 'Recipient'
          : 'Counterparty',
    value: recipientValue,
  });

  return parties;
}

function buildReceiptReferences(input: BuildPaymentsReceiptInput) {
  return [
    {
      key: 'transfer_id',
      label: 'Transfer ID',
      value: input.transfer.transferId,
    },
    ...(input.providerReference
      ? [
          {
            key: 'provider_reference',
            label: 'Provider reference',
            value: input.providerReference,
          },
        ]
      : []),
    ...(input.quoteId
      ? [
          {
            key: 'quote_id',
            label: 'Quote ID',
            value: input.quoteId,
          },
        ]
      : []),
    ...(input.remittance?.remittanceId
      ? [
          {
            key: 'remittance_id',
            label: 'Remittance ID',
            value: input.remittance.remittanceId,
          },
        ]
      : []),
    ...(input.relatedTransferId
      ? [
          {
            key: 'related_transfer_id',
            label: 'Related transfer ID',
            value: input.relatedTransferId,
          },
        ]
      : []),
    ...(input.transfer.externalReference
      ? [
          {
            key: 'external_reference',
            label: 'External reference',
            value: input.transfer.externalReference,
          },
        ]
      : []),
  ];
}

function buildAmountBreakdown(
  input: BuildPaymentsReceiptInput,
  locale: string,
) {
  const receiptKind = resolveReceiptKind(input);
  const sourceLabel =
    receiptKind === 'refund' || receiptKind === 'reversal'
      ? 'Adjustment amount'
      : 'Source amount';

  const lines = [
    createPaymentsFactLine({
      lineId: 'source_amount',
      label: sourceLabel,
      value: formatPaymentsMoney(
        input.transfer.sourceAmountCents,
        input.transfer.sourceCurrency,
        locale,
      ),
      emphasis: 'strong',
    }),
    ...(input.transfer.feeAmountCents > 0
      ? [
          createPaymentsFactLine({
            lineId: 'fee_amount',
            label: 'Fee',
            value: formatPaymentsMoney(
              input.transfer.feeAmountCents,
              input.transfer.sourceCurrency,
              locale,
            ),
          }),
        ]
      : []),
    ...(input.transfer.destinationAmountCents &&
    input.transfer.destinationCurrency
      ? [
          createPaymentsFactLine({
            lineId: 'destination_amount',
            label:
              receiptKind === 'refund' || receiptKind === 'reversal'
                ? 'Resulting amount'
                : receiptKind === 'remittance'
                  ? 'Recipient amount'
                  : 'Destination amount',
            value: formatPaymentsMoney(
              input.transfer.destinationAmountCents,
              input.transfer.destinationCurrency,
              locale,
            ),
            emphasis:
              receiptKind === 'refund' || receiptKind === 'reversal'
                ? 'positive'
                : 'neutral',
          }),
        ]
      : []),
    ...(input.remittance?.exchangeRate &&
    input.transfer.destinationCurrency
      ? [
          createPaymentsFactLine({
            lineId: 'exchange_rate',
            label: 'Exchange rate',
            value: formatPaymentsExchangeRate(
              input.remittance.exchangeRate,
              input.transfer.sourceCurrency,
              input.transfer.destinationCurrency,
              locale,
            ),
          }),
        ]
      : []),
    createPaymentsFactLine({
      lineId: 'status',
      label: 'Status',
      value: getPaymentsTransferStatusLabel(input.transfer.status),
      emphasis:
        input.transfer.status === 'completed'
          ? 'positive'
          : input.transfer.status === 'failed'
            ? 'warning'
            : 'neutral',
    }),
  ];

  return lines;
}

function buildLegalCopy(input: BuildPaymentsReceiptInput, railLabel: string) {
  const primaryRail = resolvePrimaryRail({
    sourceRail: input.transfer.sourceRail,
    destinationRail: input.transfer.destinationRail,
  });
  const blockIds = new Set<
    Parameters<typeof buildPaymentsLegalCopyBlocks>[0]['blockIds'][number]
  >();
  const cancellationWindow = normalizeCancellationWindow(input.cancellationWindow);

  if (
    primaryRail === 'wallet' ||
    input.transfer.sourceRail === 'wallet' ||
    input.transfer.destinationRail === 'wallet'
  ) {
    blockIds.add('stored_balance');
    blockIds.add('custodial_account');
  }

  if (
    primaryRail === 'bank' ||
    primaryRail === 'card' ||
    primaryRail === 'remittance' ||
    input.transfer.sourceRail === 'bank' ||
    input.transfer.destinationRail === 'bank'
  ) {
    blockIds.add('partner_bank');
  }

  if (primaryRail === 'card') {
    blockIds.add('debit_card');
  }

  if (primaryRail === 'remittance') {
    blockIds.add('error_resolution');
    if (
      cancellationWindow &&
      input.transfer.status !== 'completed' &&
      input.transfer.status !== 'failed' &&
      input.transfer.status !== 'reversed' &&
      input.transfer.status !== 'canceled'
    ) {
      blockIds.add('remittance_cancellation');
    }
    if (input.stablecoinRailEnabled) {
      blockIds.add('stablecoin_rail');
    }
  }

  return buildPaymentsLegalCopyBlocks({
    blockIds: [...blockIds],
    locale: input.locale,
    generatedAt: input.generatedAt,
    surfaces: input.surfaces,
    partnerBankName: input.partnerBankName,
    custodialEntityName: input.custodialEntityName,
    cardProgramName: input.cardProgramName,
    productName: input.productName,
    supportLabel: input.supportLabel,
    supportContact: input.supportContact,
    supportReference: input.providerReference ?? input.transfer.transferId,
    stablecoinRailEnabled: input.stablecoinRailEnabled,
    cancellationWindow,
  }).map((block) =>
    primaryRail === 'merchant'
      ? {
          ...block,
          summary: block.summary.replace('Wallet', railLabel),
        }
      : block,
  );
}

export function buildPaymentsReceiptPayload(
  input: BuildPaymentsReceiptInput,
): PaymentsReceiptPayload {
  const locale = input.locale ?? 'en-US';
  const receiptKind = resolveReceiptKind(input);
  const rail = resolvePrimaryRail({
    sourceRail: input.transfer.sourceRail,
    destinationRail: input.transfer.destinationRail,
  });
  const railLabel = getPaymentsRailLabel(rail);
  const meta = createPaymentsContentMeta({
    locale,
    generatedAt: input.generatedAt,
    surfaces: input.surfaces,
  });
  const statusLabel = getPaymentsTransferStatusLabel(input.transfer.status);
  const amountBreakdown = buildAmountBreakdown(input, locale);
  const parties = buildReceiptParties(input);
  const references = buildReceiptReferences(input);
  const recordkeeping =
    receiptKind === 'remittance'
      ? normalizeRecordkeeping(input.remittance?.recordkeeping)
      : null;

  const sections = [
    createPaymentsContentSection({
      sectionId: 'receipt_summary',
      title: 'Receipt summary',
      summary: `${resolveReceiptTitle(receiptKind)} for ${railLabel.toLowerCase()} activity.`,
      facts: [
        createPaymentsFactLine({
          lineId: 'status_label',
          label: 'Status',
          value: statusLabel,
        }),
        createPaymentsFactLine({
          lineId: 'occurred_at',
          label: 'Occurred at',
          value: formatPaymentsAbsoluteDateTime(input.occurredAt, locale),
        }),
        ...(input.transfer.memo
          ? [
              createPaymentsFactLine({
                lineId: 'memo',
                label: 'Memo',
                value: input.transfer.memo,
              }),
            ]
          : []),
      ],
    }),
    createPaymentsContentSection({
      sectionId: 'receipt_amounts',
      title: 'Amounts',
      facts: amountBreakdown,
    }),
    createPaymentsContentSection({
      sectionId: 'receipt_parties',
      title: 'Parties',
      facts: parties.map((party) =>
        createPaymentsFactLine({
          lineId: `party_${party.role}`,
          label: party.label,
          value: party.value,
        }),
      ),
    }),
    ...(receiptKind === 'remittance'
      ? [
          createPaymentsContentSection({
            sectionId: 'receipt_remittance',
            title: 'Remittance detail',
            facts: [
              ...(input.remittance?.corridor
                ? [
                    createPaymentsFactLine({
                      lineId: 'corridor',
                      label: 'Corridor',
                      value: input.remittance.corridor,
                    }),
                  ]
                : []),
              ...(input.remittance?.recipientCountryCode
                ? [
                    createPaymentsFactLine({
                      lineId: 'recipient_country',
                      label: 'Recipient country',
                      value: input.remittance.recipientCountryCode,
                    }),
                  ]
                : []),
              ...(input.remittance?.payoutMethod
                ? [
                    createPaymentsFactLine({
                      lineId: 'payout_method',
                      label: 'Payout method',
                      value: input.remittance.payoutMethod,
                    }),
                  ]
                : []),
              ...(input.remittance?.estimatedDeliveryAt
                ? [
                    createPaymentsFactLine({
                      lineId: 'estimated_delivery',
                      label: 'Estimated delivery',
                      value: formatPaymentsAbsoluteDateTime(
                        input.remittance.estimatedDeliveryAt,
                        locale,
                      ),
                    }),
                  ]
                : []),
            ],
            bullets: recordkeeping?.notes ?? [],
          }),
        ]
      : []),
    ...(references.length > 0
      ? [
          createPaymentsContentSection({
            sectionId: 'receipt_references',
            title: 'References',
            facts: references.map((reference) =>
              createPaymentsFactLine({
                lineId: reference.key,
                label: reference.label,
                value: reference.value,
              }),
            ),
          }),
        ]
      : []),
  ];

  const riskMetadata = input.transfer.metadata.risk;
  const userSafeExplanation =
    typeof riskMetadata === 'object' &&
    riskMetadata !== null &&
    'userSafeExplanation' in riskMetadata &&
    typeof riskMetadata.userSafeExplanation === 'string'
      ? riskMetadata.userSafeExplanation
      : null;

  return {
    kind: 'receipt',
    receiptId: `${input.transfer.transferId}:receipt`,
    receiptKind,
    transferKind: input.transfer.kind,
    transferId: input.transfer.transferId,
    transferStatus: input.transfer.status,
    rail,
    title: resolveReceiptTitle(receiptKind),
    subtitle: `${statusLabel} on ${formatPaymentsAbsoluteDateTime(input.occurredAt, locale)}`,
    meta,
    amountBreakdown,
    parties,
    references,
    sections,
    callouts: [
      buildPaymentsTransferStatusDisclosure({
        status: input.transfer.status,
        rail,
        userSafeExplanation,
      }),
    ],
    legalCopyBlocks: buildLegalCopy(input, railLabel),
    recordkeeping,
  };
}
