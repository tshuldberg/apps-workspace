import type { TherapyTemplate, TherapyTemplateType, TherapyTopicSection } from './types';

export const THERAPY_TEMPLATES: TherapyTemplate[] = [
  {
    type: 'pre_session',
    name: 'Pre-Session Prep',
    description: 'Prepare for your therapy session with structured topics, wins, challenges, and questions.',
    icon: '📋',
    sections: ['topics', 'wins', 'challenges', 'questions'],
  },
  {
    type: 'post_session',
    name: 'Post-Session Reflection',
    description: 'Capture key takeaways, action items, and follow-up questions after your session.',
    icon: '📝',
    sections: ['takeaways', 'action_items', 'followup_questions'],
  },
  {
    type: 'crisis_plan',
    name: 'Crisis Plan',
    description: 'Create a personal crisis plan with warning signs, coping strategies, and support contacts.',
    icon: '🛡️',
    sections: ['warning_signs', 'coping_strategies', 'support_contacts', 'safe_actions'],
  },
  {
    type: 'progress_checkin',
    name: 'Progress Check-In',
    description: 'Review your therapy goals, track patterns, and identify what is working.',
    icon: '📊',
    sections: ['original_goals', 'new_goals', 'patterns', 'working', 'not_working'],
  },
];

/**
 * Get the section labels for display.
 */
export const SECTION_LABELS: Record<TherapyTopicSection, string> = {
  topics: 'Topics I Want to Discuss',
  wins: 'Wins Since Last Session',
  challenges: 'Challenges Faced',
  questions: 'Questions for My Therapist',
  takeaways: 'Key Takeaways',
  action_items: 'Action Items / Homework',
  followup_questions: 'Follow-Up Questions',
  warning_signs: 'Warning Signs',
  coping_strategies: 'Coping Strategies',
  support_contacts: 'Support Contacts',
  safe_actions: 'Safe Actions I Can Take',
  original_goals: 'Original Therapy Goals',
  new_goals: 'New Goals',
  patterns: 'Patterns I Have Noticed',
  working: 'What Is Working',
  not_working: 'What Is Not Working',
};

/**
 * Get the template definition for a given type.
 */
export function getTemplateByType(type: TherapyTemplateType): TherapyTemplate | undefined {
  return THERAPY_TEMPLATES.find((t) => t.type === type);
}

/**
 * Get the valid sections for a given template type.
 */
export function getTemplateSections(type: TherapyTemplateType): TherapyTopicSection[] {
  const template = getTemplateByType(type);
  return template?.sections ?? [];
}
