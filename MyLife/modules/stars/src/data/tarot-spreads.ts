import type { TarotSpreadDefinition, TarotSpreadType } from '../types';

export const TAROT_SPREADS: TarotSpreadDefinition[] = [
  {
    type: 'one_card',
    name: 'One Card',
    shortLabel: 'One Card',
    description: 'A quick yes-no or clarity pull for the moment you are in.',
    questionPrompt: 'What is the clearest message for me right now?',
    cardCount: 1,
    icon: 'looks_one',
    positions: [
      {
        label: 'Insight',
        meaning: 'The immediate truth, answer, or energetic focus for this question.',
      },
    ],
  },
  {
    type: 'three_card',
    name: 'Three Card',
    shortLabel: '3-Card',
    description: 'A classic spread for momentum, pattern, and trajectory.',
    questionPrompt: 'What story is unfolding across my past, present, and future?',
    cardCount: 3,
    icon: 'dashboard',
    positions: [
      { label: 'Past', meaning: 'The influence or root that still shapes the situation.' },
      { label: 'Present', meaning: 'The energy active right now in the center of the matter.' },
      { label: 'Future', meaning: 'The direction things are moving if the current energy continues.' },
    ],
  },
  {
    type: 'celtic_cross',
    name: 'Celtic Cross',
    shortLabel: 'Celtic',
    description: 'A full-spectrum reading for the deeper pattern, challenge, and likely outcome.',
    questionPrompt: 'What is the larger architecture behind this season of my life?',
    cardCount: 10,
    icon: 'grid_view',
    positions: [
      { label: 'Present', meaning: 'The core situation or your central energy.' },
      { label: 'Challenge', meaning: 'What crosses, complicates, or pressures the present.' },
      { label: 'Root', meaning: 'The unseen cause or foundation beneath the issue.' },
      { label: 'Recent Past', meaning: 'What is fading but still relevant.' },
      { label: 'Conscious Goal', meaning: 'What you desire, intend, or are reaching toward.' },
      { label: 'Near Future', meaning: 'What approaches soon if the current path holds.' },
      { label: 'Self', meaning: 'Your current stance, identity, or role in the pattern.' },
      { label: 'Environment', meaning: 'External influences, people, or social weather around you.' },
      { label: 'Hopes and Fears', meaning: 'The emotional undercurrent shaping your expectations.' },
      { label: 'Outcome', meaning: 'The likely culmination or lesson of the spread.' },
    ],
  },
  {
    type: 'relationship',
    name: 'Relationship',
    shortLabel: 'Relationship',
    description: 'A five-card look at chemistry, friction, and the shared path.',
    questionPrompt: 'What wants to be understood in this relationship dynamic?',
    cardCount: 5,
    icon: 'favorite',
    positions: [
      { label: 'You', meaning: 'Your current emotional stance and contribution.' },
      { label: 'Them', meaning: 'Their current energy or likely perspective.' },
      { label: 'Bond', meaning: 'The living dynamic between you right now.' },
      { label: 'Challenge', meaning: 'The tension or lesson that needs honesty.' },
      { label: 'Potential', meaning: 'Where the connection can grow from here.' },
    ],
  },
  {
    type: 'horseshoe',
    name: 'Horseshoe',
    shortLabel: 'Horseshoe',
    description: 'A seven-card forecast for sequence, obstacles, and next direction.',
    questionPrompt: 'What is the most useful map for the road ahead?',
    cardCount: 7,
    icon: 'history',
    positions: [
      { label: 'Past', meaning: 'The energy that opened this story.' },
      { label: 'Present', meaning: 'Where you stand at this exact moment.' },
      { label: 'Hidden Influence', meaning: 'What is active behind the scenes.' },
      { label: 'Obstacle', meaning: 'The friction point requiring courage or adaptation.' },
      { label: 'External Influence', meaning: 'What the outer world is adding to the situation.' },
      { label: 'Advice', meaning: 'The most aligned approach available to you.' },
      { label: 'Outcome', meaning: 'The near-term result or trajectory.' },
    ],
  },
];

export const TAROT_SPREADS_BY_TYPE = Object.fromEntries(
  TAROT_SPREADS.map((spread) => [spread.type, spread]),
) as Record<TarotSpreadType, TarotSpreadDefinition>;

export function getTarotSpreadDefinition(
  spreadType: TarotSpreadType,
): TarotSpreadDefinition {
  return TAROT_SPREADS_BY_TYPE[spreadType];
}
