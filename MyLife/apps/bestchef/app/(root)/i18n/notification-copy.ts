/**
 * Localized rendering of typed notifications + activity entries
 * (plan 33 Phase 2.1, finding N1).
 *
 * The backend stores kind + params only; this module turns them into copy in
 * the user's app language. Legacy rows written before the type+params
 * migration still carry stored English title/body; those render as-is
 * (fallback) rather than pretending to be localized.
 */

export type TranslateFn = (key: string, params?: Record<string, string>) => string;

/** Matches I18nProvider's tp: full CLDR category selection (Phase 3.5). */
export type TranslatePluralFn = (
  count: number,
  singularKey: string,
  pluralKey: string,
  params?: Record<string, string>,
) => string;

interface TypedCopySource {
  kind: string;
  params: Record<string, unknown>;
  title: string;
  body?: string;
  subtitle?: string;
}

function str(params: Record<string, unknown>, key: string): string | null {
  const value = params[key];
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function tierLabel(tier: string | null, t: TranslateFn): string {
  switch (tier) {
    case 'gold':
      return t('Best Chef');
    case 'silver':
      return t("As good as momma's");
    case 'bronze':
      return t("I'd eat that");
    default:
      return tier ?? '';
  }
}

function actorName(params: Record<string, unknown>, t: TranslateFn): string {
  return str(params, 'actor_name') ?? t('Someone');
}

/**
 * Rank-delta copy through the CLDR plural engine when available; the
 * two-form branch remains only as the no-tp fallback (Phase 3.5).
 */
function renderRankDelta(delta: string, t: TranslateFn, tp?: TranslatePluralFn): string {
  const count = Number.parseInt(delta, 10);
  if (tp && Number.isFinite(count)) {
    return tp(count, 'Up {delta} rank this week', 'Up {delta} ranks this week', { delta });
  }
  return count === 1
    ? t('Up {delta} rank this week', { delta })
    : t('Up {delta} ranks this week', { delta });
}

/** Localized {title, body} for a bc_notifications row. */
export function renderNotificationCopy(
  notification: TypedCopySource,
  t: TranslateFn,
  tp?: TranslatePluralFn,
): { title: string; body: string } {
  const { kind, params } = notification;
  const hasParams = Object.keys(params ?? {}).length > 0;

  // Pre-migration rows: no params, stored English copy. Render stored copy.
  if (!hasParams && notification.title) {
    return { title: notification.title, body: notification.body ?? '' };
  }

  switch (kind) {
    case 'upvote':
      return {
        title: t('{actorName} upvoted your recipe', { actorName: actorName(params, t) }),
        body: str(params, 'dish_title') ?? '',
      };
    case 'reviewed_vote':
      return {
        title: t('{actorName} rated your recipe', { actorName: actorName(params, t) }),
        body: tierLabel(str(params, 'tier'), t),
      };
    case 'follow':
      return {
        title: t('{actorName} started following you', { actorName: actorName(params, t) }),
        body: '',
      };
    case 'comment':
      return {
        title: params['reply'] === true
          ? t('{actorName} replied to your comment', { actorName: actorName(params, t) })
          : t('{actorName} commented on your recipe', { actorName: actorName(params, t) }),
        body: str(params, 'snippet') ?? '',
      };
    case 'mention':
      return {
        title: t('{actorName} mentioned you in a comment', { actorName: actorName(params, t) }),
        body: str(params, 'snippet') ?? '',
      };
    case 'rank_up':
    case 'rank_milestone': {
      const rank = str(params, 'new_rank') ?? '';
      const delta = str(params, 'delta') ?? '';
      return {
        title: kind === 'rank_milestone'
          ? t('You climbed to #{rank}!', { rank })
          : t('You moved up to #{rank}', { rank }),
        body: renderRankDelta(delta, t, tp),
      };
    }
    case 'badge':
      return {
        title: t('{badgeName} unlocked', { badgeName: str(params, 'badge_name') ?? '' }),
        body: str(params, 'badge_description') ?? '',
      };
    case 'moderation_decision': {
      // Statement of reasons (DSA Art. 17). Title states the decision; body
      // gives the reason category + how to appeal.
      const decision = str(params, 'decision') ?? '';
      const reasonLabel = moderationReasonLabel(str(params, 'reason_category'), t);
      const appealAvailable = params['appeal_available'] === true;
      const reasonLine = t('Reason: {reason}.', { reason: reasonLabel });
      return {
        title: moderationDecisionTitle(decision, t),
        body: appealAvailable
          ? `${reasonLine} ${t('You can appeal this decision.')}`
          : reasonLine,
      };
    }
    case 'appeal_resolved': {
      const outcome = str(params, 'outcome') ?? '';
      return {
        title: outcome === 'overturned'
          ? t('Your appeal was approved')
          : t('Your appeal was reviewed'),
        body: outcome === 'overturned'
          ? t('We restored your content after review.')
          : t('After review, the original decision stands.'),
      };
    }
    default:
      return { title: notification.title, body: notification.body ?? '' };
  }
}

/** Localized title for a moderation decision on the user's own content. */
export function moderationDecisionTitle(decision: string, t: TranslateFn): string {
  switch (decision) {
    case 'removed':
      return t('Your content was removed');
    case 'hidden':
      return t('Your content was hidden');
    case 'rejected':
      return t('Your content was not approved');
    default:
      return t('A decision was made about your content');
  }
}

/** Localized label for a coarse moderation reason category. */
export function moderationReasonLabel(category: string | null, t: TranslateFn): string {
  switch (category) {
    case 'child_safety':
      return t('Child safety');
    case 'sexual_content':
      return t('Sexual content');
    case 'harassment':
      return t('Harassment or hate');
    case 'spam':
      return t('Spam or scams');
    case 'violence':
      return t('Violence or graphic content');
    case 'intellectual_property':
      return t('Intellectual property');
    case 'vote_integrity':
      return t('Vote integrity');
    case 'guidelines':
      return t('Community guidelines');
    default:
      return t('Community guidelines');
  }
}

/** Localized {title, subtitle} for a bc_profile_activity_v entry. */
export function renderActivityCopy(
  entry: TypedCopySource,
  t: TranslateFn,
  formatDate: (isoDate: string) => string,
  tp?: TranslatePluralFn,
): { title: string; subtitle: string } {
  const { kind, params } = entry;
  const hasParams = Object.keys(params ?? {}).length > 0;

  switch (kind) {
    case 'rank_change': {
      if (!hasParams) break;
      const week = str(params, 'week');
      return {
        title: t('Climbed to #{rank}', { rank: str(params, 'rank') ?? '' }),
        subtitle: week ? t('Week of {date}', { date: formatDate(week) }) : '',
      };
    }
    case 'reviewed_vote': {
      if (!hasParams) break;
      return {
        title: t('{tier} vote received', { tier: tierLabel(str(params, 'tier'), t) }),
        subtitle: t('On your submission'),
      };
    }
    case 'new_follower':
      return { title: t('New follower'), subtitle: '' };
    case 'upvotes': {
      if (!hasParams) break;
      const count = Number.parseInt(str(params, 'count') ?? '', 10);
      return {
        title: tp && Number.isFinite(count)
          ? tp(count, '{count} new upvote', '{count} new upvotes', { count: String(count) })
          : t('{count} new upvotes', { count: str(params, 'count') ?? '' }),
        subtitle: t('On your submission'),
      };
    }
    case 'badge': {
      if (!hasParams) break;
      return {
        title: t('{badgeName} unlocked', { badgeName: str(params, 'badge_name') ?? '' }),
        subtitle: str(params, 'badge_description') ?? '',
      };
    }
    case 'posted_recipe':
      return { title: t('Posted a recipe'), subtitle: t('Entered the competition') };
    default:
      break;
  }
  // Legacy fallback: server-baked English copy.
  return { title: entry.title, subtitle: entry.subtitle ?? '' };
}
