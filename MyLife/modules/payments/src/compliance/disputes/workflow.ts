import {
  assertPaymentsInvariant,
} from '../../engine/errors';
import type {
  PaymentsTransferRecord,
} from '../../engine/types';
import type {
  PaymentsDisputeCase,
  PaymentsDisputeCaseStatus,
  PaymentsDisputeCaseSubtype,
  PaymentsDisputeCaseType,
  PaymentsDisputeDeadline,
  PaymentsDisputeDeadlineKind,
  PaymentsDisputeEvidenceSlot,
  PaymentsDisputeLedgerDecisionType,
  PaymentsDisputeNote,
  PaymentsDisputeOperatorAction,
  PaymentsDisputeOperatorActionType,
  PaymentsDisputeProviderOutcome,
  PaymentsDisputeReasonCode,
  PaymentsDisputeReasonOption,
  PaymentsDisputeTimelineActor,
  PaymentsDisputeTimelineItem,
  PaymentsIssueReportDraft,
  PaymentsIssueReportInput,
  PaymentsTransferDisputeSummary,
  CreatePaymentsDisputeCaseInput,
  SubmitPaymentsDisputeEvidenceInput,
  ApplyPaymentsDisputeOperatorActionInput,
} from './types';

const REPORT_WINDOW_DAYS: Record<PaymentsDisputeCaseSubtype, number> = {
  unauthorized_transfer: 60,
  card_dispute: 60,
  market_escrow: 14,
};

const EVIDENCE_WINDOW_DAYS = 7;
const PROVIDER_RESPONSE_WINDOW_DAYS = 30;
const PROVISIONAL_CREDIT_WINDOW_DAYS = 10;

const REASON_OPTIONS: Record<
  PaymentsDisputeCaseSubtype,
  PaymentsDisputeReasonOption[]
> = {
  unauthorized_transfer: [
    {
      code: 'unauthorized_transfer',
      label: 'Unauthorized transfer',
      description: 'The money movement was not authorized by the account owner.',
    },
    {
      code: 'account_takeover',
      label: 'Account takeover',
      description: 'The wallet or credentials were used without the owner present.',
    },
    {
      code: 'other',
      label: 'Other issue',
      description: 'Use this when the transfer problem does not match a standard category.',
    },
  ],
  card_dispute: [
    {
      code: 'card_not_present_fraud',
      label: 'Card fraud',
      description: 'The card purchase was fraudulent or not recognized by the cardholder.',
    },
    {
      code: 'duplicate_charge',
      label: 'Duplicate charge',
      description: 'The cardholder was charged more than once for the same purchase.',
    },
    {
      code: 'merchant_credit_not_processed',
      label: 'Credit not processed',
      description: 'The merchant promised a credit or refund that never posted.',
    },
    {
      code: 'service_not_received',
      label: 'Service not received',
      description: 'The merchant did not provide the purchased service.',
    },
    {
      code: 'other',
      label: 'Other issue',
      description: 'Use this when the card issue needs manual classification.',
    },
  ],
  market_escrow: [
    {
      code: 'item_not_received',
      label: 'Item not received',
      description: 'The buyer never received the item tied to the escrow payment.',
    },
    {
      code: 'item_not_as_described',
      label: 'Not as described',
      description: 'The delivered item does not match the listing or seller promises.',
    },
    {
      code: 'item_damaged',
      label: 'Item damaged',
      description: 'The item arrived damaged or unusable.',
    },
    {
      code: 'wrong_item',
      label: 'Wrong item',
      description: 'The shipment did not contain the agreed item.',
    },
    {
      code: 'counterfeit',
      label: 'Counterfeit item',
      description: 'The delivered goods appear fake or unauthentic.',
    },
    {
      code: 'other',
      label: 'Other issue',
      description: 'Use this when the escrow problem needs a custom explanation.',
    },
  ],
};

type EvidenceTemplate = Pick<
  PaymentsDisputeEvidenceSlot,
  'key' | 'label' | 'description' | 'status'
>;

const EVIDENCE_TEMPLATES: Record<
  PaymentsDisputeCaseSubtype,
  EvidenceTemplate[]
