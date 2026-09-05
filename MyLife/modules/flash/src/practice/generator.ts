import type { PracticeQuestion, PracticeTestConfig, QuestionType } from './types';

interface CardData {
  id: string;
  front: string;
  back: string;
  tags: string[];
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

export function generateMCQuestion(
  card: CardData,
  allCards: CardData[],
  index: number,
): PracticeQuestion | null {
  const distractorPool = allCards.filter((c) => c.id !== card.id && c.back.trim());
  if (distractorPool.length < 3) return null;

  const distractors = shuffle(distractorPool).slice(0, 3).map((c) => c.back.trim());
  const options = shuffle([card.back.trim(), ...distractors]);

  return {
    questionIndex: index,
    sourceCardId: card.id,
    questionType: 'mc',
    questionText: truncate(card.front, 500),
    options,
    correctAnswer: card.back.trim(),
  };
}

export function generateTFQuestion(
  card: CardData,
  allCards: CardData[],
  index: number,
): PracticeQuestion {
  const isTrue = Math.random() >= 0.5;
  if (isTrue) {
    return {
      questionIndex: index,
      sourceCardId: card.id,
      questionType: 'tf',
      questionText: `${truncate(card.front, 400)} -- ${truncate(card.back, 400)}`,
      options: ['True', 'False'],
      correctAnswer: 'True',
    };
  }
  const distractorPool = allCards.filter((c) => c.id !== card.id && c.back.trim());
  const wrongAnswer = distractorPool.length > 0
    ? distractorPool[Math.floor(Math.random() * distractorPool.length)].back.trim()
    : 'False statement';

  return {
    questionIndex: index,
    sourceCardId: card.id,
    questionType: 'tf',
    questionText: `${truncate(card.front, 400)} -- ${truncate(wrongAnswer, 400)}`,
    options: ['True', 'False'],
    correctAnswer: 'False',
  };
}

export function generateShortAnswerQuestion(
  card: CardData,
  index: number,
): PracticeQuestion {
  return {
    questionIndex: index,
    sourceCardId: card.id,
    questionType: 'short_answer',
    questionText: truncate(card.front, 500),
    options: [],
    correctAnswer: card.back.trim(),
  };
}

export function generateFillBlankQuestion(
  card: CardData,
  index: number,
): PracticeQuestion {
  const words = card.back.trim().split(/\s+/);
  const blankIdx = Math.floor(words.length / 2);
  const answer = words[blankIdx] || card.back.trim();
  const blanked = words.map((w, i) => (i === blankIdx ? '______' : w)).join(' ');

  return {
    questionIndex: index,
    sourceCardId: card.id,
    questionType: 'fill_blank',
    questionText: `${truncate(card.front, 400)}\n\nFill in the blank: ${blanked}`,
    options: [],
    correctAnswer: answer,
  };
}

export function generateTestQuestions(
  config: PracticeTestConfig,
  cards: CardData[],
): PracticeQuestion[] {
  if (cards.length === 0) return [];

  const maxQuestions = Math.min(config.questionCount, cards.length);
  const selectedCards = shuffle(cards).slice(0, maxQuestions);
  const types = config.questionTypes.length > 0 ? config.questionTypes : ['mc', 'tf'] as QuestionType[];
  const questions: PracticeQuestion[] = [];

  for (let i = 0; i < selectedCards.length; i++) {
    const card = selectedCards[i];
    const questionType = types[i % types.length];
    let question: PracticeQuestion | null = null;

    if (questionType === 'mc') {
      question = generateMCQuestion(card, cards, i);
      if (!question) question = generateTFQuestion(card, cards, i);
    } else if (questionType === 'tf') {
      question = generateTFQuestion(card, cards, i);
    } else if (questionType === 'short_answer') {
      question = generateShortAnswerQuestion(card, i);
    } else if (questionType === 'fill_blank') {
      question = generateFillBlankQuestion(card, i);
    }

    if (question) questions.push(question);
  }

  return questions;
}
