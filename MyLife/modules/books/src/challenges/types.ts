/**
 * Challenge engine types.
 */

import type { Challenge } from '../models/schemas';

export interface ChallengeStatus {
  challenge: Challenge;
  currentValue: number;
  targetValue: number;
  percentComplete: number;
  isComplete: boolean;
}
