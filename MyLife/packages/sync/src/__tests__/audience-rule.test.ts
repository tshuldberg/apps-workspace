import { describe, expect, it } from 'vitest';
import {
  audienceRulesEqual,
  createAudienceRule,
  createCommunityAudienceRule,
  createReplyAudienceRule,
  validateReplyAudience,
} from '../protocol/audience-rule';

describe('audience rules', () => {
  it('defines the V1 audience labels and public hosted flags', () => {
    expect(createAudienceRule({ type: 'only_me' }).label).toBe('Only me');
    expect(createAudienceRule({ type: 'friends' }).replyNotice).toBe('Replies stay friends-only.');
    expect(createAudienceRule({ type: 'connections' }).label).toBe('Connections');
    expect(createAudienceRule({ type: 'selected_people', deviceIds: ['b', 'a', 'a'] }).allowedViewers)
      .toEqual({ kind: 'selected_people', deviceIds: ['a', 'b'] });
    expect(createCommunityAudienceRule('family').allowedReplyWriters)
      .toEqual({ kind: 'community', communityId: 'family' });

    const publicRule = createAudienceRule({ type: 'public' });
    expect(publicRule.label).toBe('Public');
    expect(publicRule.requiresHostedStorage).toBe(true);
    expect(publicRule.publicModerationRequired).toBe(true);
    expect(publicRule.hostedNotice).toBe('Public posts use hosted storage and moderation.');
  });

  it('derives replies from the original audience rule', () => {
    const parent = createCommunityAudienceRule('book-club');
    const reply = createReplyAudienceRule(parent);

    expect(reply).not.toBe(parent);
    expect(audienceRulesEqual(reply, parent)).toBe(true);
    expect(validateReplyAudience(parent, reply)).toEqual({ ok: true, rule: reply });
  });

  it('blocks a reply from expanding a private audience to public', () => {
    const parent = createAudienceRule({ type: 'friends' });
    const publicReply = createAudienceRule({ type: 'public' });

    expect(validateReplyAudience(parent, publicReply)).toEqual({
      ok: false,
      reason: 'audience_mismatch',
    });
  });

  it('blocks selected-people replies from adding a new viewer', () => {
    const parent = createAudienceRule({ type: 'selected_people', deviceIds: ['alice', 'bob'] });
    const expandedReply = createAudienceRule({ type: 'selected_people', deviceIds: ['alice', 'bob', 'cara'] });

    expect(validateReplyAudience(parent, expandedReply)).toEqual({
      ok: false,
      reason: 'audience_mismatch',
    });
  });

  it('does not allow replies to Only me items', () => {
    const parent = createAudienceRule({ type: 'only_me' });
    const reply = createAudienceRule({ type: 'only_me' });

    expect(() => createReplyAudienceRule(parent)).toThrow('This audience does not allow replies.');
    expect(validateReplyAudience(parent, reply)).toEqual({
      ok: false,
      reason: 'reply_disabled',
    });
  });
});
