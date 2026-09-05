export type { MCOption, MCQuestion, MCSessionConfig, MCResult } from './types';
export {
  getEligibleCards,
  generateDistractors,
  buildMCQuestion,
  generateMCQuestions,
  calculateMCScore,
  truncateText,
} from './distractor-engine';
