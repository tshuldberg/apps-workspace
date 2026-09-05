import {
  buildPaymentsDisputeOpsChecklist,
  buildPaymentsLaunchEvidenceCaptureEligibility,
  createInMemoryPaymentsLaunchEvidenceStore,
  buildPaymentsLaunchOperatorRunbook,
  buildPaymentsLaunchReleaseEvidenceReview,
  buildPaymentsLaunchReleaseApprovalPacket,
  buildPaymentsOpsConsoleViewModel,
  runPaymentsLaunchReconciliationStatusMatrix,
  runPaymentsProviderSandboxDrills,
} from '@mylife/payments';
import {
  PaymentsLine,
  PaymentsPanel,
  PaymentsWebShell,
} from '../../payments/components';

const LAUNCH_REVIEW_NOW = '2026-04-24T16:30:00.000Z';
const RELEASE_EVIDENCE_KINDS = [
  'legal_review',
  'pilot_approval',
  'release_owner_signoff',
  'hidden_state_acknowledgement',
] as const;

function createIdFactory() {
  let counter = 0;
  return (prefix: string) => `${prefix}_ops_review_${++counter}`;
}

async function buildPaymentsOpsReviewViewModel() {
  const now = () => new Date(LAUNCH_REVIEW_NOW);
  const providerDrillReport = await runPaymentsProviderSandboxDrills({
    providerProfile: 'synctera',
    now,
    createId: createIdFactory(),
  });
  const reconciliationStatusMatrixReport =
    await runPaymentsLaunchReconciliationStatusMatrix({
      providerProfile: 'synctera',
      now,
      createId: createIdFactory(),
    });
  const disputeOpsChecklist = buildPaymentsDisputeOpsChecklist({
    ledgerActionApproverRole: 'payments_ops_lead',
    ledgerActionDualControl: true,
    provisionalCreditWindowDays: 10,
    closureNoticeTemplateApproved: true,
    auditEvidenceSinkConfigured: true,
    generatedAt: providerDrillReport.generatedAt,
  });
  const releaseApprovalPacket = buildPaymentsLaunchReleaseApprovalPacket({
    providerDrillReport,
    reconciliationStatusMatrixReport,
    disputeOpsChecklist,
    expectedProviderProfile: 'synctera',
    generatedAt: LAUNCH_REVIEW_NOW,
  });
  const launchRunbook = buildPaymentsLaunchOperatorRunbook({
    providerDrillReport,
    reconciliationStatusMatrixReport,
    disputeOpsChecklist,
    releaseApprovalPacket,
    expectedProviderProfile: 'synctera',
    generatedAt: LAUNCH_REVIEW_NOW,
  });
  const launchReleaseEvidenceReview = buildPaymentsLaunchReleaseEvidenceReview({
    providerDrillReport,
    reconciliationStatusMatrixReport,
    disputeOpsChecklist,
    releaseEvidence: {
      legalReview: null,
      pilotApproval: null,
      releaseOwnerSignoff: null,
      hiddenStateAcknowledgement: null,
    },
    expectedProviderProfile: 'synctera',
    paymentsFeatureHidden: true,
    generatedAt: LAUNCH_REVIEW_NOW,
  });
  const releaseEvidenceStore = createInMemoryPaymentsLaunchEvidenceStore();
  const releaseEvidenceFilter = releaseApprovalPacket.automatedEvidenceGeneratedAt
    ? {
        providerProfile: 'synctera' as const,
        automatedEvidenceGeneratedAt: releaseApprovalPacket.automatedEvidenceGeneratedAt,
      }
    : {
        providerProfile: 'synctera' as const,
      };
  const releaseEvidenceRecords = releaseEvidenceStore.list(releaseEvidenceFilter);
  const launchReleaseEvidenceCaptureEligibility = RELEASE_EVIDENCE_KINDS.map((kind) =>
    buildPaymentsLaunchEvidenceCaptureEligibility({
      kind,
      evidenceId: null,
      idempotencyKey: null,
      operatorIdentity: null,
      reviewerIdentity: null,
      providerProfile: 'synctera',
      automatedEvidenceGeneratedAt:
        releaseApprovalPacket.automatedEvidenceGeneratedAt,
      releaseTicketId: null,
      targetReleaseState: null,
      existingRecords: releaseEvidenceRecords,
    }),
  );

  return buildPaymentsOpsConsoleViewModel({
    breaks: [],
    disputes: [],
    providerEvents: [],
    remittanceExceptionIds: ['remit_timeout_1'],
    complianceHoldWalletIds: ['wallet_review_1'],
    launchRunbook,
    launchEvidenceTimestamps: {
      provider_drills: providerDrillReport.generatedAt,
      reconciliation_matrix: reconciliationStatusMatrixReport.generatedAt,
      dispute_ops: disputeOpsChecklist.generatedAt,
      approval_packet: releaseApprovalPacket.generatedAt,
      automated_evidence: releaseApprovalPacket.automatedEvidenceGeneratedAt,
    },
    launchReleaseEvidenceReview,
    launchReleaseEvidenceRecords: releaseEvidenceRecords,
    launchReleaseEvidenceCaptureEligibility,
  });
}

