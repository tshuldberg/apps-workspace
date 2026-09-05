import { describe, it, expect } from 'vitest';
import {
  evaluateNoteConsensus,
  checkAutoAction,
  buildProductContributionStatusPatch,
  buildPublicContentModerationStatusPatch,
  canPublishProductEvidence,
  BESTCHEF_MODERATION_RATE_LIMITS,
  MIN_RATINGS,
  MIN_HELPFUL_RATIO,
  MIN_UNIQUE_RATERS,
  sanitizeProductContributionPayload,
  validateProductContributionSubmission,
} from '../moderation';
import type { Note, NoteRating } from '../types';

// ── Helpers ─────────────────────────────────────────────────────────

function makeRating(
  noteId: string,
  raterId: string,
  rating: 'helpful' | 'unhelpful',
): NoteRating {
  return {
    noteId,
    raterId,
    rating,
    createdAt: new Date(),
  };
}

function makeRatings(
  noteId: string,
  helpful: number,
  unhelpful: number,
  uniqueRaters?: number,
): NoteRating[] {
  const ratings: NoteRating[] = [];
  const raterCount = uniqueRaters ?? helpful + unhelpful;

  for (let i = 0; i < helpful; i++) {
    const raterId = i < raterCount ? `rater-${i}` : `rater-${i % raterCount}`;
    ratings.push(makeRating(noteId, raterId, 'helpful'));
  }
  for (let i = 0; i < unhelpful; i++) {
    const raterId =
      helpful + i < raterCount
        ? `rater-${helpful + i}`
        : `rater-${(helpful + i) % raterCount}`;
    ratings.push(makeRating(noteId, raterId, 'unhelpful'));
  }
  return ratings;
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? 'note-1',
    flagId: overrides.flagId ?? 'flag-1',
    authorId: overrides.authorId ?? 'author-1',
    body: overrides.body ?? 'This is a community note.',
    helpfulCount: overrides.helpfulCount ?? 0,
    unhelpfulCount: overrides.unhelpfulCount ?? 0,
    status: overrides.status ?? 'pending',
    createdAt: overrides.createdAt ?? new Date(),
  };
}

// ── Constants ───────────────────────────────────────────────────────

describe('moderation constants', () => {
  it('exports expected threshold values', () => {
    expect(MIN_RATINGS).toBe(5);
    expect(MIN_HELPFUL_RATIO).toBe(0.7);
    expect(MIN_UNIQUE_RATERS).toBe(3);
  });

  it('documents public launch abuse thresholds for server-side enforcement', () => {
    expect(BESTCHEF_MODERATION_RATE_LIMITS).toMatchObject({
      providerCallsPerProfilePerMinute: 20,
      mediaUploadsPerProfilePerHour: 30,
      submissionsPerProfilePerHour: 12,
      commentsPerProfilePerMinute: 6,
      votesPerProfilePerMinute: 30,
      reportsPerProfilePerHour: 10,
      profileEditsPerProfilePerHour: 12,
    });
  });
});

// ── evaluateNoteConsensus ───────────────────────────────────────────

