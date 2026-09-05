import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_ROOT = path.resolve(process.cwd(), 'app');
const ROOT_ROUTE_DIR = path.join(APP_ROOT, '(root)');
const REPO_ROOT = path.resolve(process.cwd(), '..', '..');
const BACKLOG_PATH = path.join(REPO_ROOT, 'docs', 'plans', 'features', 'recipes', 'bestchef-kitchen-intelligence-feature-bug-backlog.md');
const PHASE_9_SESSION_PATH = path.join(REPO_ROOT, 'docs', 'sessions', '2026-04-26-bestchef-phase-9-qa-gates-release-readiness.md');
const ROUTE_SKIP_SEGMENTS = new Set([
  '__tests__',
  'components',
  'data',
  'i18n',
  'providers',
  'utils',
]);
const INTERACTIVE_TAGS = [
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
] as const;

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const filePath = path.join(dir, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) return walkFiles(filePath);
    return /\.(ts|tsx)$/.test(entry) ? [filePath] : [];
  });
}

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function findElementBlocks(source: string, tagName: string): Array<{ index: number; block: string; tagName: string }> {
  const blocks: Array<{ index: number; block: string; tagName: string }> = [];
  const opening = `<${tagName}`;
  const closing = `</${tagName}>`;
  let index = 0;
  while ((index = source.indexOf(opening, index)) !== -1) {
    const end = source.indexOf(closing, index);
    const selfClosingEnd = source.indexOf('/>', index);
    const blockEnd = end === -1
      ? (selfClosingEnd === -1 ? index + 500 : selfClosingEnd + 2)
      : end + closing.length;
    blocks.push({ index, block: source.slice(index, blockEnd), tagName });
    index += opening.length;
  }
  return blocks;
}

function findInteractiveBlocks(source: string): Array<{ index: number; block: string; tagName: string }> {
  return INTERACTIVE_TAGS.flatMap((tagName) => findElementBlocks(source, tagName));
}

