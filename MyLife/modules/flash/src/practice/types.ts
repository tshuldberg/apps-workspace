export type QuestionType = 'mc' | 'tf' | 'short_answer' | 'fill_blank';
export type TestStatus = 'in_progress' | 'completed' | 'abandoned';

export interface PracticeTestConfig {
  deckId: string;
  questionCount: number;
  timeLimitSeconds: number | null;
  questionTypes: QuestionType[];
}

export interface PracticeTest {
  id: string;
  deckId: string;
  title: string;
  questionCount: number;
  timeLimitSeconds: number | null;
  questionTypes: QuestionType[];
  totalScore: number | null;
  maxScore: number | null;
  scorePercent: number | null;
  timeTakenSeconds: number | null;
  weakTags: string[];
  status: TestStatus;
  startedAt: string;
  completedAt: string | null;
}

export interface PracticeAnswer {
  id: string;
  testId: string;
  questionIndex: number;
  sourceCardId: string | null;
  questionType: QuestionType;
  questionText: string;
  options: string[];
  correctAnswer: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
  timeSpentSeconds: number;
  explanation: string;
  answeredAt: string | null;
}

export interface PracticeQuestion {
  questionIndex: number;
  sourceCardId: string;
  questionType: QuestionType;
  questionText: string;
  options: string[];
  correctAnswer: string;
}

export interface TestScoreResult {
  totalScore: number;
  maxScore: number;
  scorePercent: number;
  weakTags: string[];
  perType: Record<QuestionType, { correct: number; total: number }>;
}