> = {
  unauthorized_transfer: [
    {
      key: 'account_statement',
      label: 'Customer statement',
      description: 'Short statement explaining why the transfer was unauthorized.',
      status: 'required',
    },
    {
      key: 'device_context',
      label: 'Device context',
      description: 'Device or login context that supports the unauthorized-transfer claim.',
      status: 'required',
    },
    {
      key: 'supporting_documents',
      label: 'Supporting documents',
      description: 'Screenshots, police report, or related documentation if available.',
      status: 'optional',
    },
  ],
  card_dispute: [
    {
      key: 'cardholder_statement',
      label: 'Cardholder statement',
      description: 'Statement from the cardholder describing the purchase issue.',
      status: 'required',
    },
    {
      key: 'merchant_contact',
      label: 'Merchant contact',
      description: 'Messages or receipts showing attempts to resolve with the merchant.',
      status: 'optional',
    },
    {
      key: 'receipt_or_contract',
      label: 'Receipt or contract',
      description: 'Proof of the original transaction, receipt, or order terms.',
      status: 'optional',
    },
  ],
  market_escrow: [
    {
      key: 'listing_context',
      label: 'Listing and chat context',
      description: 'Listing screenshots or conversation history for the escrowed order.',
      status: 'required',
    },
    {
      key: 'delivery_or_condition',
      label: 'Delivery or condition proof',
      description: 'Tracking proof or photos showing the delivery issue or item condition.',
      status: 'required',
    },
    {
      key: 'return_or_refund_history',
      label: 'Return or refund history',
      description: 'Messages or receipts related to a promised return, replacement, or refund.',
      status: 'optional',
    },
  ],
};

function defaultCreateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function addDays(isoTimestamp: string, days: number): string {
  const value = new Date(isoTimestamp);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString();
}

function amountForTransfer(transfer: PaymentsTransferRecord): number {
  return transfer.sourceAmountCents;
}

function currencyForTransfer(transfer: PaymentsTransferRecord) {
  return transfer.sourceCurrency;
}

function resolveCaseSubtype(input: PaymentsIssueReportInput): PaymentsDisputeCaseSubtype {
  const transfer = input.transfer;
  if (
    input.market?.orderId ||
    transfer.kind === 'escrow_hold' ||
    transfer.kind === 'escrow_release' ||
    transfer.sourceBalanceBucket === 'escrow' ||
    transfer.destinationBalanceBucket === 'escrow'
  ) {
    return 'market_escrow';
  }

  if (
    input.cardTransactionId ||
    transfer.kind === 'card_authorization' ||
    transfer.kind === 'card_capture' ||
    transfer.kind === 'card_refund' ||
    transfer.sourceRail === 'card' ||
    transfer.destinationRail === 'card'
  ) {
    return 'card_dispute';
  }

  return 'unauthorized_transfer';
}

function resolveCaseType(
  subtype: PaymentsDisputeCaseSubtype,
): PaymentsDisputeCaseType {
  return subtype === 'unauthorized_transfer' ? 'reg_e_error' : 'chargeback';
}

function createTimelineItem(input: {
  eventType: string;
  occurredAt: string;
  actor: PaymentsDisputeTimelineActor;
  title: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
  createId?: (prefix: string) => string;
}): PaymentsDisputeTimelineItem {
  return {
    timelineId: (input.createId ?? defaultCreateId)('pay_dispute_timeline'),
    occurredAt: input.occurredAt,
    actor: input.actor,
    eventType: input.eventType,
    title: input.title,
    detail: input.detail ?? null,
    metadata: input.metadata ?? {},
  };
}

function createEvidenceSlots(input: {
  subtype: PaymentsDisputeCaseSubtype;
  evidenceDueAt: string;
  createId?: (prefix: string) => string;
}): PaymentsDisputeEvidenceSlot[] {
  return EVIDENCE_TEMPLATES[input.subtype].map((template) => ({
    slotId: (input.createId ?? defaultCreateId)('pay_dispute_slot'),
    key: template.key,
    label: template.label,
    description: template.description,
    status: template.status,
    dueAt: input.evidenceDueAt,
    attachmentIds: [],
    note: null,
  }));
}