function toneForStatus(status: string) {
  if (status === 'passed' || status === 'ready' || status === 'Eligible') {
    return styles.statusPassed;
  }
  if (status === 'blocked' || status === 'Blocked') {
    return styles.statusBlocked;
  }
  return styles.statusNeutral;
}

export default async function PaymentsOpsPage() {
  const ops = await buildPaymentsOpsReviewViewModel();
  const launchReview = ops.launchReview;
  const releaseEvidenceReview = ops.launchReleaseEvidenceReview;
  const captureEligibility = ops.launchReleaseEvidenceCaptureEligibility;
  const releaseEvidenceHistory = ops.launchReleaseEvidenceHistory;

  return (
    <PaymentsWebShell
      title={ops.title}
      subtitle="Operator queues and launch evidence for payments review."
    >
      <PaymentsPanel eyebrow="Queues" title={ops.traceSearchPlaceholder}>
        {ops.queues.map((queue) => (
          <PaymentsLine
            key={queue.id}
            label={queue.label}
            value={`${queue.count} · ${queue.highestSeverity}`}
          />
        ))}
      </PaymentsPanel>

      {launchReview ? (
        <>
          <PaymentsPanel eyebrow="Launch review" title={launchReview.decisionLabel}>
            <div style={styles.summaryGrid}>
              <PaymentsLine label="Decision" value={launchReview.decisionLabel} />
              <PaymentsLine label="Provider profile" value={launchReview.providerProfileLabel} />
              <PaymentsLine label="Release state" value={launchReview.hiddenStateLabel} />
              <PaymentsLine label="Generated at" value={launchReview.generatedAt} />
            </div>
            <p style={styles.summaryText}>{launchReview.summary}</p>
          </PaymentsPanel>

          <PaymentsPanel eyebrow="Evidence timestamps" title="Current launch packet">
            <div style={styles.timestampGrid}>
              {launchReview.evidenceTimestamps.map((line) => (
                <div key={line.id} style={styles.timestampLine}>
                  <span style={styles.timestampLabel}>{line.label}</span>
                  <strong style={line.missing ? styles.missingValue : styles.timestampValue}>
                    {line.value}
                  </strong>
                </div>
              ))}
            </div>
          </PaymentsPanel>

          {releaseEvidenceReview ? (
            <PaymentsPanel
              eyebrow={releaseEvidenceReview.title}
              title={releaseEvidenceReview.statusLabel}
            >
              <div style={styles.summaryGrid}>
                <PaymentsLine label="Review state" value={releaseEvidenceReview.statusLabel} />
                <PaymentsLine label="Provider profile" value={releaseEvidenceReview.providerProfileLabel} />
                <PaymentsLine label="Automated evidence" value={releaseEvidenceReview.automatedEvidenceLabel} />
                <PaymentsLine label="Release ticket" value={releaseEvidenceReview.releaseTicketLabel} />
                <PaymentsLine label="Target state" value={releaseEvidenceReview.targetReleaseStateLabel} />
                <PaymentsLine label="Registry state" value={releaseEvidenceReview.hiddenStateLabel} />
              </div>
              <p style={styles.summaryText}>{releaseEvidenceReview.summary}</p>
              <div style={styles.releaseEvidenceList}>
                {releaseEvidenceReview.items.map((item) => (
                  <div key={item.id} style={styles.releaseEvidenceItem}>
                    <div style={styles.sectionHeader}>
                      <strong style={styles.reasonTitle}>{item.label}</strong>
                      <span style={{ ...styles.statusPill, ...toneForStatus(item.status) }}>
                        {item.status}
                      </span>
                    </div>
                    <span style={styles.reasonEvidence}>{item.evidence}</span>
                  </div>
                ))}
              </div>
            </PaymentsPanel>
          ) : null}

          <PaymentsPanel
            eyebrow={captureEligibility.title}
            title={captureEligibility.summary}
          >
            <div style={styles.releaseEvidenceList}>
              {captureEligibility.items.map((item) => (
                <div key={item.kind} style={styles.releaseEvidenceItem}>
                  <div style={styles.sectionHeader}>
                    <strong style={styles.reasonTitle}>{item.kindLabel}</strong>
                    <span style={{ ...styles.statusPill, ...toneForStatus(item.statusLabel) }}>
                      {item.statusLabel}
                    </span>
                  </div>
                  <div style={styles.summaryGrid}>
                    <PaymentsLine label="Required roles" value={item.requiredRolesLabel} />
                    <PaymentsLine label="Operator" value={item.operatorLabel} />
                    <PaymentsLine label="Reviewer" value={item.reviewerLabel} />
                    <PaymentsLine label="Provider profile" value={item.providerProfileLabel} />
                    <PaymentsLine label="Automated evidence" value={item.automatedEvidenceLabel} />
                    <PaymentsLine label="Release ticket" value={item.releaseTicketLabel} />
                    <PaymentsLine label="Target state" value={item.targetReleaseStateLabel} />
                    <PaymentsLine label="Idempotency key" value={item.idempotencyKeyLabel} />
                  </div>
                  {item.rejectionReasons.length > 0 ? (
                    <div style={styles.captureReasonList}>
                      {item.rejectionReasons.map((reason) => (
                        <span key={reason.id} style={styles.captureReason}>
                          <strong>{reason.label}</strong>
                          {reason.evidence}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </PaymentsPanel>

          <PaymentsPanel
            eyebrow={releaseEvidenceHistory.title}
            title={`${releaseEvidenceHistory.recordCount} immutable record${
              releaseEvidenceHistory.recordCount === 1 ? '' : 's'
            }`}
          >
            <p style={styles.summaryText}>{releaseEvidenceHistory.summary}</p>
            {releaseEvidenceHistory.items.length > 0 ? (
              <div style={styles.releaseEvidenceList}>
                {releaseEvidenceHistory.items.map((item) => (
                  <div key={item.evidenceId} style={styles.releaseEvidenceItem}>
                    <div style={styles.sectionHeader}>
                      <strong style={styles.reasonTitle}>{item.kindLabel}</strong>
                      <span style={styles.fingerprint}>{item.payloadFingerprint}</span>
                    </div>
                    <div style={styles.summaryGrid}>
                      <PaymentsLine label="Evidence id" value={item.evidenceId} />
                      <PaymentsLine label="Captured by" value={item.capturedBy} />
                      <PaymentsLine label="Operator" value={item.operatorLabel} />
                      <PaymentsLine label="Reviewer" value={item.reviewerLabel} />
                      <PaymentsLine label="Captured at" value={item.capturedAt} />
                      <PaymentsLine label="Provider profile" value={item.providerProfileLabel} />
                      <PaymentsLine label="Automated evidence" value={item.automatedEvidenceLabel} />
                      <PaymentsLine label="Release ticket" value={item.releaseTicketLabel} />
                      <PaymentsLine label="Target state" value={item.targetReleaseStateLabel} />
                      <PaymentsLine label="Audit entry" value={item.auditEntryLabel} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.emptyHistory}>
                The ops route is not seeded with legal, pilot, release-owner, or hidden-state approval records.
              </p>
            )}
          </PaymentsPanel>

          <PaymentsPanel
            eyebrow="Do not launch"
            title={`${launchReview.doNotLaunchReasons.length} active blocker${
              launchReview.doNotLaunchReasons.length === 1 ? '' : 's'
            }`}
          >
            {launchReview.doNotLaunchReasons.map((reason) => (
              <div key={reason.id} style={styles.reasonRow}>
                <strong style={styles.reasonTitle}>{reason.label}</strong>
                <span style={styles.reasonEvidence}>{reason.evidence}</span>
              </div>
            ))}
          </PaymentsPanel>

          <PaymentsPanel eyebrow="Sections" title="Runbook evidence">
            <div style={styles.sectionList}>
              {launchReview.sections.map((section) => (
                <section key={section.id} style={styles.sectionRow}>
                  <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>{section.title}</h3>
                    <span style={{ ...styles.statusPill, ...toneForStatus(section.status) }}>
                      {section.status}
                    </span>
                  </div>
                  <p style={styles.sectionSummary}>{section.summary}</p>
                  {section.evidencePreview.length > 0 ? (
                    <ul style={styles.evidenceList}>
                      {section.evidencePreview.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  <span style={styles.evidenceCount}>
                    {section.evidenceLineCount} evidence line
                    {section.evidenceLineCount === 1 ? '' : 's'}
                  </span>
                </section>
              ))}
            </div>
          </PaymentsPanel>
        </>
      ) : null}
    </PaymentsWebShell>
  );
}

const styles = {
  summaryGrid: {
    display: 'grid',
    gap: 8,
  },
  summaryText: {
    margin: 0,
    color: 'rgba(245,251,248,0.72)',
    lineHeight: 1.5,
  },
  timestampGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 10,
  },
  timestampLine: {
    display: 'grid',
    gap: 6,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 12,
    background: 'rgba(255,255,255,0.03)',
  },
  timestampLabel: {
    color: 'rgba(245,251,248,0.60)',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
  },
  timestampValue: {
    color: '#F5FBF8',
    fontSize: 13,
    overflowWrap: 'anywhere' as const,
  },
  missingValue: {
    color: '#FCA5A5',
    fontSize: 13,
  },
  reasonRow: {
    display: 'grid',
    gap: 6,
    borderLeft: '3px solid #FCA5A5',
    padding: '10px 12px',
    background: 'rgba(127,29,29,0.22)',
    borderRadius: 8,
  },
  reasonTitle: {
    color: '#FEE2E2',
  },
  reasonEvidence: {
    color: 'rgba(254,226,226,0.78)',
    lineHeight: 1.45,
  },
  fingerprint: {
    color: 'rgba(245,251,248,0.62)',
    fontSize: 12,
    fontWeight: 800,
    overflowWrap: 'anywhere' as const,
  },
  emptyHistory: {
    margin: 0,
    color: 'rgba(245,251,248,0.58)',
    lineHeight: 1.45,
  },
  releaseEvidenceList: {
    display: 'grid',
    gap: 10,
  },
  releaseEvidenceItem: {
    display: 'grid',
    gap: 6,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
  },
  captureReasonList: {
    display: 'grid',
    gap: 6,
  },
  captureReason: {
    display: 'grid',
    gap: 3,
    color: 'rgba(254,226,226,0.80)',
    lineHeight: 1.4,
    borderLeft: '3px solid rgba(252,165,165,0.72)',
    padding: '8px 10px',
    background: 'rgba(127,29,29,0.18)',
    borderRadius: 8,
  },
  sectionList: {
    display: 'grid',
    gap: 12,
  },
  sectionRow: {
    display: 'grid',
    gap: 8,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 12,
    background: 'rgba(255,255,255,0.03)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    letterSpacing: 0,
  },
  statusPill: {
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
  },
  statusPassed: {
    color: '#BBF7D0',
    background: 'rgba(22,101,52,0.36)',
  },
  statusBlocked: {
    color: '#FECACA',
    background: 'rgba(127,29,29,0.36)',
  },
  statusNeutral: {
    color: '#BAE6FD',
    background: 'rgba(14,116,144,0.28)',
  },
  sectionSummary: {
    margin: 0,
    color: 'rgba(245,251,248,0.72)',
    lineHeight: 1.45,
  },
  evidenceList: {
    margin: 0,
    paddingLeft: 18,
    color: 'rgba(245,251,248,0.68)',
    lineHeight: 1.45,
  },
  evidenceCount: {
    color: 'rgba(245,251,248,0.56)',
    fontSize: 12,
    fontWeight: 700,
  },
};
