import {
  buildPaymentHandleSearchKey,
  normalizePaymentHandle,
} from './handles';
import {
  buildPaymentsKybEntryPoints,
} from './onboarding';
import {
  evaluatePaymentsTierAssessment,
} from './tiers';
import type {
  PaymentsDiscoveryContext,
  PaymentsPaymentProfile,
  PaymentsPaymentProfileInput,
  PaymentsProfileIdentifierKind,
  PaymentsProfileSearchEntry,
  PaymentsSearchProfilesInput,
  PaymentsSearchQuery,
  PaymentsVerificationMethod,
} from './types';

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.trim().replace(/[\s()-]/g, '');
}

function buildVerificationMethod(
  input: Partial<PaymentsVerificationMethod> & { value?: string | null } | undefined,
  kind: Extract<PaymentsProfileIdentifierKind, 'email' | 'phone'>,
  fallbackValue?: string | null,
): PaymentsVerificationMethod {
  const rawValue = input?.value ?? fallbackValue ?? null;
  const value =
    typeof rawValue === 'string'
      ? kind === 'email'
        ? normalizeEmail(rawValue)
        : normalizePhone(rawValue)
      : null;

  return {
    value,
    verificationState: input?.verificationState ?? 'unverified',
    verifiedAt: input?.verifiedAt ?? null,
    discoverable: input?.discoverable ?? false,
  };
}