function buildDeadlines(input: {
  subtype: PaymentsDisputeCaseSubtype;
  transferOccurredAt: string;
  openedAt: string;
  now: Date;
  createId?: (prefix: string) => string;
}): PaymentsDisputeDeadline[] {
  const reportBy = addDays(
    input.transferOccurredAt,
    REPORT_WINDOW_DAYS[input.subtype],
  );
  const evidenceBy = addDays(input.openedAt, EVIDENCE_WINDOW_DAYS);
  const providerResponseBy = addDays(
    input.openedAt,
    PROVIDER_RESPONSE_WINDOW_DAYS,
  );
  const provisionalCreditBy = addDays(
    input.openedAt,
    PROVISIONAL_CREDIT_WINDOW_DAYS,
  );

  const base: PaymentsDisputeDeadline[] = [
    {
      deadlineId: (input.createId ?? defaultCreateId)('pay_dispute_deadline'),
      kind: 'report_by',
      label: 'Report by',
      description: 'Last day to file the issue report from transaction detail.',
      dueAt: reportBy,
      status:
        new Date(reportBy).getTime() < input.now.getTime() ? 'missed' : 'pending',
      completedAt: null,
    },
    {
      deadlineId: (input.createId ?? defaultCreateId)('pay_dispute_deadline'),
      kind: 'evidence_by',
      label: 'Evidence due',
      description: 'Requested customer evidence should arrive by this date.',
      dueAt: evidenceBy,
      status: 'pending',
      completedAt: null,
    },
    {
      deadlineId: (input.createId ?? defaultCreateId)('pay_dispute_deadline'),
      kind: 'provider_response_by',
      label: 'Provider response due',
      description: 'Target date for provider or network response.',
      dueAt: providerResponseBy,
      status: 'pending',
      completedAt: null,
    },
  ];

  if (input.subtype !== 'market_escrow') {
    base.push({
      deadlineId: (input.createId ?? defaultCreateId)('pay_dispute_deadline'),
      kind: 'provisional_credit_by',
      label: 'Provisional credit target',
      description:
        'Target date to decide whether provisional credit is required while the case remains open.',
      dueAt: provisionalCreditBy,
      status: 'pending',
      completedAt: null,
    });
  }

  return base;
}

function updateDeadline(
  deadlines: PaymentsDisputeDeadline[],
  kind: PaymentsDisputeDeadlineKind,
  patch: Partial<PaymentsDisputeDeadline>,
): PaymentsDisputeDeadline[] {
  return deadlines.map((deadline) =>
    deadline.kind === kind ? { ...deadline, ...patch } : deadline,
  );
}

function isActiveStatus(status: PaymentsDisputeCaseStatus): boolean {
  return status !== 'resolved' && status !== 'closed';
}

function requiredSlotsOutstanding(evidenceSlots: PaymentsDisputeEvidenceSlot[]): PaymentsDisputeEvidenceSlot[] {
  return evidenceSlots.filter(
    (slot) => slot.status === 'required' && slot.attachmentIds.length === 0,
  );
}

function resolveNextStep(disputeCase: PaymentsDisputeCase): string {
  if (disputeCase.status === 'closed') {
    return 'Case closed.';
  }

  if (disputeCase.status === 'awaiting_customer') {
    const outstanding = requiredSlotsOutstanding(disputeCase.evidenceSlots);
    if (outstanding.length === 0) {
      return 'Customer evidence is in. Return the case to operator review.';
    }
    return `Add the requested evidence: ${outstanding
      .map((slot) => slot.label)
      .join(', ')}.`;
  }

  if (disputeCase.ledgerState.ledgerActionPending) {
    return 'Apply the selected dispute decision through the ledger service before closing the case.';
  }

  if (
    disputeCase.providerOutcome === 'chargeback_debit' ||
    disputeCase.providerOutcome === 'lost' ||
    disputeCase.providerOutcome === 'refund_posted'
  ) {
    return 'Review the provider outcome and choose a reversal, refund, or no-ledger-change resolution.';
  }

  switch (disputeCase.status) {
    case 'draft':
      return 'Finish the issue report and submit the case.';
    case 'open':
      return 'A payments operator should triage the report and decide on the next action.';
    case 'under_review':
      return 'Operator review is in progress.';
    case 'submitted_to_provider':
      return 'Waiting for the provider or network response.';
    case 'provisional_credit_issued':
      return 'Keep the provider investigation open and confirm the final ledger outcome when the response arrives.';
    case 'resolved':
      return 'Send the resolution notice and close the case when the workflow is complete.';
    default:
      return 'Review the case and take the next required action.';
  }
}

