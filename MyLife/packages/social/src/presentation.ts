import { MODULE_METADATA } from '@mylife/module-registry';
import type { ModuleId } from '@mylife/module-registry';
import type { Activity, Challenge, ChallengeMember } from './types';

export interface SocialModulePresentation {
  name: string;
  icon: string;
  accentColor: string;
}

const FALLBACK_MODULE_PRESENTATION: SocialModulePresentation = {
  name: 'MyLife',
  icon: '\u{1F30D}',
  accentColor: '#7C4DFF',
};

export function getSocialModulePresentation(
  moduleId: ModuleId | null | undefined,
): SocialModulePresentation {
  if (!moduleId) return FALLBACK_MODULE_PRESENTATION;

  const moduleMetadata = MODULE_METADATA[moduleId];
  if (!moduleMetadata) return FALLBACK_MODULE_PRESENTATION;

  return {
    name: moduleMetadata.name,
    icon: moduleMetadata.icon,
    accentColor: moduleMetadata.accentColor,
  };
}

export function describeSocialActivity(
  activity: Pick<Activity, 'title' | 'description'>,
): string {
  const title = activity.title.trim();
  const description = activity.description?.trim();

  if (!description) return title;
  if (!title) return description;
  return `${title}. ${description}`;
}

export function getPrimaryChallengeModuleId(
  challenge: Pick<Challenge, 'goals'>,
): ModuleId | null {
  return challenge.goals[0]?.moduleId ?? null;
}

export function calculateChallengeProgressPercent(
  challenge: Pick<Challenge, 'goals'>,
  member: Pick<ChallengeMember, 'progress'> | null | undefined,
): number | null {
  if (!member) return null;
  if (challenge.goals.length === 0) return 0;

  let completionTotal = 0;

  for (const goal of challenge.goals) {
    const currentValue = member.progress[goal.id] ?? 0;
    completionTotal += Math.min(currentValue, goal.targetCount) / goal.targetCount;
  }

  return Math.round((completionTotal / challenge.goals.length) * 100);
}

export function suggestSocialHandle(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);

  if (normalized.length >= 3) return normalized;
  return 'mylife_user';
}
