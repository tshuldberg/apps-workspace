import type {
  PaymentsRiskParty,
  PaymentsRiskReason,
  PaymentsSanctionsWatchlistEntry,
} from './types';

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function collectCandidateTokens(party: PaymentsRiskParty): string[] {
  const candidates = [
    party.displayName ?? null,
    party.handle ?? null,
    party.matchedTerm ?? null,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return [...new Set(candidates.map(normalizeToken))];
}

function findWatchlistEntry(
  party: PaymentsRiskParty,
  watchlist: PaymentsSanctionsWatchlistEntry[],
): PaymentsSanctionsWatchlistEntry | null {
  const tokens = collectCandidateTokens(party);
  if (tokens.length === 0) {
    return null;
  }

  const partyCountry = party.countryCode?.trim().toUpperCase() ?? null;

  for (const entry of watchlist) {
    const aliases = [entry.label, ...entry.aliases].map(normalizeToken);
    const hasCountryMatch =
      !entry.countryCodes ||
      entry.countryCodes.length === 0 ||
      (partyCountry !== null && entry.countryCodes.includes(partyCountry));

    if (!hasCountryMatch) {
      continue;
    }

    if (tokens.some((token) => aliases.includes(token))) {
      return entry;
    }
  }

  return null;
}

export function screenPaymentsSanctions(input: {
  parties: PaymentsRiskParty[];
  watchlist?: PaymentsSanctionsWatchlistEntry[];
  blockedCountryCodes?: string[];
}): PaymentsRiskReason[] {
  const findings: PaymentsRiskReason[] = [];
  const blockedCountries = new Set(
    (input.blockedCountryCodes ?? []).map((countryCode) =>
      countryCode.trim().toUpperCase(),
    ),
  );

  for (const party of input.parties) {
    const partyCountry = party.countryCode?.trim().toUpperCase() ?? null;

    if (party.screeningState === 'confirmed_match') {
      findings.push({
        code: 'sanctions.confirmed_match',
        category: 'sanctions',
        action: 'reject',
        severity: 'critical',
        machineExplanation: `Sanctions screening reported a confirmed match for ${party.role}.`,
        userSafeTitle: 'Payment blocked',
        userSafeExplanation:
          'This payment cannot proceed because a required sanctions check returned a restricted match.',
        metadata: {
          partyId: party.partyId,
          role: party.role,
          screeningState: party.screeningState,
          screeningReference: party.screeningReference ?? null,
          matchedListName: party.matchedListName ?? null,
        },
      });
      continue;
    }

    if (
      party.screeningState === 'blocked_country' ||
      (partyCountry !== null && blockedCountries.has(partyCountry))
    ) {
      findings.push({
        code: 'sanctions.blocked_country',
        category: 'sanctions',
        action: 'reject',
        severity: 'high',
        machineExplanation: `Sanctions screening blocked ${party.role} in ${partyCountry ?? 'an unsupported country'}.`,
        userSafeTitle: 'Payment blocked',
        userSafeExplanation:
          'This payment cannot proceed because the destination or participant country is currently restricted.',
        metadata: {
          partyId: party.partyId,
          role: party.role,
          countryCode: partyCountry,
          screeningReference: party.screeningReference ?? null,
        },
      });
      continue;
    }

    if (party.screeningState === 'potential_match') {
      findings.push({
        code: 'sanctions.potential_match',
        category: 'sanctions',
        action: 'hold',
        severity: 'high',
        machineExplanation: `Sanctions screening flagged a potential match for ${party.role}.`,
        userSafeTitle: 'Payment pending review',
        userSafeExplanation:
          'This payment is pending compliance review before funds move.',
        metadata: {
          partyId: party.partyId,
          role: party.role,
          screeningState: party.screeningState,
          screeningReference: party.screeningReference ?? null,
          matchedListName: party.matchedListName ?? null,
        },
      });
      continue;
    }

    if (party.screeningState === 'provider_error') {
      findings.push({
        code: 'sanctions.screening_unavailable',
        category: 'sanctions',
        action: 'hold',
        severity: 'medium',
        machineExplanation: `Sanctions screening was unavailable for ${party.role}.`,
        userSafeTitle: 'Payment pending review',
        userSafeExplanation:
          'We could not complete a required compliance check yet, so this payment is pending review.',
        metadata: {
          partyId: party.partyId,
          role: party.role,
          screeningState: party.screeningState,
          screeningReference: party.screeningReference ?? null,
        },
      });
      continue;
    }

    const watchlistEntry = findWatchlistEntry(party, input.watchlist ?? []);
    if (watchlistEntry) {
      findings.push({
        code: 'sanctions.potential_match',
        category: 'sanctions',
        action: 'hold',
        severity: 'high',
        machineExplanation: `Local sanctions hook matched ${party.role} to watchlist entry ${watchlistEntry.entryId}.`,
        userSafeTitle: 'Payment pending review',
        userSafeExplanation:
          'This payment is pending compliance review before funds move.',
        metadata: {
          partyId: party.partyId,
          role: party.role,
          matchedEntryId: watchlistEntry.entryId,
          matchedEntryLabel: watchlistEntry.label,
        },
      });
    }
  }

  return findings;
}
