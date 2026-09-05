import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_ROUTE_DIR = path.resolve(process.cwd(), 'app', '(root)');

function readRoute(relativePath: string): string {
  return readFileSync(path.join(ROOT_ROUTE_DIR, relativePath), 'utf8');
}

function styleBlock(source: string, styleName: string): string {
  const start = source.indexOf(`${styleName}: {`);
  if (start === -1) return '';
  const end = source.indexOf('\n  },', start);
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

describe('avatar fallback text fit', () => {
  it('keeps large profile initials from clipping inside circular avatars', () => {
    const profileHeader = styleBlock(
      readRoute('components/profile/ProfileHeader.tsx'),
      'initials',
    );
    const chefBanner = styleBlock(
      readRoute('components/chef/ChefBanner.tsx'),
      'initials',
    );

    for (const block of [profileHeader, chefBanner]) {
      expect(block).toContain('lineHeight: 42');
      expect(block).toContain('includeFontPadding: false');
      expect(block).toContain("textAlign: 'center'");
    }
  });

  it('applies the same fit rule to copied avatar-initial styles across the app', () => {
    const targets = [
      ['components/home/HomeGreeting.tsx', 'avatarInitials'],
      ['components/NotificationRow.tsx', 'avatarInitials'],
      ['components/recipe/CommunityVerdictSection.tsx', 'avatarText'],
      ['components/recipe/RecipeChefRow.tsx', 'avatarText'],
      ['components/vote/FullScreenSubmissionCard.tsx', 'avatarInitials'],
      ['discover.tsx', 'chefAvatarText'],
    ] as const;

    for (const [filePath, styleName] of targets) {
      const block = styleBlock(readRoute(filePath), styleName);
      expect(block, `${filePath} ${styleName}`).toContain('lineHeight');
      expect(block, `${filePath} ${styleName}`).toContain('includeFontPadding: false');
      expect(block, `${filePath} ${styleName}`).toContain("textAlign: 'center'");
    }
  });

  it('keeps the reusable avatar initials sizing proportional to avatar size', () => {
    const source = readRoute('components/profile/Avatar.tsx');

    expect(source).toContain('fontSize: Math.round(size * 0.4)');
    expect(source).toContain('lineHeight: Math.ceil(size * 0.52)');
    expect(source).toContain('includeFontPadding: false');
  });
});
