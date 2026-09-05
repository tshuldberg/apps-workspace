export type TileSide = 'front' | 'back';

export interface MatchTile {
  tileId: string;
  cardId: string;
  side: TileSide;
  text: string;
}

export interface MatchBoard {
  tiles: MatchTile[];
  boardSize: number;
  pairCount: number;
}

export interface MatchResult {
  deckId: string;
  boardSize: number;
  timeMs: number;
  mistakes: number;
  stars: number;
  cardIds: string[];
}