function actionDefinition(input: {
  actionType: PaymentsDisputeOperatorActionType;
  label: string;
  description: string;
  recommendedLedgerDecision?: PaymentsDisputeLedgerDecisionType | null;
}): PaymentsDisputeOperatorAction {
  return {
    actionType: input.actionType,
    label: input.label,
    description: input.description,
    recommendedLedgerDecision: input.recommendedLedgerDecision ?? null,
  };
}

function resolveOperatorActions(
  disputeCase: PaymentsDisputeCase,
): PaymentsDisputeOperatorAction[] {
  if (disputeCase.status === 'closed') {
    return [];
  }

  if (disputeCase.status === 'resolved') {
    return [
      actionDefinition({
        actionType: 'close_case',
        label: 'Close case',
        description: 'Mark the dispute complete after notifications and ledger work are done.',
      }),
    ];
  }

  const actions: PaymentsDisputeOperatorAction[] = [
    actionDefinition({
      actionType: 'request_evidence',
      label: 'Request evidence',
      description: 'Ask the customer for more documentation or supporting proof.',
    }),
    actionDefinition({
      actionType: 'submit_to_provider',
      label: 'Submit to provider',
      description: 'Route the dispute or chargeback package to the provider or network.',
    }),
    actionDefinition({
      actionType: 'record_provider_outcome',
      label: 'Record provider outcome',
      description: 'Capture a provider review or chargeback-like outcome without changing the ledger yet.',
    }),
    actionDefinition({
      actionType: 'resolve_with_reversal',
      label: 'Resolve with reversal',
      description: 'Reverse the original posted transfer through the ledger service.',
      recommendedLedgerDecision: 'reversal',
    }),
    actionDefinition({
      actionType: 'resolve_with_refund',
      label: 'Resolve with refund',
      description: 'Post a refund or chargeback-style reimbursement through the ledger service.',
      recommendedLedgerDecision: 'refund',
    }),
    actionDefinition({
      actionType: 'deny_claim',
      label: 'Deny claim',
      description: 'Close the case with no funds movement and notify the customer.',
      recommendedLedgerDecision: 'none',
    }),
  ];

  if (
    disputeCase.caseSubtype !== 'market_escrow' &&
    disputeCase.status !== 'provisional_credit_issued'
  ) {
    actions.splice(
      2,
      0,
      actionDefinition({
        actionType: 'issue_provisional_credit',
        label: 'Issue provisional credit',
        description: 'Prepare a temporary credit while the provider investigation stays open.',
        recommendedLedgerDecision: 'provisional_credit',
      }),
    );
  }

  return actions;
}

function resolveSummaryFromCase(
  disputeCase: PaymentsDisputeCase,
): PaymentsTransferDisputeSummary {
  const nextDeadline = disputeCase.deadlines.find(
    (deadline) => deadline.status === 'pending',
  );

  return {
    transferId: disputeCase.transferId,
    caseId: disputeCase.caseId,
    caseSubtype: disputeCase.caseSubtype,
    status: disputeCase.status,
    hasActiveCase: isActiveStatus(disputeCase.status),
    headline:
      disputeCase.status === 'closed'
        ? 'Issue closed'
        : disputeCase.status === 'resolved'
          ? 'Resolution selected'
          : 'Issue under review',
    nextStep: disputeCase.nextStep,
    deadlineAt: nextDeadline?.dueAt ?? null,
  };
}

function compareCases(left: PaymentsDisputeCase, right: PaymentsDisputeCase): number {
  const leftActive = isActiveStatus(left.status);
  const rightActive = isActiveStatus(right.status);
  if (leftActive !== rightActive) {
    return leftActive ? -1 : 1;
  }

  return (
    new Date(right.updatedAt).getTime() -
    new Date(left.updatedAt).getTime()
  );
}

function validateReason(subtype: PaymentsDisputeCaseSubtype, reasonCode: PaymentsDisputeReasonCode): void {
  const allowed = REASON_OPTIONS[subtype].some((option) => option.code === reasonCode);
  assertPaymentsInvariant(
    allowed,
    'invalid_command',
    `Reason ${reasonCode} is not allowed for ${subtype}`,
    {
      subtype,
      reasonCode,
    },
  );
}

function resolveInitialStatus(): PaymentsDisputeCaseStatus {
  return 'open';
}

function withRecomputedState(disputeCase: PaymentsDisputeCase): PaymentsDisputeCase {
  const updated: PaymentsDisputeCase = {
    ...disputeCase,
    nextStep: resolveNextStep(disputeCase),
  };
  return {
    ...updated,
    operatorActions: resolveOperatorActions(updated),
  };
}

