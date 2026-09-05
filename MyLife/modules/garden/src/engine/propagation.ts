import type { PropagationStage } from '../types';

const STAGE_ORDER: PropagationStage[] = ['started', 'callusing', 'rooting', 'growing', 'ready', 'potted'];

/**
 * Get the next valid stages for a given stage (forward progression only).
 * Any non-terminal stage can also go to 'failed'.
 */
export function getNextStages(current: PropagationStage): PropagationStage[] {
  if (current === 'failed' || current === 'potted') return [];
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1) return [];
  const forward = STAGE_ORDER.slice(idx + 1);
  return forward;
}

/**
 * Check if advancing from one stage to another is valid.
 * Forward progression only. Any stage can go to 'failed'.
 */
export function isValidStageTransition(from: PropagationStage, to: PropagationStage): boolean {
  if (from === 'failed' || from === 'potted') return false;
  if (to === 'failed') return true;
  const fromIdx = STAGE_ORDER.indexOf(from);
  const toIdx = STAGE_ORDER.indexOf(to);
  return toIdx > fromIdx;
}

/**
 * Calculate success rate. Returns 0 for zero total.
 */
export function calculateSuccessRate(totalCount: number, pottedCount: number): number {
  if (totalCount === 0) return 0;
  return Math.round((pottedCount / totalCount) * 1000) / 10;
}
