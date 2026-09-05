'use server';

import {
  getChallengeTemplates,
  getSeasonalChallenges,
  type ChallengeTemplate,
  type Season,
} from '@mylife/bestchef';

// ── Result wrapper ──────────────────────────────────────────────────

interface ActionResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

function success<T>(data: T): ActionResult<T> {
  return { ok: true, data, error: null };
}

// ── Actions ─────────────────────────────────────────────────────────

export async function getChallengeTemplatesAction(): Promise<ActionResult<ChallengeTemplate[]>> {
  try {
    return success(getChallengeTemplates());
  } catch (err) {
    console.error('[challenge-actions] getChallengeTemplatesAction failed:', err);
    return { ok: false, data: null, error: 'Failed to load challenge templates' };
  }
}

export async function getSeasonalChallengesAction(
  season?: Season,
): Promise<ActionResult<ChallengeTemplate[]>> {
  try {
    return success(getSeasonalChallenges(season));
  } catch (err) {
    console.error('[challenge-actions] getSeasonalChallengesAction failed:', err);
    return { ok: false, data: null, error: 'Failed to load seasonal challenges' };
  }
}