export function buildPaymentsTransferDisputeSummary(input: {
  transfer: PaymentsTransferRecord;
  disputes?: PaymentsDisputeCase[];
}): PaymentsTransferDisputeSummary {
  const related = (input.disputes ?? [])
    .filter((dispute) => dispute.transferId === input.transfer.transferId)
    .sort(compareCases);

  const activeCase = related.find((dispute) => isActiveStatus(dispute.status));
  const currentCase = activeCase ?? related[0] ?? null;

  if (!currentCase) {
    return {
      transferId: input.transfer.transferId,
      caseId: null,
      caseSubtype: null,
      status: null,
      hasActiveCase: false,
      headline: 'No reported issue',
      nextStep: 'Report an issue from transaction detail if this transfer needs review.',
      deadlineAt: null,
    };
  }

  return resolveSummaryFromCase(currentCase);
}

export function buildPaymentsIssueReportDraft(
  input: PaymentsIssueReportInput,
): PaymentsIssueReportDraft {
  const caseSubtype = resolveCaseSubtype(input);
  const caseType = resolveCaseType(caseSubtype);
  const currentCaseSummary = buildPaymentsTransferDisputeSummary({
    transfer: input.transfer,
    disputes: input.existingCases,
  });
  const reportBy = addDays(
    input.transferOccurredAt,
    REPORT_WINDOW_DAYS[caseSubtype],
  );
  const reportable =
    !currentCaseSummary.hasActiveCase &&
    new Date(reportBy).getTime() >= input.now.getTime();
  const blockedReason = currentCaseSummary.hasActiveCase
    ? 'An active case already exists for this transfer.'
    : !reportable
      ? 'The issue-reporting window has closed for this transfer.'
      : null;
  const deadlines = buildDeadlines({
    subtype: caseSubtype,
    transferOccurredAt: input.transferOccurredAt,
    openedAt: input.now.toISOString(),
    now: input.now,
  });

  return {
    ownerUserId: input.ownerUserId,
    walletId: input.walletId,
    transferId: input.transfer.transferId,
    caseType,
    caseSubtype,
    reportable,
    reasonOptions: REASON_OPTIONS[caseSubtype],
    evidenceSlots: createEvidenceSlots({
      subtype: caseSubtype,
      evidenceDueAt:
        deadlines.find((deadline) => deadline.kind === 'evidence_by')?.dueAt ??
        addDays(input.now.toISOString(), EVIDENCE_WINDOW_DAYS),
    }),
    deadlines,
    currentCaseSummary,
    nextStep: blockedReason
      ? currentCaseSummary.nextStep
      : 'Choose a reason, add context, and submit the issue report from transaction detail.',
    blockedReason,
  };
}

