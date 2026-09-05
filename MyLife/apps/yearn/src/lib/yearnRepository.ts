import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { YearnProfileUpsertInput } from './onboarding';
import { normalizeYearnIntroNote } from './yearnIntro';
import {
  normalizeYearnIntroMessageCiphertext,
  normalizeYearnMessageCiphertext,
  normalizeYearnUserMessageCiphertext,
  yearnMessageCiphertextSchema,
  yearnIntroMessageCiphertextSchema,
  type YearnMessageCiphertext,
  type YearnIntroMessageCiphertext,
  type YearnUserMessageCiphertext,
} from './yearnIntroMessage';
import {
  yearnE2eeDevicePublicKeySchema,
  type YearnE2eeDevicePublicKey,
} from './yearnE2ee';

type AnySupabaseClient = SupabaseClient<any, any, any, any, any>;

const profileColumns = [
  'id',
  'display_name',
  'birthday',
  'pronouns',
  'custom_pronouns',
  'gender_identities',
  'orientation_identities',
  'identity_visibility',
  'orientation_consent_granted_at',
  'orientation_consent_withdrawn_at',
  'intention',
  'relationship_structure',
  'photos',
  'prompts',
  'interests',
  'is_verified',
  'is_paused',
].join(',');

const encryptedMessageColumns = [
  'id',
  'match_id',
  'sender_id',
  'kind',
  'ciphertext',
  'source_like_id',
  'read_at',
  'created_at',
].join(',');

const e2eeDeviceKeyColumns = [
  'user_id',
  'device_id',
  'public_key',
  'key_algorithm',
  'created_at',
  'last_seen_at',
].join(',');

const photoSchema = z.object({
  symbol: z.string().nullable().optional(),
  tint_hex: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
}).passthrough();

const promptSchema = z.object({
  question: z.string(),
  answer: z.string(),
}).passthrough();

const photosSchema = z.preprocess(
  (value) => (Array.isArray(value) ? value : []),
  z.array(photoSchema),
);

const promptsSchema = z.preprocess(
  (value) => (Array.isArray(value) ? value : []),
  z.array(promptSchema),
);

const interestsSchema = z.preprocess(
  (value) => (Array.isArray(value) ? value : []),
  z.array(z.string()),
);

const visibilitySchema = z.object({
  pronouns: z.boolean().optional(),
  identity: z.boolean().optional(),
  genderIdentities: z.boolean().optional(),
  orientation: z.boolean().optional(),
  photos: z.boolean().optional(),
  prompts: z.boolean().optional(),
  interests: z.boolean().optional(),
}).passthrough();

const deckRowSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  age: z.number().int().nonnegative(),
  pronouns: z.string(),
  intention: z.string(),
  relationship_structure: z.string(),
  photos: photosSchema,
  prompts: promptsSchema,
  interests: interestsSchema,
  is_verified: z.boolean(),
  city: z.string().nullable().optional(),
  distance_bucket: z.string().nullable().optional(),
  distance_miles: z.number().nonnegative().nullable().optional(),
  occupation: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  last_active_at: z.string().nullable().optional(),
});

const incomingLikeRowSchema = deckRowSchema.extend({
  like_id: z.string().uuid(),
  note: z.string().nullable(),
  intro_ciphertext: yearnIntroMessageCiphertextSchema.nullable().optional(),
  created_at: z.string(),
  sender_id: z.string().uuid(),
}).omit({ id: true });

const matchRowSchema = deckRowSchema.extend({
  match_id: z.string().uuid(),
  matched_at: z.string(),
  other_id: z.string().uuid(),
  is_pending: z.boolean().optional().default(false),
}).omit({ id: true });

const membershipRowSchema = z.object({
  is_member: z.boolean(),
  status: z.string(),
  expires_at: z.string().nullable(),
});

const boostActivationResponseSchema = z.object({
  expiresAt: z.string().min(1),
  duplicate: z.boolean(),
});

