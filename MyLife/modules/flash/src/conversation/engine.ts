import type { CardContext, ConversationConfig, ConversationMode, ConversationDifficulty } from './types';

const MAX_CARDS_IN_CONTEXT = 50;

export function selectCardsForContext(
  cards: Array<CardContext & { dueAt?: string | null; lapseCount?: number; lastReviewAt?: string | null }>,
  maxCards = MAX_CARDS_IN_CONTEXT,
): CardContext[] {
  if (cards.length === 0) return [];

  const sorted = [...cards].sort((a, b) => {
    // Priority: due > leech > recently reviewed > rest
    const aScore = (a.dueAt ? 3 : 0) + (a.lapseCount && a.lapseCount >= 8 ? 2 : 0) + (a.lastReviewAt ? 1 : 0);
    const bScore = (b.dueAt ? 3 : 0) + (b.lapseCount && b.lapseCount >= 8 ? 2 : 0) + (b.lastReviewAt ? 1 : 0);
    return bScore - aScore;
  });

  return sorted.slice(0, maxCards).map(({ cardId, front, back }) => ({ cardId, front, back }));
}

export function formatCardContext(cards: CardContext[]): string {
  if (cards.length === 0) return '';
  return cards.map((c, i) => `[${i + 1}] Q: ${c.front}\nA: ${c.back}`).join('\n\n');
}

export function estimateTokens(text: string): number {
  // Rough approximation: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

function modeInstructions(mode: ConversationMode): string {
  switch (mode) {
    case 'tutor':
      return 'You are a patient tutor. Explain concepts from the study material, ask follow-up questions to check understanding, and correct misconceptions gently. Adapt your explanations to the student\'s level.';
    case 'quiz':
      return 'You are a quiz master. Ask rapid-fire questions based on the study material. After each answer, briefly say if it\'s correct and why, then move to the next question. Keep the pace fast.';
    case 'explain':
      return 'You ask the student to explain concepts from the study material. After their explanation, provide feedback on completeness and accuracy. Point out what they missed or got wrong.';
    case 'debate':
      return 'You take a contrarian position on topics from the study material. Challenge the student\'s understanding with counterarguments. The student must defend their knowledge with evidence from what they\'ve studied.';
  }
}

function difficultyInstructions(difficulty: ConversationDifficulty): string {
  switch (difficulty) {
    case 'beginner':
      return 'Use simple language. Break concepts into small pieces. Give lots of encouragement. Accept partial answers.';
    case 'medium':
      return 'Use standard academic language. Expect reasonable understanding. Probe for deeper connections.';
    case 'advanced':
      return 'Use technical language. Expect precise answers. Ask about edge cases and connections between concepts.';
  }
}

export function buildSystemPrompt(
  config: ConversationConfig,
  cards: CardContext[],
): string {
  const cardContent = formatCardContext(cards);
  const modeText = modeInstructions(config.mode);
  const diffText = difficultyInstructions(config.difficulty ?? 'medium');
  const langText = config.language && config.language !== 'en'
    ? `Conduct the conversation in ${config.language}.`
    : '';

  return [
    'You are a study companion for a flashcard app.',
    modeText,
    diffText,
    langText,
    '',
    'IMPORTANT RULES:',
    '- Only use knowledge from the study material provided below.',
    '- Do not introduce facts outside this material.',
    '- If the student asks something not in the material, say so.',
    '- Keep responses concise (2-4 sentences per turn).',
    '- When ending the conversation, provide a summary with:',
    '  1. Topics covered',
    '  2. Strong areas',
    '  3. Areas needing review',
    '  4. Performance: X/5 (where X is your rating)',
    '',
    `STUDY MATERIAL (${cards.length} cards):`,
    cardContent,
  ].filter(Boolean).join('\n');
}

export function buildOpeningMessage(mode: ConversationMode, deckName: string): string {
  switch (mode) {
    case 'tutor':
      return `Let's study ${deckName} together. I'll explain concepts and check your understanding. What would you like to start with, or shall I pick a topic?`;
    case 'quiz':
      return `Quick quiz on ${deckName}! I'll ask you questions and keep score. Ready? Here comes the first one.`;
    case 'explain':
      return `Let's test your understanding of ${deckName}. I'll ask you to explain concepts, and I'll give you feedback. Ready?`;
    case 'debate':
      return `Time to defend your knowledge of ${deckName}. I'll challenge your understanding. Don't just agree with me. Ready?`;
  }
}

export function extractPerformanceRating(text: string): number | null {
  const patterns = [
    /Performance:\s*(\d(?:\.\d)?)\s*\/\s*5/i,
    /(\d(?:\.\d)?)\s*\/\s*5\s*(?:stars?|rating)/i,
    /rating[:\s]+(\d(?:\.\d)?)\s*\/\s*5/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const rating = parseFloat(match[1]);
      if (rating >= 1 && rating <= 5) return rating;
    }
  }
  return null;
}
