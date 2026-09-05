import {
  getTarotCardById,
  getTarotCardByName,
  getTarotCardOfDay,
  TAROT_SPREADS_BY_TYPE,
  type DailyReading,
  type TarotCard,
  type TarotReadingCard,
  type TarotSpreadType,
} from '@mylife/stars';

export function formatLongDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonthGroup(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function getDateParts(date: string): { day: string; month: string } {
  const value = new Date(`${date}T00:00:00`);
  return {
    day: value.toLocaleDateString('en-US', { day: '2-digit' }),
    month: value.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

export function getSpreadLabel(spreadType: TarotSpreadType): string {
  return TAROT_SPREADS_BY_TYPE[spreadType]?.shortLabel ?? spreadType;
}

export function resolveDailyTarotCard(
  reading: DailyReading | null | undefined,
  date: string,
): TarotCard {
  const storedCard =
    getTarotCardById(reading?.tarotCardId ?? '') ??
    getTarotCardByName(reading?.tarotCard ?? null);

  return storedCard ?? getTarotCardOfDay(date);
}

export function buildDailySummary(card: TarotCard, reversed: boolean): string {
  const core = reversed ? card.reversedMeaning : card.uprightMeaning;
  return `${core} Focus on ${card.keywords.slice(0, 2).join(' and ')} today.`;
}

export function buildPositionInterpretation(
  card: TarotCard,
  positionMeaning: string,
  reversed: boolean,
): string {
  const base = reversed ? card.reversedMeaning : card.uprightMeaning;
  return `${positionMeaning} ${base}`.trim();
}

export function buildReadingNarrative(cards: TarotReadingCard[]): string {
  if (cards.length === 0) {
    return 'The archive is quiet for now. Draw when the question feels ready.';
  }

  if (cards.length === 1) {
    return `${cards[0].cardName} is the single thread running through this question. ${cards[0].interpretation}`;
  }

  const opening = cards[0];
  const middle = cards[Math.floor(cards.length / 2)];
  const closing = cards[cards.length - 1];

  return `${opening.cardName} opens the reading through ${opening.positionLabel.toLowerCase()}, ${middle.cardName} describes the living tension at ${middle.positionLabel.toLowerCase()}, and ${closing.cardName} points toward ${closing.positionLabel.toLowerCase()}.`;
}

export function createTarotTitle(spreadType: TarotSpreadType, question: string): string {
  if (question.trim().length > 0) {
    return question.trim().slice(0, 72);
  }

  return `${TAROT_SPREADS_BY_TYPE[spreadType]?.name ?? 'Tarot'} Reading`;
}
