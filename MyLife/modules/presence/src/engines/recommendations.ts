import type { DailySummary } from '../types';

export type PresenceRecommendationType = 'goal' | 'session' | 'intention' | 'streak';

export interface PresenceRecommendation {
  type: PresenceRecommendationType;
  title: string;
  body: string;
  actionRoute: string;
}

export interface PresenceRecommendationContext {
  summary: DailySummary;
  goalMinutes: number;
  recentAverageMinutes: number;
  completedSessions: number;
  focusMinutes: number;
  currentStreak: number;
  intentionCompliance: number;
  violatingApps: Array<{
    appName: string;
    overage: number;
  }>;
}

export function buildPresenceRecommendations(
  context: PresenceRecommendationContext,
): PresenceRecommendation[] {
  const recommendations: PresenceRecommendation[] = [];
  const overGoalMinutes = Math.max(context.summary.totalMinutes - context.goalMinutes, 0);
  const underGoalMinutes = Math.max(context.goalMinutes - context.summary.totalMinutes, 0);
  const averageDelta = context.summary.totalMinutes - context.recentAverageMinutes;
  const heaviestApp = context.summary.topApps[0];

  if (overGoalMinutes > 0) {
    recommendations.push({
      type: 'goal',
      title: 'Reset tomorrow early',
      body: `You ran ${overGoalMinutes} minutes over goal today. Block one low-value window tomorrow morning so the day starts calmer.`,
      actionRoute: '/(presence)/stats',
    });
  } else {
    recommendations.push({
      type: 'goal',
      title: 'Protect the under-goal day',
      body: `You finished ${underGoalMinutes} minutes under goal. Repeat the same friction points tomorrow before reactive opens creep back in.`,
      actionRoute: '/(presence)/report',
    });
  }

  if (context.completedSessions === 0) {
    recommendations.push({
      type: 'session',
      title: 'Book one focus block',
      body: 'No focus session landed today. Schedule a 25 minute session near your most distracting hour tomorrow.',
      actionRoute: '/(presence)/sessions',
    });
  } else {
    recommendations.push({
      type: 'session',
      title: 'Lean on focus momentum',
      body: `Your ${context.completedSessions} completed session${context.completedSessions === 1 ? '' : 's'} protected ${context.focusMinutes} minutes of attention today.`,
      actionRoute: '/(presence)/sessions',
    });
  }

  if (context.intentionCompliance < 100 && context.violatingApps.length > 0) {
    const primaryViolation = context.violatingApps[0];
    recommendations.push({
      type: 'intention',
      title: 'Tighten one weak spot',
      body: `${primaryViolation.appName} drifted the furthest today. Lower its limit or enable a breathing pause so opens become deliberate.`,
      actionRoute: '/(presence)/intentions',
    });
  } else if (heaviestApp != null) {
    recommendations.push({
      type: 'intention',
      title: 'Keep your strongest boundary',
      body: `${heaviestApp.appName} was still your top app, but the plan held. Preserve that limit before it starts expanding again.`,
      actionRoute: '/(presence)/intentions',
    });
  }

  if (context.currentStreak >= 3) {
    recommendations.push({
      type: 'streak',
      title: 'Defend the streak',
      body: `You are on a ${context.currentStreak}-day streak. Keep tomorrow light in the afternoon so the streak does not depend on late recovery.`,
      actionRoute: '/(presence)/badges',
    });
  } else if (averageDelta < 0) {
    recommendations.push({
      type: 'streak',
      title: 'You are trending down',
      body: `Today landed ${Math.abs(averageDelta)} minutes below your recent average. Stack another clean day to turn that into a streak.`,
      actionRoute: '/(presence)/stats',
    });
  }

  return recommendations.slice(0, 3);
}