const membershipActivationResponseSchema = z.object({
  status: z.string().min(1),
  expiresAt: z.string().min(1),
  isMember: z.boolean(),
});

const discoveryPrefsRowSchema = z.object({
  min_age: z.number().int().min(18).max(100),
  max_age: z.number().int().min(18).max(100).nullable(),
  max_distance_miles: z.number().int().min(1).max(500).nullable(),
  intention_filter: z.string().nullable(),
});

const discoveryPrefsInputSchema = z
  .object({
    minAge: z.number().int().min(18).max(100),
    maxAge: z.number().int().min(18).max(100).nullable(),
    maxDistanceMiles: z.number().int().min(1).max(500).nullable(),
    intentionFilter: z.string().trim().min(1).nullable(),
  })
  .refine((prefs) => prefs.maxAge === null || prefs.maxAge >= prefs.minAge, {
    message: 'maxAge must be at least minAge',
  });

const latitudeSchema = z.number().finite().min(-90).max(90);
const longitudeSchema = z.number().finite().min(-180).max(180);

const verificationRowSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending_review', 'approved', 'rejected', 'revoked', 'superseded']),
  review_reason: z.string().nullable(),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
});

const boostVerificationFailureCodes = new Set([
  'malformed_jws',
  'bad_chain',
  'bad_signature',
  'wrong_bundle',
  'wrong_product',
  'revoked',
  'expired_cert',
  'not_consumable',
  'sandbox_not_allowed', 'account_mismatch',
]);

const reportReasonSchema = z.enum([
  'fake_profile',
  'harassment',
  'sexual_content',
  'underage',
  'scam',
  'other',
]);

const reportDetailsSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.string().max(1000).nullable(),
);

const encryptedMessageRowSchema = z.object({
  id: z.string().uuid(),
  match_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  kind: z.enum(['intro', 'user']),
  ciphertext: yearnMessageCiphertextSchema,
  source_like_id: z.string().uuid().nullable().optional(),
  read_at: z.string().nullable().optional(),
  created_at: z.string(),
});

const e2eeDeviceKeyRowSchema = z.object({
  user_id: z.string().uuid(),
  device_id: z.string(),
  public_key: z.string(),
  key_algorithm: z.string(),
  created_at: z.string().optional(),
  last_seen_at: z.string().optional(),
});

const profileRowSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  birthday: z.string(),
  pronouns: z.string(),
  custom_pronouns: z.string().optional().default(''),
  gender_identities: interestsSchema,
  orientation_identities: interestsSchema,
  identity_visibility: z.preprocess(
    (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
    visibilitySchema,
  ),
  orientation_consent_granted_at: z.string().nullable().optional().default(null),
  orientation_consent_withdrawn_at: z.string().nullable().optional().default(null),
  intention: z.string(),
  relationship_structure: z.string(),
  photos: photosSchema,
  prompts: promptsSchema,
  interests: interestsSchema,
  is_verified: z.boolean(),
  is_paused: z.boolean(),
});

export type YearnPhoto = z.infer<typeof photoSchema>;
export type YearnPromptRow = z.infer<typeof promptSchema>;

export interface YearnProfile {
  id: string;
  displayName: string;
  birthday: string;
  pronouns: string;
  customPronouns: string;
  genderIdentities: string[];
  orientationIdentities: string[];
  identityVisibility: Record<string, unknown>;
  orientationConsentGrantedAt: string | null;
  orientationConsentWithdrawnAt: string | null;
  intention: string;
  relationshipStructure: string;
  photos: YearnPhoto[];
  prompts: YearnPromptRow[];
  interests: string[];
  isVerified: boolean;
  isPaused: boolean;
}

export type YearnBoostActivationErrorCode =
  | 'not_configured'
  | 'verification_failed'
  | 'activation_failed';

const boostActivationErrorMessages: Record<YearnBoostActivationErrorCode, string> = {
  not_configured: 'Boost activation is not available yet.',
  verification_failed: 'The App Store could not verify this purchase. No boost was applied.',
  activation_failed: 'Boost activation could not be completed. No boost was applied.',
};

