import { describe, expect, it, vi } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../test/vitest/function-quality';
import {
  YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
  YEARN_USER_MESSAGE_KIND,
  type YearnUserMessageCiphertext,
} from '../yearnIntroMessage';
import { YearnRepository } from '../yearnRepository';

const matchId = '33333333-3333-3333-3333-333333333333';
const senderId = '55555555-5555-5555-5555-555555555555';

function makeCiphertext(index = 0): YearnUserMessageCiphertext {
  return {
    version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
    kind: YEARN_USER_MESSAGE_KIND,
    algorithm: 'xchacha20poly1305-double-ratchet',
    senderDeviceId: 'sender-device-1',
    recipientDeviceId: 'recipient-device-1',
    ciphertext: `base64-message-ciphertext-${index}`,
    nonce: `base64-message-nonce-${index}`,
    header: {
      messageNumber: index,
      previousChainLength: Math.max(0, index - 1),
    },
  };
}

function makeMessageRow(index = 0) {
  const suffix = String(index + 1).padStart(12, '0');
  return {
    id: `44444444-4444-4444-4444-${suffix}`,
    match_id: matchId,
    sender_id: senderId,
    kind: 'user',
    ciphertext: makeCiphertext(index),
    source_like_id: null,
    read_at: null,
    created_at: `2026-05-31T12:${String(index % 60).padStart(2, '0')}:00Z`,
  };
}

function repositoryForFetch(rows: ReturnType<typeof makeMessageRow>[]) {
  const orderById = vi.fn().mockResolvedValue({ data: rows, error: null });
  const orderByCreatedAt = vi.fn().mockReturnValue({ order: orderById });
  const eq = vi.fn().mockReturnValue({ order: orderByCreatedAt });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return {
    repo: new YearnRepository({ from } as never),
    mocks: { eq, from, orderByCreatedAt, orderById },
  };
}

function repositoryForWrite(row = makeMessageRow(0)) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  const getUser = vi.fn().mockResolvedValue({
    data: { user: { id: senderId } },
    error: null,
  });
  return {
    repo: new YearnRepository({ auth: { getUser }, from } as never),
    mocks: { getUser, insert },
  };
}

describe('YearnRepository encrypted message function quality gate', () => {
  it('matches contract behavior for encrypted chat reads and writes', async () => {
    const { repo: readRepo, mocks: readMocks } = repositoryForFetch([makeMessageRow(0)]);

    await expect(readRepo.fetchEncryptedMessages(matchId)).resolves.toMatchObject([
      {
        matchId,
        senderId,
        kind: 'user',
        ciphertext: makeCiphertext(0),
      },
    ]);
    expect(readMocks.from).toHaveBeenCalledWith('messages_ciphertext');
    expect(readMocks.eq).toHaveBeenCalledWith('match_id', matchId);

    const { repo: writeRepo, mocks: writeMocks } = repositoryForWrite();
    await expect(writeRepo.sendEncryptedMessage(matchId, makeCiphertext(1)))
      .resolves.toMatchObject({
        matchId,
        senderId,
        kind: 'user',
      });
    expect(writeMocks.insert).toHaveBeenCalledWith({
      match_id: matchId,
      sender_id: senderId,
      kind: 'user',
      ciphertext: makeCiphertext(1),
    });
  });

  it('passes deterministic fuzz invariants for encrypted chat reads', async () => {
    await runDeterministicFuzz({
      label: 'fetchEncryptedMessages fuzz',
      iterations: 80,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 0, 40);
        return Array.from({ length: size }, (_, index) => makeMessageRow(index));
      },
      assertCase: async (rows) => {
        const { repo } = repositoryForFetch(rows);
        const result = await repo.fetchEncryptedMessages(matchId);
        expect(result).toHaveLength(rows.length);
        for (const [index, message] of result.entries()) {
          expect(message.id).toBe(rows[index]?.id);
          expect(message.ciphertext.kind).toBe(YEARN_USER_MESSAGE_KIND);
        }
      },
    });
  });

  it('stays within linear complexity slope budget for encrypted chat reads', async () => {
    await assertComplexitySlope({
      label: 'fetchEncryptedMessages',
      sizes: [200, 400, 800],
      expected: 'linear',
      maxRatios: [3.8, 3.8],
      warmupRuns: 3,
      sampleRuns: 12,
      setup: (size) => repositoryForFetch(
        Array.from({ length: size }, (_, index) => makeMessageRow(index)),
      ).repo,
      run: async (repo) => {
        await repo.fetchEncryptedMessages(matchId);
      },
    });
  });

  it('stays within memory budget under repeated encrypted chat reads', async () => {
    await assertMemoryBudget({
      label: 'fetchEncryptedMessages',
      repeats: 20,
      maxHeapDeltaBytes: 24 * 1024 * 1024,
      setup: () => repositoryForFetch(
        Array.from({ length: 40 }, (_, index) => makeMessageRow(index)),
      ).repo,
      run: async (repo) => {
        await repo.fetchEncryptedMessages(matchId);
      },
    });
  });
});
