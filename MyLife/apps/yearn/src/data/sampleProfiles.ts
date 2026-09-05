import { yearnColors } from '../theme/yearnTheme';

export interface YearnPrompt {
  question: string;
  answer: string;
}

export interface YearnProfile {
  id: string;
  name: string;
  age: number;
  pronouns: string;
  city: string;
  distanceMiles: number;
  occupation: string;
  intention: string;
  relationshipStructure: string;
  interests: string[];
  prompts: YearnPrompt[];
  accentColor: string;
  verified: boolean;
  lastActive: string;
}

export const sampleProfiles: readonly YearnProfile[] = [
  {
    id: 'iris',
    name: 'Iris',
    age: 28,
    pronouns: 'she/her',
    city: 'Brooklyn',
    distanceMiles: 3,
    occupation: 'Editor at a small press',
    intention: 'Long-term, open to slow',
    relationshipStructure: 'Monogamous',
    interests: ['Poetry', 'Film photography', 'Slow mornings', 'Bouldering'],
    prompts: [
      {
        question: "A letter I'd write to a stranger",
        answer: 'About the first paragraph of a book I never finished.',
      },
      {
        question: "I'm hoping you",
        answer: 'Have a favorite bookstore and the patience to argue about a sentence.',
      },
    ],
    accentColor: yearnColors.coral,
    verified: true,
    lastActive: 'Active today',
  },
  {
    id: 'theo',
    name: 'Theo',
    age: 31,
    pronouns: 'he/they',
    city: 'Lower East Side',
    distanceMiles: 5,
    occupation: 'Architect, draws on napkins',
    intention: 'Looking for someone to build with',
    relationshipStructure: 'Monogamous',
    interests: ['Cooking', 'Brutalism', 'Long walks', 'Jazz vinyl'],
    prompts: [
      {
        question: 'The way to win me over',
        answer: 'Order a second espresso and stay for the conversation.',
      },
      {
        question: 'A small confession',
        answer: "I've redrawn my apartment in CAD four times. None of them got built.",
      },
    ],
    accentColor: yearnColors.gold,
    verified: true,
    lastActive: 'Active 2h ago',
  },
  {
    id: 'amara',
    name: 'Amara',
    age: 26,
    pronouns: 'she/her',
    city: 'Crown Heights',
    distanceMiles: 7,
    occupation: 'Cellist, sometimes teaches',
    intention: 'Curious, no rush',
    relationshipStructure: 'Open to ENM',
    interests: ['Chamber music', 'Sourdough', 'Hiking', 'Letters'],
    prompts: [
      {
        question: 'A perfect Sunday',
        answer: 'Coffee, a record, an unfinished sentence carried into Monday.',
      },
      {
        question: 'I want to be asked about',
        answer: "The piece I'm afraid to play in public.",
      },
    ],
    accentColor: yearnColors.sage,
    verified: false,
    lastActive: 'Active yesterday',
  },
];
