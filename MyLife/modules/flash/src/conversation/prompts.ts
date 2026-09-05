import type { ConversationMode } from './types';

/** Mode-specific conversation starters after the opening message. */
export const FIRST_QUESTIONS: Record<ConversationMode, string> = {
  tutor: "Let's start with a concept from your cards. Can you tell me what you already know about the first topic?",
  quiz: "Here's your first question. Think carefully before answering.",
  explain: "Pick any concept from your study material and explain it to me as if I've never heard of it.",
  debate: "I'll start with a bold claim. Tell me why I'm wrong.",
};

export const SUMMARY_INSTRUCTION =
  'When the user asks to end the conversation, provide a summary including: (1) topics covered, (2) strong areas, (3) areas needing review, and (4) a rating line exactly like "Performance: X/5" where X is 1-5.';
