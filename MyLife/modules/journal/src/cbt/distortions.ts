import type { DistortionType } from './types';

export interface DistortionDefinition {
  type: DistortionType;
  name: string;
  description: string;
  example: string;
}

export const COGNITIVE_DISTORTIONS: DistortionDefinition[] = [
  {
    type: 'all_or_nothing',
    name: 'All-or-Nothing Thinking',
    description: 'Seeing things in black-and-white categories. If performance falls short of perfect, you see yourself as a total failure.',
    example: '"I made one mistake on the presentation, so the whole thing was a disaster."',
  },
  {
    type: 'overgeneralization',
    name: 'Overgeneralization',
    description: 'Seeing a single negative event as a never-ending pattern of defeat.',
    example: '"I got rejected for this job. I will never find work."',
  },
  {
    type: 'mental_filter',
    name: 'Mental Filter',
    description: 'Picking out a single negative detail and dwelling on it exclusively, darkening your whole vision of reality.',
    example: '"My boss praised 9 things in my review but mentioned 1 area for improvement. The review was terrible."',
  },
  {
    type: 'disqualifying_positive',
    name: 'Disqualifying the Positive',
    description: 'Rejecting positive experiences by insisting they "don\'t count" for some reason.',
    example: '"They only said I did a good job because they felt sorry for me."',
  },
  {
    type: 'mind_reading',
    name: 'Mind Reading',
    description: 'Concluding that someone is reacting negatively to you without checking the facts.',
    example: '"She did not respond to my text. She must be angry at me."',
  },
  {
    type: 'fortune_telling',
    name: 'Fortune Telling',
    description: 'Predicting that things will turn out badly as if you have a crystal ball.',
    example: '"I just know the interview will go horribly. There is no point in preparing."',
  },
  {
    type: 'magnification',
    name: 'Magnification (Catastrophizing)',
    description: 'Exaggerating the importance of problems and shortcomings.',
    example: '"I forgot to reply to that email. My boss will fire me for sure."',
  },
  {
    type: 'minimization',
    name: 'Minimization',
    description: 'Shrinking the importance of your own desirable qualities or achievements.',
    example: '"Anyone could have done what I did. It was not a big deal."',
  },
  {
    type: 'emotional_reasoning',
    name: 'Emotional Reasoning',
    description: 'Assuming that your negative emotions reflect the way things really are.',
    example: '"I feel like a failure, therefore I must be a failure."',
  },
  {
    type: 'should_statements',
    name: 'Should Statements',
    description: 'Motivating yourself with "shoulds" and "musts," which creates pressure and resentment.',
    example: '"I should be able to handle this without help. What is wrong with me?"',
  },
  {
    type: 'labeling',
    name: 'Labeling',
    description: 'Attaching a fixed, global label to yourself or others instead of describing the behavior.',
    example: '"I am a loser" instead of "I made a mistake."',
  },
  {
    type: 'personalization',
    name: 'Personalization',
    description: 'Seeing yourself as the cause of some negative external event for which you were not primarily responsible.',
    example: '"My child got a bad grade. I am a terrible parent."',
  },
  {
    type: 'blame',
    name: 'Blame',
    description: 'Holding other people entirely responsible for your pain or holding yourself entirely responsible for every problem.',
    example: '"My partner makes me feel terrible about myself. It is all their fault."',
  },
  {
    type: 'always_being_right',
    name: 'Always Being Right',
    description: 'Continually putting others on trial to prove that your opinions and actions are correct.',
    example: '"I do not care how they feel about it. I know I am right and I need to prove it."',
  },
  {
    type: 'fallacy_of_fairness',
    name: 'Fallacy of Fairness',
    description: 'Feeling resentful because you think you know what is fair, but other people do not agree.',
    example: '"It is not fair that I work so hard and do not get recognized. Others get promoted for less."',
  },
];

/**
 * Get a distortion definition by its type identifier.
 */
export function getDistortionByType(type: DistortionType): DistortionDefinition | undefined {
  return COGNITIVE_DISTORTIONS.find((d) => d.type === type);
}
