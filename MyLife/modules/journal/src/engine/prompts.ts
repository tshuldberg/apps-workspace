import type { JournalPrompt, JournalPromptCategory } from '../types';

const PROMPTS: Record<JournalPromptCategory, string[]> = {
  reflection: [
    'What felt heavier than expected today, and why?',
    'Where did you feel most like yourself today?',
    'What would make tomorrow feel a little simpler?',
    'What conversation is still echoing in your mind?',
  ],
  gratitude: [
    'What small thing are you grateful for right now?',
    'Who made your day easier, even in a small way?',
    'What ordinary part of life felt unexpectedly good today?',
    'What are three things you would miss if they disappeared tomorrow?',
  ],
  therapy: [
    'What thought kept repeating today, and what evidence supports or challenges it?',
    'What emotion showed up strongest today, and what might have triggered it?',
    'Where did you respond with compassion instead of criticism?',
    'What would you tell a friend who had your exact day?',
  ],
  stoic: [
    'What today was outside your control, and how did you respond?',
    'Where did you practice patience when it was inconvenient?',
    'What value did you live by today, even imperfectly?',
    'What discomfort today taught you something useful?',
  ],
};

export function getDailyJournalPrompt(
  referenceDate: string,
  category: JournalPromptCategory = 'reflection',
): JournalPrompt {
  const prompts = PROMPTS[category];
  const dayIndex = Number(referenceDate.replaceAll('-', ''));
  const promptIndex = dayIndex % prompts.length;

  return {
    id: `${category}-${referenceDate}`,
    category,
    prompt: prompts[promptIndex],
  };
}

export function listJournalPromptCategories(): JournalPromptCategory[] {
  return ['reflection', 'gratitude', 'therapy', 'stoic'];
}
