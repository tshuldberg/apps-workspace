import {
  formatPaymentsAbsoluteDate,
  resolvePaymentsDisclosureLocale,
} from './content';
import type {
  BuildPaymentsLegalCopyBlocksInput,
  PaymentsDisclosureSurface,
  PaymentsLegalCopyBlock,
  PaymentsLegalCopyBlockId,
  PaymentsLegalCopyPlacement,
} from './types';

const LEGAL_COPY_EFFECTIVE_AT = '2026-04-22T00:00:00.000Z';

const DEFAULT_SURFACES: PaymentsDisclosureSurface[] = [
  'mobile',
  'web',
  'email',
  'pdf',
  'support_export',
];

const VERSION_BY_BLOCK: Record<PaymentsLegalCopyBlockId, string> = {
  stored_balance: 'stored_balance@2026-04-22.v1',
  partner_bank: 'partner_bank@2026-04-22.v1',
  custodial_account: 'custodial_account@2026-04-22.v1',
  debit_card: 'debit_card@2026-04-22.v1',
  stablecoin_rail: 'stablecoin_rail@2026-04-22.v1',
  remittance_cancellation: 'remittance_cancellation@2026-04-22.v1',
  error_resolution: 'error_resolution@2026-04-22.v1',
};

const PLACEMENTS_BY_BLOCK: Record<
  PaymentsLegalCopyBlockId,
  PaymentsLegalCopyPlacement[]
> = {
  stored_balance: ['wallet_settings', 'funding', 'receipt', 'transfer_detail'],
  partner_bank: ['wallet_settings', 'funding', 'quote', 'receipt'],
  custodial_account: ['wallet_settings', 'funding', 'receipt', 'transfer_detail'],
  debit_card: ['card', 'receipt', 'transfer_detail'],
  stablecoin_rail: ['quote', 'receipt', 'transfer_detail', 'support_export'],
  remittance_cancellation: ['quote', 'receipt', 'transfer_detail', 'support_export'],
  error_resolution: ['quote', 'receipt', 'transfer_detail', 'support_export'],
};

function createFootnote(
  blockId: PaymentsLegalCopyBlockId,
  locale: string,
): string {
  return `Effective ${formatPaymentsAbsoluteDate(LEGAL_COPY_EFFECTIVE_AT, locale)}. Version ${VERSION_BY_BLOCK[blockId]}.`;
}

function createBlock(
  input: Omit<PaymentsLegalCopyBlock, 'effectiveAt' | 'version'>,
): PaymentsLegalCopyBlock {
  return {
    ...input,
    effectiveAt: LEGAL_COPY_EFFECTIVE_AT,
    version: VERSION_BY_BLOCK[input.blockId],
  };
}

