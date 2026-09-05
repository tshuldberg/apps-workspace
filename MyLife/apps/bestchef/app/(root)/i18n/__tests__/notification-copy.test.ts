import { describe, expect, it } from 'vitest';
import { renderActivityCopy, renderNotificationCopy, tierLabel } from '../notification-copy';

// Echo-style t: returns the key with params substituted, so assertions can
// verify both key selection and param wiring without loading catalogs.
function t(key: string, params?: Record<string, string>): string {
  let out = key;
  for (const [name, value] of Object.entries(params ?? {})) {
    out = out.split(`{${name}}`).join(value);
  }
  return out;
}

describe('typed notification rendering (plan 33 Phase 2.1)', () => {
  it('renders typed rows from kind + params, never stored copy', () => {
    const copy = renderNotificationCopy(
      {
        kind: 'upvote',
        params: { actor_name: 'Chef Nakamura', dish_title: 'Shoyu Ramen' },
        title: '',
        body: '',
      },
      t,
    );
    expect(copy.title).toBe('Chef Nakamura upvoted your recipe');
    expect(copy.body).toBe('Shoyu Ramen');
  });

  it('distinguishes comment replies and localizes tier labels', () => {
    const reply = renderNotificationCopy(
      { kind: 'comment', params: { actor_name: 'Ana', snippet: 'Nice!', reply: true }, title: '' },
      t,
    );
    expect(reply.title).toBe('Ana replied to your comment');
    expect(reply.body).toBe('Nice!');

    const rated = renderNotificationCopy(
      { kind: 'reviewed_vote', params: { actor_name: 'Ana', tier: 'silver' }, title: '' },
      t,
    );
    expect(rated.body).toBe("As good as momma's");
    expect(tierLabel('gold', t)).toBe('Best Chef');
  });

  it('picks the singular/plural rank body form', () => {
    const single = renderNotificationCopy(
      { kind: 'rank_up', params: { new_rank: 7, old_rank: 8, delta: 1 }, title: '' },
      t,
    );
    expect(single.title).toBe('You moved up to #7');
    expect(single.body).toBe('Up 1 rank this week');

    const milestone = renderNotificationCopy(
      { kind: 'rank_milestone', params: { new_rank: 3, old_rank: 12, delta: 9 }, title: '' },
      t,
    );
    expect(milestone.title).toBe('You climbed to #3!');
    expect(milestone.body).toBe('Up 9 ranks this week');
  });

  it('routes the rank delta through the plural engine when tp is provided (Phase 3.5)', () => {
    const tpCalls: Array<{ count: number; singular: string; plural: string }> = [];
    const tp = (count: number, singular: string, plural: string, params?: Record<string, string>) => {
      tpCalls.push({ count, singular, plural });
      return t(count === 1 ? singular : plural, params);
    };

    const copy = renderNotificationCopy(
      { kind: 'rank_up', params: { new_rank: 5, old_rank: 8, delta: 3 }, title: '' },
      t,
      tp,
    );
    expect(copy.body).toBe('Up 3 ranks this week');
    expect(tpCalls).toEqual([
      { count: 3, singular: 'Up {delta} rank this week', plural: 'Up {delta} ranks this week' },
    ]);
  });

  it('routes upvote counts through the plural engine in activity copy', () => {
    const tp = (count: number, singular: string, plural: string, params?: Record<string, string>) =>
      t(count === 1 ? singular : plural, params);
    const one = renderActivityCopy(
      { kind: 'upvotes', params: { count: 1 }, title: '', subtitle: '' },
      t,
      (iso) => iso,
      tp,
    );
    expect(one.title).toBe('1 new upvote');
    const many = renderActivityCopy(
      { kind: 'upvotes', params: { count: 4 }, title: '', subtitle: '' },
      t,
      (iso) => iso,
      tp,
    );
    expect(many.title).toBe('4 new upvotes');
  });

  it('falls back to the two-form branch when the delta is not numeric', () => {
    const tp = () => {
      throw new Error('tp must not be called for a non-numeric delta');
    };
    const copy = renderNotificationCopy(
      { kind: 'rank_up', params: { new_rank: 5, delta: 'lots' }, title: '' },
      t,
      tp,
    );
    expect(copy.body).toBe('Up lots ranks this week');
  });

  it('falls back to a translatable Someone when the actor is missing', () => {
    const copy = renderNotificationCopy({ kind: 'follow', params: { reply: false }, title: '' }, t);
    expect(copy.title).toBe('Someone started following you');
  });

  it('renders legacy pre-params rows with their stored copy', () => {
    const copy = renderNotificationCopy(
      { kind: 'comment', params: {}, title: 'Old English title', body: 'Old body' },
      t,
    );
    expect(copy.title).toBe('Old English title');
    expect(copy.body).toBe('Old body');
  });

  it('renders activity entries from params with client-side dates', () => {
    const copy = renderActivityCopy(
      {
        kind: 'rank_change',
        params: { rank: 4, week: '2026-06-29' },
        title: 'Climbed to #4',
        subtitle: 'Week of Jun 29',
      },
      t,
      () => '29 juin',
    );
    expect(copy.title).toBe('Climbed to #4');
    expect(copy.subtitle).toBe('Week of 29 juin');

    const legacy = renderActivityCopy(
      { kind: 'rank_change', params: {}, title: 'Climbed to #9', subtitle: 'Week of Jun 01' },
      t,
      (d) => d,
    );
    expect(legacy.subtitle).toBe('Week of Jun 01');
  });

  // Statement of reasons (audit H4 / DSA Art. 17). These kinds must render
  // real localized copy, never a blank row.
  it('renders a moderation_decision with decision title, reason, and appeal line', () => {
    const copy = renderNotificationCopy(
      {
        kind: 'moderation_decision',
        params: {
          content_type: 'submission',
          content_title: 'Shoyu Ramen',
          decision: 'removed',
          reason_category: 'sexual_content',
          appeal_available: true,
        },
        title: '',
      },
      t,
    );
    expect(copy.title).toBe('Your content was removed');
    expect(copy.body).toContain('Sexual content');
    expect(copy.body).toContain('You can appeal this decision.');
  });

  it('omits the appeal line when no appeal is available', () => {
    const copy = renderNotificationCopy(
      {
        kind: 'moderation_decision',
        params: { decision: 'hidden', reason_category: 'spam', appeal_available: false },
        title: '',
      },
      t,
    );
    expect(copy.title).toBe('Your content was hidden');
    expect(copy.body).toContain('Spam or scams');
    expect(copy.body).not.toContain('You can appeal this decision.');
  });

  it('falls back to community guidelines for an unknown reason category', () => {
    const copy = renderNotificationCopy(
      {
        kind: 'moderation_decision',
        params: { decision: 'rejected', reason_category: 'unmapped', appeal_available: true },
        title: '',
      },
      t,
    );
    expect(copy.title).toBe('Your content was not approved');
    expect(copy.body).toContain('Community guidelines');
  });

  it('renders appeal_resolved outcomes (overturned vs upheld), never blank', () => {
    const overturned = renderNotificationCopy(
      { kind: 'appeal_resolved', params: { outcome: 'overturned' }, title: '' },
      t,
    );
    expect(overturned.title).toBe('Your appeal was approved');
    expect(overturned.body).toBe('We restored your content after review.');

    const upheld = renderNotificationCopy(
      { kind: 'appeal_resolved', params: { outcome: 'upheld' }, title: '' },
      t,
    );
    expect(upheld.title).toBe('Your appeal was reviewed');
    expect(upheld.body).toBe('After review, the original decision stands.');
  });
});
