import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_ROUTE_DIR = path.resolve(process.cwd(), 'app', '(root)');

describe('leaderboard filters', () => {
  it('opens a full filter sheet from the toolbar action', () => {
    const source = readFileSync(path.join(ROOT_ROUTE_DIR, '(tabs)', 'leaderboard.tsx'), 'utf8');

    expect(source).toContain('onFilter={openFilterSheet}');
    expect(source).toContain('visible={showFilters}');
    expect(source).toContain("presentationStyle=\"pageSheet\"");
    expect(source).toContain("t('Apply filters')");
  });

  it('keeps leaderboard filters backed by real ranking state', () => {
    const source = readFileSync(path.join(ROOT_ROUTE_DIR, '(tabs)', 'leaderboard.tsx'), 'utf8');

    expect(source).toContain("type LeaderboardSort = 'score' | 'reviewed' | 'approval'");
    expect(source).toContain('minimumReviews > 0');
    expect(source).toContain('restaurantsOnly && !entry.isRestaurant');
    expect(source).toContain('getApprovalRatio(b) - getApprovalRatio(a)');
    expect(source).toContain('setActiveKind(draftKind)');
    expect(source).toContain('setRange(draftRange)');
  });

  it('honors Top 100 shortcut query params for each leaderboard kind', () => {
    const source = readFileSync(path.join(ROOT_ROUTE_DIR, '(tabs)', 'leaderboard.tsx'), 'utf8');
    const shortcuts = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'home', 'LeaderboardShortcuts.tsx'), 'utf8');

    expect(shortcuts).toContain('leaderboard?kind=${kind}');
    expect(source).toContain('function resolveInitialKind');
    expect(source).toContain("kind === 'category' || kind === 'dish'");
    expect(source).toContain("kind === 'cuisine'");
    expect(source).toContain("kind === 'region'");
    expect(source).toContain('lastParamKindRef.current = params.kind');
    expect(source).toContain('getDefaultSubFilter(');
  });

  it('keeps active filter chips from stretching into full-height tiles', () => {
    const source = readFileSync(path.join(ROOT_ROUTE_DIR, '(tabs)', 'leaderboard.tsx'), 'utf8');

    expect(source).toContain('style={styles.activeFilterScroll}');
    expect(source).toContain('activeFilterScroll:');
    expect(source).toContain('maxHeight: 44');
    expect(source).toContain("alignSelf: 'flex-start'");
  });

  it('loads public leaderboard data without requiring cloud auth readiness', () => {
    const source = readFileSync(path.join(ROOT_ROUTE_DIR, 'hooks', 'useLeaderboardEntries.ts'), 'utf8');

    expect(source).toContain('useBestChefCloud');
    expect(source).toContain('const { isConfigured, supabase } = useBestChefCloud();');
    expect(source).toContain('initBestChefClient(supabase);');
    expect(source).not.toContain('isReady');
    expect(source).not.toContain('cloudError');
    expect(source).toContain('try {');
    expect(source).toContain('catch (err)');
    expect(source).toContain('setLoading(false)');
  });

  it('renders leaderboard entries with joined ChefTom dish and profile labels', () => {
    const podiumCard = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'leaderboard', 'PodiumCard.tsx'), 'utf8');
    const leaderboardRow = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'leaderboard', 'LeaderboardRow.tsx'), 'utf8');

    expect(podiumCard).toContain('entry.dishName ?? entry.recipeTitle');
    expect(podiumCard).toContain('entry.chefDisplayName');
    expect(leaderboardRow).toContain('entry.dishName ?? entry.recipeTitle');
    expect(leaderboardRow).toContain('entry.chefDisplayName');
    expect(leaderboardRow).toContain('entry.cuisine');
    expect(leaderboardRow).toContain('entry.dishRegion ?? submission.region');
  });
});