export class YearnBoostActivationError extends Error {
  constructor(public readonly code: YearnBoostActivationErrorCode) {
    super(boostActivationErrorMessages[code]);
    this.name = 'YearnBoostActivationError';
  }
}

export interface YearnDiscoverProfile {
  id: string;
  displayName: string;
  age: number;
  pronouns: string;
  intention: string;
  relationshipStructure: string;
  photos: YearnPhoto[];
  prompts: YearnPromptRow[];
  interests: string[];
  isVerified: boolean;
  city?: string;
  distanceBucket?: string;
  distanceMiles?: number;
  occupation?: string;
  bio?: string;
  lastActiveAt?: string;
}

export interface YearnIncomingLike {
  id: string;
  profile: YearnDiscoverProfile;
  intro: string | null;
  encryptedIntro: YearnIntroMessageCiphertext | null;
  receivedAt: string;
}

export interface YearnMatch {
  id: string;
  matchedAt: string;
  profile: YearnDiscoverProfile;
  isPending: boolean;
}

export interface YearnMembership {
  isMember: boolean;
  status: string;
  expiresAt: string | null;
}

export interface YearnVerificationState {
  id: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'revoked' | 'superseded';
  reviewReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface YearnDiscoveryPrefs {
  minAge: number;
  maxAge: number | null;
  maxDistanceMiles: number | null;
  intentionFilter: string | null;
}

export type YearnReportReason = z.infer<typeof reportReasonSchema>;

export interface YearnReportUserInput {
  reportedId: string;
  reason: YearnReportReason;
  details?: string | null;
}

export interface YearnEncryptedMessage {
  id: string;
  matchId: string;
  senderId: string;
  kind: 'intro' | 'user';
  ciphertext: YearnMessageCiphertext;
  sourceLikeId: string | null;
  readAt: string | null;
  createdAt: string;
}

function mapDeckProfile(row: z.infer<typeof deckRowSchema>): YearnDiscoverProfile {
  const profile: YearnDiscoverProfile = {
    id: row.id,
    displayName: row.display_name,
    age: row.age,
    pronouns: row.pronouns,
    intention: row.intention,
    relationshipStructure: row.relationship_structure,
    photos: row.photos,
    prompts: row.prompts,
    interests: row.interests,
    isVerified: row.is_verified,
  };

  if (row.city) profile.city = row.city;
  if (row.distance_bucket) profile.distanceBucket = row.distance_bucket;
  if (typeof row.distance_miles === 'number') profile.distanceMiles = row.distance_miles;
  if (row.occupation) profile.occupation = row.occupation;
  if (row.bio) profile.bio = row.bio;
  if (row.last_active_at) profile.lastActiveAt = row.last_active_at;

  return profile;
}

function mapProfile(row: z.infer<typeof profileRowSchema>): YearnProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    birthday: row.birthday,
    pronouns: row.pronouns,
    customPronouns: row.custom_pronouns,
    genderIdentities: row.gender_identities,
    orientationIdentities: row.orientation_identities,
    identityVisibility: row.identity_visibility,
    orientationConsentGrantedAt: row.orientation_consent_granted_at,
    orientationConsentWithdrawnAt: row.orientation_consent_withdrawn_at,
    intention: row.intention,
    relationshipStructure: row.relationship_structure,
    photos: row.photos,
    prompts: row.prompts,
    interests: row.interests,
    isVerified: row.is_verified,
    isPaused: row.is_paused,
  };
}

function mapIncomingLike(row: z.infer<typeof incomingLikeRowSchema>): YearnIncomingLike {
  return {
    id: row.like_id,
    intro: row.note,
    encryptedIntro: row.intro_ciphertext ?? null,
    receivedAt: row.created_at,
    profile: mapDeckProfile({
      id: row.sender_id,
      display_name: row.display_name,
      age: row.age,
      pronouns: row.pronouns,
      intention: row.intention,
      relationship_structure: row.relationship_structure,
      photos: row.photos,
      prompts: row.prompts,
      interests: row.interests,
      is_verified: row.is_verified,
      city: row.city,
      distance_bucket: row.distance_bucket,
      distance_miles: row.distance_miles,
      occupation: row.occupation,
      bio: row.bio,
      last_active_at: row.last_active_at,
    }),
  };
}

