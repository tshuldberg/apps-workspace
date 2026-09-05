import type { HumanVerification, CommunityHealth, CommunityTemplate } from './types';

// ── Verification Checks ─────────────────────────────────────────────

export function isHumanVerified(
  verification: HumanVerification | null | undefined,
): boolean {
  return verification != null && verification.attestationHash.length > 0;
}

export function canParticipateInHumansOnly(
  communityHumansOnly: boolean,
  verification: HumanVerification | null | undefined,
): boolean {
  if (!communityHumansOnly) return true;
  return isHumanVerified(verification);
}

// ── Community Health Calculation ─────────────────────────────────────

export function calculateCommunityHealth(params: {
  totalMembers: number;
  verifiedMembers: number;
  avgResponseTimeMinutes: number;
  modActionsLast30Days: number;
  totalPostsLast30Days: number;
  flaggedPostsLast30Days: number;
  activePostersLast7Days: number;
  communityId: string;
  now?: Date;
}): CommunityHealth {
  const verifiedHumanPercent =
    params.totalMembers > 0
      ? Math.round((params.verifiedMembers / params.totalMembers) * 100)
      : 0;

  const flagRatio =
    params.totalPostsLast30Days > 0
      ? params.flaggedPostsLast30Days / params.totalPostsLast30Days
      : 0;
  const signalToNoiseScore = Math.round((1 - flagRatio) * 10 * 10) / 10;

  return {
    communityId: params.communityId,
    verifiedHumanPercent,
    avgResponseTimeMinutes: params.avgResponseTimeMinutes,
    modActionsLast30Days: params.modActionsLast30Days,
    signalToNoiseScore: Math.max(0, Math.min(10, signalToNoiseScore)),
    memberCount: params.totalMembers,
    activePostersLast7Days: params.activePostersLast7Days,
    computedAt: (params.now ?? new Date()).toISOString(),
  };
}

// ── Module Community Templates ──────────────────────────────────────

export const MODULE_COMMUNITY_TEMPLATES: CommunityTemplate[] = [
  {
    moduleId: 'books',
    name: 'books',
    displayName: 'Books',
    description: 'Discuss what you are reading, share recommendations, and join book clubs.',
    defaultRules: [
      'Be respectful of differing opinions on books',
      'Use spoiler tags for plot reveals',
      'No self-promotion without contributing to discussion',
    ],
    defaultTags: ['recommendations', 'discussion', 'book-club', 'reviews', 'new-releases'],
    welcomePost: {
      title: 'Welcome to the Books community',
      body: 'Share what you are reading, get recommendations from fellow readers, and join book clubs. Your MyBooks library is linked -- share entries directly in your posts.',
    },
    humansOnly: true,
  },
  {
    moduleId: 'recipes',
    name: 'recipes',
    displayName: 'Recipes',
    description: 'Share recipes, cooking tips, and meal planning ideas.',
    defaultRules: [
      'Include ingredients and instructions when sharing recipes',
      'Credit original recipe sources',
      'Be helpful with substitution suggestions',
    ],
    defaultTags: ['quick-meals', 'baking', 'meal-prep', 'dietary', 'techniques'],
    welcomePost: {
      title: 'Welcome to the Recipes community',
      body: 'Share your favorite recipes, get cooking advice, and discover new dishes. Link recipes from your MyRecipes collection directly in posts.',
    },
    humansOnly: true,
  },
  {
    moduleId: 'workouts',
    name: 'workouts',
    displayName: 'Workouts',
    description: 'Share workout routines, fitness tips, and progress updates.',
    defaultRules: [
      'Encourage all fitness levels',
      'Do not give medical advice',
      'Share your own experience, not prescriptions',
    ],
    defaultTags: ['routines', 'progress', 'form-check', 'nutrition', 'recovery'],
    welcomePost: {
      title: 'Welcome to the Workouts community',
      body: 'Share routines, track progress together, and get form advice. Your MyWorkouts data can be linked directly in posts.',
    },
    humansOnly: true,
  },
  {
    moduleId: 'budget',
    name: 'budget',
    displayName: 'Budget',
    description: 'Discuss budgeting strategies, savings tips, and financial goals.',
    defaultRules: [
      'No specific investment advice',
      'Share strategies, not account balances',
      'Be supportive of all income levels',
    ],
    defaultTags: ['savings', 'debt-free', 'tips', 'envelope-method', 'goals'],
    welcomePost: {
      title: 'Welcome to the Budget community',
      body: 'Share budgeting strategies, celebrate financial milestones, and learn from each other. Privacy-first -- share only what you are comfortable with.',
    },
    humansOnly: true,
  },
  {
    moduleId: 'surf',
    name: 'surf',
    displayName: 'Surf',
    description: 'Share surf reports, spot recommendations, and session recaps.',
    defaultRules: [
      'Respect local surf etiquette',
      'Be mindful about sharing secret spots',
      'Share conditions honestly',
    ],
    defaultTags: ['session-recap', 'conditions', 'gear', 'spots', 'beginners'],
    welcomePost: {
      title: 'Welcome to the Surf community',
      body: 'Share session recaps, discuss conditions, and connect with fellow surfers. Link your MySurf forecasts and session logs directly.',
    },
    humansOnly: true,
  },
  {
    moduleId: 'trails',
    name: 'trails',
    displayName: 'Trails',
    description: 'Share trail reports, hiking tips, and outdoor adventures.',
    defaultRules: [
      'Follow Leave No Trace principles',
      'Report trail conditions accurately',
      'Respect wildlife and other hikers',
    ],
    defaultTags: ['trail-report', 'gear', 'wildlife', 'photography', 'beginners'],
    welcomePost: {
      title: 'Welcome to the Trails community',
      body: 'Share trail conditions, plan group hikes, and discover new routes. Link your MyTrails logs and photos directly.',
    },
    humansOnly: true,
  },
];