export function createPaymentsDisputeCase(
  input: CreatePaymentsDisputeCaseInput,
): PaymentsDisputeCase {
  const reportDraft = buildPaymentsIssueReportDraft(input);
  assertPaymentsInvariant(
    reportDraft.reportable && reportDraft.caseSubtype && reportDraft.caseType,
    'invalid_command',
    reportDraft.blockedReason ?? 'Issue reporting is not available for this transfer.',
    {
      transferId: input.transfer.transferId,
    },
  );
  validateReason(reportDraft.caseSubtype, input.reasonCode);
  assertPaymentsInvariant(
    input.userStatement.trim().length >= 10,
    'invalid_command',
    'userStatement must be at least 10 characters long',
  );

  const createId = input.createId ?? defaultCreateId;
  const openedAt = input.reportedAt ?? input.now.toISOString();
  const deadlines = updateDeadline(
    buildDeadlines({
      subtype: reportDraft.caseSubtype,
      transferOccurredAt: input.transferOccurredAt,
      openedAt,
      now: input.now,
      createId,
    }),
    'report_by',
    {
      status: 'met',
      completedAt: openedAt,
    },
  );

  const baseCase: PaymentsDisputeCase = {
    caseId: createId('pay_dispute'),
    ownerUserId: input.ownerUserId,
    walletId: input.walletId,
    transferId: input.transfer.transferId,
    cardTransactionId: input.cardTransactionId ?? null,
    providerName: input.providerName ?? null,
    counterparty: input.counterparty ?? null,
    market: input.market ?? null,
    caseType: reportDraft.caseType,
    caseSubtype: reportDraft.caseSubtype,
    status: resolveInitialStatus(),
    amountCents: amountForTransfer(input.transfer),
    currency: currencyForTransfer(input.transfer),
    reasonCode: input.reasonCode,
    userStatement: input.userStatement.trim(),
    providerOutcome: 'none',
    openedAt,
    updatedAt: openedAt,
    evidenceSlots: createEvidenceSlots({
      subtype: reportDraft.caseSubtype,
      evidenceDueAt:
        deadlines.find((deadline) => deadline.kind === 'evidence_by')?.dueAt ??
        addDays(openedAt, EVIDENCE_WINDOW_DAYS),
      createId,
    }),
    deadlines,
    timeline: [
      createTimelineItem({
        occurredAt: openedAt,
        actor: 'customer',
        eventType: 'case_reported',
        title: 'Issue reported',
        detail: input.userStatement.trim(),
        metadata: {
          reasonCode: input.reasonCode,
          caseType: reportDraft.caseType,
          caseSubtype: reportDraft.caseSubtype,
        },
        createId,
      }),
    ],
    notes: [
      {
        noteId: createId('pay_dispute_note'),
        createdAt: openedAt,
        authorRole: 'customer',
        authorUserId: input.ownerUserId,
        visibility: 'customer',
        body: input.userStatement.trim(),
      },
    ],
    operatorActions: [],
    nextStep: '',
    ledgerState: {
      recommendedDecision: null,
      ledgerActionPending: false,
      appliedDecision: null,
      appliedAt: null,
    },
    metadata: {
      transferKind: input.transfer.kind,
      transferStatus: input.transfer.status,
      marketOrderId: input.market?.orderId ?? null,
      existingCaseCount: (input.existingCases ?? []).length,
    },
  };

  return withRecomputedState(baseCase);
}

export function submitPaymentsDisputeEvidence(
  input: SubmitPaymentsDisputeEvidenceInput,
): PaymentsDisputeCase {
  const slotIds = new Set(input.slotSubmissions.map((submission) => submission.slotId));
  const updatedSlots = input.disputeCase.evidenceSlots.map((slot) => {
    const submission = input.slotSubmissions.find(
      (candidate) => candidate.slotId === slot.slotId,
    );
    if (!submission) {
      return slot;
    }
    return {
      ...slot,
      status: 'submitted' as const,
      attachmentIds: [...slot.attachmentIds, submission.attachmentId],
      note: submission.note ?? slot.note,
    };
  });

  assertPaymentsInvariant(
    slotIds.size > 0,
    'invalid_command',
    'At least one evidence slot must be submitted',
  );

  const requiredOutstanding = requiredSlotsOutstanding(updatedSlots);
  const evidenceCompleted = requiredOutstanding.length === 0;
  const status =
    evidenceCompleted && input.disputeCase.status === 'awaiting_customer'
      ? 'under_review'
      : input.disputeCase.status;
  const deadlines = evidenceCompleted
    ? updateDeadline(input.disputeCase.deadlines, 'evidence_by', {
        status: 'met',
        completedAt: input.submittedAt,
      })
    : input.disputeCase.deadlines;
  const notes: PaymentsDisputeNote[] = input.note
    ? [
        ...input.disputeCase.notes,
        {
          noteId: defaultCreateId('pay_dispute_note'),
          createdAt: input.submittedAt,
          authorRole: 'customer',
          authorUserId: input.submittedByUserId ?? null,
          visibility: 'customer',
          body: input.note,
        },
      ]
    : input.disputeCase.notes;
  const timeline = [
    ...input.disputeCase.timeline,
    createTimelineItem({
      occurredAt: input.submittedAt,
      actor: 'customer',
      eventType: 'evidence_submitted',
      title: 'Evidence submitted',
      detail:
        input.slotSubmissions.length === 1
          ? 'One evidence slot was updated.'
          : `${input.slotSubmissions.length} evidence slots were updated.`,
      metadata: {
        slotIds: [...slotIds],
      },
    }),
  ];

  return withRecomputedState({
    ...input.disputeCase,
    status,
    updatedAt: input.submittedAt,
    evidenceSlots: updatedSlots,
    deadlines,
    notes,
    timeline,
  });
}