function mapMatch(row: z.infer<typeof matchRowSchema>): YearnMatch {
  return {
    id: row.match_id,
    matchedAt: row.matched_at,
    isPending: row.is_pending,
    profile: mapDeckProfile({
      id: row.other_id,
      display_name: row.display_name,
      age: row.age,
      pronouns: row.pronouns,
      intention: row.intention,
      relationship_structure: row.relationship_structure,
      photos: row.photos,
      prompts: row.prompts,
      interests: row.interests,
      is_verified: row.is_verified,
      city: row.city,
      distance_bucket: row.distance_bucket,
      distance_miles: row.distance_miles,
      occupation: row.occupation,
      bio: row.bio,
      last_active_at: row.last_active_at,
    }),
  };
}

function mapEncryptedMessage(row: z.infer<typeof encryptedMessageRowSchema>): YearnEncryptedMessage {
  return {
    id: row.id,
    matchId: row.match_id,
    senderId: row.sender_id,
    kind: row.kind,
    ciphertext: normalizeYearnMessageCiphertext(row.ciphertext) as YearnMessageCiphertext,
    sourceLikeId: row.source_like_id ?? null,
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  };
}

function mapE2eeDeviceKey(row: z.infer<typeof e2eeDeviceKeyRowSchema>): YearnE2eeDevicePublicKey {
  return yearnE2eeDevicePublicKeySchema.parse({
    userId: row.user_id,
    deviceId: row.device_id,
    publicKey: row.public_key,
    keyAlgorithm: row.key_algorithm,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  });
}

function assertDifferentYearnUsers(action: string, userId: string, targetUserId: string): void {
  if (userId === targetUserId) {
    throw new Error(`${action}: cannot target your own profile`);
  }
}

function errorCodeFromPayload(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const error = (value as Record<string, unknown>).error;
  return typeof error === 'string' && error.trim().length > 0 ? error.trim() : null;
}

function jsonResponseLike(value: unknown): value is { json(): Promise<unknown> } {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as { json?: unknown }).json === 'function';
}

async function functionErrorCode(
  data: unknown,
  error: unknown,
  response: unknown,
): Promise<string | null> {
  const directCode = errorCodeFromPayload(data) ?? errorCodeFromPayload(error);
  if (directCode) return directCode;

  const context = error && typeof error === 'object'
    ? (error as { context?: unknown }).context
    : null;
  const errorResponse = jsonResponseLike(response)
    ? response
    : jsonResponseLike(context)
    ? context
    : null;
  if (!errorResponse) return null;

  try {
    return errorCodeFromPayload(await errorResponse.json());
  } catch {
    return null;
  }
}

function boostActivationError(code: string | null): YearnBoostActivationError {
  if (code === 'not_configured') return new YearnBoostActivationError('not_configured');
  if (code && boostVerificationFailureCodes.has(code)) {
    return new YearnBoostActivationError('verification_failed');
  }
  return new YearnBoostActivationError('activation_failed');
}

export class YearnRepository {
  constructor(private readonly client: AnySupabaseClient) {}

