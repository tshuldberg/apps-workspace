import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  emitMarketListingCreated,
  emitMarketListingSold,
} = vi.hoisted(() => ({
  emitMarketListingCreated: vi.fn(),
  emitMarketListingSold: vi.fn(),
}));

vi.mock('@mylife/social', () => ({
  emitMarketListingCreated,
  emitMarketListingSold,
}));

import {
  cloudCreateConversationRequest,
  cloudCreateListing,
  cloudGetListings,
  cloudGetRecipientPreKeyBundles,
  cloudGetSellerStats,
  cloudRegisterSecureDevice,
  cloudRespondToConversationRequest,
  cloudSendMessage,
  cloudSendSecureEnvelope,
  cloudStartConversation,
} from '../cloud/client';

type QueryResult = { data: unknown; error: unknown };

function createBuilder(
  result: QueryResult,
  state: { insertPayload?: unknown; updatePayload?: unknown } = {},
) {
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn((payload: unknown) => {
      state.insertPayload = payload;
      return builder;
    }),
    update: vi.fn((payload: unknown) => {
      state.updatePayload = payload;
      return builder;
    }),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    textSearch: vi.fn(() => builder),
    single: vi.fn(async () => result),
    then: (resolve: (value: QueryResult) => void) =>
      Promise.resolve(result).then(resolve),
  };

  return { builder, state };
}

function createSupabase(tables: Record<string, ReturnType<typeof createBuilder>>, userId = 'seller-1') {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: userId ? { id: userId } : null,
        },
      })),
    },
    from: vi.fn((table: string) => {
      const response = tables[table];
      if (!response) throw new Error(`Missing table mock for ${table}`);
      return response.builder;
    }),
    rpc: vi.fn(),
  };
}

