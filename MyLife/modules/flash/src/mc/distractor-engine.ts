import type { MCOption, MCQuestion } from './types';

export interface CardData {
  id: string;
  front: string;
  back: string;
  cardType: string;
  queue: string;
  templateOrdinal: number;
}

const MAX_OPTION_LENGTH = 120;

function truncateText(text: string, maxLength: number = MAX_OPTION_LENGTH): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getEligibleCards(cards: CardData[]): CardData[] {
  return cards.filter(
    (c) => c.queue !== 'suspended' && c.queue !== 'buried' && c.templateOrdinal === 0,
  );
}

export function generateDistractors(
  correctCard: CardData,
  allCards: CardData[],
  count: number = 3,
): CardData[] {
  const candidates = allCards.filter(
    (c) =>
      c.id !== correctCard.id &&
      c.back.trim().toLowerCase() !== correctCard.back.trim().toLowerCase(),
  );
  return fisherYatesShuffle(candidates).slice(0, count);
}

export function buildMCQuestion(
  correctCard: CardData,
  distractors: CardData[],
): MCQuestion {
  const correctOption: MCOption = {
    text: truncateText(correctCard.back),
    cardId: correctCard.id,
    isCorrect: true,
  };

  const distractorOptions: MCOption[] = distractors.map((d) => ({
    text: truncateText(d.back),
    cardId: d.id,
    isCorrect: false,
  }));

  return {
    questionText: correctCard.front,
    cardId: correctCard.id,
    options: fisherYatesShuffle([correctOption, ...distractorOptions]),
  };
}

export function generateMCQuestions(
  cards: CardData[],
  questionCount: number | 'all',
): MCQuestion[] {
  const eligible = getEligibleCards(cards);

  if (eligible.length < 4) {
    throw new Error('Need at least 4 cards for multiple choice.');
  }

  const count = questionCount === 'all' ? eligible.length : Math.min(questionCount, eligible.length);
  const questionCards = fisherYatesShuffle(eligible).slice(0, count);

  return questionCards.map((card) => {
    const distractors = generateDistractors(card, eligible, 3);
    return buildMCQuestion(card, distractors);
  });
}

export function calculateMCScore(
  correctCount: number,
  totalCount: number,
): number {
  if (totalCount === 0) return 0;
  return Math.round((correctCount / totalCount) * 1000) / 10;
}

export { truncateText, fisherYatesShuffle };