describe('evaluateNoteConsensus', () => {
  it('returns shouldShow false when below minimum ratings threshold', () => {
    // 4 ratings (below MIN_RATINGS of 5)
    const ratings = makeRatings('note-1', 4, 0);
    const result = evaluateNoteConsensus(ratings);
    expect(result.shouldShow).toBe(false);
    expect(result.totalRatings).toBe(4);
  });

  it('returns shouldShow false with zero ratings', () => {
    const result = evaluateNoteConsensus([]);
    expect(result.shouldShow).toBe(false);
    expect(result.totalRatings).toBe(0);
    expect(result.helpfulRatio).toBe(0);
    expect(result.uniqueRaters).toBe(0);
  });

  it('returns shouldShow false when above threshold but below helpful ratio', () => {
    // 3 helpful, 4 unhelpful = 42.8% helpful (below 70%)
    const ratings = makeRatings('note-1', 3, 4);
    const result = evaluateNoteConsensus(ratings);
    expect(result.shouldShow).toBe(false);
    expect(result.totalRatings).toBe(7);
    expect(result.helpfulRatio).toBeLessThan(MIN_HELPFUL_RATIO);
  });

  it('returns shouldShow true when all criteria met', () => {
    // 5 helpful, 1 unhelpful = 83.3% helpful, 6 unique raters
    const ratings = makeRatings('note-1', 5, 1);
    const result = evaluateNoteConsensus(ratings);
    expect(result.shouldShow).toBe(true);
    expect(result.totalRatings).toBe(6);
    expect(result.helpfulRatio).toBeGreaterThanOrEqual(MIN_HELPFUL_RATIO);
    expect(result.uniqueRaters).toBeGreaterThanOrEqual(MIN_UNIQUE_RATERS);
  });

  it('handles exactly at 70% threshold (should show)', () => {
    // 7 helpful, 3 unhelpful = exactly 70%
    const ratings = makeRatings('note-1', 7, 3);
    const result = evaluateNoteConsensus(ratings);
    expect(result.shouldShow).toBe(true);
    expect(result.helpfulRatio).toBe(0.7);
  });

  it('handles just below 70% threshold (should not show)', () => {
    // We need a ratio just below 0.7.
    // 6 helpful, 3 unhelpful = 66.7% (below 70%, 9 raters)
    const ratings = makeRatings('note-1', 6, 3);
    const result = evaluateNoteConsensus(ratings);
    expect(result.shouldShow).toBe(false);
    expect(result.helpfulRatio).toBeLessThan(MIN_HELPFUL_RATIO);
  });

  it('returns shouldShow false when not enough unique raters', () => {
    // 5 helpful ratings but only from 2 unique raters
    const ratings: NoteRating[] = [
      makeRating('note-1', 'rater-A', 'helpful'),
      makeRating('note-1', 'rater-B', 'helpful'),
      makeRating('note-1', 'rater-A', 'helpful'),
      makeRating('note-1', 'rater-B', 'helpful'),
      makeRating('note-1', 'rater-A', 'helpful'),
    ];
    const result = evaluateNoteConsensus(ratings);
    expect(result.shouldShow).toBe(false);
    expect(result.uniqueRaters).toBe(2);
    expect(result.uniqueRaters).toBeLessThan(MIN_UNIQUE_RATERS);
  });

  it('counts unique raters correctly with duplicates', () => {
    const ratings: NoteRating[] = [
      makeRating('note-1', 'rater-A', 'helpful'),
      makeRating('note-1', 'rater-B', 'helpful'),
      makeRating('note-1', 'rater-C', 'helpful'),
      makeRating('note-1', 'rater-A', 'helpful'),
      makeRating('note-1', 'rater-B', 'helpful'),
    ];
    const result = evaluateNoteConsensus(ratings);
    expect(result.uniqueRaters).toBe(3);
  });

  it('rounds helpfulRatio to 3 decimal places', () => {
    // 2 helpful, 1 unhelpful = 0.66666...
    const ratings = makeRatings('note-1', 2, 1);
    const result = evaluateNoteConsensus(ratings);
    const decimalPlaces = result.helpfulRatio.toString().split('.')[1]?.length ?? 0;
    expect(decimalPlaces).toBeLessThanOrEqual(3);
  });

  it('returns all unanimous helpful ratings as shouldShow true', () => {
    // 6 helpful, 0 unhelpful = 100%
    const ratings = makeRatings('note-1', 6, 0);
    const result = evaluateNoteConsensus(ratings);
    expect(result.shouldShow).toBe(true);
    expect(result.helpfulRatio).toBe(1);
  });

  it('returns all unanimous unhelpful ratings as shouldShow false', () => {
    // 0 helpful, 6 unhelpful = 0%
    const ratings = makeRatings('note-1', 0, 6);
    const result = evaluateNoteConsensus(ratings);
    expect(result.shouldShow).toBe(false);
    expect(result.helpfulRatio).toBe(0);
  });
});

// ── checkAutoAction ─────────────────────────────────────────────────

