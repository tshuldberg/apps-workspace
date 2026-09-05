import { describe, expect, it, vi } from 'vitest';
import {
  YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
  YEARN_INTRO_MESSAGE_KIND,
  YEARN_USER_MESSAGE_KIND,
} from '../yearnIntroMessage';
import { YEARN_E2EE_KEY_ALGORITHM } from '../yearnE2ee';
import { YearnBoostActivationError, YearnRepository } from '../yearnRepository';

const deckRow = {
  id: '11111111-1111-1111-1111-111111111111',
  display_name: 'Iris',
  age: 28,
  pronouns: 'she/her',
  intention: 'Long-term, open to slow',
  relationship_structure: 'Monogamous',
  photos: [{ symbol: 'book.closed.fill', tint_hex: '#E8856B', path: null }],
  prompts: [{ question: 'A letter', answer: 'A first paragraph.' }],
  interests: ['Poetry'],
  is_verified: true,
};

const encryptedIntro = {
  version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
  kind: YEARN_INTRO_MESSAGE_KIND,
  algorithm: 'xchacha20poly1305-double-ratchet',
  senderDeviceId: 'sender-device-1',
  recipientDeviceId: 'recipient-device-1',
  ciphertext: 'base64-ciphertext',
  nonce: 'base64-nonce',
} as const;

const encryptedMessage = {
  version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
  kind: YEARN_USER_MESSAGE_KIND,
  algorithm: 'xchacha20poly1305-double-ratchet',
  senderDeviceId: 'sender-device-1',
  recipientDeviceId: 'recipient-device-1',
  ciphertext: 'base64-message-ciphertext',
  nonce: 'base64-message-nonce',
  header: {
    messageNumber: 2,
    previousChainLength: 1,
  },
} as const;

const matchId = '33333333-3333-3333-3333-333333333333';
const messageId = '44444444-4444-4444-4444-444444444444';
const senderId = '55555555-5555-5555-5555-555555555555';

const e2eeDeviceKey = {
  userId: senderId,
  deviceId: 'sender-device-public-key',
  publicKey: 'sender-device-public-key',
  keyAlgorithm: YEARN_E2EE_KEY_ALGORITHM,
  createdAt: '2026-05-31T12:00:00.000Z',
} as const;

const e2eeDeviceKeyRow = {
  user_id: deckRow.id,
  device_id: 'recipient-device-public-key',
  public_key: 'recipient-device-public-key',
  key_algorithm: YEARN_E2EE_KEY_ALGORITHM,
  created_at: '2026-05-31T12:00:00.000Z',
  last_seen_at: '2026-05-31T12:01:00.000Z',
} as const;

function repositoryWithRpc(rpc: ReturnType<typeof vi.fn>): YearnRepository {
  return new YearnRepository({ rpc } as never);
}

function repositoryWithInvoke(invoke: ReturnType<typeof vi.fn>): YearnRepository {
  return new YearnRepository({ functions: { invoke } } as never);
}

