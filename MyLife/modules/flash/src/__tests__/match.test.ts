import { describe, it, expect } from 'vitest';
import {
  generateBoard,
  checkMatch,
  calculateStars,
  getEligibleCards,
  truncateTileText,
} from '../match/board-generator';
import type { MatchCardData } from '../match/board-generator';
import type { MatchTile } from '../match/types';

function makeCards(count: number): MatchCardData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    front: `Front ${i}`,
    back: `Back ${i}`,
    queue: 'new',
    templateOrdinal: 0,
  }));
}

describe('Match Game - Board Generator', () => {
  it('generates 6-tile board from 3+ cards', () => {
    const board = generateBoard(makeCards(5), 6);
    expect(board.tiles).toHaveLength(6);
    expect(board.pairCount).toBe(3);
    expect(board.boardSize).toBe(6);
  });

  it('generates 12-tile board from 6+ cards', () => {
    const board = generateBoard(makeCards(10), 12);
    expect(board.tiles).toHaveLength(12);
    expect(board.pairCount).toBe(6);
  });

  it('auto-downsizes board for small decks', () => {
    const board = generateBoard(makeCards(5), 12);
    expect(board.tiles).toHaveLength(10); // 5 pairs
    expect(board.pairCount).toBe(5);
  });

  it('throws for fewer than 3 cards', () => {
    expect(() => generateBoard(makeCards(2), 6)).toThrow('Need at least 3 cards');
  });

  it('excludes suspended cards', () => {
    const cards = makeCards(5);
    cards[0].queue = 'suspended';
    const eligible = getEligibleCards(cards);
    expect(eligible).toHaveLength(4);
  });

  it('each tile has a card pair (front + back)', () => {
    const board = generateBoard(makeCards(6), 12);
    const cardIds = new Set(board.tiles.map((t) => t.cardId));
    for (const cardId of cardIds) {
      const cardTiles = board.tiles.filter((t) => t.cardId === cardId);
      expect(cardTiles).toHaveLength(2);
      const sides = cardTiles.map((t) => t.side).sort();
      expect(sides).toEqual(['back', 'front']);
    }
  });
});

describe('Match Game - Match Checking', () => {
  it('returns true for correct match (front + back of same card)', () => {
    const a: MatchTile = { tileId: 'c1_front', cardId: 'c1', side: 'front', text: 'F' };
    const b: MatchTile = { tileId: 'c1_back', cardId: 'c1', side: 'back', text: 'B' };
    expect(checkMatch(a, b)).toBe(true);
  });

  it('returns false for different cards', () => {
    const a: MatchTile = { tileId: 'c1_front', cardId: 'c1', side: 'front', text: 'F' };
    const b: MatchTile = { tileId: 'c2_back', cardId: 'c2', side: 'back', text: 'B' };
    expect(checkMatch(a, b)).toBe(false);
  });

  it('returns false for same side of same card', () => {
    const a: MatchTile = { tileId: 'c1_front', cardId: 'c1', side: 'front', text: 'F' };
    const b: MatchTile = { tileId: 'c1_front2', cardId: 'c1', side: 'front', text: 'F' };
    expect(checkMatch(a, b)).toBe(false);
  });
});

describe('Match Game - Star Rating', () => {
  it('gives 3 stars for fast, few mistakes (12-tile)', () => {
    expect(calculateStars(12, 25_000, 0)).toBe(3);
  });

  it('gives 2 stars for moderate performance (12-tile)', () => {
    expect(calculateStars(12, 45_000, 3)).toBe(2);
  });

  it('gives 1 star for slow/many mistakes (12-tile)', () => {
    expect(calculateStars(12, 75_000, 6)).toBe(1);
  });

  it('scales thresholds for larger boards (24-tile)', () => {
    // 24 tiles = 2x scale, so 3-star threshold is 60s
    expect(calculateStars(24, 55_000, 0)).toBe(3);
  });

  it('truncates long tile text', () => {
    const long = 'a'.repeat(80);
    const result = truncateTileText(long);
    expect(result).toHaveLength(63); // 60 + "..."
    expect(result.endsWith('...')).toBe(true);
  });
});
