export type { TileSide, MatchTile, MatchBoard, MatchResult } from './types';
export type { MatchCardData } from './board-generator';
export {
  getEligibleCards,
  generateBoard,
  checkMatch,
  calculateStars,
  truncateTileText,
  fisherYatesShuffle,
} from './board-generator';