describe('market cloud client', () => {
  beforeEach(() => {
    emitMarketListingCreated.mockReset();
    emitMarketListingSold.mockReset();
  });

  it('maps snake_case listings and parses POINT coordinates', async () => {
    const supabase = createSupabase({
      mk_listings: createBuilder({
        data: [
          {
            id: 'list-1',
            seller_id: 'seller-1',
            category_id: 'cat-1',
            title: 'Mirrorless camera',
            description: 'Great condition camera body with lens.',
            price_cents: 125000,
            currency: 'USD',
            pricing_type: 'fixed',
            condition: 'good',
            listing_type: 'sell',
            status: 'active',
            location_name: 'San Francisco',
            location: 'POINT(-122.4 37.8)',
            fulfillment_type: null,
            service_radius_miles: null,
            availability_notes: null,
            trade_for: null,
            view_count: 22,
            watch_count: 4,
            message_count: 1,
            created_at: '2026-03-10T00:00:00.000Z',
            updated_at: '2026-03-10T00:00:00.000Z',
            expires_at: null,
          },
        ],
        error: null,
      }),
    });

    const result = await cloudGetListings(supabase as any);

    expect(result).toEqual({
      ok: true,
      data: [
        expect.objectContaining({
          sellerId: 'seller-1',
          categoryId: 'cat-1',
          priceCents: 125000,
          locationName: 'San Francisco',
          latitude: 37.8,
          longitude: -122.4,
          fulfillmentType: null,
          serviceRadiusMiles: null,
          availabilityNotes: null,
        }),
      ],
    });
  });

  it('writes snake_case listing payloads and stores geometry as POINT text', async () => {
    const table = createBuilder({
      data: {
        id: 'list-2',
        seller_id: 'seller-1',
        category_id: 'cat-1',
        title: 'Espresso machine',
        description: 'Excellent machine with grinder included.',
        price_cents: 45000,
        currency: 'USD',
        pricing_type: 'fixed',
        condition: 'good',
        listing_type: 'sell',
        status: 'active',
        location_name: 'Oakland',
        location: 'POINT(-122.27 37.8)',
        fulfillment_type: null,
        service_radius_miles: null,
        availability_notes: null,
        trade_for: null,
        view_count: 0,
        watch_count: 0,
        message_count: 0,
        created_at: '2026-03-10T00:00:00.000Z',
        updated_at: '2026-03-10T00:00:00.000Z',
        expires_at: null,
      },
      error: null,
    });
    const supabase = createSupabase({ mk_listings: table });

    const result = await cloudCreateListing(supabase as any, {
      categoryId: 'cat-1',
      title: 'Espresso machine',
      description: 'Excellent machine with grinder included.',
      priceCents: 45000,
      pricingType: 'fixed',
      condition: 'good',
      listingType: 'sell',
      locationName: 'Oakland',
      latitude: 37.8,
      longitude: -122.27,
    });

    expect(table.state.insertPayload).toEqual({
      seller_id: 'seller-1',
      category_id: 'cat-1',
      title: 'Espresso machine',
      description: 'Excellent machine with grinder included.',
      price_cents: 45000,
      currency: 'USD',
      pricing_type: 'fixed',
      condition: 'good',
      listing_type: 'sell',
      location_name: 'Oakland',
      location: 'POINT(-122.27 37.8)',
      fulfillment_type: null,
      service_radius_miles: null,
      availability_notes: null,
      trade_for: null,
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        sellerId: 'seller-1',
        latitude: 37.8,
        longitude: -122.27,
      },
    });
    expect(emitMarketListingCreated).toHaveBeenCalledTimes(1);
  });

  it('creates service listings with service metadata and no goods condition', async () => {
    const table = createBuilder({
      data: {
        id: 'list-3',
        seller_id: 'seller-1',
        category_id: 'cat-services',
        title: 'Window washing',
        description: 'Exterior and interior residential window washing.',
        price_cents: 18000,
        currency: 'USD',
        pricing_type: 'negotiable',
        condition: null,
        listing_type: 'service_offer',
        status: 'active',
        location_name: 'San Jose',
        location: 'POINT(-121.89 37.33)',
        fulfillment_type: 'onsite',
        service_radius_miles: 20,
        availability_notes: 'Weekends and weekday evenings.',
        trade_for: 'Open to partial barter for furniture.',
        view_count: 0,
        watch_count: 0,
        message_count: 0,
        created_at: '2026-03-10T00:00:00.000Z',
        updated_at: '2026-03-10T00:00:00.000Z',
        expires_at: null,
      },
      error: null,
    });
    const supabase = createSupabase({ mk_listings: table });

    const result = await cloudCreateListing(supabase as any, {
      categoryId: 'cat-services',
      title: 'Window washing',
      description: 'Exterior and interior residential window washing.',
      priceCents: 18000,
      pricingType: 'negotiable',
      listingType: 'service_offer',
      locationName: 'San Jose',
      latitude: 37.33,
      longitude: -121.89,
      fulfillmentType: 'onsite',
      serviceRadiusMiles: 20,
      availabilityNotes: 'Weekends and weekday evenings.',
      tradeFor: 'Open to partial barter for furniture.',
    });

    expect(table.state.insertPayload).toEqual({
      seller_id: 'seller-1',
      category_id: 'cat-services',
      title: 'Window washing',
      description: 'Exterior and interior residential window washing.',
      price_cents: 18000,
      currency: 'USD',
      pricing_type: 'negotiable',
      condition: null,
      listing_type: 'service_offer',
      location_name: 'San Jose',
      location: 'POINT(-121.89 37.33)',
      fulfillment_type: 'onsite',
      service_radius_miles: 20,
      availability_notes: 'Weekends and weekday evenings.',
      trade_for: 'Open to partial barter for furniture.',
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        listingType: 'service_offer',
        condition: null,
        fulfillmentType: 'onsite',
        serviceRadiusMiles: 20,
      },
    });
  });

  it('maps seller stats active_listings to activeListings', async () => {
    const supabase = createSupabase({
      mk_seller_stats: createBuilder({
        data: {
          seller_id: 'seller-1',
          total_listings: 12,
          active_listings: 4,
          total_sold: 8,
          average_rating: 4.8,
          review_count: 6,
          response_rate: 97,
          member_since: '2025-01-01T00:00:00.000Z',
        },
        error: null,
      }),
    });

    const result = await cloudGetSellerStats(supabase as any, 'seller-1');

    expect(result).toEqual({
      ok: true,
      data: {
        sellerId: 'seller-1',
        totalListings: 12,
        activeListings: 4,
        totalSold: 8,
        averageRating: 4.8,
        reviewCount: 6,
        responseRate: 97,
        memberSince: '2025-01-01T00:00:00.000Z',
      },
    });
  });

  it('starts or reuses a buyer conversation for a listing', async () => {
    const listingTable = createBuilder({
      data: { seller_id: 'seller-9' },
      error: null,
    });
    const conversationTable = createBuilder({
      data: {
        id: 'conv-1',
        listing_id: 'listing-1',
        buyer_id: 'buyer-1',
        seller_id: 'seller-9',
        last_message_at: null,
        created_at: '2026-03-10T00:00:00.000Z',
      },
      error: null,
    });
    const supabase = createSupabase(
      {
        mk_listings: listingTable,
        mk_conversations: conversationTable,
      },
      'buyer-1',
    );

    const result = await cloudStartConversation(supabase as any, 'listing-1');

    expect(conversationTable.state.insertPayload).toEqual({
      listing_id: 'listing-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-9',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'conv-1',
        listingId: 'listing-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-9',
        lastMessageAt: null,
        createdAt: '2026-03-10T00:00:00.000Z',
      },
    });
  });

  it('creates a conversation request tied to the buyer conversation', async () => {
    const listingTable = createBuilder({
      data: { seller_id: 'seller-9' },
      error: null,
    });
    const conversationTable = createBuilder({
      data: {
        id: 'conv-2',
        listing_id: 'listing-2',
        buyer_id: 'buyer-1',
        seller_id: 'seller-9',
        last_message_at: null,
        created_at: '2026-03-10T00:00:00.000Z',
      },
      error: null,
    });
    const requestTable = createBuilder({
      data: {
        id: 'req-1',
        conversation_id: 'conv-2',
        listing_id: 'listing-2',
        requester_id: 'buyer-1',
        responder_id: 'seller-9',
        friend_link_id: 'friend-link-1',
        status: 'pending',
        created_at: '2026-03-10T00:00:00.000Z',
        responded_at: null,
      },
      error: null,
    });
    const supabase = createSupabase(
      {
        mk_listings: listingTable,
        mk_conversations: conversationTable,
        mk_message_requests: requestTable,
      },
      'buyer-1',
    );

    const result = await cloudCreateConversationRequest(supabase as any, {
      listingId: 'listing-2',
      friendLinkId: 'friend-link-1',
    });

    expect(requestTable.state.insertPayload).toEqual({
      conversation_id: 'conv-2',
      listing_id: 'listing-2',
      requester_id: 'buyer-1',
      responder_id: 'seller-9',
      friend_link_id: 'friend-link-1',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'req-1',
        conversationId: 'conv-2',
        listingId: 'listing-2',
        requesterId: 'buyer-1',
        responderId: 'seller-9',
        friendLinkId: 'friend-link-1',
        status: 'pending',
        createdAt: '2026-03-10T00:00:00.000Z',
        respondedAt: null,
      },
    });
  });

  it('registers a secure device bundle with signed and one-time prekeys', async () => {
    const deviceTable = createBuilder({
      data: {
        id: 'device-1',
        user_id: 'buyer-1',
        platform: 'ios',
        label: 'iPhone',
        identity_key: 'identity-key',
        registration_id: 321,
        supports_sealed_sender: true,
        supports_post_quantum: true,
        created_at: '2026-03-10T00:00:00.000Z',
        last_seen_at: '2026-03-10T00:00:00.000Z',
      },
      error: null,
    });
    const signedPreKeyTable = createBuilder({ data: null, error: null });
    const oneTimePreKeyTable = createBuilder({ data: null, error: null });
    const supabase = createSupabase(
      {
        mk_secure_devices: deviceTable,
        mk_signed_prekeys: signedPreKeyTable,
        mk_one_time_prekeys: oneTimePreKeyTable,
      },
      'buyer-1',
    );

    const result = await cloudRegisterSecureDevice(supabase as any, {
      platform: 'ios',
      label: 'iPhone',
      identityKey: 'identity-key',
      registrationId: 321,
      signedPreKey: {
        keyId: 7,
        publicKey: 'signed-prekey-public',
        signature: 'signed-prekey-signature',
      },
      curveOneTimePreKeys: [
        { keyId: 11, publicKey: 'curve-one-time-key' },
      ],
      pqOneTimePreKeys: [
        { keyId: 21, publicKey: 'pq-one-time-key' },
      ],
      pqLastResortPreKey: {
        keyId: 31,
        publicKey: 'pq-last-resort-key',
      },
    });

    expect(deviceTable.state.insertPayload).toEqual({
      user_id: 'buyer-1',
      platform: 'ios',
      label: 'iPhone',
      identity_key: 'identity-key',
      registration_id: 321,
      supports_sealed_sender: true,
      supports_post_quantum: true,
    });
    expect(signedPreKeyTable.state.insertPayload).toEqual({
      device_id: 'device-1',
      key_id: 7,
      algorithm: 'curve25519',
      public_key: 'signed-prekey-public',
      signature: 'signed-prekey-signature',
    });
    expect(oneTimePreKeyTable.state.insertPayload).toEqual([
      {
        device_id: 'device-1',
        key_id: 11,
        kind: 'curve25519',
        public_key: 'curve-one-time-key',
      },
      {
        device_id: 'device-1',
        key_id: 21,
        kind: 'kyber1024',
        public_key: 'pq-one-time-key',
      },
      {
        device_id: 'device-1',
        key_id: 31,
        kind: 'kyber1024_last_resort',
        public_key: 'pq-last-resort-key',
      },
    ]);
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'device-1',
        userId: 'buyer-1',
        platform: 'ios',
        label: 'iPhone',
        identityKey: 'identity-key',
        registrationId: 321,
        supportsSealedSender: true,
        supportsPostQuantum: true,
        createdAt: '2026-03-10T00:00:00.000Z',
        lastSeenAt: '2026-03-10T00:00:00.000Z',
      },
    });
  });

  it('maps claimed recipient prekey bundles from the secure messaging RPC', async () => {
    const supabase = createSupabase({}, 'buyer-1');
    supabase.rpc.mockResolvedValue({
      data: [
        {
          device: {
            id: 'device-2',
            user_id: 'seller-9',
            platform: 'android',
            label: 'Pixel',
            identity_key: 'seller-identity',
            registration_id: 555,
            supports_sealed_sender: true,
            supports_post_quantum: true,
            created_at: '2026-03-10T00:00:00.000Z',
            last_seen_at: '2026-03-10T00:00:00.000Z',
          },
          signed_prekey: {
            id: 'spk-1',
            device_id: 'device-2',
            key_id: 9,
            algorithm: 'curve25519',
            public_key: 'signed-public',
            signature: 'signed-signature',
            created_at: '2026-03-10T00:00:00.000Z',
            expires_at: null,
          },
          curve_one_time_prekey: {
            id: 'otk-curve',
            device_id: 'device-2',
            key_id: 12,
            kind: 'curve25519',
            public_key: 'curve-public',
            is_consumed: true,
            created_at: '2026-03-10T00:00:00.000Z',
            consumed_at: '2026-03-10T00:00:00.000Z',
          },
          pq_one_time_prekey: {
            id: 'otk-pq',
            device_id: 'device-2',
            key_id: 18,
            kind: 'kyber1024',
            public_key: 'pq-public',
            is_consumed: true,
            created_at: '2026-03-10T00:00:00.000Z',
            consumed_at: '2026-03-10T00:00:00.000Z',
          },
          pq_last_resort_prekey: {
            id: 'otk-pq-last',
            device_id: 'device-2',
            key_id: 19,
            kind: 'kyber1024_last_resort',
            public_key: 'pq-last-public',
            is_consumed: false,
            created_at: '2026-03-10T00:00:00.000Z',
            consumed_at: null,
          },
        },
      ],
      error: null,
    });

    const result = await cloudGetRecipientPreKeyBundles(supabase as any, 'seller-9');

    expect(supabase.rpc).toHaveBeenCalledWith('mk_claim_recipient_prekey_bundles', {
      recipient_user_id: 'seller-9',
    });
    expect(result).toEqual({
      ok: true,
      data: [
        {
          device: {
            id: 'device-2',
            userId: 'seller-9',
            platform: 'android',
            label: 'Pixel',
            identityKey: 'seller-identity',
            registrationId: 555,
            supportsSealedSender: true,
            supportsPostQuantum: true,
            createdAt: '2026-03-10T00:00:00.000Z',
            lastSeenAt: '2026-03-10T00:00:00.000Z',
          },
          signedPreKey: {
            id: 'spk-1',
            deviceId: 'device-2',
            keyId: 9,
            algorithm: 'curve25519',
            publicKey: 'signed-public',
            signature: 'signed-signature',
            createdAt: '2026-03-10T00:00:00.000Z',
            expiresAt: null,
          },
          curveOneTimePreKey: {
            id: 'otk-curve',
            deviceId: 'device-2',
            keyId: 12,
            kind: 'curve25519',
            publicKey: 'curve-public',
            isConsumed: true,
            createdAt: '2026-03-10T00:00:00.000Z',
            consumedAt: '2026-03-10T00:00:00.000Z',
          },
          pqOneTimePreKey: {
            id: 'otk-pq',
            deviceId: 'device-2',
            keyId: 18,
            kind: 'kyber1024',
            publicKey: 'pq-public',
            isConsumed: true,
            createdAt: '2026-03-10T00:00:00.000Z',
            consumedAt: '2026-03-10T00:00:00.000Z',
          },
          pqLastResortPreKey: {
            id: 'otk-pq-last',
            deviceId: 'device-2',
            keyId: 19,
            kind: 'kyber1024_last_resort',
            publicKey: 'pq-last-public',
            isConsumed: false,
            createdAt: '2026-03-10T00:00:00.000Z',
            consumedAt: null,
          },
        },
      ],
    });
  });

  it('updates conversation requests and creates a marketplace block when blocked', async () => {
    const requestTable = createBuilder({
      data: {
        id: 'req-2',
        conversation_id: 'conv-2',
        listing_id: 'listing-2',
        requester_id: 'buyer-1',
        responder_id: 'seller-9',
        friend_link_id: null,
        status: 'blocked',
        created_at: '2026-03-10T00:00:00.000Z',
        responded_at: '2026-03-10T00:05:00.000Z',
      },
      error: null,
    });
    const blocksTable = createBuilder({ data: null, error: null });
    const supabase = createSupabase(
      {
        mk_message_requests: requestTable,
        mk_blocks: blocksTable,
      },
      'seller-9',
    );

    const result = await cloudRespondToConversationRequest(
      supabase as any,
      'req-2',
      'blocked',
    );

    expect(requestTable.state.updatePayload).toMatchObject({
      status: 'blocked',
    });
    expect(blocksTable.state.insertPayload).toEqual({
      blocker_id: 'seller-9',
      blocked_id: 'buyer-1',
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        id: 'req-2',
        status: 'blocked',
        requesterId: 'buyer-1',
        responderId: 'seller-9',
      },
    });
  });

  it('stores encrypted message envelopes without plaintext bodies', async () => {
    const messageTable = createBuilder({
      data: {
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_id: 'buyer-1',
        body: null,
        content_type: 'application/e2ee+ciphertext',
        ciphertext: 'ciphertext-base64',
        encryption_algorithm: 'aes-256-gcm',
        encryption_salt: 'salt-base64',
        encryption_iv: 'iv-base64',
        created_at: '2026-03-10T00:00:00.000Z',
      },
      error: null,
    });
    const supabase = createSupabase({ mk_messages: messageTable }, 'buyer-1');

    const result = await cloudSendMessage(supabase as any, 'conv-1', {
      contentType: 'application/e2ee+ciphertext',
      ciphertext: 'ciphertext-base64',
      encryptionAlgorithm: 'aes-256-gcm',
      encryptionSalt: 'salt-base64',
      encryptionIv: 'iv-base64',
    });

    expect(messageTable.state.insertPayload).toEqual({
      conversation_id: 'conv-1',
      sender_id: 'buyer-1',
      body: null,
      content_type: 'application/e2ee+ciphertext',
      ciphertext: 'ciphertext-base64',
      encryption_algorithm: 'aes-256-gcm',
      encryption_salt: 'salt-base64',
      encryption_iv: 'iv-base64',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'buyer-1',
        body: null,
        contentType: 'application/e2ee+ciphertext',
        ciphertext: 'ciphertext-base64',
        encryptionAlgorithm: 'aes-256-gcm',
        encryptionSalt: 'salt-base64',
        encryptionIv: 'iv-base64',
        createdAt: '2026-03-10T00:00:00.000Z',
      },
    });
  });

  it('stores per-device secure envelopes for Signal-style message delivery', async () => {
    const secureMessageTable = createBuilder({
      data: {
        id: 'secure-1',
        conversation_id: 'conv-5',
        request_id: 'req-5',
        sender_id: 'buyer-1',
        sender_device_id: 'buyer-device',
        recipient_id: 'seller-9',
        recipient_device_id: 'seller-device',
        envelope_type: 'prekey_signal_message',
        protocol_version: 'signal-pqxdh-v1',
        ciphertext: 'base64-envelope',
        registration_id: 9123,
        message_index: 0,
        previous_chain_length: 0,
        sent_at: '2026-03-10T00:00:00.000Z',
        delivered_at: null,
        read_at: null,
      },
      error: null,
    });
    const supabase = createSupabase(
      {
        mk_secure_messages: secureMessageTable,
      },
      'buyer-1',
    );

    const result = await cloudSendSecureEnvelope(supabase as any, {
      conversationId: 'conv-5',
      requestId: 'req-5',
      recipientId: 'seller-9',
      senderDeviceId: 'buyer-device',
      recipientDeviceId: 'seller-device',
      envelopeType: 'prekey_signal_message',
      protocolVersion: 'signal-pqxdh-v1',
      ciphertext: 'base64-envelope',
      registrationId: 9123,
      messageIndex: 0,
      previousChainLength: 0,
    });

    expect(secureMessageTable.state.insertPayload).toEqual({
      conversation_id: 'conv-5',
      request_id: 'req-5',
      sender_id: 'buyer-1',
      sender_device_id: 'buyer-device',
      recipient_id: 'seller-9',
      recipient_device_id: 'seller-device',
      envelope_type: 'prekey_signal_message',
      protocol_version: 'signal-pqxdh-v1',
      ciphertext: 'base64-envelope',
      registration_id: 9123,
      message_index: 0,
      previous_chain_length: 0,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        id: 'secure-1',
        conversationId: 'conv-5',
        requestId: 'req-5',
        senderId: 'buyer-1',
        senderDeviceId: 'buyer-device',
        recipientId: 'seller-9',
        recipientDeviceId: 'seller-device',
        envelopeType: 'prekey_signal_message',
        protocolVersion: 'signal-pqxdh-v1',
        ciphertext: 'base64-envelope',
        registrationId: 9123,
        messageIndex: 0,
        previousChainLength: 0,
        sentAt: '2026-03-10T00:00:00.000Z',
        deliveredAt: null,
        readAt: null,
      },
    });
  });
});
