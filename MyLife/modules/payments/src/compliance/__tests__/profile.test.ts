import { describe, expect, it } from 'vitest';

import {
  buildPaymentsKybEntryPoints,
  buildPaymentsProfile,
  canDiscoverPaymentProfile,
  createPaymentsBusinessOnboardingDraft,
  searchPaymentsProfiles,
} from '../index';

describe('payments compliance profiles', () => {
  it('builds explicit phone and email verification state into the profile', () => {
    const profile = buildPaymentsProfile({
      ownerUserId: 'owner_1',
      primaryWalletId: 'wallet_1',
      handle: '@alice',
      displayName: 'Alice Example',
      identityStatus: 'verified',
      verificationState: 'verified',
      approvedTier: 'standard',
      fields: {
        legalName: 'Alice Example',
        dateOfBirth: '1990-01-01',
        addressLine1: '1 Main St',
        city: 'San Francisco',
        regionCode: 'CA',
        postalCode: '94105',
        governmentIdLast4: '1234',
      },
      discoverability: {
        visibility: 'searchable',
        allowEmailLookup: true,
        allowPhoneLookup: true,
      },
      email: {
        value: 'alice@example.com',
        verificationState: 'verified',
        verifiedAt: '2026-04-21T12:00:00.000Z',
        discoverable: true,
      },
      phone: {
        value: '+1 (415) 555-0123',
        verificationState: 'verified',
        verifiedAt: '2026-04-21T12:00:00.000Z',
        discoverable: true,
      },
    });

    expect(profile.handle).toBe('alice');
    expect(profile.handleSearchKey).toBe('@alice');
    expect(profile.email.verificationState).toBe('verified');
    expect(profile.phone.value).toBe('+14155550123');
    expect(profile.searchIndex.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining(['handle', 'email', 'phone']),
    );
  });

  it('searches safely using discoverability and verified identifiers', () => {
    const searchable = buildPaymentsProfile({
      ownerUserId: 'owner_searchable',
      handle: '@alice',
      displayName: 'Alice Example',
      identityStatus: 'verified',
      verificationState: 'verified',
      approvedTier: 'standard',
      fields: {
        legalName: 'Alice Example',
        dateOfBirth: '1990-01-01',
        addressLine1: '1 Main St',
        city: 'San Francisco',
        regionCode: 'CA',
        postalCode: '94105',
        governmentIdLast4: '1234',
      },
      discoverability: {
        visibility: 'contacts_only',
        allowEmailLookup: true,
        allowPhoneLookup: true,
      },
      email: {
        value: 'alice@example.com',
        verificationState: 'verified',
        discoverable: true,
      },
      phone: {
        value: '+14155550123',
        verificationState: 'verified',
        discoverable: true,
      },
    });
    const privateProfile = buildPaymentsProfile({
      ownerUserId: 'owner_private',
      handle: '@bob',
      displayName: 'Bob Example',
      identityStatus: 'verified',
      verificationState: 'verified',
      approvedTier: 'basic',
      fields: {
        legalName: 'Bob Example',
      },
      discoverability: {
        visibility: 'private',
      },
    });

    const asStranger = searchPaymentsProfiles({
      profiles: [searchable, privateProfile],
      query: 'alice@example.com',
      actorUserId: 'viewer_1',
      relationshipByOwnerUserId: {
        owner_searchable: 'stranger',
      },
    });
    const asContact = searchPaymentsProfiles({
      profiles: [searchable, privateProfile],
      query: 'alice@example.com',
      actorUserId: 'viewer_1',
      relationshipByOwnerUserId: {
        owner_searchable: 'contact',
      },
    });

    expect(asStranger).toHaveLength(0);
    expect(asContact).toHaveLength(1);
    expect(asContact[0]?.ownerUserId).toBe('owner_searchable');
    expect(
      canDiscoverPaymentProfile(searchable, {
        actorUserId: 'viewer_1',
        relationship: 'contact',
        identifierKind: 'phone',
        exactMatch: true,
      }),
    ).toBe(true);
  });

  it('creates distinct KYB entry points and drafts for merchant surfaces', () => {
    const personalProfile = buildPaymentsProfile({
      ownerUserId: 'owner_1',
      handle: '@alice',
      displayName: 'Alice Example',
      subjectType: 'individual',
      identityStatus: 'verified',
      verificationState: 'verified',
      approvedTier: 'full',
      fields: {
        legalName: 'Alice Example',
        email: 'alice@example.com',
        phoneE164: '+14155550123',
        dateOfBirth: '1990-01-01',
        addressLine1: '1 Main St',
        city: 'San Francisco',
        regionCode: 'CA',
        postalCode: '94105',
        governmentIdLast4: '1234',
        taxIdLast4: '1234',
      },
    });
    const businessProfile = buildPaymentsProfile({
      ownerUserId: 'owner_2',
      handle: '@acme',
      displayName: 'Acme Goods',
      subjectType: 'business',
      identityStatus: 'verified',
      verificationState: 'verified',
      fields: {
        businessName: 'Acme Goods',
        businessType: 'llc',
        email: 'ops@acme.test',
        phoneE164: '+14155550199',
        addressLine1: '1 Market St',
        city: 'San Francisco',
        regionCode: 'CA',
        postalCode: '94105',
        registrationNumber: 'REG-123',
        websiteUrl: 'https://acme.test',
        taxIdLast4: '1234',
        beneficialOwnerCount: 2,
      },
    });

    expect(
      personalProfile.kybEntryPoints.every(
        (entry) => entry.status === 'requires_business_identity',
      ),
    ).toBe(true);
    expect(
      businessProfile.kybEntryPoints.every((entry) => entry.status === 'available'),
    ).toBe(true);

    const draft = createPaymentsBusinessOnboardingDraft({
      ownerUserId: 'owner_2',
      product: 'market_seller_payout',
      sourceSurface: 'market',
    });

    expect(draft.subjectType).toBe('business');
    expect(draft.product).toBe('market_seller_payout');
    expect(
      buildPaymentsKybEntryPoints({
        subjectType: businessProfile.subjectType,
        identityStatus: businessProfile.identityStatus,
        verificationState: businessProfile.verificationState,
        assessment: businessProfile.tierAssessment,
      })[0]?.distinctIdentityTrack,
    ).toBe(true);
  });
});
