/**
 * Contract tests for ReviewedVoteSheet (P4-C).
 *
 * Validates route structure, verdict state, castVoteWithProof integration,
 * and legacy route redirect. Tests inspect source code directly --
 * the same pattern used by FullScreenSubmissionCard and CookProofCapture.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(process.cwd(), 'app', '(root)');
const SHEET_FILE = path.join(ROOT, 'reviewed-vote', '[submissionId].tsx');
const LEGACY_FILE = path.join(ROOT, 'submission', '[id]', 'vote.tsx');

const sheet = readFileSync(SHEET_FILE, 'utf8');
const legacy = readFileSync(LEGACY_FILE, 'utf8');

describe('ReviewedVoteSheet route', () => {
  it('renders -- file exists and has a default export', () => {
    expect(sheet).toContain('export default function ReviewedVoteSheet');
  });

  it('imports castVoteWithProof from @mylife/bestchef', () => {
    expect(sheet).toContain("castVoteWithProof");
    expect(sheet).toContain("from '@mylife/bestchef'");
  });

  it('calls castVoteWithProof with correct payload shape (submissionId, tier, verdict, rating, notes)', () => {
    expect(sheet).toContain('submissionId: cloudSubmissionId');
    expect(sheet).toContain('tier: selectedTier');
    expect(sheet).toContain('verdict: verdict ?? undefined');
    expect(sheet).toContain('rating,');
    expect(sheet).toContain('notes: notes.trim()');
  });

  it('verdict picker holds state via setVerdict', () => {
    expect(sheet).toContain('setVerdict(');
    expect(sheet).toContain("verdict === cfg.value");
  });

  it('exposes all four verdict options', () => {
    expect(sheet).toContain("'liked'");
    expect(sheet).toContain("'loved'");
    expect(sheet).toContain("'mixed'");
    expect(sheet).toContain("'disliked'");
  });

  it('has star rating from 1-5', () => {
    expect(sheet).toContain('[1, 2, 3, 4, 5]');
    expect(sheet).toContain('setRating(i)');
  });

  it('has notes textarea with NOTES_MAX cap', () => {
    expect(sheet).toContain('NOTES_MAX');
    expect(sheet).toContain('maxLength={NOTES_MAX}');
  });

  it('requires photo before submit is enabled', () => {
    expect(sheet).toContain('Boolean(photoUri)');
    expect(sheet).toContain('disabled={!canSubmit}');
  });

  it('shows toast on success and navigates back', () => {
    expect(sheet).toContain('Reviewed vote submitted');
    expect(sheet).toContain("router.back()");
  });

  it('uses server-backed upload flow (not mesh relay)', () => {
    expect(sheet).toContain('createVoteProofMediaAsset');
    expect(sheet).toContain('completeVoteProofUpload');
    expect(sheet).toContain('createLocalVoteProofDraft');
    expect(sheet).not.toContain('SERVICE_ROLE');
  });
});

describe('Legacy vote route redirect', () => {
  it('is now a thin redirect to /reviewed-vote/:id', () => {
    expect(legacy).toContain('router.replace');
    expect(legacy).toContain('/reviewed-vote/');
  });

  it('does not contain the old CookProofCapture render', () => {
    expect(legacy).not.toContain('CookProofCapture');
    expect(legacy).not.toContain('castVoteWithProof');
  });
});
