export type ConversationMode = 'tutor' | 'quiz' | 'explain' | 'debate';
export type ConversationDifficulty = 'beginner' | 'medium' | 'advanced';
export type ConversationStatus = 'active' | 'completed' | 'abandoned';
export type MessageRole = 'system' | 'assistant' | 'user';

export interface Conversation {
  id: string;
  deckId: string;
  mode: ConversationMode;
  difficulty: ConversationDifficulty;
  language: string;
  topicSummary: string;
  messageCount: number;
  cardsReferenced: number;
  durationSeconds: number;
  performanceRating: number | null;
  status: ConversationStatus;
  startedAt: string;
  completedAt: string | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  cardIds: string[];
  tokensUsed: number;
  createdAt: string;
}

export interface ConversationConfig {
  deckId: string;
  mode: ConversationMode;
  difficulty?: ConversationDifficulty;
  language?: string;
}

export interface CardContext {
  cardId: string;
  front: string;
  back: string;
}
