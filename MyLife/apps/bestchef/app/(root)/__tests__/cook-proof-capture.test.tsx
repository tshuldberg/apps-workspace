import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_ROUTE_DIR = path.resolve(process.cwd(), 'app', '(root)');

describe('CookProof capture contract', () => {
  it('requires a public-photo notice before submit', () => {
    const capture = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'CookProofCapture.tsx'), 'utf8');
    const noticeIndex = capture.indexOf('Your photo will be public on this recipe and your profile.');
    const submitIndex = capture.indexOf('Submit CookProof vote');

    expect(noticeIndex).toBeGreaterThan(-1);
    expect(submitIndex).toBeGreaterThan(noticeIndex);
  });

  it('keeps camera, library, tier, and submit controls accessible', () => {
    const capture = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'CookProofCapture.tsx'), 'utf8');

    expect(capture).toContain('Select {tier} vote');
    expect(capture).toContain('Open camera for CookProof photo');
    expect(capture).toContain('Choose CookProof photo from library');
    expect(capture).toContain('Submit CookProof vote');
    expect(capture).toContain('accessibilityState={{ disabled: !canSubmit, busy }}');
  });

  it('keeps the route server-backed and offline-draft capable', () => {
    // P4-C: real impl moved to reviewed-vote/[submissionId].tsx; legacy route is a redirect.
    const route = readFileSync(path.join(ROOT_ROUTE_DIR, 'reviewed-vote', '[submissionId].tsx'), 'utf8');

    expect(route).toContain('ensureCloudSubmissionForAppId');
    expect(route).toContain('createVoteProofMediaAsset');
    expect(route).toContain('uploadProofBytes');
    expect(route).toContain('completeVoteProofUpload');
    expect(route).toContain('castVoteWithProof');
    expect(route).toContain('createLocalVoteProofDraft');
    expect(route).not.toContain('SERVICE_ROLE');
  });
});
