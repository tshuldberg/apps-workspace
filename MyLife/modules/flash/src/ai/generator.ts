import type { GenerationConfig, GenerationResult, GeneratedCard, CardTypePreference } from './types';
import {
  validateTextLength,
  extractDefinitions,
  extractColonDefinitions,
  extractLists,
  extractBoldTerms,
  deduplicateCards,
} from './text-parser';

function filterByPreference(
  cards: GeneratedCard[],
  preference: CardTypePreference,
): GeneratedCard[] {
  if (preference === 'auto') return cards;
  return cards.filter((c) => c.cardType === preference);
}

export function generateCardsOnDevice(config: GenerationConfig): GenerationResult {
  const start = Date.now();
  const error = validateTextLength(config.text);
  if (error) {
    return { cards: [], mode: 'on_device', inputLength: config.text.length, durationMs: Date.now() - start };
  }

  const allCards: GeneratedCard[] = [
    ...extractDefinitions(config.text),
    ...extractColonDefinitions(config.text),
    ...extractLists(config.text),
    ...extractBoldTerms(config.text),
  ];

  const filtered = filterByPreference(allCards, config.cardTypePreference);
  const deduplicated = deduplicateCards(filtered);

  return {
    cards: deduplicated,
    mode: 'on_device',
    inputLength: config.text.length,
    durationMs: Date.now() - start,
  };
}

export async function generateCards(config: GenerationConfig): Promise<GenerationResult> {
  if (config.mode === 'on_device') {
    return generateCardsOnDevice(config);
  }

  // Cloud mode placeholder -- requires API key configuration
  // In production, this would call Claude API with structured output
  throw new Error('Cloud AI generation requires API key configuration. Use on-device mode.');
}
