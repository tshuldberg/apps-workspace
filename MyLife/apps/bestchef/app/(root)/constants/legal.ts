// Single source of truth for BestChef legal + support destinations.
//
// These URLs back the in-app legal links (settings About section) and the
// terms-acceptance onboarding gate. The pages themselves must be hosted and
// reachable before public launch (LEGAL-10 operational item). Keep this the
// only place these strings are defined so the gate and settings never drift.

export const LEGAL_URLS = {
  privacy: 'https://bestchef.app/privacy',
  terms: 'https://bestchef.app/terms',
  guidelines: 'https://bestchef.app/guidelines',
  dataDeletion: 'https://bestchef.app/data-deletion',
  support: 'https://bestchef.app/support',
} as const;

export const SUPPORT_EMAIL = 'support@bestchef.app';

export type LegalUrlKey = keyof typeof LEGAL_URLS;

// Operator identity + jurisdiction, centralized so the founder/attorney fills
// them in ONE place before publication (audit H5, ledger item F2). These mirror
// the tokens in legal/operator.md. Honesty rule: no real legal entity or
// governing law exists anywhere in the repo, so these stay explicit
// placeholders rather than a fabricated entity. A build/publish step should
// assert none of these still contains "TO BE COMPLETED" before going live.
export const OPERATOR_IDENTITY = {
  legalName: '[TO BE COMPLETED BY OPERATOR BEFORE PUBLICATION - F2]',
  governingLaw: '[TO BE COMPLETED BY OPERATOR BEFORE PUBLICATION - F2]',
  contactAddress: '[TO BE COMPLETED BY OPERATOR BEFORE PUBLICATION - F2]',
  effectiveDate: '[TO BE COMPLETED BY OPERATOR BEFORE PUBLICATION - F2]',
  hostingRegion: '[TO BE COMPLETED BY OPERATOR BEFORE PUBLICATION - F2/F1]',
} as const;

/** True while any operator-identity field is still an unfilled F2 placeholder. */
export function operatorIdentityIncomplete(): boolean {
  return Object.values(OPERATOR_IDENTITY).some((v) => v.includes('TO BE COMPLETED'));
}

export type OperatorIdentityKey = keyof typeof OPERATOR_IDENTITY;
