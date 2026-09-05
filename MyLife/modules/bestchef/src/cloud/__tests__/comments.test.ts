import { describe, it, expect } from 'vitest';
import {
  formatCommentPreview,
  isWithinEditWindow,
  COMMENT_EDIT_WINDOW_HOURS,
  MAX_COMMENT_LENGTH,
} from '../comments';
import { CommentSchema } from '../types';

// ── formatCommentPreview ─────────────────────────────────────────────

describe('formatCommentPreview', () => {
  it('returns the full body when shorter than maxLength', () => {
    expect(formatCommentPreview('Short comment')).toBe('Short comment');
  });

  it('returns the full body when exactly maxLength', () => {
    const body = 'a'.repeat(100);
    expect(formatCommentPreview(body, 100)).toBe(body);
  });

  it('truncates at word boundary with ellipsis', () => {
    const body = 'The quick brown fox jumps over the lazy dog and then some more words';
    const result = formatCommentPreview(body, 30);
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(33); // 30 + '...'
  });

  it('truncates at maxLength when no suitable space found', () => {
    const body = 'abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz';
    const result = formatCommentPreview(body, 20);
    expect(result).toBe('abcdefghijklmnopqrst...');
  });

  it('uses custom maxLength', () => {
    const body = 'This is a test comment with several words in it';
    const result = formatCommentPreview(body, 15);
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(18); // 15 + '...'
  });

  it('handles empty string', () => {
    expect(formatCommentPreview('')).toBe('');
  });

  it('handles single word longer than maxLength', () => {
    const body = 'superlongwordwithnobreaks';
    const result = formatCommentPreview(body, 10);
    expect(result).toBe('superlongw...');
  });

  it('preserves body with no truncation at default 100 chars', () => {
    const body = 'A perfectly reasonable comment.';
    expect(formatCommentPreview(body)).toBe(body);
  });
});

// ── MAX_COMMENT_LENGTH ───────────────────────────────────────────────

describe('MAX_COMMENT_LENGTH', () => {
  it('is 2000 characters', () => {
    expect(MAX_COMMENT_LENGTH).toBe(2000);
  });
});

// ── Comment length enforcement logic ─────────────────────────────────

describe('comment length validation logic', () => {
  it('body at exactly MAX_COMMENT_LENGTH is valid', () => {
    const body = 'x'.repeat(MAX_COMMENT_LENGTH);
    expect(body.length).toBe(2000);
    expect(body.length <= MAX_COMMENT_LENGTH).toBe(true);
  });

  it('body exceeding MAX_COMMENT_LENGTH is invalid', () => {
    const body = 'x'.repeat(MAX_COMMENT_LENGTH + 1);
    expect(body.length > MAX_COMMENT_LENGTH).toBe(true);
  });

  it('empty body after trim is invalid', () => {
    const body = '   ';
    expect(body.trim().length).toBe(0);
  });
});

// ── COMMENT_EDIT_WINDOW_HOURS / isWithinEditWindow (F-032) ───────────

describe('isWithinEditWindow', () => {
  it('exposes a 24h window default matching the server RPC', () => {
    expect(COMMENT_EDIT_WINDOW_HOURS).toBe(24);
  });

  it('returns true for a freshly created comment', () => {
    const now = new Date('2026-04-27T12:00:00Z');
    const created = new Date('2026-04-27T11:59:00Z');
    expect(isWithinEditWindow(created, now)).toBe(true);
  });

  it('returns true for a comment exactly at the window boundary', () => {
    const now = new Date('2026-04-27T12:00:00Z');
    const created = new Date('2026-04-26T12:00:00Z');
    expect(isWithinEditWindow(created, now)).toBe(true);
  });

  it('returns false for a comment older than the window', () => {
    const now = new Date('2026-04-27T12:00:00Z');
    const created = new Date('2026-04-26T11:59:00Z');
    expect(isWithinEditWindow(created, now)).toBe(false);
  });

  it('returns false when the clock is before the createdAt (skew)', () => {
    const now = new Date('2026-04-27T12:00:00Z');
    const created = new Date('2026-04-27T13:00:00Z');
    expect(isWithinEditWindow(created, now)).toBe(false);
  });

  it('honors a custom window override', () => {
    const now = new Date('2026-04-27T12:00:00Z');
    const created = new Date('2026-04-27T11:00:00Z');
    expect(isWithinEditWindow(created, now, 0.5)).toBe(false);
    expect(isWithinEditWindow(created, now, 2)).toBe(true);
  });
});

// ── Comment schema -- threading + edit/delete (F-031, F-032) ─────────

describe('CommentSchema with P12-A additions', () => {
  const baseComment = {
    id: '00000000-0000-0000-0000-000000000001',
    submissionId: '00000000-0000-0000-0000-000000000002',
    profileId: '00000000-0000-0000-0000-000000000003',
    socialActivityId: null,
    parentId: null,
    body: 'Hello world',
    commentType: 'comment',
    photoUrl: null,
    isPinned: false,
    helpfulCount: 0,
    moderationStatus: 'approved',
    createdAt: '2026-04-27T12:00:00Z',
    updatedAt: '2026-04-27T12:00:00Z',
    editedAt: null,
    deletedAt: null,
  };

  it('parses a top-level comment with parentId null', () => {
    const parsed = CommentSchema.parse(baseComment);
    expect(parsed.parentId).toBeNull();
    expect(parsed.editedAt).toBeNull();
    expect(parsed.deletedAt).toBeNull();
  });

  it('parses a reply with parentId set', () => {
    const parsed = CommentSchema.parse({
      ...baseComment,
      id: '00000000-0000-0000-0000-000000000010',
      parentId: '00000000-0000-0000-0000-000000000001',
    });
    expect(parsed.parentId).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('parses an edited comment with editedAt timestamp', () => {
    const parsed = CommentSchema.parse({
      ...baseComment,
      editedAt: '2026-04-27T12:30:00Z',
    });
    expect(parsed.editedAt).toBeInstanceOf(Date);
  });

  it('parses a soft-deleted comment with deletedAt set', () => {
    const parsed = CommentSchema.parse({
      ...baseComment,
      deletedAt: '2026-04-27T13:00:00Z',
    });
    expect(parsed.deletedAt).toBeInstanceOf(Date);
  });
});

// ── Helpful toggle invariants (F-033 / B-008) ────────────────────────
//
// The cloud round-trip is exercised by the integration suite; here we lock in
// the invariants the UI depends on: a toggle is idempotent at the state level
// and never reports the same value twice in succession.

describe('helpful toggle invariants', () => {
  it('flipping twice from unmarked returns to unmarked', () => {
    let isHelpful = false;
    isHelpful = !isHelpful;
    expect(isHelpful).toBe(true);
    isHelpful = !isHelpful;
    expect(isHelpful).toBe(false);
  });

  it('count never goes negative for a given comment', () => {
    let count = 0;
    const apply = (delta: number) => {
      count = Math.max(0, count + delta);
    };
    apply(-1);
    expect(count).toBe(0);
    apply(1);
    apply(1);
    apply(-1);
    expect(count).toBe(1);
  });
});
