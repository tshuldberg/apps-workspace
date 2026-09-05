import type { AiPromptTheme } from './types';

export interface ThemeDefinition {
  theme: AiPromptTheme;
  icon: string;
  templates: string[];
}

export const PROMPT_THEMES: ThemeDefinition[] = [
  {
    theme: 'emotional_exploration',
    icon: '💭',
    templates: [
      'You have been feeling {mood} lately. What do you think is behind that?',
      'What emotion has been showing up most this week, and what is it trying to tell you?',
      'If your current emotional state had a color, what would it be and why?',
      'What feeling have you been avoiding lately? What would happen if you sat with it?',
      'Describe a moment this week when your emotions surprised you.',
      'What would your {mood} self say to your past self right now?',
      'Which emotion do you wish you could feel more of? What brings it out?',
      'What is one thing you have been carrying emotionally that you could set down today?',
    ],
  },
  {
    theme: 'pattern_recognition',
    icon: '🔍',
    templates: [
      'You have written {avgWordCount} words per entry lately. What has been on your mind?',
      'Looking at your recent entries, what theme keeps coming back?',
      'What situation keeps repeating in your life? What would change if you responded differently?',
      'Your journaling streak is {streakDays} days. What has kept you coming back?',
      'What pattern in your thinking do you notice when you re-read your recent entries?',
      'If someone read your last 7 entries, what would they learn about you?',
      'What triggers tend to shift your mood? How have you been handling them?',
      'What is one habit you have noticed forming, for better or worse?',
    ],
  },
  {
    theme: 'growth_reflection',
    icon: '🌱',
    templates: [
      'What is one way you have grown in the past month?',
      'What challenge from last week taught you something valuable?',
      'What would you tell your year-ago self about where you are now?',
      'What skill or quality are you actively developing? How is it going?',
      'Describe a recent moment where you handled something better than you would have before.',
      'What is the next version of yourself that you are working toward?',
      'What mistake have you made recently that turned into a learning moment?',
      'What feedback have you received lately that stuck with you?',
    ],
  },
  {
    theme: 'relationship_insight',
    icon: '🤝',
    templates: [
      'Who had the biggest impact on your day today, and how?',
      'What relationship in your life needs more attention right now?',
      'When did you last feel truly heard by someone? What made it feel that way?',
      'What conversation are you avoiding? What would happen if you had it?',
      'Who in your life brings out the best version of you?',
      'What boundary do you need to set or reinforce with someone?',
      'Describe a moment of genuine connection you experienced recently.',
      'What would you like to say to someone that you have not said yet?',
    ],
  },
  {
    theme: 'gratitude_deepening',
    icon: '🙏',
    templates: [
      'What ordinary thing in your life would you really miss if it disappeared?',
      'Who did something kind for you recently that you did not fully appreciate at the time?',
      'What part of your daily routine are you most grateful for?',
      'What challenge in your life right now has a hidden gift?',
      'What about your body or health are you grateful for today?',
      'What memory from the past week makes you smile?',
      'What privilege or advantage do you have that you sometimes take for granted?',
      'What is something in nature you noticed today that deserves appreciation?',
    ],
  },
  {
    theme: 'future_visioning',
    icon: '🔮',
    templates: [
      'Where do you see yourself in 6 months? What needs to happen to get there?',
      'If you could design your ideal typical day, what would it look like?',
      'What is one goal you are working toward that excites you?',
      'What would your life look like if your biggest fear did not hold you back?',
      'What do you want to be known for? How are you living that out today?',
      'If money and time were no obstacle, what would you do tomorrow?',
      'What small step could you take this week toward your biggest dream?',
      'What would "success" mean for you at the end of this year?',
    ],
  },
  {
    theme: 'self_compassion',
    icon: '💗',
    templates: [
      'Things have been tough lately. What do you need to hear right now?',
      'What would you say to a friend who was going through what you are going through?',
      'Where in your life are you being too hard on yourself?',
      'What is one way you can be kinder to yourself today?',
      'What do you need right now that you are not giving yourself?',
      'Write a permission slip to yourself for something you have been holding against yourself.',
      'What part of yourself are you learning to accept?',
      'Describe a moment today when you chose self-compassion over self-criticism.',
    ],
  },
  {
    theme: 'values_alignment',
    icon: '🧭',
    templates: [
      'What is one value you lived by today, even imperfectly?',
      'When did you last compromise on something important to you? How did it feel?',
      'If your actions this week were a compass, where are they pointing?',
      'What does integrity mean to you? Where did you practice it recently?',
      'What would you do differently if you fully trusted your own judgment?',
      'What matters to you that you have not made time for lately?',
      'How would the person you want to be handle your current challenge?',
      'What decision ahead of you is really a question about your values?',
    ],
  },
  {
    theme: 'energy_awareness',
    icon: '⚡',
    templates: [
      'What gave you energy today and what drained it?',
      'It has been {daysSinceLastEntry} day(s) since you last wrote. What has been filling your time?',
      'What activities this week left you feeling recharged?',
      'What is one thing you could remove from your schedule to create more space?',
      'How did you sleep recently, and how is it affecting your day?',
      'What does your body need right now that your mind has been ignoring?',
      'Where are you spending energy on things that do not matter to you?',
      'What is the smallest change that would make your daily energy better?',
    ],
  },
  {
    theme: 'boundary_setting',
    icon: '🛡️',
    templates: [
      'What situation drained you this week because you did not set a boundary?',
      'What is one "no" you need to say but have been avoiding?',
      'When did you last protect your time or energy successfully? How did it feel?',
      'What expectation from others is weighing on you right now?',
      'How do you know when a boundary has been crossed? What does it feel like in your body?',
      'What boundary would your future self thank you for setting today?',
      'Who in your life respects your boundaries well? What can you learn from that relationship?',
      'What is one area of your life where you tend to overcommit?',
    ],
  },
  {
    theme: 'creative_expression',
    icon: '🎨',
    templates: [
      'If you could describe today in a single metaphor, what would it be?',
      'Write about your current mood as if it were a weather forecast.',
      'What song captures how you feel right now? Why?',
      'If your week were a chapter in a book, what would the title be?',
      'Describe your ideal space using all five senses.',
      'Write a short letter to an emotion you experienced today.',
      'What color is your energy level right now? What shade would you prefer?',
      'If you could paint your current state of mind, what would the canvas look like?',
    ],
  },
  {
    theme: 'mindful_observation',
    icon: '👁️',
    templates: [
      'What did you notice today that you usually overlook?',
      'Describe exactly what you see, hear, and feel right now in this moment.',
      'What small detail from your day stands out in your memory?',
      'When were you most present today? When were you most distracted?',
      'What sounds are surrounding you right now? What do they tell you about your environment?',
      'What part of your routine did you do on autopilot today?',
      'What is one thing you observed about another person today?',
      'Describe the transition between two moments in your day that felt different.',
    ],
  },
];

/**
 * Get a theme definition by its type.
 */
export function getThemeDefinition(theme: AiPromptTheme): ThemeDefinition | undefined {
  return PROMPT_THEMES.find((t) => t.theme === theme);
}
