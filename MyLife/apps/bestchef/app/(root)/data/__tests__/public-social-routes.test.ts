import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PUBLIC_SOCIAL_ROUTES = [
  '../../(tabs)/index.tsx',
  '../../(tabs)/leaderboard.tsx',
  '../../(tabs)/profile.tsx',
  '../../comments/[submissionId].tsx',
  '../../recipe/[id].tsx',
  '../../chef/[id].tsx',
  '../../challenges.tsx',
  '../../dish/[id].tsx',
  '../../feed.tsx',
  '../../submission/[id]/vote.tsx',
] as const;

function readRoute(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('BestChef public social render policy', () => {
  it('guards public social demo imports with the render policy', () => {
    for (const routePath of PUBLIC_SOCIAL_ROUTES) {
      const content = readRoute(routePath);
      if (!content.includes('DEMO_')) continue;

      expect(content, `${routePath} imports demo social content`).toContain(
        'shouldShowDemoContent',
      );
    }
  });
});
