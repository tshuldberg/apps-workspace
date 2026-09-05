import { describe, expect, it } from 'vitest';
import { newArticleId, newDraftId, newFollowId } from '../(root)/lib/ids';

describe('client id generation', () => {
  it('shapes draft ids as d-<base36>-<6 chars>', () => {
    expect(newDraftId()).toMatch(/^d-[0-9a-z]+-[0-9a-z]{6}$/);
  });

  it('shapes article ids as a-<base36>-<6 chars>', () => {
    expect(newArticleId()).toMatch(/^a-[0-9a-z]+-[0-9a-z]{6}$/);
  });

  it('shapes follow ids as f-<base36>-<6 chars>', () => {
    expect(newFollowId()).toMatch(/^f-[0-9a-z]+-[0-9a-z]{6}$/);
  });

  it('produces distinct ids across calls', () => {
    const ids = new Set([newDraftId(), newDraftId(), newDraftId(), newDraftId()]);
    expect(ids.size).toBe(4);
  });
});
