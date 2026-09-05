import type { MatchTile, MatchBoard } from './types';

export interface MatchCardData {
  id: string;
  front: string;
  back: string;
  queue: string;
  templateOrdinal: number;
}

const MAX_TILE_TEXT_LENGTH = 60;

export function truncateTileText(text: string): string {
  if (text.length <= MAX_TILE_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TILE_TEXT_LENGTH) + '...';
}

export function fisherYatesShuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getEligibleCards(cards: MatchCardData[]): MatchCardData[] {
  return cards.filter(
    (c) => c.queue !== 'suspended' && c.queue !== 'buried' && c.templateOrdinal === 0,
  );
}

export function generateBoard(
  cards: MatchCardData[],
  requestedBoardSize: number,
): MatchBoard {
  const eligible = getEligibleCards(cards);

  if (eligible.length < 3) {
    throw new Error('Need at least 3 cards to play Match Game.');
  }

  const maxPairs = eligible.length;
  const requestedPairs = Math.floor(requestedBoardSize / 2);
  const pairCount = Math.min(requestedPairs, maxPairs);
  const boardSize = pairCount * 2;

  const selectedCards = fisherYatesShuffle(eligible).slice(0, pairCount);

  const tiles: MatchTile[] = [];
  for (const card of selectedCards) {
    tiles.push({
      tileId: `${card.id}_front`,
      cardId: card.id,
      side: 'front',
      text: truncateTileText(card.front),
    });
    tiles.push({
      tileId: `${card.id}_back`,
      cardId: card.id,
      side: 'back',
      text: truncateTileText(card.back),
    });
  }

  return {
    tiles: fisherYatesShuffle(tiles),
    boardSize,
    pairCount,
  };
}

export function checkMatch(tileA: MatchTile, tileB: MatchTile): boolean {
  return tileA.cardId === tileB.cardId && tileA.side !== tileB.side;
}

// Base thresholds for 12-tile (6-pair) board
const BASE_BOARD_SIZE = 12;
const BASE_3STAR_TIME_MS = 30_000;
const BASE_3STAR_MAX_MISTAKES = 1;
const BASE_2STAR_TIME_MS = 60_000;
const BASE_2STAR_MAX_MISTAKES = 4;

export function calculateStars(
  boardSize: number,
  timeMs: number,
  mistakes: number,
): number {
  const scale = boardSize / BASE_BOARD_SIZE;

  const time3Star = BASE_3STAR_TIME_MS * scale;
  const time2Star = BASE_2STAR_TIME_MS * scale;
  const mistakes3Star = Math.ceil(BASE_3STAR_MAX_MISTAKES * scale);
  const mistakes2Star = Math.ceil(BASE_2STAR_MAX_MISTAKES * scale);

  if (mistakes <= mistakes3Star && timeMs <= time3Star) return 3;
  if (mistakes <= mistakes2Star && timeMs <= time2Star) return 2;
  return 1;
}
