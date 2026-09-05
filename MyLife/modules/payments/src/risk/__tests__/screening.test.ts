import { describe, expect, it } from 'vitest';

import {
  screenPaymentsSanctions,
} from '../index';

describe('payments sanctions screening hooks', () => {
  it('holds a transfer when a local watchlist alias matches a party', () => {
    const findings = screenPaymentsSanctions({
      parties: [
        {
          partyId: 'party_sender',
          role: 'sender',
          displayName: 'Alice Example',
        },
        {
          partyId: 'party_recipient',
          role: 'recipient',
          displayName: 'Acme SDN Shell',
        },
      ],
      watchlist: [
        {
          entryId: 'sdn_001',
          label: 'Acme SDN Shell',
          aliases: ['Acme Sdn Shell'],
        },
      ],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('sanctions.potential_match');
    expect(findings[0]?.action).toBe('hold');
  });

  it('rejects a confirmed sanctions match or blocked country', () => {
    const findings = screenPaymentsSanctions({
      parties: [
        {
          partyId: 'party_sender',
          role: 'sender',
          displayName: 'Blocked Sender',
          screeningState: 'confirmed_match',
          screeningReference: 'screen_123',
        },
        {
          partyId: 'party_recipient',
          role: 'remittance_recipient',
          countryCode: 'IR',
        },
      ],
      blockedCountryCodes: ['IR'],
    });

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'sanctions.confirmed_match',
        'sanctions.blocked_country',
      ]),
    );
    expect(findings.every((finding) => finding.action === 'reject')).toBe(true);
  });
});
