import { describe, expect, it } from 'vitest';

import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  createInMemoryPaymentsLaunchEvidenceStore,
  type CapturePaymentsLaunchEvidenceInput,
  type PaymentsLaunchEvidenceOperatorIdentity,
} from '../evidence-store';

const EVIDENCE_TIME = '2026-04-24T16:30:00.000Z';
const APPROVAL_TIME = '2026-04-24T16:29:00.000Z';
const LEGAL_OPERATOR: PaymentsLaunchEvidenceOperatorIdentity = {
  actorId: 'operator_legal',
  displayName: 'Legal Reviewer',
  email: 'counsel@mylife.app',
  roles: ['legal_reviewer'],
};

function makeCommand(index: number): CapturePaymentsLaunchEvidenceInput {
  return {
    evidenceId: `evidence_legal_${index}`,
    idempotencyKey: `idem_legal_${index}`,
    kind: 'legal_review',
    capturedAt: '2026-04-24T16:31:00.000Z',
    operatorIdentity: LEGAL_OPERATOR,
    providerProfile: 'synctera',
    automatedEvidenceGeneratedAt: EVIDENCE_TIME,
    releaseTicketId: 'PAY-RELEASE-2026-04-24',
    targetReleaseState: 'public_beta',
    payload: {
      approvedBy: 'counsel@mylife.app',
      approvedAt: APPROVAL_TIME,
      automatedEvidenceGeneratedAt: EVIDENCE_TIME,
      providerProfile: 'synctera',
      copySetVersion: `payments-copy-${index}`,
      counselMatterId: `legal-mypay-launch-${index}`,
      storedBalanceCopyApproved: true,
      partnerBankCopyApproved: true,
      custodialCopyApproved: true,
      remittanceCancellationCopyApproved: true,
      errorResolutionCopyApproved: true,
    },
  };
}

function makeCommands(size: number): CapturePaymentsLaunchEvidenceInput[] {
  return Array.from({ length: size }, (_, index) => makeCommand(index));
}

async function captureAll(
  commands: CapturePaymentsLaunchEvidenceInput[],
): Promise<number> {
  const store = createInMemoryPaymentsLaunchEvidenceStore();

  for (const command of commands) {
    await store.capture(command);
  }

  return store.list().length;
}

describe('createInMemoryPaymentsLaunchEvidenceStore function quality gate', () => {
  it('matches contract behavior for capture, replay, and mutation rejection', async () => {
    const store = createInMemoryPaymentsLaunchEvidenceStore();
    const command = makeCommand(1);
    const captured = await store.capture(command);
    const replayed = await store.capture({
      ...command,
      capturedAt: '2026-04-24T16:35:00.000Z',
    });
    const conflict = await store.capture({
      ...command,
      idempotencyKey: 'idem_legal_conflict',
      targetReleaseState: 'ga',
    });

    expect(captured.status).toBe('captured');
    expect(replayed.status).toBe('idempotent_replay');
    expect(conflict.errorCode).toBe('evidence_id_conflict');
    expect(store.list()).toHaveLength(1);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'createInMemoryPaymentsLaunchEvidenceStore fuzz',
      iterations: 120,
      seed: 42,
      makeCase: (rng, index) => {
        const command = makeCommand(index);
        const mode = randomInt(rng, 0, 4);

        if (mode === 1) {
          command.targetReleaseState = 'hidden';
        }
        if (mode === 2) {
          command.payload = {
            ...command.payload,
            providerProfile: 'unit',
          };
        }
        if (mode === 3) {
          command.idempotencyKey = '';
        }
        if (mode === 4) {
          command.operatorIdentity = {
            actorId: 'operator_unprivileged',
            roles: ['payments_ops'],
          };
        }

        return { command, shouldCapture: mode === 0 };
      },
      assertCase: async ({ command, shouldCapture }) => {
        const store = createInMemoryPaymentsLaunchEvidenceStore();
        const result = await store.capture(command);

        expect(result.status).toBe(shouldCapture ? 'captured' : 'rejected');
        expect(store.list()).toHaveLength(shouldCapture ? 1 : 0);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'createInMemoryPaymentsLaunchEvidenceStore',
      sizes: [50, 100, 200],
      expected: 'linear',
      maxRatios: [5.5, 5.5],
      setup: makeCommands,
      run: async (commands) => {
        await captureAll(commands);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'createInMemoryPaymentsLaunchEvidenceStore',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeCommands(80),
      run: async (commands) => {
        await captureAll(commands);
      },
    });
  });
});