export function applyPaymentsDisputeOperatorAction(
  input: ApplyPaymentsDisputeOperatorActionInput,
): PaymentsDisputeCase {
  const actedAt = input.actedAt;
  const noteTimelineDetail = input.note ?? null;
  let status: PaymentsDisputeCaseStatus = input.disputeCase.status;
  let evidenceSlots = input.disputeCase.evidenceSlots;
  let deadlines = input.disputeCase.deadlines;
  let providerOutcome: PaymentsDisputeProviderOutcome =
    input.disputeCase.providerOutcome;
  let ledgerState = input.disputeCase.ledgerState;
  let timelineTitle = 'Operator action';
  let timelineEventType = input.actionType;

  switch (input.actionType) {
    case 'request_evidence': {
      const requestedIds = new Set(input.requestedSlotIds ?? []);
      assertPaymentsInvariant(
        requestedIds.size > 0,
        'invalid_command',
        'requestedSlotIds are required when requesting evidence',
      );
      evidenceSlots = input.disputeCase.evidenceSlots.map((slot) =>
        requestedIds.has(slot.slotId)
          ? {
              ...slot,
              status: slot.attachmentIds.length > 0 ? 'submitted' : 'required',
            }
          : slot,
      );
      deadlines = updateDeadline(deadlines, 'evidence_by', {
        dueAt: addDays(actedAt, EVIDENCE_WINDOW_DAYS),
        status: 'pending',
        completedAt: null,
      });
      status = 'awaiting_customer';
      timelineTitle = 'Evidence requested';
      break;
    }
    case 'submit_to_provider':
      status = 'submitted_to_provider';
      providerOutcome = 'submitted';
      timelineTitle = 'Submitted to provider';
      break;
    case 'issue_provisional_credit':
      status = 'provisional_credit_issued';
      ledgerState = {
        ...ledgerState,
        recommendedDecision: 'provisional_credit',
        ledgerActionPending: true,
      };
      deadlines = updateDeadline(deadlines, 'provisional_credit_by', {
        status: 'met',
        completedAt: actedAt,
      });
      timelineTitle = 'Provisional credit selected';
      break;
    case 'record_provider_outcome':
      assertPaymentsInvariant(
        !!input.providerOutcome && input.providerOutcome !== 'none',
        'invalid_command',
        'providerOutcome is required when recording a provider outcome',
      );
      providerOutcome = input.providerOutcome;
      status = 'under_review';
      timelineTitle = 'Provider outcome recorded';
      break;
    case 'resolve_with_reversal':
      status = 'resolved';
      ledgerState = {
        ...ledgerState,
        recommendedDecision: 'reversal',
        ledgerActionPending: true,
      };
      timelineTitle = 'Resolution selected: reversal';
      break;
    case 'resolve_with_refund':
      status = 'resolved';
      ledgerState = {
        ...ledgerState,
        recommendedDecision: 'refund',
        ledgerActionPending: true,
      };
      timelineTitle = 'Resolution selected: refund';
      break;
    case 'deny_claim':
      status = 'resolved';
      ledgerState = {
        ...ledgerState,
        recommendedDecision: 'none',
        ledgerActionPending: false,
      };
      timelineTitle = 'Claim denied';
      break;
    case 'close_case':
      status = 'closed';
      timelineTitle = 'Case closed';
      break;
  }

  const notes = input.note
    ? [
        ...input.disputeCase.notes,
        {
          noteId: defaultCreateId('pay_dispute_note'),
          createdAt: actedAt,
          authorRole: 'operator' as const,
          authorUserId: input.actorUserId ?? null,
          visibility: 'internal' as const,
          body: input.note,
        },
      ]
    : input.disputeCase.notes;

  const updatedCase = withRecomputedState({
    ...input.disputeCase,
    status,
    updatedAt: actedAt,
    evidenceSlots,
    deadlines,
    providerOutcome,
    notes,
    ledgerState,
    timeline: [
      ...input.disputeCase.timeline,
      createTimelineItem({
        occurredAt: actedAt,
        actor: 'operator',
        eventType: timelineEventType,
        title: timelineTitle,
        detail: noteTimelineDetail,
        metadata: {
          providerOutcome:
            input.actionType === 'record_provider_outcome'
              ? input.providerOutcome
              : null,
          requestedSlotIds: input.requestedSlotIds ?? [],
        },
      }),
    ],
  });

  return updatedCase;
}