export function buildPaymentsLegalCopyBlocks(
  input: BuildPaymentsLegalCopyBlocksInput,
): PaymentsLegalCopyBlock[] {
  const locale = resolvePaymentsDisclosureLocale(input.locale);
  const productName = input.productName?.trim() || 'MyPay';
  const partnerBankName = input.partnerBankName?.trim() || 'our partner bank';
  const custodialEntityName =
    input.custodialEntityName?.trim() || 'our custodial partner';
  const cardProgramName = input.cardProgramName?.trim() || `${productName} Card`;
  const supportLabel = input.supportLabel?.trim() || `${productName} Support`;
  const supportContact = input.supportContact?.trim() || 'the in-app support channel';
  const surfaces = input.surfaces?.length ? [...input.surfaces] : DEFAULT_SURFACES;
  const uniqueIds = [...new Set(input.blockIds)];

  return uniqueIds.flatMap((blockId) => {
    if (blockId === 'stablecoin_rail' && !input.stablecoinRailEnabled) {
      return [];
    }

    const footnote = createFootnote(blockId, locale);

    switch (blockId) {
      case 'stored_balance':
        return [
          createBlock({
            blockId,
            title: 'Stored balance',
            summary:
              'Wallet balance is stored value and not a standalone checking or savings account.',
            body: [
              `${productName} stored balance is a prepaid wallet balance used to send, receive, and hold funds inside the product.`,
              'Stored value may be held for the benefit of users in pooled program accounts instead of a separate deposit account opened in the end user\'s name.',
              'Availability can change while holds, returns, disputes, and provider settlement remain open.',
            ],
            footnote,
            surfaces,
            placements: PLACEMENTS_BY_BLOCK[blockId],
            tags: ['wallet', 'stored-balance', 'regulatory-copy'],
          }),
        ];
      case 'partner_bank':
        return [
          createBlock({
            blockId,
            title: 'Partner bank program',
            summary:
              'A disclosed bank partner supports eligible wallet, funding, and card features.',
            body: [
              `Eligible balances and card services may rely on ${partnerBankName} or another disclosed partner institution.`,
              'Pass-through deposit insurance, when available, depends on account structure, recordkeeping, and the partner-bank program terms in force on the effective date below.',
              'Coverage is not unlimited and may not apply after funds leave the partner-bank program or when eligibility conditions are not met.',
            ],
            footnote,
            surfaces,
            placements: PLACEMENTS_BY_BLOCK[blockId],
            tags: ['partner-bank', 'wallet', 'funding'],
          }),
        ];
      case 'custodial_account':
        return [
          createBlock({
            blockId,
            title: 'Custodial account structure',
            summary:
              'Funds can be held in pooled custodial or FBO accounts mapped back to the end user.',
            body: [
              `${custodialEntityName} may maintain omnibus or for-benefit-of account structures instead of creating an individual bank account for each user.`,
              'Program records must preserve the linkage between balances, transfers, and the end user for support, audit, and regulatory workflows.',
              'Provider holds, incoming returns, and settlement timing can change when funds become available to spend, withdraw, or reverse.',
            ],
            footnote,
            surfaces,
            placements: PLACEMENTS_BY_BLOCK[blockId],
            tags: ['custody', 'fbo', 'wallet'],
          }),
        ];
      case 'debit_card':
        return [
          createBlock({
            blockId,
            title: 'Debit card access',
            summary:
              'Card activity follows network and issuer rules that are distinct from wallet transfers.',
            body: [
              `${cardProgramName} can place authorizations, partial captures, incremental adjustments, reversals, and chargeback-driven debits against the linked balance.`,
              'The card may be issued by a disclosed partner bank under card-network rules that are separate from wallet-to-wallet or funding transfers.',
              'ATM availability, international usage, chargeback timing, and final settlement depend on the active card terms and network procedures.',
            ],
            footnote,
            surfaces,
            placements: PLACEMENTS_BY_BLOCK[blockId],
            tags: ['card', 'issuer', 'network'],
          }),
        ];
      case 'stablecoin_rail':
        return [
          createBlock({
            blockId,
            title: 'Cross-border settlement rail',
            summary:
              'Some corridors can use a digital liquidity rail behind the scenes without changing the customer-facing fiat contract.',
            body: [
              'If enabled for a corridor, a partner may use a digital liquidity rail only as back-end settlement infrastructure.',
              `Sender debits, disclosed fees, exchange rate, and recipient payout amount remain expressed in fiat terms inside the ${productName} customer contract.`,
              'Routing can change without a UI rewrite as long as disclosed customer amounts, delivery expectations, and legal obligations stay the same.',
            ],
            footnote,
            surfaces,
            placements: PLACEMENTS_BY_BLOCK[blockId],
            tags: ['cross-border', 'digital-liquidity', 'remittance'],
          }),
        ];
      case 'remittance_cancellation': {
        const cancelable = input.cancellationWindow?.cancelable ?? true;
        const cancelBy = input.cancellationWindow?.cancelBy
          ? formatPaymentsAbsoluteDate(input.cancellationWindow.cancelBy, locale)
          : null;
        const reason = input.cancellationWindow?.reason;

        return [
          createBlock({
            blockId,
            title: 'Cancellation timing',
            summary: cancelable
              ? cancelBy
                ? `Cross-border transfers can usually be canceled until ${cancelBy}.`
                : 'Cross-border transfers can usually be canceled before final provider submission.'
              : 'Cancellation is no longer available for this transfer state.',
            body: cancelable
              ? [
                  cancelBy
                    ? `Use quote or transfer detail before ${cancelBy} to request cancellation while the transfer is still eligible.`
                    : 'Cancellation remains available only while the transfer has not moved beyond the partner\'s cancelable state.',
                  'After payout, cash pickup release, or other irreversible provider actions, cancellation may no longer be possible.',
                  reason ??
                    'Provider and corridor rules determine the exact cancellation deadline and refund path.',
                ]
              : [
                  reason ??
                    'The transfer has passed the last cancelable state for this corridor or payout method.',
                  'Use the receipt and provider references if support needs to investigate a failed or delayed payout instead of a cancellation request.',
                  'Refund timing after a failed delivery depends on partner reconciliation and any corridor-specific hold periods.',
                ],
            footnote,
            surfaces,
            placements: PLACEMENTS_BY_BLOCK[blockId],
            tags: ['remittance', 'cancellation'],
          }),
        ];
      }
      case 'error_resolution':
        return [
          createBlock({
            blockId,
            title: 'Error resolution',
            summary:
              'Use transaction detail or support to report unauthorized, delayed, failed, or misdirected transfers.',
            body: [
              `Open a case from transfer detail or contact ${supportLabel} to report an issue with the current transaction.`,
              'Include the transfer, receipt, remittance, or provider reference so operations can reconcile your case against immutable ledger and provider-event history.',
              'Available remedies and timelines depend on transfer rail, partner rules, and the laws that apply to the corridor and product state.',
            ],
            footnote: [
              footnote,
              `Support contact: ${supportContact}.`,
              input.supportReference
                ? `Reference: ${input.supportReference}.`
                : null,
            ]
              .filter(Boolean)
              .join(' '),
            surfaces,
            placements: PLACEMENTS_BY_BLOCK[blockId],
            tags: ['support', 'error-resolution', 'remittance'],
          }),
        ];
    }
  });
}
