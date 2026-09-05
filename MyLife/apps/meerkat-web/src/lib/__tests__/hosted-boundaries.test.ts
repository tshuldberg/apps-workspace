import { describe, expect, it } from 'vitest';
import { buildHostedBoundaryItems } from '../hosted-boundaries';

describe('web hosted boundaries', () => {
  it('marks public hosted surfaces hidden until real hosted sources exist', () => {
    const items = buildHostedBoundaryItems({
      relayUrl: '',
      localStorageLabel: '4 MB',
    });

    expect(items.find((item) => item.id === 'public_posts')).toMatchObject({
      state: 'unavailable',
      stateLabel: 'Hidden',
    });
    expect(items.find((item) => item.id === 'public_feed')).toMatchObject({
      state: 'unavailable',
      stateLabel: 'Hidden',
    });
    expect(items.find((item) => item.id === 'large_files')?.detail)
      .toContain('Paid hosted file storage is not connected');
  });

  it('requires payment for the configured first-party hosted relay without a token', () => {
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

  it('shows first-party hosted relay as usable only when a token is present', () => {
    const items = buildHostedBoundaryItems({
      relayUrl: 'wss://relay.meerkat.example',
      hostedRelayUrl: 'wss://relay.meerkat.example',
      hasHostedRelayEntitlement: true,
      localStorageLabel: '0 B',
    });

    expect(items.find((item) => item.id === 'hosted_relay')).toMatchObject({
      state: 'included',
      stateLabel: 'Entitlement present',
    });
  });
});