describe('checkAutoAction', () => {
  it('returns no action when no notes are shown', () => {
    const notes = [makeNote({ status: 'pending' })];
    const ratingsMap = new Map<string, NoteRating[]>();
    const result = checkAutoAction(notes, ratingsMap);
    expect(result.shouldAct).toBe(false);
    expect(result.action).toBe('none');
  });

  it('returns no action with empty notes array', () => {
    const result = checkAutoAction([], new Map());
    expect(result.shouldAct).toBe(false);
    expect(result.action).toBe('none');
  });

  it('returns no action when shown note has low consensus', () => {
    // Shown note but only 50% helpful (below 0.8 threshold)
    const note = makeNote({ id: 'note-1', status: 'shown' });
    const ratings = makeRatings('note-1', 3, 3);
    const ratingsMap = new Map([['note-1', ratings]]);
    const result = checkAutoAction([note], ratingsMap);
    expect(result.shouldAct).toBe(false);
    expect(result.action).toBe('none');
  });

  it('returns demote when shown note has high consensus (>= 0.8)', () => {
    // 5 helpful, 1 unhelpful = 83.3% from 6 unique raters
    const note = makeNote({ id: 'note-1', status: 'shown' });
    const ratings = makeRatings('note-1', 5, 1);
    const ratingsMap = new Map([['note-1', ratings]]);
    const result = checkAutoAction([note], ratingsMap);
    expect(result.shouldAct).toBe(true);
    expect(result.action).toBe('demote');
  });

  it('returns demote for exactly 80% helpful ratio', () => {
    // 4 helpful, 1 unhelpful = 80% from 5 unique raters
    const note = makeNote({ id: 'note-1', status: 'shown' });
    const ratings = makeRatings('note-1', 4, 1);
    const ratingsMap = new Map([['note-1', ratings]]);
    const result = checkAutoAction([note], ratingsMap);
    expect(result.shouldAct).toBe(true);
    expect(result.action).toBe('demote');
  });

  it('skips hidden notes even with high consensus ratings', () => {
    const note = makeNote({ id: 'note-1', status: 'hidden' });
    const ratings = makeRatings('note-1', 10, 0);
    const ratingsMap = new Map([['note-1', ratings]]);
    const result = checkAutoAction([note], ratingsMap);
    expect(result.shouldAct).toBe(false);
    expect(result.action).toBe('none');
  });

  it('skips pending notes even with high consensus ratings', () => {
    const note = makeNote({ id: 'note-1', status: 'pending' });
    const ratings = makeRatings('note-1', 10, 0);
    const ratingsMap = new Map([['note-1', ratings]]);
    const result = checkAutoAction([note], ratingsMap);
    expect(result.shouldAct).toBe(false);
    expect(result.action).toBe('none');
  });

  it('returns demote on first qualifying note in a list', () => {
    const notes = [
      makeNote({ id: 'note-1', status: 'pending' }),
      makeNote({ id: 'note-2', status: 'shown' }),
      makeNote({ id: 'note-3', status: 'shown' }),
    ];
    // note-2 has high consensus, note-3 does not
    const ratingsMap = new Map([
      ['note-2', makeRatings('note-2', 8, 0)],
      ['note-3', makeRatings('note-3', 3, 4)],
    ]);
    const result = checkAutoAction(notes, ratingsMap);
    expect(result.shouldAct).toBe(true);
    expect(result.action).toBe('demote');
  });

  it('handles missing ratings in map gracefully', () => {
    const note = makeNote({ id: 'note-1', status: 'shown' });
    const ratingsMap = new Map<string, NoteRating[]>();
    // No ratings in map for this note
    const result = checkAutoAction([note], ratingsMap);
    expect(result.shouldAct).toBe(false);
    expect(result.action).toBe('none');
  });
});