function uniqueSearchEntries(
  entries: PaymentsProfileSearchEntry[],
): PaymentsProfileSearchEntry[] {
  const seen = new Set<string>();
  const unique: PaymentsProfileSearchEntry[] = [];

  for (const entry of entries) {
    const key = `${entry.kind}:${entry.token}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(entry);
  }

  return unique;
}

export function buildPaymentsProfileSearchIndex(
  profile: Pick<
    PaymentsPaymentProfile,
    'handle' | 'email' | 'phone' | 'discoverability'
  >,
): PaymentsProfileSearchEntry[] {
  const entries: PaymentsProfileSearchEntry[] = [];

  if (profile.handle && profile.discoverability.allowHandleLookup) {
    entries.push({
      kind: 'handle',
      token: buildPaymentHandleSearchKey(profile.handle),
      verified: true,
      exactOnly: false,
    });
  }

  if (
    profile.email.value &&
    profile.email.verificationState === 'verified' &&
    profile.email.discoverable &&
    profile.discoverability.allowEmailLookup
  ) {
    entries.push({
      kind: 'email',
      token: normalizeEmail(profile.email.value),
      verified: true,
      exactOnly: true,
    });
  }

  if (
    profile.phone.value &&
    profile.phone.verificationState === 'verified' &&
    profile.phone.discoverable &&
    profile.discoverability.allowPhoneLookup
  ) {
    entries.push({
      kind: 'phone',
      token: normalizePhone(profile.phone.value),
      verified: true,
      exactOnly: true,
    });
  }

  return uniqueSearchEntries(entries);
}

export function buildPaymentsProfile(
  input: PaymentsPaymentProfileInput,
): PaymentsPaymentProfile {
  const discoverability = {
    visibility: input.discoverability?.visibility ?? 'searchable',
    allowHandleLookup: input.discoverability?.allowHandleLookup ?? true,
    allowEmailLookup: input.discoverability?.allowEmailLookup ?? false,
    allowPhoneLookup: input.discoverability?.allowPhoneLookup ?? false,
  };
  const handle =
    typeof input.handle === 'string' && input.handle.trim().length > 0
      ? normalizePaymentHandle(input.handle)
      : null;
  const fallbackEmail =
    typeof input.fields?.email === 'string' ? input.fields.email : null;
  const fallbackPhone =
    typeof input.fields?.phoneE164 === 'string' ? input.fields.phoneE164 : null;
  const email = buildVerificationMethod(input.email, 'email', fallbackEmail);
  const phone = buildVerificationMethod(input.phone, 'phone', fallbackPhone);
  const tierAssessment = evaluatePaymentsTierAssessment({
    subjectType: input.subjectType ?? 'individual',
    identityStatus: input.identityStatus ?? 'unsubmitted',
    verificationState: input.verificationState ?? 'unverified',
    approvedTier: input.approvedTier,
    fields: {
      ...(input.fields ?? {}),
      email: email.value,
      phoneE164: phone.value,
    },
  });

  const profileWithoutSearch: Omit<PaymentsPaymentProfile, 'searchIndex' | 'kybEntryPoints'> = {
    ownerUserId: input.ownerUserId,
    primaryWalletId: input.primaryWalletId ?? null,
    walletType: input.walletType ?? 'consumer',
    handle,
    handleSearchKey: handle ? buildPaymentHandleSearchKey(handle) : null,
    displayName: input.displayName ?? null,
    countryCode: input.countryCode ?? 'US',
    subjectType: input.subjectType ?? 'individual',
    identityStatus: input.identityStatus ?? 'unsubmitted',
    verificationState: input.verificationState ?? 'unverified',
    email,
    phone,
    discoverability,
    fields: {
      ...(input.fields ?? {}),
      email: email.value,
      phoneE164: phone.value,
    },
    tierAssessment,
  };

  return {
    ...profileWithoutSearch,
    searchIndex: buildPaymentsProfileSearchIndex(profileWithoutSearch),
    kybEntryPoints: buildPaymentsKybEntryPoints({
      subjectType: profileWithoutSearch.subjectType,
      identityStatus: profileWithoutSearch.identityStatus,
      verificationState: profileWithoutSearch.verificationState,
      assessment: tierAssessment,
    }),
  };
}

function resolveSearchQuery(
  query: string,
  exactMatch: boolean,
  explicitKind?: PaymentsProfileIdentifierKind,
): PaymentsSearchQuery {
  const trimmed = query.trim();

  if (explicitKind === 'email' || (!explicitKind && trimmed.includes('@') && !trimmed.startsWith('@'))) {
    return {
      kind: 'email',
      token: normalizeEmail(trimmed),
      exactMatch: true,
    };
  }

  if (
    explicitKind === 'phone' ||
    (!explicitKind && /^[+()\d\s-]+$/.test(trimmed))
  ) {
    return {
      kind: 'phone',
      token: normalizePhone(trimmed),
      exactMatch: true,
    };
  }

  return {
    kind: 'handle',
    token: buildPaymentHandleSearchKey(trimmed),
    exactMatch,
  };
}

export function canDiscoverPaymentProfile(
  profile: PaymentsPaymentProfile,
  context: PaymentsDiscoveryContext,
): boolean {
  if (context.actorUserId === profile.ownerUserId) {
    return true;
  }

  if (profile.discoverability.visibility === 'private') {
    return false;
  }

  if (
    profile.discoverability.visibility === 'contacts_only' &&
    context.relationship !== 'contact'
  ) {
    return false;
  }

  switch (context.identifierKind) {
    case 'handle':
      return profile.discoverability.allowHandleLookup;
    case 'email':
      return (
        profile.discoverability.allowEmailLookup &&
        profile.email.verificationState === 'verified' &&
        profile.email.discoverable
      );
    case 'phone':
      return (
        profile.discoverability.allowPhoneLookup &&
        profile.phone.verificationState === 'verified' &&
        profile.phone.discoverable
      );
  }
}

export function searchPaymentsProfiles(
  input: PaymentsSearchProfilesInput,
): PaymentsPaymentProfile[] {
  const normalizedQuery = resolveSearchQuery(
    input.query,
    input.exactMatch ?? true,
    input.identifierKind,
  );

  return input.profiles
    .filter((profile) => {
      const relationship =
        profile.ownerUserId === input.actorUserId
          ? 'self'
          : input.relationshipByOwnerUserId?.[profile.ownerUserId] ?? 'stranger';
      if (
        !canDiscoverPaymentProfile(profile, {
          actorUserId: input.actorUserId,
          relationship,
          identifierKind: normalizedQuery.kind,
          exactMatch: normalizedQuery.exactMatch,
        })
      ) {
        return false;
      }

      return profile.searchIndex.some((entry) => {
        if (entry.kind !== normalizedQuery.kind) {
          return false;
        }
        if (normalizedQuery.exactMatch || entry.exactOnly) {
          return entry.token === normalizedQuery.token;
        }
        return entry.token.startsWith(normalizedQuery.token);
      });
    })
    .sort((left, right) => {
      if (left.ownerUserId === input.actorUserId && right.ownerUserId !== input.actorUserId) {
        return -1;
      }
      if (right.ownerUserId === input.actorUserId && left.ownerUserId !== input.actorUserId) {
        return 1;
      }
      return (left.handleSearchKey ?? left.displayName ?? '').localeCompare(
        right.handleSearchKey ?? right.displayName ?? '',
      );
    });
}