function blockHasNavigation(block: string): boolean {
  return /router\.(?:push|replace|back)\s*\(|href\s*=/.test(block);
}

function blockHasPressedFeedback(block: string): boolean {
  return /pressed\s*&&|style=\{\(\{\s*pressed\s*\}\)|style=\{\(\s*\{\s*pressed\s*\}\s*\)|Animated\.timing/.test(block);
}

function blockHasAction(block: string): boolean {
  return /\bonPress\s*=|\bonLongPress\s*=|\bhref\s*=/.test(block);
}

function blockHasSoonFallback(block: string): boolean {
  return /pathname:\s*['"]\/soon['"]|router\.(?:push|replace)\(\s*['"]\/soon['"]/.test(block);
}

function blockHasVisibleTextOrAccessibilityLabel(block: string): boolean {
  return /accessibilityLabel\s*=|aria-label\s*=|<Text\b/.test(block);
}

function routeFiles(): string[] {
  return walkFiles(APP_ROOT).filter((filePath) => {
    const rel = path.relative(APP_ROOT, filePath);
    const parts = rel.split(path.sep);
    if (parts.some((part) => ROUTE_SKIP_SEGMENTS.has(part))) return false;
    if (parts.some((part) => part.startsWith('_'))) return false;
    return filePath.endsWith('.tsx');
  });
}

function normalizeRoute(raw: string): string {
  const cleaned = raw
    .replace(/\.(tsx|ts)$/, '')
    .split(path.sep)
    .filter((part) => part !== '(root)')
    .join('/');
  const withoutIndex = cleaned.endsWith('/index')
    ? cleaned.slice(0, -'/index'.length)
    : cleaned === 'index' ? '' : cleaned;
  return `/${withoutIndex}`.replace(/\/+/g, '/') || '/';
}

function routePatternsFor(filePath: string): string[] {
  const rel = path.relative(APP_ROOT, filePath);
  const grouped = normalizeRoute(rel);
  const ungrouped = normalizeRoute(
    rel
      .split(path.sep)
      .filter((part) => !/^\(.+\)$/.test(part))
      .join(path.sep),
  );
  return Array.from(new Set([grouped, ungrouped]));
}

function routeRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\[\.{3}[^\\\]]+\\\]/g, '.+')
    .replace(/\\\[[^\\\]]+\\\]/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function extractRouteTargets(source: string): Array<{ target: string; index: number }> {
  const targets = new Map<string, { target: string; index: number }>();
  const callPattern = /router\.(?:push|replace)\(\s*(?:\{[\s\S]*?pathname:\s*)?(['"`])([^'"`]+)\1/g;
  const pathnamePattern = /pathname:\s*(['"`])([^'"`]+)\1/g;
  const hrefPattern = /href=\s*(?:\{\s*)?(['"`])([^'"`]+)\1/g;

  for (const match of source.matchAll(callPattern)) {
    targets.set(`${match.index}:${match[2]}`, { target: match[2]!, index: match.index ?? 0 });
  }
  for (const match of source.matchAll(pathnamePattern)) {
    targets.set(`${match.index}:${match[2]}`, { target: match[2]!, index: match.index ?? 0 });
  }
  for (const match of source.matchAll(hrefPattern)) {
    targets.set(`${match.index}:${match[2]}`, { target: match[2]!, index: match.index ?? 0 });
  }

  return Array.from(targets.values())
    .filter(({ target }) => target.startsWith('/'))
    .map(({ target, index }) => ({
      index,
      target: target.split('?')[0]!.replace(/\$\{[^}]+\}/g, '__param__'),
    }));
}

function sourceFilesForInteractionAudit(): string[] {
  return walkFiles(ROOT_ROUTE_DIR).filter((filePath) => (
    filePath.endsWith('.tsx') && !filePath.includes(`${path.sep}__tests__${path.sep}`)
  ));
}

function sourceFilesForKitchenInteractionAudit(): string[] {
  return [
    path.join(ROOT_ROUTE_DIR, '(tabs)', 'kitchen.tsx'),
    path.join(ROOT_ROUTE_DIR, 'components', 'KitchenSliderShell.tsx'),
    path.join(ROOT_ROUTE_DIR, 'components', 'MediaSlot.tsx'),
    path.join(ROOT_ROUTE_DIR, 'components', 'HealthSummary.tsx'),
    path.join(ROOT_ROUTE_DIR, 'components', 'ReportMenu.tsx'),
    path.join(ROOT_ROUTE_DIR, 'components', 'ErrorBoundary.tsx'),
    path.join(ROOT_ROUTE_DIR, 'components', 'NutritionPanel.tsx'),
    path.join(ROOT_ROUTE_DIR, 'kitchen-receipt.tsx'),
    path.join(ROOT_ROUTE_DIR, 'kitchen-receipt-review.tsx'),
    path.join(ROOT_ROUTE_DIR, 'kitchen-photo.tsx'),
    path.join(ROOT_ROUTE_DIR, 'kitchen-photo-review.tsx'),
    path.join(ROOT_ROUTE_DIR, 'expiration-photo.tsx'),
    path.join(ROOT_ROUTE_DIR, 'recipes', 'new.tsx'),
    path.join(ROOT_ROUTE_DIR, 'grocery.tsx'),
    path.join(ROOT_ROUTE_DIR, 'pantry.tsx'),
    path.join(ROOT_ROUTE_DIR, 'soon.tsx'),
  ];
}

describe('BestChef UIUX interaction contract', () => {
  it('keeps a universal soon page available for intentionally deferred follow-ups', () => {
    expect(existsSync(path.join(ROOT_ROUTE_DIR, 'soon.tsx'))).toBe(true);
    const layout = readFileSync(path.join(ROOT_ROUTE_DIR, '_layout.tsx'), 'utf8');
    expect(layout).toContain('<Stack.Screen name="soon"');
  });

  it('keeps page transitions animated through the root stack', () => {
    const layout = readFileSync(path.join(ROOT_ROUTE_DIR, '_layout.tsx'), 'utf8');
    expect(layout).toMatch(/animation:\s*['"]slide_from_right['"]/);
    expect(layout).toMatch(/animation:\s*['"]slide_from_bottom['"]/);
    expect(layout).toContain('<Stack.Screen name="submit" options={{ presentation: \'modal\' }} />');
    expect(layout).toContain('name="submission/[id]/vote"');
    expect(layout).toContain("presentation: 'fullScreenModal'");
  });

  it('requires every interactive control to have a real action', () => {
    const failures: string[] = [];
    for (const filePath of sourceFilesForInteractionAudit()) {
      const source = readFileSync(filePath, 'utf8');
      for (const { index, block, tagName } of findInteractiveBlocks(source)) {
        if (!blockHasAction(block)) {
          failures.push(`${path.relative(process.cwd(), filePath)}:${lineNumber(source, index)} ${tagName}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('requires KITCH controls to include pressed-state feedback, route animation, or /soon fallback', () => {
    const failures: string[] = [];
    for (const filePath of sourceFilesForKitchenInteractionAudit()) {
      const source = readFileSync(filePath, 'utf8');
      for (const { index, block, tagName } of findInteractiveBlocks(source)) {
        if (blockHasNavigation(block) || blockHasSoonFallback(block)) continue;
        if (!blockHasPressedFeedback(block)) {
          failures.push(`${path.relative(process.cwd(), filePath)}:${lineNumber(source, index)} ${tagName}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('requires KITCH interactive controls to expose visible text or an accessibility label', () => {
    const failures: string[] = [];
    for (const filePath of sourceFilesForKitchenInteractionAudit()) {
      const source = readFileSync(filePath, 'utf8');
      for (const { index, block, tagName } of findInteractiveBlocks(source)) {
        if (!blockHasVisibleTextOrAccessibilityLabel(block)) {
          failures.push(`${path.relative(process.cwd(), filePath)}:${lineNumber(source, index)} ${tagName}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('requires every routed action to land on an existing page or the soon page', () => {
    const routePatterns = routeFiles().flatMap(routePatternsFor);
    const routeMatchers = routePatterns.map(routeRegex);
    const failures: string[] = [];

    for (const filePath of sourceFilesForInteractionAudit()) {
      const source = readFileSync(filePath, 'utf8');
      for (const { target, index } of extractRouteTargets(source)) {
        const resolves = routeMatchers.some((matcher) => matcher.test(target));
        if (!resolves) {
          failures.push(`${path.relative(process.cwd(), filePath)}:${lineNumber(source, index)} -> ${target}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('loads public cloud recipe detail routes without requiring a ready viewer profile', () => {
    const source = readFileSync(path.join(ROOT_ROUTE_DIR, 'recipe', '[id].tsx'), 'utf8');

    expect(source).toContain('const canLoadDirectCloudSubmission = routeIsCloudSubmission && cloud.supabase !== null;');
    expect(source).toContain('const canResolveAliasSubmission = !routeIsCloudSubmission && cloud.isReady && cloud.profile !== null;');
    expect(source).toContain('getCloudSubmissionViewModel(resolvedCloudSubmissionId, cloud.profile)');
    expect(source).toContain("submissionLoading ? t('Loading recipe...') : t('Recipe not found')");
  });

  it('requires native modals to animate and expose an in-modal action', () => {
    const failures: string[] = [];
    for (const filePath of sourceFilesForInteractionAudit()) {
      const source = readFileSync(filePath, 'utf8');
      for (const { index, block } of findElementBlocks(source, 'Modal')) {
        if (!/animationType\s*=|presentationStyle\s*=/.test(block)) {
          failures.push(`${path.relative(process.cwd(), filePath)}:${lineNumber(source, index)} missing modal animation`);
        }
        if (!/onPress\s*=|onRequestClose\s*=/.test(block)) {
          failures.push(`${path.relative(process.cwd(), filePath)}:${lineNumber(source, index)} missing modal action`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps report menus deterministic with callback-backed menu items', () => {
    const filePath = path.join(ROOT_ROUTE_DIR, 'components', 'ReportMenu.tsx');
    const source = readFileSync(filePath, 'utf8');
    const failures: string[] = [];
    const rel = path.relative(process.cwd(), filePath);

    for (const pattern of [
      'REASON_KEYS',
      'ActionSheetIOS.showActionSheetWithOptions',
      'Alert.alert',
      'onPress: () => submit(key)',
      'accessibilityLabel={accessibilityLabel ?? t(\'Report content\')}',
    ]) {
      const index = source.indexOf(pattern);
      if (index === -1) {
        failures.push(`${rel}:1 missing ${pattern}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('routes recipe voting through the CookProof capture flow', () => {
    const recipe = readFileSync(path.join(ROOT_ROUTE_DIR, 'recipe', '[id].tsx'), 'utf8');
    // P4-C: the real impl moved to reviewed-vote/[submissionId].tsx; the legacy route is a redirect.
    const reviewedVoteRoute = readFileSync(path.join(ROOT_ROUTE_DIR, 'reviewed-vote', '[submissionId].tsx'), 'utf8');
    const legacyRoute = readFileSync(path.join(ROOT_ROUTE_DIR, 'submission', '[id]', 'vote.tsx'), 'utf8');
    const capture = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'CookProofCapture.tsx'), 'utf8');
    const tapVoteFooter = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'recipe', 'RecipeVoteFooter.tsx'), 'utf8');

    expect(recipe).toContain('<RecipeVoteFooter');
    expect(recipe).not.toContain('castVote(');
    expect(recipe).not.toContain('saveVote(db');
    expect(tapVoteFooter).toContain("router.push(`/reviewed-vote/${submissionId}`)");
    expect(tapVoteFooter).toContain('Reviewed Vote');
    expect(tapVoteFooter).toContain('saveVote(db, submissionId');
    expect(tapVoteFooter).toContain("label={t('Pass')}");
    expect(tapVoteFooter).toContain("label={t('Yum')}");
    expect(tapVoteFooter).not.toContain("label={t('Upvote')}");
    expect(tapVoteFooter).not.toContain('disabled={!voterProfileId}');
    expect(tapVoteFooter).not.toContain('if (pendingRef.current || !voterProfileId) return;');
    // P4-C: real flow lives in reviewed-vote route
    expect(reviewedVoteRoute).toContain('prepareProof');
    expect(reviewedVoteRoute).toContain('createVoteProofMediaAsset');
    expect(reviewedVoteRoute).toContain('completeVoteProofUpload');
    expect(reviewedVoteRoute).toContain('castVoteWithProof');
    expect(reviewedVoteRoute).toContain('createLocalVoteProofDraft');
    expect(reviewedVoteRoute).toContain('pickProofPhoto');
    // legacy route redirects to reviewed-vote
    expect(legacyRoute).toContain('router.replace');
    expect(legacyRoute).toContain('/reviewed-vote/');
    expect(capture).toContain('Your photo will be public on this recipe and your profile.');
  });

  it('loads selected recipe instructions into Cook mode', () => {
    const cookMode = readFileSync(path.join(ROOT_ROUTE_DIR, 'cook-mode', '[id].tsx'), 'utf8');

    expect(cookMode).toContain('useBestChefCloud');
    expect(cookMode).toContain('initBestChefClient(cloud.supabase)');
    expect(cookMode).toContain('isCloudSubmissionId(routeId)');
    expect(cookMode).toContain('getCloudSubmissionViewModel(routeId, cloud.profile)');
    expect(cookMode).toContain('stepsOrFallback(cloudSubmission.steps)');
    expect(cookMode).toContain('stepsOrFallback(baseRecipe?.steps)');
    expect(cookMode).not.toContain('const recipe = useMemo');
  });

  it('keeps per-ingredient facts collapsed until the user expands a row', () => {
    const recipe = readFileSync(path.join(ROOT_ROUTE_DIR, 'recipe', '[id].tsx'), 'utf8');

    expect(recipe).toContain('ingredientCollapsedRow');
    expect(recipe).toContain('Plus size={16}');
    expect(recipe).toContain('Minus size={16}');
    expect(recipe).toContain('setOpenIngredientNutritionId');
    expect(recipe).toContain('<HealthSummary');
    expect(recipe).toContain('<NutritionPanel detail={ingredientDetail} compact />');
    expect(recipe).not.toContain('onPressDetails={() => setOpenIngredientNutritionId');
  });

  it('keeps CookProof capture states and expected vote errors visible to the app contract', () => {
    // P4-C: real vote flow is in reviewed-vote/[submissionId].tsx
    const reviewedVoteRoute = readFileSync(path.join(ROOT_ROUTE_DIR, 'reviewed-vote', '[submissionId].tsx'), 'utf8');
    const capture = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'CookProofCapture.tsx'), 'utf8');

    for (const state of ['empty', 'loading', 'error', 'success', 'partial']) {
      expect(capture).toContain(`| '${state}'`);
    }

    expect(capture).toContain('No candidate photo');
    expect(capture).toContain('Uploading proof and casting vote');
    expect(capture).toContain('Vote committed, pending review');
    expect(capture).toContain('Offline draft queued');
    expect(reviewedVoteRoute).toContain("'vote_already_exists'");
    expect(reviewedVoteRoute).toContain("'proof_duplicate'");
    expect(reviewedVoteRoute).toContain("'cannot_vote_on_own'");
    expect(reviewedVoteRoute).toContain("'network'");
  });

  it('keeps gradients backed by concrete colors on every screen', () => {
    // The object-cast pattern crashed on a real device (errors_log
    // 2026-05-04): LinearGradient calls colors.map, and the token is an
    // object. Ban the cast app-wide, not just in VideoStep.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          walk(p);
        } else if (entry.name.endsWith('.tsx')) {
          if (readFileSync(p, 'utf8').includes('HERO_GRADIENT as unknown as [string, string]')) {
            offenders.push(p);
          }
        }
      }
    };
    walk(ROOT_ROUTE_DIR);
    expect(offenders).toEqual([]);

    const videoStep = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'submit', 'steps', 'VideoStep.tsx'), 'utf8');
    expect(videoStep).toContain('colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}');
  });

  it('uses BestChef social profile ids for Vote feed exclusion and tap votes', () => {
    const voteTab = readFileSync(path.join(ROOT_ROUTE_DIR, '(tabs)', 'vote.tsx'), 'utf8');

    expect(voteTab).toContain('const { supabase, profile } = useBestChefCloud();');
    expect(voteTab).toContain('const viewerProfileId = profile?.id ?? null;');
    expect(voteTab).toContain("const profileKey = viewerProfileId ?? 'public';");
    expect(voteTab).toContain('viewerProfileId: viewerProfileId ?? undefined');
    expect(voteTab).toContain('voterProfileId: viewerProfileId');
    expect(voteTab).not.toContain('if (supabase && !viewerProfileId) return;');
    expect(voteTab).not.toContain('voterProfileId: userId');
  });

  it('keeps CookProof gallery wired to submission detail and profile with reduced motion support', () => {
    const recipe = readFileSync(path.join(ROOT_ROUTE_DIR, 'recipe', '[id].tsx'), 'utf8');
    const profile = readFileSync(path.join(ROOT_ROUTE_DIR, '(tabs)', 'profile.tsx'), 'utf8');
    const gallery = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'CookProofGallery.tsx'), 'utf8');
    const data = readFileSync(path.join(ROOT_ROUTE_DIR, 'data', 'cloud-vote-proofs.ts'), 'utf8');

    expect(recipe).toContain('<CookProofGallery');
    expect(recipe).toContain('getSubmissionCookProofGallery');
    expect(recipe).toContain('focusedProofId');
    expect(recipe).toContain('deleteVoteWithProof');
    expect(recipe).toContain('Delete CookProof vote');
    const profileRecipesPane = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'profile', 'ProfileRecipesPane.tsx'), 'utf8');
    expect(profileRecipesPane).toContain('MyCookProofGrid');
    expect(profileRecipesPane).toContain('proofGrid');
    expect(profile).toContain('deleteVoteWithProof');
    expect(profile).toContain('Delete CookProof vote');
    expect(profile).toContain('getProfileCookProofs');
    expect(gallery).toContain('useReducedMotionPreference');
    expect(gallery).toContain('Approved CookProof gallery');
    expect(gallery).toContain('View all ({count})');
    expect(gallery).toContain('onDeleteProof');
    expect(data).toContain("from('bc_vote_proofs')");
    expect(data).toContain(".eq('status', 'approved')");
    expect(data).toContain('getSubmissionCookProofGallery');
    expect(data).toContain("from('bc_votes')");
  });

  it('keeps gesture handlers animated, accessible, and backed by button alternatives', () => {
    const filePath = path.join(ROOT_ROUTE_DIR, 'components', 'KitchenSliderShell.tsx');
    const source = readFileSync(filePath, 'utf8');
    const failures: string[] = [];
    const rel = path.relative(process.cwd(), filePath);
    const panResponderIndex = source.indexOf('PanResponder.create');

    for (const pattern of [
      'onMoveShouldSetPanResponder',
      'onPanResponderRelease',
      'directionFromGesture',
      'Animated.parallel',
      'Animated.timing',
      'accessibilityLabel',
      "pathname: '/soon'",
      'actions.map',
    ]) {
      if (!source.includes(pattern)) {
        failures.push(`${rel}:${lineNumber(source, Math.max(panResponderIndex, 0))} missing ${pattern}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps the Kitchen upload hub visible with real routes (P14-C wired barcode + clipboard)', () => {
    const source = readFileSync(path.join(ROOT_ROUTE_DIR, '(tabs)', 'kitchen.tsx'), 'utf8');
    expect(source).toContain('Manual Food');
    expect(source).toContain('Barcode');
    expect(source).toContain('Receipt Photo');
    expect(source).toContain('Grocery Photo');
    expect(source).toContain('Expiration Photo');
    expect(source).toContain('Recipe Ingredients');
    expect(source).toContain('Clipboard');
    expect(source).toContain("router.push('/pantry')");
    expect(source).toContain("router.push('/kitchen-receipt')");
    expect(source).toContain("router.push('/kitchen-photo')");
    expect(source).toContain("router.push('/expiration-photo')");
    expect(source).toContain("router.push('/recipes/new')");
    expect(source).toContain("router.push('/kitchen-barcode')");
    expect(source).toContain("router.push('/kitchen-paste-recipe')");
  });

  it('documents the Kitchen slider gesture map before implementation details', () => {
    const backlog = readFileSync(BACKLOG_PATH, 'utf8');
    expect(backlog).toContain('### Gesture Map - 2026-04-25');
    expect(backlog).toContain('| Kitchen | Grocery lists | Recipe slider, routed to `/soon`');
    expect(backlog).toContain('| Grocery | Recipe slider, routed to `/soon`');
    expect(backlog).toContain('| Saved recipe | Grocery lists | Kitchen | Cooking mode/video, routed to `/soon`');
    expect(backlog).toContain('Reduced-motion users bypass transform movement');
  });

  it('keeps the Kitchen, Grocery, and saved recipe views inside the slider shell', () => {
    const kitchen = readFileSync(path.join(ROOT_ROUTE_DIR, '(tabs)', 'kitchen.tsx'), 'utf8');
    const grocery = readFileSync(path.join(ROOT_ROUTE_DIR, 'grocery.tsx'), 'utf8');
    const recipe = readFileSync(path.join(ROOT_ROUTE_DIR, 'saved-recipe', '[id].tsx'), 'utf8');

    expect(kitchen).toContain('<KitchenSliderShell surface="kitchen"');
    expect(grocery).toContain('<KitchenSliderShell surface="grocery"');
    expect(recipe).toContain('<KitchenSliderShell surface="recipe"');
  });

  it('keeps slider gestures animated, accessible, reduced-motion aware, and routed', () => {
    const shell = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'KitchenSliderShell.tsx'), 'utf8');
    const mediaUtils = readFileSync(path.join(ROOT_ROUTE_DIR, 'utils', 'media.ts'), 'utf8');

    expect(shell).toContain('PanResponder.create');
    expect(shell).toContain("direction: 'left'");
    expect(shell).toContain("direction: 'right'");
    expect(shell).toContain("direction: 'up'");
    expect(shell).toContain("direction: 'down'");
    expect(shell).toContain('Animated.timing');
    expect(shell).toContain('accessibilityLabel');
    expect(shell).toContain("pathname: '/soon'");
    expect(shell).toContain('useReducedMotionPreference');
    expect(mediaUtils).toContain('AccessibilityInfo.isReduceMotionEnabled');
    expect(mediaUtils).toContain('reduceMotionChanged');
  });

  it('keeps the Kitchen slider rail in layout instead of overlaying content', () => {
    const shell = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'KitchenSliderShell.tsx'), 'utf8');
    const kitchen = readFileSync(path.join(ROOT_ROUTE_DIR, '(tabs)', 'kitchen.tsx'), 'utf8');
    const railIndex = shell.indexOf('rail: {');
    const railButtonIndex = shell.indexOf('railButton:', railIndex);
    const railBlock = shell.slice(railIndex, railButtonIndex);

    expect(railIndex).toBeGreaterThan(-1);
    expect(railButtonIndex).toBeGreaterThan(railIndex);
    expect(railBlock).not.toContain("position: 'absolute'");
    expect(railBlock).not.toContain('bottom:');
    expect(railBlock).toContain('marginHorizontal');
    expect(railBlock).toContain('marginBottom');
    expect(kitchen).not.toContain('paddingBottom: 190');
  });

  it('routes Kitchen barcode and clipboard actions to their P14-C destinations', () => {
    const kitchen = readFileSync(path.join(ROOT_ROUTE_DIR, '(tabs)', 'kitchen.tsx'), 'utf8');
    const failures: string[] = [];
    const uploadHandlerIndex = kitchen.indexOf('const openUploadAction');
    const expected: Record<string, string> = {
      barcode: '/kitchen-barcode',
      clipboard: '/kitchen-paste-recipe',
    };
    for (const [actionKey, route] of Object.entries(expected)) {
      const actionIndex = kitchen.indexOf(`case '${actionKey}'`, uploadHandlerIndex);
      const actionBlock = actionIndex === -1 ? '' : kitchen.slice(actionIndex, kitchen.indexOf('return;', actionIndex) + 'return;'.length);
      if (!actionBlock.includes(`'${route}'`)) {
        failures.push(`app/(root)/(tabs)/kitchen.tsx:${lineNumber(kitchen, Math.max(actionIndex, 0))} ${actionKey}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps Phase 1 grocery item actions available from each item row', () => {
    const grocery = readFileSync(path.join(ROOT_ROUTE_DIR, 'grocery.tsx'), 'utf8');

    expect(grocery).toContain('const handleItemActions');
    expect(grocery).toContain('removeGroceryListItem(db, item.id)');
    expect(grocery).toContain("t('Open grocery item actions')");
    expect(grocery).toContain("t('Mark Checked')");
    expect(grocery).toContain("t('Nutrition Details')");
    expect(grocery).toContain("t('Delete Item')");
    expect(grocery).toContain('<MoreHorizontal');
  });

  it('keeps capture upload routes guarded by camera and library permission preflights', () => {
    for (const route of ['kitchen-receipt.tsx', 'kitchen-photo.tsx', 'expiration-photo.tsx']) {
      const source = readFileSync(path.join(ROOT_ROUTE_DIR, route), 'utf8');
      const rel = path.join('app/(root)', route);
      const cameraPermission = source.indexOf('ImagePicker.requestCameraPermissionsAsync()');
      const libraryPermission = source.indexOf('ImagePicker.requestMediaLibraryPermissionsAsync()');
      const cameraLaunch = source.indexOf('ImagePicker.launchCameraAsync');
      const libraryLaunch = source.indexOf('ImagePicker.launchImageLibraryAsync');

      expect(cameraPermission, `${rel} camera permission`).toBeGreaterThan(-1);
      expect(libraryPermission, `${rel} library permission`).toBeGreaterThan(-1);
      expect(cameraLaunch, `${rel} camera launch`).toBeGreaterThan(-1);
      expect(libraryLaunch, `${rel} library launch`).toBeGreaterThan(-1);
      expect(cameraPermission, `${rel} camera preflight order`).toBeLessThan(cameraLaunch);
      expect(libraryPermission, `${rel} library preflight order`).toBeLessThan(libraryLaunch);
      expect(source).toContain('if (!permission.granted)');
      expect(source).toContain("t('Photo access needed')");
    }
  });

  it('keeps Phase 3 receipt provider selection and nutrition enrichment visible', () => {
    const receipt = readFileSync(path.join(ROOT_ROUTE_DIR, 'kitchen-receipt.tsx'), 'utf8');
    const data = readFileSync(path.join(ROOT_ROUTE_DIR, 'data', 'kitchen.ts'), 'utf8');

    expect(data).toContain('RECEIPT_OCR_PROVIDER_OPTIONS');
    expect(data).toContain("'manual_text'");
    expect(data).toContain("'claude_vision'");
    expect(data).toContain("'managed_cloud'");
    expect(data).toContain("'on_device'");
    expect(data).toContain('includeNetworkNutrition');
    expect(receipt).toContain('OCR Provider');
    expect(receipt).toContain('setOcrProvider(option.id)');
    expect(receipt).toContain('Enrich matches with nutrition providers');
    expect(receipt).toContain('includeNetworkNutrition');
  });

  it('keeps Phase 4 grocery photo crop and region evidence visible through review', () => {
    const photo = readFileSync(path.join(ROOT_ROUTE_DIR, 'kitchen-photo.tsx'), 'utf8');
    const review = readFileSync(path.join(ROOT_ROUTE_DIR, 'kitchen-photo-review.tsx'), 'utf8');
    const data = readFileSync(path.join(ROOT_ROUTE_DIR, 'data', 'kitchen.ts'), 'utf8');

    expect(data).toContain('bounding_box');
    expect(data).toContain('crop_uri');
    expect(photo).toContain('getInitialGroceryPhotoCandidates');
    expect(photo).toContain('shouldUseDemoFixturesInDev()');
    expect(photo).toContain('rawCandidateJson: submittedRawCandidates');
    expect(photo).not.toContain('SAMPLE_GROCERY_PHOTO_JSON');
    expect(review).toContain('candidate.crop_uri');
    expect(review).toContain('candidate.bounding_box');
    expect(review).toContain('cropUri: candidate.crop_uri');
    expect(review).toContain('Crop available');
    expect(review).toContain('<Image source={{ uri: candidate.crop_uri }}');
  });

  it('keeps Phase 5 expiration OCR provider status, manual selection, evidence, and labels visible', () => {
    const expiration = readFileSync(path.join(ROOT_ROUTE_DIR, 'expiration-photo.tsx'), 'utf8');
    const data = readFileSync(path.join(ROOT_ROUTE_DIR, 'data', 'kitchen.ts'), 'utf8');

    expect(data).toContain('EXPIRATION_OCR_PROVIDER_OPTIONS');
    expect(data).toContain("'manual_text'");
    expect(data).toContain("'claude_vision'");
    expect(data).toContain("'managed_cloud'");
    expect(data).toContain("'on_device'");
    expect(data).toContain('providerStatus');
    expect(data).toContain('requiresManualSelection');
    expect(data).toContain('No pantry data changed');
    expect(expiration).toContain('OCR Provider');
    expect(expiration).toContain('setOcrProvider(option.id)');
    expect(expiration).toContain('providerStatus');
    expect(expiration).toContain("setSelectedDate(review.requiresManualSelection ? ''");
    expect(expiration).toContain('candidate.reason');
    expect(expiration).toContain('candidate.context');
    expect(expiration).toContain('candidate.crop_uri');
    expect(expiration).toContain("accessibilityLabel={t('Open camera for expiration photo')}");
    expect(expiration).toContain("accessibilityLabel={t('Choose expiration photo from library')}");
    expect(expiration).toContain("accessibilityLabel={busy ? t('Reading expiration date') : t('Read expiration date')}");
    expect(expiration).toContain("accessibilityLabel={t('Confirm expiration date')}");
  });

  it('keeps Phase 6 nutrition panels universal with pantry source selection', () => {
    const panel = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'NutritionPanel.tsx'), 'utf8');
    const pantry = readFileSync(path.join(ROOT_ROUTE_DIR, 'pantry.tsx'), 'utf8');
    const data = readFileSync(path.join(ROOT_ROUTE_DIR, 'data', 'kitchen.ts'), 'utf8');
    const grocery = readFileSync(path.join(ROOT_ROUTE_DIR, 'grocery.tsx'), 'utf8');
    const savedRecipe = readFileSync(path.join(ROOT_ROUTE_DIR, 'saved-recipe', '[id].tsx'), 'utf8');
    const recipe = readFileSync(path.join(ROOT_ROUTE_DIR, 'recipe', '[id].tsx'), 'utf8');
    const dish = readFileSync(path.join(ROOT_ROUTE_DIR, 'dish', '[id].tsx'), 'utf8');

    expect(panel).toContain('sourceChoices');
    expect(panel).toContain('onSelectSource');
    expect(panel).toContain('Source Choices');
    expect(panel).toContain('Selected nutrition source');
    expect(panel).toContain('Choose nutrition source');
    expect(pantry).toContain('selectPantryNutritionSource');
    expect(pantry).toContain("t('Use nutrition source?')");
    expect(pantry).toContain("t('Use Source')");
    expect(pantry).toContain('sourceChoices={row.nutritionSourceChoices}');
    expect(data).toContain('getNutritionSourceChoicesForPantryItem');
    expect(data).toContain('selectNutritionSourceForPantryItem');
    expect(grocery).toContain('<NutritionPanel detail={item.nutritionDetail} compact />');
    expect(savedRecipe).toContain('<NutritionPanel detail={details.nutritionDetail}');
    expect(recipe).toContain('<NutritionPanel detail={nutritionBundle.detail}');
    expect(dish).toContain('<NutritionPanel detail={nutritionBundle.detail}');
  });

  it('keeps media slots stable with nonblank fallbacks across kitchen surfaces', () => {
    const mediaSlot = readFileSync(path.join(ROOT_ROUTE_DIR, 'components', 'MediaSlot.tsx'), 'utf8');
    const mediaUtils = readFileSync(path.join(ROOT_ROUTE_DIR, 'utils', 'media.ts'), 'utf8');
    const kitchen = readFileSync(path.join(ROOT_ROUTE_DIR, '(tabs)', 'kitchen.tsx'), 'utf8');
    const grocery = readFileSync(path.join(ROOT_ROUTE_DIR, 'grocery.tsx'), 'utf8');
    const pantry = readFileSync(path.join(ROOT_ROUTE_DIR, 'pantry.tsx'), 'utf8');
    const recipe = readFileSync(path.join(ROOT_ROUTE_DIR, 'saved-recipe', '[id].tsx'), 'utf8');
    const feed = readFileSync(path.join(ROOT_ROUTE_DIR, 'feed.tsx'), 'utf8');

    expect(mediaUtils).toContain('MEDIA_SLOT_ASPECT_RATIOS');
    expect(mediaSlot).toContain('aspectRatio');
    expect(mediaSlot).toContain('mediaSlotFallbackLabel');
    expect(mediaSlot).toContain('fallbackTitle');
    expect(kitchen).toContain('kind="recipe"');
    expect(grocery).toContain('kind="receipt"');
    expect(pantry).toContain('mediaKindForBatch');
    expect(recipe).toContain('Saved recipe media');
    expect(feed).toContain('StyleSheet.absoluteFillObject');
    expect(feed).toContain('setSubmissionLikeDesired');
    expect(feed).toContain('fill={likeState.liked');
  });

  it('keeps Phase 0 recipe shell icon controls accessible', () => {
    const newRecipe = readFileSync(path.join(ROOT_ROUTE_DIR, 'recipes', 'new.tsx'), 'utf8');
    const savedRecipe = readFileSync(path.join(ROOT_ROUTE_DIR, 'saved-recipe', '[id].tsx'), 'utf8');

    expect(newRecipe).toContain("accessibilityLabel={t('Back')}");
    expect(newRecipe).toContain("accessibilityLabel={t('Save recipe')}");
    expect(newRecipe).toContain('useLocalSearchParams');
    expect(newRecipe).toContain('updateSavedRecipe');
    expect(savedRecipe).toContain("accessibilityLabel={t('Back')}");
    expect(savedRecipe).toContain("accessibilityLabel={t('Edit saved recipe')}");
    expect(savedRecipe).toContain("pathname: '/recipes/new'");
    expect(savedRecipe).toContain('recipeId: recipe.id');
    expect(savedRecipe).toContain("accessibilityLabel={t('Export saved recipe')}");
    expect(savedRecipe).toContain("t('Export Recipe')");
    expect(savedRecipe).toContain('Print.printAsync');
    expect(savedRecipe).toContain('Print.printToFileAsync');
    expect(savedRecipe).toContain('Share.share');
    expect(savedRecipe).toContain("t('Remove favorite')");
    expect(savedRecipe).toContain("t('Mark favorite')");
  });

  it('keeps Phase 9 visual QA screenshot evidence attached to session docs', () => {
    const backlog = readFileSync(BACKLOG_PATH, 'utf8');
    const session = readFileSync(PHASE_9_SESSION_PATH, 'utf8');
    const screenshotPaths = [
      'output/playwright/bestchef-phase-9/01-kitchen-clean.png',
      'output/playwright/bestchef-phase-9/02-grocery-afterprompt.png',
      'output/playwright/bestchef-phase-9/03-pantry.png',
      'output/playwright/bestchef-phase-9/04-receipt-capture.png',
      'output/playwright/bestchef-phase-9/05-grocery-photo-capture.png',
      'output/playwright/bestchef-phase-9/06-expiration-ocr.png',
      'output/playwright/bestchef-phase-9/07-recipe-entry.png',
    ];

    expect(backlog).toContain('5. [x] Visual QA screenshots are attached to implementation sessions.');
    expect(backlog).not.toContain('screenshots pending');
    for (const screenshotPath of screenshotPaths) {
      expect(session).toContain(screenshotPath);
    }
  });
});