describe('YearnRepository', () => {
  it('fetches the signed-in users profile row', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: deckRow.id,
        display_name: 'Iris',
        birthday: '1995-05-20',
        pronouns: 'she/her',
        custom_pronouns: '',
        intention: 'Long-term, open to slow',
        relationship_structure: 'Monogamous',
        photos: deckRow.photos,
        prompts: deckRow.prompts,
        interests: deckRow.interests,
        is_verified: true,
        is_paused: false,
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const repo = new YearnRepository({ from } as never);

    await expect(repo.fetchMyProfile(deckRow.id)).resolves.toMatchObject({
      id: deckRow.id,
      displayName: 'Iris',
      birthday: '1995-05-20',
      relationshipStructure: 'Monogamous',
    });

    expect(from).toHaveBeenCalledWith('profiles');
    expect(eq).toHaveBeenCalledWith('id', deckRow.id);
  });

  it('upserts an onboarding profile without writing server-owned verification', async () => {
    const savedRow = {
      id: deckRow.id,
      display_name: 'Iris',
      birthday: '1995-05-20',
      pronouns: 'she/her',
      custom_pronouns: '',
      intention: 'Long-term, open to slow',
      relationship_structure: 'Monogamous',
      photos: deckRow.photos,
      prompts: deckRow.prompts,
      interests: deckRow.interests,
      is_verified: false,
      is_paused: false,
    };
    const single = vi.fn().mockResolvedValue({ data: savedRow, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });
    const repo = new YearnRepository({ from } as never);

    const result = await repo.upsertMyProfile(deckRow.id, {
      displayName: 'Iris',
      birthday: '1995-05-20',
      pronouns: 'she/her',
      customPronouns: '',
      genderIdentities: ['Woman'],
      orientationIdentities: [],
      identityVisibility: { genderIdentities: true },
      orientationConsentGrantedAt: null,
      orientationConsentWithdrawnAt: null,
      intention: 'Long-term, open to slow',
      relationshipStructure: 'Monogamous',
      photos: deckRow.photos.map((photo) => ({
        symbol: photo.symbol ?? '',
        tint_hex: photo.tint_hex ?? '#E8856B',
        path: null,
        show_on_profile: true,
      })),
      prompts: deckRow.prompts.map((prompt) => ({
        ...prompt,
        show_on_profile: true,
      })),
      interests: deckRow.interests,
      isPaused: false,
    });

    expect(result.displayName).toBe('Iris');
    expect(upsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ is_verified: expect.anything() }),
      { onConflict: 'id' },
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: deckRow.id,
        display_name: 'Iris',
        birthday: '1995-05-20',
        custom_pronouns: '',
        gender_identities: ['Woman'],
        orientation_identities: [],
        identity_visibility: { genderIdentities: true },
        orientation_consent_granted_at: null,
        orientation_consent_withdrawn_at: null,
      }),
      { onConflict: 'id' },
    );
  });

  it('fetches and maps discover profiles from the existing RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [deckRow], error: null });
    const repo = repositoryWithRpc(rpc);

    await expect(repo.fetchDeck(12)).resolves.toEqual([
      {
        id: deckRow.id,
        displayName: 'Iris',
        age: 28,
        pronouns: 'she/her',
        intention: 'Long-term, open to slow',
        relationshipStructure: 'Monogamous',
        photos: deckRow.photos,
        prompts: deckRow.prompts,
        interests: ['Poetry'],
        isVerified: true,
      },
    ]);
    expect(rpc).toHaveBeenCalledWith('discover_profiles', { p_limit: 12 });
  });

  it('maps incoming likes with sender profile data', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          ...deckRow,
          like_id: '22222222-2222-2222-2222-222222222222',
          note: 'Your bookstore prompt got me.',
          created_at: '2026-05-30T12:00:00Z',
          sender_id: deckRow.id,
        },
      ],
      error: null,
    });
    const repo = repositoryWithRpc(rpc);

    const likes = await repo.fetchIncomingLikes();

    expect(likes[0]?.id).toBe('22222222-2222-2222-2222-222222222222');
    expect(likes[0]?.intro).toBe('Your bookstore prompt got me.');
    expect(likes[0]?.encryptedIntro).toBeNull();
    expect(likes[0]?.profile.displayName).toBe('Iris');
    expect(rpc).toHaveBeenCalledWith('incoming_likes');
  });

  it('maps encrypted incoming intro envelopes for the future E2EE inbox path', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          ...deckRow,
          like_id: '22222222-2222-2222-2222-222222222222',
          note: null,
          intro_ciphertext: encryptedIntro,
          created_at: '2026-05-30T12:00:00Z',
          sender_id: deckRow.id,
        },
      ],
      error: null,
    });
    const repo = repositoryWithRpc(rpc);

    const likes = await repo.fetchIncomingLikes();

    expect(likes[0]?.intro).toBeNull();
    expect(likes[0]?.encryptedIntro).toEqual(encryptedIntro);
  });

  it('sends no-intro likes through the authenticated write RPC and maps a mutual match', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          ...deckRow,
          match_id: '33333333-3333-3333-3333-333333333333',
          matched_at: '2026-05-30T12:00:00Z',
          other_id: deckRow.id,
          is_pending: false,
        },
      ],
      error: null,
    });
    const repo = repositoryWithRpc(rpc);

    await expect(repo.sendLike(deckRow.id))
      .resolves.toMatchObject({
        id: '33333333-3333-3333-3333-333333333333',
        profile: {
          id: deckRow.id,
          displayName: 'Iris',
        },
        isPending: false,
      });
    expect(rpc).toHaveBeenCalledWith('send_like', {
      p_profile_id: deckRow.id,
      p_note: null,
    });
  });

  it('rejects plaintext intro notes before calling the write RPC', async () => {
    const rpc = vi.fn();
    const repo = repositoryWithRpc(rpc);

    await expect(repo.sendLike(deckRow.id, 'Your bookstore prompt got me.')).rejects.toThrow(
      'Plaintext intros are disabled. Send encrypted intro ciphertext instead.',
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('can send a like with an encrypted intro envelope without a plaintext note', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const repo = repositoryWithRpc(rpc);

    await expect(repo.sendLike(deckRow.id, null, encryptedIntro)).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledWith('send_like', {
      p_profile_id: deckRow.id,
      p_note: null,
      p_intro_ciphertext: encryptedIntro,
    });
  });

  it('rejects plaintext-bearing encrypted intro envelopes before calling the write RPC', async () => {
    const rpc = vi.fn();
    const repo = repositoryWithRpc(rpc);

    await expect(repo.sendLike(deckRow.id, null, {
      ...encryptedIntro,
      header: { note: 'This should stay local.' },
    })).rejects.toThrow(/plaintext field.*note/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('publishes the authenticated users E2EE device public key', async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: senderId } },
      error: null,
    });
    const repo = new YearnRepository({ auth: { getUser }, from } as never);

    await expect(repo.publishE2eeDeviceKey(e2eeDeviceKey)).resolves.toBeUndefined();

    expect(from).toHaveBeenCalledWith('e2ee_devices');
    expect(upsert).toHaveBeenCalledWith({
      user_id: senderId,
      device_id: e2eeDeviceKey.deviceId,
      public_key: e2eeDeviceKey.publicKey,
      key_algorithm: YEARN_E2EE_KEY_ALGORITHM,
      is_active: true,
      created_at: e2eeDeviceKey.createdAt,
      last_seen_at: expect.stringMatching(/^20\d\d-/),
    }, { onConflict: 'user_id,device_id' });
  });

  it('rejects publishing another users E2EE device public key', async () => {
    const upsert = vi.fn();
    const from = vi.fn().mockReturnValue({ upsert });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: senderId } },
      error: null,
    });
    const repo = new YearnRepository({ auth: { getUser }, from } as never);

    await expect(repo.publishE2eeDeviceKey({
      ...e2eeDeviceKey,
      userId: deckRow.id,
    })).rejects.toThrow('publishE2eeDeviceKey: cannot publish another user device key');
    expect(from).not.toHaveBeenCalled();
  });

  it('fetches the latest visible recipient E2EE device public key', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [e2eeDeviceKeyRow],
      error: null,
    });
    const repo = repositoryWithRpc(rpc);

    await expect(repo.fetchIntroRecipientDeviceKey(deckRow.id)).resolves.toEqual({
      userId: deckRow.id,
      deviceId: e2eeDeviceKeyRow.device_id,
      publicKey: e2eeDeviceKeyRow.public_key,
      keyAlgorithm: YEARN_E2EE_KEY_ALGORITHM,
      createdAt: e2eeDeviceKeyRow.created_at,
      lastSeenAt: e2eeDeviceKeyRow.last_seen_at,
    });
    expect(rpc).toHaveBeenCalledWith('intro_recipient_device_key', {
      p_profile_id: deckRow.id,
    });
  });

  it('returns null when a recipient has no published E2EE device key', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const repo = repositoryWithRpc(rpc);

    await expect(repo.fetchIntroRecipientDeviceKey(deckRow.id)).resolves.toBeNull();
  });

  it('rejects overlong intro notes before calling the write RPC', async () => {
    const rpc = vi.fn();
    const repo = repositoryWithRpc(rpc);

    await expect(repo.sendLike(deckRow.id, 'a'.repeat(301))).rejects.toThrow(
      'Intro must be 300 characters or fewer.',
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sends passes through the authenticated write RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const repo = repositoryWithRpc(rpc);

    await expect(repo.sendPass(deckRow.id)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('send_pass', {
      p_profile_id: deckRow.id,
    });
  });

  it('blocks another profile through the safety table', async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: senderId } },
      error: null,
    });
    const repo = new YearnRepository({ auth: { getUser }, from } as never);

    await expect(repo.blockUser(deckRow.id)).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledWith('blocks');
    expect(insert).toHaveBeenCalledWith({
      blocker_id: senderId,
      blocked_id: deckRow.id,
    });
  });

  it('rejects self blocks before writing safety rows', async () => {
    const insert = vi.fn();
    const from = vi.fn().mockReturnValue({ insert });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: senderId } },
      error: null,
    });
    const repo = new YearnRepository({ auth: { getUser }, from } as never);

    await expect(repo.blockUser(senderId)).rejects.toThrow(
      'blockUser: cannot target your own profile',
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('files a report with normalized details', async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: senderId } },
      error: null,
    });
    const repo = new YearnRepository({ auth: { getUser }, from } as never);

    await expect(repo.reportUser({
      reportedId: deckRow.id,
      reason: 'fake_profile',
      details: '  Photos look copied.  ',
    })).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledWith('reports');
    expect(insert).toHaveBeenCalledWith({
      reporter_id: senderId,
      reported_id: deckRow.id,
      reason: 'fake_profile',
      details: 'Photos look copied.',
    });
  });

  it('rejects invalid report reasons before authenticating', async () => {
    const getUser = vi.fn();
    const from = vi.fn();
    const repo = new YearnRepository({ auth: { getUser }, from } as never);

    await expect(repo.reportUser({
      reportedId: deckRow.id,
      reason: 'old_reason' as never,
    })).rejects.toThrow();
    expect(getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('maps pending match state from my_matches', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          ...deckRow,
          match_id: '33333333-3333-3333-3333-333333333333',
          matched_at: '2026-05-30T12:00:00Z',
          other_id: deckRow.id,
          is_pending: true,
        },
      ],
      error: null,
    });
    const repo = repositoryWithRpc(rpc);

    const matches = await repo.fetchMatches();

    expect(matches[0]?.id).toBe('33333333-3333-3333-3333-333333333333');
    expect(matches[0]?.isPending).toBe(true);
    expect(matches[0]?.profile.id).toBe(deckRow.id);
  });

  it('fetches encrypted match messages in stable chat order', async () => {
    const orderById = vi.fn().mockResolvedValue({
      data: [
        {
          id: messageId,
          match_id: matchId,
          sender_id: senderId,
          kind: 'intro',
          ciphertext: encryptedIntro,
          source_like_id: '22222222-2222-2222-2222-222222222222',
          read_at: null,
          created_at: '2026-05-31T12:00:00Z',
        },
      ],
      error: null,
    });
    const orderByCreatedAt = vi.fn().mockReturnValue({ order: orderById });
    const eq = vi.fn().mockReturnValue({ order: orderByCreatedAt });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const repo = new YearnRepository({ from } as never);

    const messages = await repo.fetchEncryptedMessages(matchId);

    expect(messages).toEqual([
      {
        id: messageId,
        matchId,
        senderId,
        kind: 'intro',
        ciphertext: encryptedIntro,
        sourceLikeId: '22222222-2222-2222-2222-222222222222',
        readAt: null,
        createdAt: '2026-05-31T12:00:00Z',
      },
    ]);
    expect(from).toHaveBeenCalledWith('messages_ciphertext');
    expect(eq).toHaveBeenCalledWith('match_id', matchId);
    expect(orderByCreatedAt).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(orderById).toHaveBeenCalledWith('id', { ascending: true });
  });

  it('sends encrypted user messages without plaintext body fields', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: messageId,
        match_id: matchId,
        sender_id: senderId,
        kind: 'user',
        ciphertext: encryptedMessage,
        source_like_id: null,
        read_at: null,
        created_at: '2026-05-31T12:05:00Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: senderId } },
      error: null,
    });
    const repo = new YearnRepository({ auth: { getUser }, from } as never);

    await expect(repo.sendEncryptedMessage(matchId, encryptedMessage)).resolves.toMatchObject({
      id: messageId,
      matchId,
      senderId,
      kind: 'user',
      ciphertext: encryptedMessage,
    });
    expect(insert).toHaveBeenCalledWith({
      match_id: matchId,
      sender_id: senderId,
      kind: 'user',
      ciphertext: encryptedMessage,
    });
  });

  it('rejects intro envelopes on the encrypted user-message send path', async () => {
    const getUser = vi.fn();
    const from = vi.fn();
    const repo = new YearnRepository({ auth: { getUser }, from } as never);

    await expect(repo.sendEncryptedMessage(matchId, encryptedIntro as never))
      .rejects.toThrow();
    expect(getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('marks only other encrypted thread messages as read', async () => {
    const isNull = vi.fn().mockResolvedValue({ data: null, error: null });
    const neq = vi.fn().mockReturnValue({ is: isNull });
    const eq = vi.fn().mockReturnValue({ neq });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: senderId } },
      error: null,
    });
    const repo = new YearnRepository({ auth: { getUser }, from } as never);

    await expect(repo.markEncryptedMessagesRead(matchId)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith({
      read_at: expect.stringMatching(/^20\d\d-/),
    });
    expect(eq).toHaveBeenCalledWith('match_id', matchId);
    expect(neq).toHaveBeenCalledWith('sender_id', senderId);
    expect(isNull).toHaveBeenCalledWith('read_at', null);
  });

  it('throws Supabase RPC errors with the backend message', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'discover_profiles: not authenticated' },
    });
    const repo = repositoryWithRpc(rpc);

    await expect(repo.fetchDeck()).rejects.toThrow('discover_profiles: not authenticated');
  });

  it('activates a boost through the signed-transaction Edge Function', async () => {
    // Arrange
    const invoke = vi.fn().mockResolvedValue({
      data: { expiresAt: '2026-07-18T12:00:00.000Z', duplicate: false },
      error: null,
    });
    const repo = repositoryWithInvoke(invoke);

    // Act
    const activation = repo.activateBoost('signed-storekit-transaction');

    // Assert
    await expect(activation).resolves.toEqual({
      expiresAt: '2026-07-18T12:00:00.000Z',
      duplicate: false,
    });
    expect(invoke).toHaveBeenCalledWith('yearn-boost-activate', {
      body: { signedTransaction: 'signed-storekit-transaction' },
    });
  });

  it('passes an idempotent duplicate boost response through', async () => {
    // Arrange
    const invoke = vi.fn().mockResolvedValue({
      data: { expiresAt: '2026-07-18T12:00:00.000Z', duplicate: true },
      error: null,
    });
    const repo = repositoryWithInvoke(invoke);

    // Act
    const activation = repo.activateBoost('signed-storekit-transaction');

    // Assert
    await expect(activation).resolves.toEqual({
      expiresAt: '2026-07-18T12:00:00.000Z',
      duplicate: true,
    });
  });

  it('uses the not-configured user copy for a 503 FunctionsHttpError', async () => {
    // Arrange
    const response = new Response(JSON.stringify({ error: 'not_configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: { context: response },
      response,
    });
    const repo = repositoryWithInvoke(invoke);

    // Act
    const activation = repo.activateBoost('signed-storekit-transaction');

    // Assert
    await expect(activation).rejects.toMatchObject({
      name: 'YearnBoostActivationError',
      code: 'not_configured',
      message: 'Boost activation is not available yet.',
    });
  });

  it.each([
    'malformed_jws',
    'bad_chain',
    'bad_signature',
    'wrong_bundle',
    'wrong_product',
    'revoked',
    'expired_cert',
    'not_consumable',
  ])('uses verification-failure copy for %s', async (errorCode) => {
    // Arrange
    const response = new Response(JSON.stringify({ error: errorCode }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: { context: response },
      response,
    });
    const repo = repositoryWithInvoke(invoke);

    // Act
    const activation = repo.activateBoost('signed-storekit-transaction');

    // Assert
    await expect(activation).rejects.toMatchObject({
      name: 'YearnBoostActivationError',
      code: 'verification_failed',
      message: 'The App Store could not verify this purchase. No boost was applied.',
    });
  });

  it('wraps transport failures in a typed activation error', async () => {
    // Arrange
    const invoke = vi.fn().mockRejectedValue(new Error('network unavailable'));
    const repo = repositoryWithInvoke(invoke);

    // Act
    const activation = repo.activateBoost('signed-storekit-transaction');

    // Assert
    await expect(activation).rejects.toBeInstanceOf(YearnBoostActivationError);
    await expect(activation).rejects.toMatchObject({
      code: 'activation_failed',
      message: 'Boost activation could not be completed. No boost was applied.',
    });
  });

  it('wraps malformed success payloads in a typed activation error', async () => {
    // Arrange
    const invoke = vi.fn().mockResolvedValue({
      data: { expiresAt: null, duplicate: 'no' },
      error: null,
    });
    const repo = repositoryWithInvoke(invoke);

    // Act
    const activation = repo.activateBoost('signed-storekit-transaction');

    // Assert
    await expect(activation).rejects.toMatchObject({
      name: 'YearnBoostActivationError',
      code: 'activation_failed',
      message: 'Boost activation could not be completed. No boost was applied.',
    });
  });

  it('deletes the signed-in account through the delete_my_account RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: senderId } },
      error: null,
    });
    const repo = new YearnRepository({ auth: { getUser }, rpc } as never);

    await expect(repo.deleteMyAccount()).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('delete_my_account');
  });

  it('surfaces delete_my_account failures and requires a session', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'delete_my_account: not authenticated' },
    });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: senderId } },
      error: null,
    });
    const repo = new YearnRepository({ auth: { getUser }, rpc } as never);
    await expect(repo.deleteMyAccount()).rejects.toThrow('delete_my_account: not authenticated');

    const signedOut = new YearnRepository({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      rpc: vi.fn(),
    } as never);
    await expect(signedOut.deleteMyAccount()).rejects.toThrow(/deleteMyAccount/);
  });
});
