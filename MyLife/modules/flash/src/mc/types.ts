export interface MCOption {
  text: string;
  cardId: string;
  isCorrect: boolean;
}

export interface MCQuestion {
  questionText: string;
  cardId: string;
  options: MCOption[];
}

export interface MCSessionConfig {
  deckId: string;
  questionCount: number | 'all';
}

export interface MCResult {
  deckId: string;
  questionCount: number;
  correctCount: number;
  incorrectCount: number;
  scorePercent: number;
  timeMs: number;
  incorrectCardIds: string[];
}
