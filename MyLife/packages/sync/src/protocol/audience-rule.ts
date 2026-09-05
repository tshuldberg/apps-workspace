export type AudienceType =
  | 'only_me'
  | 'friends'
  | 'connections'
  | 'selected_people'
  | 'this_community'
  | 'public';

export type AudienceActorSet =
  | { kind: 'none' }
  | { kind: 'self' }
  | { kind: 'friends' }
  | { kind: 'connections' }
  | { kind: 'selected_people'; deviceIds: readonly string[] }
  | { kind: 'community'; communityId: string }
  | { kind: 'public' };

export interface AudienceRule {
  type: AudienceType;
  label: string;
  explanation: string;
  replyNotice: string;
  hostedNotice: string | null;
  allowedViewers: AudienceActorSet;
  allowedReplyWriters: AudienceActorSet;
  repliesInherit: true;
  canExpandAfterReplies: boolean;
  requiresHostedStorage: boolean;
  publicModerationRequired: boolean;
}

export type AudienceRuleInput =
  | { type: 'only_me' }
  | { type: 'friends' }
  | { type: 'connections' }
  | { type: 'selected_people'; deviceIds: readonly string[] }
  | { type: 'this_community'; communityId: string }
  | { type: 'public' };

export type ReplyAudienceRejectReason =
  | 'audience_mismatch'
  | 'reply_disabled';

export type ReplyAudienceValidation =
  | { ok: true; rule: AudienceRule }
  | { ok: false; reason: ReplyAudienceRejectReason };

const AUDIENCE_LABELS: Record<AudienceType, string> = {
  only_me: 'Only me',
  friends: 'Friends',
  connections: 'Connections',
  selected_people: 'Selected people',
  this_community: 'This community',
  public: 'Public',
};

function uniqueSortedDeviceIds(deviceIds: readonly string[]): string[] {
  return Array.from(new Set(deviceIds.map((id) => id.trim()).filter(Boolean))).sort();
}

function actorSetKey(set: AudienceActorSet): string {
  if (set.kind !== 'selected_people') return JSON.stringify(set);
  return JSON.stringify({ kind: set.kind, deviceIds: uniqueSortedDeviceIds(set.deviceIds) });
}

function cloneActorSet(set: AudienceActorSet): AudienceActorSet {
  if (set.kind !== 'selected_people') return { ...set };
  return { kind: 'selected_people', deviceIds: uniqueSortedDeviceIds(set.deviceIds) };
}

function audienceCopy(input: AudienceRuleInput): Pick<
  AudienceRule,
  'explanation' | 'replyNotice' | 'hostedNotice'
> {
  switch (input.type) {
    case 'only_me':
      return {
        explanation: 'Only you can see this.',
        replyNotice: 'Replies are turned off.',
        hostedNotice: null,
      };
    case 'friends':
      return {
        explanation: 'Only your friends can see this.',
        replyNotice: 'Replies stay friends-only.',
        hostedNotice: null,
      };
    case 'connections':
      return {
        explanation: 'Only your trusted connections can see this.',
        replyNotice: 'Replies stay inside the original audience.',
        hostedNotice: null,
      };
    case 'selected_people':
      return {
        explanation: 'Only the people you choose can see this.',
        replyNotice: 'Replies stay with the same selected people.',
        hostedNotice: null,
      };
    case 'this_community':
      return {
        explanation: 'Members with access to this community channel can see this.',
        replyNotice: 'Replies stay in this community.',
        hostedNotice: null,
      };
    case 'public':
      return {
        explanation: 'Anyone with public access can see this.',
        replyNotice: 'Replies are public too.',
        hostedNotice: 'Public posts use hosted storage and moderation.',
      };
  }
}

function audienceActors(input: AudienceRuleInput): Pick<AudienceRule, 'allowedViewers' | 'allowedReplyWriters'> {
  switch (input.type) {
    case 'only_me':
      return { allowedViewers: { kind: 'self' }, allowedReplyWriters: { kind: 'none' } };
    case 'friends':
      return { allowedViewers: { kind: 'friends' }, allowedReplyWriters: { kind: 'friends' } };
    case 'connections':
      return { allowedViewers: { kind: 'connections' }, allowedReplyWriters: { kind: 'connections' } };
    case 'selected_people': {
      const deviceIds = uniqueSortedDeviceIds(input.deviceIds);
      return {
        allowedViewers: { kind: 'selected_people', deviceIds },
        allowedReplyWriters: { kind: 'selected_people', deviceIds },
      };
    }
    case 'this_community':
      return {
        allowedViewers: { kind: 'community', communityId: input.communityId },
        allowedReplyWriters: { kind: 'community', communityId: input.communityId },
      };
    case 'public':
      return { allowedViewers: { kind: 'public' }, allowedReplyWriters: { kind: 'public' } };
  }
}

export function createAudienceRule(input: AudienceRuleInput): AudienceRule {
  const copy = audienceCopy(input);
  const actors = audienceActors(input);
  return {
    type: input.type,
    label: AUDIENCE_LABELS[input.type],
    explanation: copy.explanation,
    replyNotice: copy.replyNotice,
    hostedNotice: copy.hostedNotice,
    allowedViewers: actors.allowedViewers,
    allowedReplyWriters: actors.allowedReplyWriters,
    repliesInherit: true,
    canExpandAfterReplies: false,
    requiresHostedStorage: input.type === 'public',
    publicModerationRequired: input.type === 'public',
  };
}

export function createCommunityAudienceRule(communityId: string): AudienceRule {
  return createAudienceRule({ type: 'this_community', communityId });
}

export function cloneAudienceRule(rule: AudienceRule): AudienceRule {
  return {
    ...rule,
    allowedViewers: cloneActorSet(rule.allowedViewers),
    allowedReplyWriters: cloneActorSet(rule.allowedReplyWriters),
  };
}

export function audienceRulesEqual(a: AudienceRule, b: AudienceRule): boolean {
  return a.type === b.type
    && actorSetKey(a.allowedViewers) === actorSetKey(b.allowedViewers)
    && actorSetKey(a.allowedReplyWriters) === actorSetKey(b.allowedReplyWriters)
    && a.repliesInherit === b.repliesInherit
    && a.requiresHostedStorage === b.requiresHostedStorage
    && a.publicModerationRequired === b.publicModerationRequired;
}

export function createReplyAudienceRule(parentRule: AudienceRule): AudienceRule {
  if (parentRule.allowedReplyWriters.kind === 'none') {
    throw new Error('This audience does not allow replies.');
  }
  return cloneAudienceRule(parentRule);
}

export function validateReplyAudience(
  parentRule: AudienceRule,
  proposedReplyRule: AudienceRule,
): ReplyAudienceValidation {
  if (parentRule.allowedReplyWriters.kind === 'none') {
    return { ok: false, reason: 'reply_disabled' };
  }
  if (!audienceRulesEqual(parentRule, proposedReplyRule)) {
    return { ok: false, reason: 'audience_mismatch' };
  }
  return { ok: true, rule: cloneAudienceRule(parentRule) };
}