  private async requireAuthenticatedUserId(action: string): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error) throw new Error(error.message);
    const userId = data.user?.id;
    if (!userId) throw new Error(`${action}: not authenticated`);
    return userId;
  }

  async fetchMyProfile(userId: string): Promise<YearnProfile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select(profileColumns)
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return mapProfile(profileRowSchema.parse(data));
  }

  async upsertMyProfile(
    userId: string,
    profile: YearnProfileUpsertInput,
  ): Promise<YearnProfile> {
    const payload = {
      id: userId,
      display_name: profile.displayName,
      birthday: profile.birthday,
      pronouns: profile.pronouns,
      custom_pronouns: profile.customPronouns,
      gender_identities: profile.genderIdentities,
      orientation_identities: profile.orientationIdentities,
      identity_visibility: profile.identityVisibility,
      orientation_consent_granted_at: profile.orientationConsentGrantedAt,
      orientation_consent_withdrawn_at: profile.orientationConsentWithdrawnAt,
      intention: profile.intention,
      relationship_structure: profile.relationshipStructure,
      photos: profile.photos,
      prompts: profile.prompts,
      interests: profile.interests,
      is_paused: profile.isPaused,
    };

    const { data, error } = await this.client
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select(profileColumns)
      .single();
    if (error) throw new Error(error.message);
    return mapProfile(profileRowSchema.parse(data));
  }

  async fetchDeck(limit = 30): Promise<YearnDiscoverProfile[]> {
    const { data, error } = await this.client.rpc('discover_profiles', {
      p_limit: limit,
    });
    if (error) throw new Error(error.message);
    return z.array(deckRowSchema).parse(data ?? []).map(mapDeckProfile);
  }

  async fetchIncomingLikes(): Promise<YearnIncomingLike[]> {
    const { data, error } = await this.client.rpc('incoming_likes');
    if (error) throw new Error(error.message);
    return z.array(incomingLikeRowSchema).parse(data ?? []).map(mapIncomingLike);
  }

  async sendLike(
    profileId: string,
    intro: string | null = null,
    introCiphertext: YearnIntroMessageCiphertext | null = null,
  ): Promise<YearnMatch | null> {
    const note = normalizeYearnIntroNote(intro);
    const encryptedIntro = normalizeYearnIntroMessageCiphertext(introCiphertext);
    if (note) {
      throw new Error('Plaintext intros are disabled. Send encrypted intro ciphertext instead.');
    }
    const params: {
      p_profile_id: string;
      p_note: string | null;
      p_intro_ciphertext?: YearnIntroMessageCiphertext;
    } = {
      p_profile_id: profileId,
      p_note: null,
    };
    if (encryptedIntro) params.p_intro_ciphertext = encryptedIntro;

    const { data, error } = await this.client.rpc('send_like', params);
    if (error) throw new Error(error.message);
    const [match] = z.array(matchRowSchema).parse(data ?? []).map(mapMatch);
    return match ?? null;
  }

  async publishE2eeDeviceKey(key: YearnE2eeDevicePublicKey): Promise<void> {
    const deviceKey = yearnE2eeDevicePublicKeySchema.parse(key);
    const userId = await this.requireAuthenticatedUserId('publishE2eeDeviceKey');
    if (deviceKey.userId !== userId) {
      throw new Error('publishE2eeDeviceKey: cannot publish another user device key');
    }

    const { error } = await this.client
      .from('e2ee_devices')
      .upsert({
        user_id: deviceKey.userId,
        device_id: deviceKey.deviceId,
        public_key: deviceKey.publicKey,
        key_algorithm: deviceKey.keyAlgorithm,
        is_active: true,
        created_at: deviceKey.createdAt,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'user_id,device_id' });
    if (error) throw new Error(error.message);
  }

  async fetchIntroRecipientDeviceKey(
    profileId: string,
  ): Promise<YearnE2eeDevicePublicKey | null> {
    const { data, error } = await this.client.rpc('intro_recipient_device_key', {
      p_profile_id: z.string().uuid().parse(profileId),
    });
    if (error) throw new Error(error.message);
    const [row] = z.array(e2eeDeviceKeyRowSchema).parse(data ?? []);
    return row ? mapE2eeDeviceKey(row) : null;
  }

  async sendPass(profileId: string): Promise<void> {
    const { error } = await this.client.rpc('send_pass', {
      p_profile_id: profileId,
    });
    if (error) throw new Error(error.message);
  }

  async likeBack(likeId: string): Promise<YearnMatch | null> {
    const { data, error } = await this.client.rpc('like_back', {
      p_like_id: likeId,
    });
    if (error) throw new Error(error.message);
    const [match] = z.array(matchRowSchema).parse(data ?? []).map(mapMatch);
    return match ?? null;
  }

  async dismissLike(likeId: string): Promise<void> {
    const { error } = await this.client.rpc('dismiss_like', {
      p_like_id: likeId,
    });
    if (error) throw new Error(error.message);
  }

  async blockUser(blockedId: string): Promise<void> {
    const targetUserId = z.string().uuid().parse(blockedId);
    const blockerId = await this.requireAuthenticatedUserId('blockUser');
    assertDifferentYearnUsers('blockUser', blockerId, targetUserId);

    const { error } = await this.client
      .from('blocks')
      .insert({
        blocker_id: blockerId,
        blocked_id: targetUserId,
      });
    if (error) throw new Error(error.message);
  }

  async reportUser(input: YearnReportUserInput): Promise<void> {
    const report = {
      reportedId: z.string().uuid().parse(input.reportedId),
      reason: reportReasonSchema.parse(input.reason),
      details: reportDetailsSchema.parse(input.details ?? null),
    };
    const reporterId = await this.requireAuthenticatedUserId('reportUser');
    assertDifferentYearnUsers('reportUser', reporterId, report.reportedId);

    const { error } = await this.client
      .from('reports')
      .insert({
        reporter_id: reporterId,
        reported_id: report.reportedId,
        reason: report.reason,
        details: report.details,
      });
    if (error) throw new Error(error.message);
  }

  async fetchMatches(): Promise<YearnMatch[]> {
    const { data, error } = await this.client.rpc('my_matches');
    if (error) throw new Error(error.message);
    return z.array(matchRowSchema).parse(data ?? []).map(mapMatch);
  }

  async archiveMatch(matchId: string): Promise<void> {
    const { error } = await this.client.rpc('archive_match', {
      p_match_id: matchId,
    });
    if (error) throw new Error(error.message);
  }

  async fetchEncryptedMessages(matchId: string): Promise<YearnEncryptedMessage[]> {
    const { data, error } = await this.client
      .from('messages_ciphertext')
      .select(encryptedMessageColumns)
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return z.array(encryptedMessageRowSchema).parse(data ?? []).map(mapEncryptedMessage);
  }

  async sendEncryptedMessage(
    matchId: string,
    ciphertext: YearnUserMessageCiphertext,
  ): Promise<YearnEncryptedMessage> {
    const encryptedMessage = normalizeYearnUserMessageCiphertext(ciphertext);
    const senderId = await this.requireAuthenticatedUserId('sendEncryptedMessage');
    const { data, error } = await this.client
      .from('messages_ciphertext')
      .insert({
        match_id: matchId,
        sender_id: senderId,
        kind: 'user',
        ciphertext: encryptedMessage,
      })
      .select(encryptedMessageColumns)
      .single();
    if (error) throw new Error(error.message);
    return mapEncryptedMessage(encryptedMessageRowSchema.parse(data));
  }

  async markEncryptedMessagesRead(matchId: string): Promise<void> {
    const senderId = await this.requireAuthenticatedUserId('markEncryptedMessagesRead');
    const { error } = await this.client
      .from('messages_ciphertext')
      .update({ read_at: new Date().toISOString() })
      .eq('match_id', matchId)
      .neq('sender_id', senderId)
      .is('read_at', null);
    if (error) throw new Error(error.message);
  }

  async currentMembership(): Promise<YearnMembership | null> {
    const { data, error } = await this.client.rpc('current_membership');
    if (error) throw new Error(error.message);
    const [membership] = z.array(membershipRowSchema).parse(data ?? []);
    if (!membership) return null;
    return {
      isMember: membership.is_member,
      status: membership.status,
      expiresAt: membership.expires_at,
    };
  }

  async activateBoost(
    signedTransaction: string,
  ): Promise<{ expiresAt: string; duplicate: boolean }> {
    let invocation: {
      data: unknown;
      error: unknown;
      response?: unknown;
    };
    try {
      invocation = await this.client.functions.invoke('yearn-boost-activate', {
        body: { signedTransaction },
      });
    } catch {
      throw new YearnBoostActivationError('activation_failed');
    }

    const serverErrorCode = await functionErrorCode(
      invocation.data,
      invocation.error,
      invocation.response,
    );
    if (invocation.error || serverErrorCode) throw boostActivationError(serverErrorCode);

    const parsed = boostActivationResponseSchema.safeParse(invocation.data);
    if (!parsed.success) throw new YearnBoostActivationError('activation_failed');
    return parsed.data;
  }

  async deleteMyAccount(): Promise<void> {
    await this.requireAuthenticatedUserId('deleteMyAccount');
    const { error } = await this.client.rpc('delete_my_account');
    if (error) throw new Error(error.message);
  }

  async activateMembership(
    signedTransaction: string,
  ): Promise<{ status: string; expiresAt: string; isMember: boolean }> {
    let invocation: {
      data: unknown;
      error: unknown;
      response?: unknown;
    };
    try {
      invocation = await this.client.functions.invoke('yearn-membership-activate', {
        body: { signedTransaction },
      });
    } catch {
      throw new YearnBoostActivationError('activation_failed');
    }

    const serverErrorCode = await functionErrorCode(
      invocation.data,
      invocation.error,
      invocation.response,
    );
    if (invocation.error || serverErrorCode) throw boostActivationError(serverErrorCode);

    const parsed = membershipActivationResponseSchema.safeParse(invocation.data);
    if (!parsed.success) throw new YearnBoostActivationError('activation_failed');
    return parsed.data;
  }

  async submitVerification(selfiePath: string): Promise<string> {
    const { data, error } = await this.client.rpc('submit_verification', {
      p_selfie_path: z.string().min(1).parse(selfiePath),
    });
    if (error) throw new Error(error.message);
    return z.string().uuid().parse(data);
  }

  async fetchMyVerification(): Promise<YearnVerificationState | null> {
    const userId = await this.requireAuthenticatedUserId('fetchMyVerification');
    const { data, error } = await this.client
      .from('verification_submissions')
      .select('id, status, review_reason, created_at, reviewed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = verificationRowSchema.parse(data);
    return {
      id: row.id,
      status: row.status,
      reviewReason: row.review_reason,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
    };
  }

  async updateMyLocation(latitude: number, longitude: number): Promise<void> {
    const { error } = await this.client.rpc('update_my_location', {
      p_latitude: latitudeSchema.parse(latitude),
      p_longitude: longitudeSchema.parse(longitude),
    });
    if (error) throw new Error(error.message);
  }

  async clearMyLocation(): Promise<void> {
    const { error } = await this.client.rpc('update_my_location', {
      p_latitude: null,
      p_longitude: null,
    });
    if (error) throw new Error(error.message);
  }

  async fetchDiscoveryPrefs(): Promise<YearnDiscoveryPrefs | null> {
    const userId = await this.requireAuthenticatedUserId('fetchDiscoveryPrefs');
    const { data, error } = await this.client
      .from('discovery_prefs')
      .select('min_age, max_age, max_distance_miles, intention_filter')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = discoveryPrefsRowSchema.parse(data);
    return {
      minAge: row.min_age,
      maxAge: row.max_age,
      maxDistanceMiles: row.max_distance_miles,
      intentionFilter: row.intention_filter,
    };
  }

  async saveDiscoveryPrefs(prefs: YearnDiscoveryPrefs): Promise<void> {
    const userId = await this.requireAuthenticatedUserId('saveDiscoveryPrefs');
    const parsed = discoveryPrefsInputSchema.parse(prefs);
    const { error } = await this.client
      .from('discovery_prefs')
      .upsert(
        {
          user_id: userId,
          min_age: parsed.minAge,
          max_age: parsed.maxAge,
          max_distance_miles: parsed.maxDistanceMiles,
          intention_filter: parsed.intentionFilter,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (error) throw new Error(error.message);
  }
}