describe('product contribution workflow', () => {
  it('removes private pantry and receipt keys from contribution payloads', () => {
    const sanitized = sanitizeProductContributionPayload({
      canonical_name: 'Whole Milk',
      pantry_quantity: 2,
      photo_uri: 'file:///private/package.jpg',
      evidence: {
        receipt_photo_uri: 'file:///private/receipt.jpg',
        crop_uri: 'file:///private/receipt-crop.jpg',
        source_url: 'https://example.com/products/milk',
      },
      nested: [
        {
          raw_ocr_text: 'card ending 1234',
          candidate_json: '[{"pantry_item_id":"pantry-1"}]',
          source_id: '049000042566',
        },
      ],
    });

    expect(sanitized).toEqual({
      canonical_name: 'Whole Milk',
      evidence: {
        source_url: 'https://example.com/products/milk',
      },
      nested: [{ source_id: '049000042566' }],
    });
  });

  it('requires explicit sharing opt-in, license metadata, and no private fields', () => {
    const result = validateProductContributionSubmission({
      shareOptIn: false,
      license: '',
      payloads: {
        product: {
          canonical_name: 'Milk',
          evidence: {
            pantry_item_id: 'private-pantry-row',
            parsed_json: { total_cents: 1200 },
          },
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.privateKeys).toEqual([
      'evidence.pantry_item_id',
      'evidence.parsed_json',
    ]);
    expect(result.errors).toContain('Product contributions require explicit sharing opt-in.');
    expect(result.errors).toContain('Product contributions require license metadata.');
    expect(result.errors).toContain('Product contributions cannot include pantry, receipt, or raw image data.');
  });

  it('requires image license and consent before image evidence can be shared', () => {
    const result = validateProductContributionSubmission({
      shareOptIn: true,
      license: 'CC BY-SA 4.0',
      hasImageEvidence: true,
      evidenceOptIn: true,
      imageLicense: 'CC BY-SA 4.0',
      imageConsentStatus: 'owned_by_user',
    });

    expect(result).toEqual({
      ok: true,
      errors: [],
      privateKeys: [],
    });
  });

  it('builds valid contribution state transitions for submit, verify, reject, and supersede', () => {
    const nowIso = '2026-04-25T12:00:00.000Z';

    expect(buildProductContributionStatusPatch('private_draft', 'submit', { nowIso })).toEqual({
      ok: true,
      data: {
        status: 'submitted',
        share_opt_in: true,
        submitted_at: nowIso,
      },
    });

    expect(
      buildProductContributionStatusPatch('submitted', 'verify', {
        nowIso,
        reviewerProfileId: 'reviewer-1',
      }),
    ).toEqual({
      ok: true,
      data: {
        status: 'verified',
        moderation_status: 'approved',
        reviewed_by_profile_id: 'reviewer-1',
        moderation_notes: null,
        reviewed_at: nowIso,
        verified_at: nowIso,
      },
    });

    expect(buildProductContributionStatusPatch('submitted', 'reject', { nowIso }).ok).toBe(true);
    expect(
      buildProductContributionStatusPatch('verified', 'supersede', {
        nowIso,
        supersededByContributionId: 'replacement-1',
      }),
    ).toEqual({
      ok: true,
      data: {
        status: 'superseded',
        moderation_status: 'approved',
        reviewed_by_profile_id: null,
        moderation_notes: null,
        reviewed_at: nowIso,
        superseded_by_contribution_id: 'replacement-1',
      },
    });
  });

  it('blocks invalid contribution state transitions', () => {
    expect(buildProductContributionStatusPatch('submitted', 'submit', { nowIso: 'now' })).toEqual({
      ok: false,
      error: 'Only private drafts can be submitted.',
    });
    expect(
      buildProductContributionStatusPatch('private_draft', 'verify', { nowIso: 'now' }),
    ).toEqual({
      ok: false,
      error: 'Only submitted contributions can be verified.',
    });
    expect(
      buildProductContributionStatusPatch('verified', 'supersede', { nowIso: 'now' }),
    ).toEqual({
      ok: false,
      error: 'Superseded contributions require a replacement contribution id.',
    });
  });

  it('publishes product image evidence only after opt-in, approval, visibility, and consent', () => {
    expect(
      canPublishProductEvidence({
        shareOptIn: true,
        moderationStatus: 'approved',
        visibility: 'public',
        imageConsentStatus: 'owned_by_user',
      }),
    ).toBe(true);

    expect(
      canPublishProductEvidence({
        shareOptIn: false,
        moderationStatus: 'approved',
        visibility: 'public',
        imageConsentStatus: 'owned_by_user',
      }),
    ).toBe(false);

    expect(
      canPublishProductEvidence({
        shareOptIn: true,
        moderationStatus: 'approved',
        visibility: 'private',
        imageConsentStatus: 'owned_by_user',
      }),
    ).toBe(false);

    expect(
      canPublishProductEvidence({
        shareOptIn: true,
        moderationStatus: 'approved',
        visibility: 'public',
        imageConsentStatus: 'not_granted',
      }),
    ).toBe(false);
  });
});

describe('public content moderation transitions', () => {
  it('maps hide and remove actions to hidden public content status', () => {
    const nowIso = '2026-04-27T12:00:00.000Z';

    expect(buildPublicContentModerationStatusPatch('approved', 'hidden', nowIso)).toEqual({
      ok: true,
      data: {
        moderation_status: 'hidden',
        updated_at: nowIso,
      },
    });
    expect(buildPublicContentModerationStatusPatch('approved', 'removed', nowIso)).toEqual({
      ok: true,
      data: {
        moderation_status: 'hidden',
        updated_at: nowIso,
      },
    });
  });

  it('maps restore and approval actions back to public approved status', () => {
    const nowIso = '2026-04-27T12:05:00.000Z';

    expect(buildPublicContentModerationStatusPatch('hidden', 'restored', nowIso)).toEqual({
      ok: true,
      data: {
        moderation_status: 'approved',
        updated_at: nowIso,
      },
    });
    expect(buildPublicContentModerationStatusPatch('pending', 'approved', nowIso)).toEqual({
      ok: true,
      data: {
        moderation_status: 'approved',
        updated_at: nowIso,
      },
    });
  });

  it('keeps dismissed reports audit-only without mutating content state', () => {
    expect(
      buildPublicContentModerationStatusPatch(
        'approved',
        'dismissed',
        '2026-04-27T12:10:00.000Z',
      ),
    ).toEqual({
      ok: true,
      data: {},
    });
  });
});
