import { describe, expect, it } from 'vitest';
import { buildHostedBoundaryItems } from '../(root)/data/hosted-boundaries';

describe('hosted boundaries', () => {
  it('keeps backup, public posting, and public feed out of local-only use', () => {
    const items = buildHostedBoundaryItems({
      relayUrl: null,
      localStorageLabel: '12 MB',
    });

    expect(items.find((item) => item.id === 'hosted_backup')).toMatchObject({
      state: 'local_only',
      stateLabel: 'Not backed up',
    });
    expect(items.find((item) => item.id === 'public_posts')).toMatchObject({
      state: 'unavailable',
      stateLabel: 'Hidden',
    });
    expect(items.find((item) => item.id === 'public_feed')).toMatchObject({
      state: 'unavailable',
      stateLabel: 'Hidden',
    });
  });

  it('fails closed for a first-party hosted relay without an entitlement token', () => {
    const items = buildHostedBoundaryItems({
      relayUrl: 'wss://relay.meerkat.example/',
      hostedRelayUrl: 'wss://relay.meerkat.example',
      hasHostedRelayEntitlement: false,
      localStorageLabel: '0 B',
    });

    expect(items.find((item) => item.id === 'hosted_relay')).toMatchObject({
      state: 'paid_required',
      stateLabel: 'Paid access required',
    });
  });

  it('does not treat a community relay as first-party hosted access', () => {
    const items = buildHostedBoundaryItems({
      relayUrl: 'wss://community.example',
      hostedRelayUrl: 'wss://relay.meerkat.example',
      hasHostedRelayEntitlement: false,
      localStorageLabel: '64 KB',
    });

    expect(items.find((item) => item.id === 'hosted_relay')).toMatchObject({
      state: 'local_only',
      stateLabel: 'Own or community',
    });
  });

  // Plan 19 P7a: public_posts / public_feed are state-driven (section 7.4).
  it('keeps public posting + feed hidden with unchanged copy when no source is configured', () => {
    const items = buildHostedBoundaryItems({ relayUrl: null, localStorageLabel: '0 B' });
    expect(items.find((item) => item.id === 'public_posts')).toMatchObject({
      state: 'unavailable',
      stateLabel: 'Hidden',
      detail: 'Public posts use hosted storage and moderation. Public posting stays hidden until paid public reach is live.',
    });
    expect(items.find((item) => item.id === 'public_feed')).toMatchObject({
      state: 'unavailable',
      stateLabel: 'Hidden',
      detail: 'Public feed inclusion is a paid hosted service. The Public feed stays hidden until a real hosted source exists.',
    });
  });

  it('flips public posting + feed to self-served when a public source is configured and responding', () => {
    const items = buildHostedBoundaryItems({
      relayUrl: null,
      localStorageLabel: '0 B',
      publicSourceConfigured: true,
      publicSourceResponded: true,
    });
    for (const id of ['public_posts', 'public_feed'] as const) {
      expect(items.find((item) => item.id === id)).toMatchObject({
        state: 'local_only',
        stateLabel: 'Self-served',
        detail: 'Public reach is live through the host you configured. It is public only while that host is online; this is free self-hosting, not paid managed serving.',
      });
    }
  });

  it('stays hidden when a source is configured but has not responded', () => {
    const items = buildHostedBoundaryItems({
      relayUrl: null,
      localStorageLabel: '0 B',
      publicSourceConfigured: true,
      publicSourceResponded: false,
    });
    expect(items.find((item) => item.id === 'public_feed')).toMatchObject({ state: 'unavailable', stateLabel: 'Hidden' });
  });

  it('reports included/Hosted ONLY when a real hosted serving entitlement is present (defaults false)', () => {
    const withEntitlement = buildHostedBoundaryItems({
      relayUrl: null,
      localStorageLabel: '0 B',
      publicSourceConfigured: true,
      publicSourceResponded: true,
      hasPublicHostedEntitlement: true,
    });
    for (const id of ['public_posts', 'public_feed'] as const) {
      expect(withEntitlement.find((item) => item.id === id)).toMatchObject({
        state: 'included',
        stateLabel: 'Hosted',
        detail: 'Always-on managed public serving is active. Viewing is free for everyone; you pay for hosting capacity.',
      });
    }

    // Configured + responding but NO entitlement stays self-served, never included.
    const withoutEntitlement = buildHostedBoundaryItems({
      relayUrl: null,
      localStorageLabel: '0 B',
      publicSourceConfigured: true,
      publicSourceResponded: true,
    });
    expect(withoutEntitlement.find((item) => item.id === 'public_posts')?.state).toBe('local_only');
  });
});
