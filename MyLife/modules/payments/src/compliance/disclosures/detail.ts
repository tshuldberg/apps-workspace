import {
  buildPaymentsRemittanceQuotePayload,
} from './remittance';
import {
  buildPaymentsReceiptPayload,
} from './receipts';
import {
  buildPaymentsTransferStatusDisclosure,
  createPaymentsContentMeta,
  createPaymentsContentSection,
  createPaymentsDisclosureBundle,
  createPaymentsFactLine,
  formatPaymentsAbsoluteDateTime,
  getPaymentsRailLabel,
  getPaymentsTransferStatusLabel,
  mergePaymentsDisclosureBundles,
} from './content';
import type {
  BuildPaymentsTransferDetailPayloadInput,
  PaymentsTransferDetailPayload,
} from './types';

function resolveRailNarrative(rail: PaymentsTransferDetailPayload['rail']): string {
  switch (rail) {
    case 'card':
      return 'Card activity can move through authorization, capture, refund, and dispute states without changing the receipt contract.';
    case 'bank':
    case 'ach':
    case 'wire':
      return 'Bank-linked activity can remain pending while the partner confirms settlement or return timing.';
    case 'remittance':
      return 'Cross-border detail can reuse quote disclosures, receipts, and legal copy across quote, confirmation, history, PDF, email, and support export surfaces.';
    case 'merchant':
      return 'Merchant and escrow activity keeps external payout references separate from wallet ledger references.';
    case 'wallet':
    case 'internal':
      return 'Wallet detail stays server-authoritative and reuses the same legal-copy center as other rails.';
  }
}

function buildRailSection(input: BuildPaymentsTransferDetailPayloadInput) {
  const railLabel = getPaymentsRailLabel(
    input.transfer.sourceRail === 'remittance' ||
      input.transfer.destinationRail === 'remittance'
      ? 'remittance'
      : input.transfer.sourceRail === 'card' ||
          input.transfer.destinationRail === 'card'
        ? 'card'
        : input.transfer.destinationRail,
  );

  return createPaymentsContentSection({
    sectionId: 'transfer_detail_summary',
    title: 'Transfer detail',
    summary: resolveRailNarrative(
      input.transfer.sourceRail === 'remittance' ||
        input.transfer.destinationRail === 'remittance'
        ? 'remittance'
        : input.transfer.sourceRail === 'card' ||
            input.transfer.destinationRail === 'card'
          ? 'card'
          : input.transfer.destinationRail,
    ),
    facts: [
      createPaymentsFactLine({
        lineId: 'rail',
        label: 'Rail',
        value: railLabel,
      }),
      createPaymentsFactLine({
        lineId: 'status',
        label: 'Status',
        value: getPaymentsTransferStatusLabel(input.transfer.status),
      }),
      createPaymentsFactLine({
        lineId: 'occurred_at',
        label: 'Occurred at',
        value: formatPaymentsAbsoluteDateTime(
          input.occurredAt,
          input.locale ?? 'en-US',
        ),
      }),
      createPaymentsFactLine({
        lineId: 'transfer_id',
        label: 'Transfer ID',
        value: input.transfer.transferId,
      }),
    ],
  });
}

function buildRemittanceDetailSection(input: BuildPaymentsTransferDetailPayloadInput) {
  if (
    !input.remittance &&
    !input.remittanceQuote
  ) {
    return null;
  }

  return createPaymentsContentSection({
    sectionId: 'transfer_detail_remittance',
    title: 'Cross-border detail',
    summary:
      input.remittanceQuote?.corridor
        ? `Quote and receipt data are aligned for corridor ${input.remittanceQuote.corridor}.`
        : 'Cross-border details are attached to this transfer.',
    facts: [
      ...(input.remittance?.corridor || input.remittanceQuote?.corridor
        ? [
            createPaymentsFactLine({
              lineId: 'corridor',
              label: 'Corridor',
              value:
                input.remittance?.corridor ??
                input.remittanceQuote?.corridor ??
                '',
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
    ],
  });
}

export function buildPaymentsTransferDetailPayload(
  input: BuildPaymentsTransferDetailPayloadInput,
): PaymentsTransferDetailPayload {
  const locale = input.locale ?? 'en-US';
  const receipt = buildPaymentsReceiptPayload({
    ...input,
    locale,
  });
  const meta = createPaymentsContentMeta({
    locale,
    generatedAt: input.generatedAt,
    surfaces: input.surfaces,
  });
  const riskMetadata = input.transfer.metadata.risk;
  const userSafeExplanation =
    typeof riskMetadata === 'object' &&
    riskMetadata !== null &&
    'userSafeExplanation' in riskMetadata &&
    typeof riskMetadata.userSafeExplanation === 'string'
      ? riskMetadata.userSafeExplanation
      : null;

  const summaryBundle = createPaymentsDisclosureBundle({
    bundleId: `transfer_detail_${input.transfer.transferId}`,
    meta,
    callouts: [
      buildPaymentsTransferStatusDisclosure({
        status: input.transfer.status,
        rail: receipt.rail,
        userSafeExplanation,
      }),
    ],
    sections: [
      buildRailSection(input),
      ...(buildRemittanceDetailSection(input)
        ? [buildRemittanceDetailSection(input)!]
        : []),
    ],
    legalCopyBlocks: receipt.legalCopyBlocks,
  });

  const remittanceBundle = input.remittanceQuote
    ? buildPaymentsRemittanceQuotePayload({
        ...input.remittanceQuote,
        locale,
        generatedAt: input.generatedAt,
        surfaces: input.surfaces,
        partnerBankName:
          input.remittanceQuote.partnerBankName ?? input.partnerBankName,
        custodialEntityName:
          input.remittanceQuote.custodialEntityName ??
          input.custodialEntityName,
        productName: input.remittanceQuote.productName ?? input.productName,
        supportLabel: input.remittanceQuote.supportLabel ?? input.supportLabel,
        supportContact:
          input.remittanceQuote.supportContact ?? input.supportContact,
        supportReference:
          input.remittanceQuote.supportReference ?? input.supportReference,
        stablecoinRailEnabled:
          input.remittanceQuote.stablecoinRailEnabled ??
          input.stablecoinRailEnabled,
      }).disclosureBundle
    : createPaymentsDisclosureBundle({
        bundleId: `transfer_detail_receipt_${input.transfer.transferId}`,
        meta,
        legalCopyBlocks: receipt.legalCopyBlocks,
      });

  return {
    transferId: input.transfer.transferId,
    rail: receipt.rail,
    status: input.transfer.status,
    headline: `${getPaymentsRailLabel(receipt.rail)} ${getPaymentsTransferStatusLabel(input.transfer.status)}`,
    meta,
    disclosureBundle: mergePaymentsDisclosureBundles(
      summaryBundle,
      remittanceBundle,
    ),
    receipt,
  };
}
