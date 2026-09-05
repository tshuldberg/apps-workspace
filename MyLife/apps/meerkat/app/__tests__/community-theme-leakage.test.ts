// Plan 38 Phase 1c (amendment D.2): the per-community theme NEVER leaks past a
// community route subtree. app chrome and DM threads keep the base theme.
//
// A lint-style guard (mirrors chat-kit-no-providers.test.ts): the ONLY screens
// allowed to mount the CommunityThemeProvider boundary are the community route
// subtrees (community/[communityId]*, channel/[communityId]/*, post/[communityId]/*).
// The tab bar and the DM thread screen must NOT reference it, so a DM thread and
// the tab bar can never pick up a community theme.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const tabsDir = resolve(__dirname, '../(root)/(tabs)');
const BOUNDARY = 'CommunityThemeProvider';

function read(relPath: string): string {
  return readFileSync(resolve(tabsDir, relPath), 'utf8');
}

// Community route subtrees: these MUST mount the boundary.
const WRAPPED = [
  'community/[communityId].tsx',
  'community/[communityId]/settings.tsx',
  'channel/[communityId]/[channelId].tsx',
  'post/[communityId]/[channelId]/[postId].tsx',
];

// App chrome + DM thread: these must NEVER mount the boundary (base theme only).
const NOT_WRAPPED = [
  '_layout.tsx', // the tab bar
  'dm/[conversationId].tsx', // a DM thread
  'messages.tsx',
  'index.tsx', // the Feed
  'me.tsx',
];

describe('community theme boundary is scoped to community routes only', () => {
  for (const file of WRAPPED) {
    it(`${file} mounts the CommunityThemeProvider boundary`, () => {
      expect(read(file)).toContain(BOUNDARY);
    });
  }

  for (const file of NOT_WRAPPED) {
    it(`${file} never mounts the community theme boundary (stays base theme)`, () => {
      expect(read(file)).not.toContain(BOUNDARY);
    });
  }
});
