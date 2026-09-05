import type { TarotCard, TarotSuit } from '../types';

const MAJOR_ARCANA: TarotCard[] = [
  {
    id: 'major-fool',
    name: 'The Fool',
    number: 0,
    suit: null,
    arcana: 'major',
    keywords: ['beginnings', 'trust', 'leap'],
    uprightMeaning: 'A new chapter is opening. Curiosity and trust will carry you farther than overplanning today.',
    reversedMeaning: 'Hesitation or naivete may be clouding the first step. Pause long enough to choose courage over chaos.',
    loveMeaning: 'Love asks for honesty and fresh energy instead of old scripts.',
    careerMeaning: 'A bold experiment or pitch can unlock movement if you stay grounded while taking the risk.',
    spiritualMeaning: 'Begin again with beginner mind. The soul grows when it is willing to learn in public.',
    prompt: 'What leap feels scary because it matters?',
    element: 'Air',
    timing: 'Dawn',
  },
  {
    id: 'major-magician',
    name: 'The Magician',
    number: 1,
    suit: null,
    arcana: 'major',
    keywords: ['manifestation', 'skill', 'focus'],
    uprightMeaning: 'You already hold the tools required. Focused intention turns scattered potential into clear momentum.',
    reversedMeaning: 'Energy is leaking through doubt, distraction, or performance. Reclaim your center before acting.',
    loveMeaning: 'Speak directly about what you want instead of hoping it will be guessed.',
    careerMeaning: 'Your talent is ready for visible use. Ship the work, demonstrate the craft, and own the room.',
    spiritualMeaning: 'Alignment comes from channeling will with integrity, not control.',
    prompt: 'Which tool or gift have I been underusing?',
    element: 'Mercury',
    timing: 'First spark',
  },
  {
    id: 'major-high-priestess',
    name: 'The High Priestess',
    number: 2,
    suit: null,
    arcana: 'major',
    keywords: ['intuition', 'mystery', 'inner knowing'],
    uprightMeaning: 'The answer is already whispering beneath the noise. Trust subtle signals, dreams, and body wisdom.',
    reversedMeaning: 'You may be overriding intuition to force clarity too soon. Let insight ripen.',
    loveMeaning: 'Emotional truth matters more than outward certainty right now.',
    careerMeaning: 'Observe the room before making the next move. Hidden context matters.',
    spiritualMeaning: 'Stillness is the channel. Silence is carrying information for you.',
    prompt: 'What do I know before anyone else confirms it?',
    element: 'Moon',
    timing: 'Midnight',
  },
  {
    id: 'major-empress',
    name: 'The Empress',
    number: 3,
    suit: null,
    arcana: 'major',
    keywords: ['abundance', 'nourishment', 'beauty'],
    uprightMeaning: 'Growth wants tending, not rushing. Create conditions where pleasure and productivity can coexist.',
    reversedMeaning: 'Overgiving, neglect, or creative depletion is asking for repair. Refill the well.',
    loveMeaning: 'Affection deepens through care, softness, and consistent presence.',
    careerMeaning: 'Sustainable expansion beats forced output. Build the environment your work needs.',
    spiritualMeaning: 'The sacred is present in the body, the home, and the natural world.',
    prompt: 'What part of my life needs more tenderness to flourish?',
    element: 'Venus',
    timing: 'Spring bloom',
  },
  {
    id: 'major-emperor',
    name: 'The Emperor',
    number: 4,
    suit: null,
    arcana: 'major',
    keywords: ['structure', 'authority', 'stability'],
    uprightMeaning: 'Boundaries, systems, and discipline will create freedom. Build the container before scaling the dream.',
    reversedMeaning: 'Rigidity or control may be choking progress. Trade domination for steadiness.',
    loveMeaning: 'Reliability is the language of care right now.',
    careerMeaning: 'Leadership is available if you define standards and follow through on them.',
    spiritualMeaning: 'Devotion can look like routine, repetition, and the courage to hold form.',
    prompt: 'Where would better structure create real relief?',
    element: 'Aries',
    timing: 'Noon',
  },
  {
    id: 'major-hierophant',
    name: 'The Hierophant',
    number: 5,
    suit: null,
    arcana: 'major',
    keywords: ['tradition', 'guidance', 'ritual'],
    uprightMeaning: 'Wisdom may arrive through trusted systems, teachers, or proven rituals. Let lineage support you.',
    reversedMeaning: 'Outdated rules or borrowed beliefs may need questioning. Keep what is alive; release what is performative.',
    loveMeaning: 'Shared values matter more than chemistry alone.',
    careerMeaning: 'Training, mentorship, or institutional support can accelerate progress.',
    spiritualMeaning: 'Ritual returns you to yourself when the world feels noisy.',
    prompt: 'Which tradition supports me, and which one limits me?',
    element: 'Taurus',
    timing: 'Sacred hour',
  },
  {
    id: 'major-lovers',
    name: 'The Lovers',
    number: 6,
    suit: null,
    arcana: 'major',
    keywords: ['choice', 'union', 'alignment'],
    uprightMeaning: 'A decision is asking to be made in alignment with your values, not your fears.',
    reversedMeaning: 'Mixed signals or internal division can drain your energy. Clarify the choice beneath the choice.',
    loveMeaning: 'Connection grows where truth, reciprocity, and desire meet.',
    careerMeaning: 'Collaborations thrive when values and expectations are explicit.',
    spiritualMeaning: 'Union begins with self-honesty.',
    prompt: 'What choice would honor my values even if it complicates the moment?',
    element: 'Gemini',
    timing: 'Crossroads',
  },
  {
    id: 'major-chariot',
    name: 'The Chariot',
    number: 7,
    suit: null,
    arcana: 'major',
    keywords: ['drive', 'direction', 'victory'],
    uprightMeaning: 'Momentum is available when you choose a direction and commit your full will to it.',
    reversedMeaning: 'Scattered effort or emotional static is pulling the reins in opposite directions.',
    loveMeaning: 'Move toward what you want instead of waiting to be chosen.',
    careerMeaning: 'Execution and discipline turn ambition into visible progress.',
    spiritualMeaning: 'Mastery comes from integrating instinct and intention.',
    prompt: 'Where do I need to stop wavering and move decisively?',
    element: 'Cancer',
    timing: 'Forward motion',
  },
  {
    id: 'major-strength',
    name: 'Strength',
    number: 8,
    suit: null,
    arcana: 'major',
    keywords: ['courage', 'patience', 'heart'],
    uprightMeaning: 'Gentle power will outperform force today. Meet intensity with steadiness and self-respect.',
    reversedMeaning: 'Fatigue, self-criticism, or reactivity is asking for compassion instead of pressure.',
    loveMeaning: 'Tender honesty is stronger than defensiveness.',
    careerMeaning: 'Quiet confidence and consistency will earn trust faster than display.',
    spiritualMeaning: 'True strength is the ability to remain open while staying rooted.',
    prompt: 'What would brave softness look like here?',
    element: 'Leo',
    timing: 'Steady flame',
  },
  {
    id: 'major-hermit',
    name: 'The Hermit',
    number: 9,
    suit: null,
    arcana: 'major',
    keywords: ['solitude', 'search', 'wisdom'],
    uprightMeaning: 'Step back far enough to hear your own signal. Reflection will bring the next clear step.',
    reversedMeaning: 'Isolation can become avoidance if you hide too long. Let reflection lead back into life.',
    loveMeaning: 'Space can be healing when it is honest and not punitive.',
    careerMeaning: 'Research, refinement, and solo focus are favored over noise.',
    spiritualMeaning: 'Your lantern is enough for the next few steps. You do not need the whole map.',
    prompt: 'What truth appears only when I am quiet?',
    element: 'Virgo',
    timing: 'Lantern hour',
  },
  {
    id: 'major-wheel-of-fortune',
    name: 'Wheel of Fortune',
    number: 10,
    suit: null,
    arcana: 'major',
    keywords: ['cycles', 'timing', 'fate'],
    uprightMeaning: 'A turning point is underway. Meet change with flexibility and faith in larger patterns.',
    reversedMeaning: 'Resistance to a cycle change may amplify friction. Work with timing, not against it.',
    loveMeaning: 'The relationship dynamic is shifting. Notice what is ready to evolve.',
    careerMeaning: 'Timing, visibility, and momentum are changing in your favor if you stay adaptable.',
    spiritualMeaning: 'Life is moving in spirals, not straight lines.',
    prompt: 'What cycle is ending, and what wants to begin in its place?',
    element: 'Jupiter',
    timing: 'Turning tide',
  },
  {
    id: 'major-justice',
    name: 'Justice',
    number: 11,
    suit: null,
    arcana: 'major',
    keywords: ['truth', 'clarity', 'balance'],
    uprightMeaning: 'See the situation clearly and respond with integrity. Reality will support clean decisions.',
    reversedMeaning: 'Bias, avoidance, or imbalance may be distorting the outcome. Return to facts.',
    loveMeaning: 'Honest accountability is the path to repair.',
    careerMeaning: 'Contracts, decisions, and negotiations benefit from precision and fairness.',
    spiritualMeaning: 'Alignment asks you to live what you claim to value.',
    prompt: 'What truth becomes obvious when I stop bargaining with it?',
    element: 'Libra',
    timing: 'Judgement hour',
  },
  {
    id: 'major-hanged-man',
    name: 'The Hanged Man',
    number: 12,
    suit: null,
    arcana: 'major',
    keywords: ['pause', 'surrender', 'perspective'],
    uprightMeaning: 'Stillness is not failure. A pause is creating the perspective needed for the next move.',
    reversedMeaning: 'Stagnation can masquerade as surrender. Ask whether you are resting or delaying.',
    loveMeaning: 'A relationship question may need a new angle, not a faster answer.',
    careerMeaning: 'Step back, reframe, and let the deeper pattern emerge before committing.',
    spiritualMeaning: 'Release the need to force revelation.',
    prompt: 'What changes when I stop trying to solve this the old way?',
    element: 'Water',
    timing: 'Suspended moment',
  },
  {
    id: 'major-death',
    name: 'Death',
    number: 13,
    suit: null,
    arcana: 'major',
    keywords: ['ending', 'transformation', 'release'],
    uprightMeaning: 'Something has completed its cycle. Let the ending clear space for cleaner life to arrive.',
    reversedMeaning: 'Clinging to what is finished will prolong discomfort. Release with intention.',
    loveMeaning: 'A relationship pattern must die for intimacy to deepen.',
    careerMeaning: 'A role, plan, or method may be expiring so a better structure can emerge.',
    spiritualMeaning: 'Transformation is sacred compost.',
    prompt: 'What am I ready to stop carrying?',
    element: 'Scorpio',
    timing: 'Threshold',
  },
  {
    id: 'major-temperance',
    name: 'Temperance',
    number: 14,
    suit: null,
    arcana: 'major',
    keywords: ['balance', 'alchemy', 'healing'],
    uprightMeaning: 'Blend extremes with patience. Integration, not intensity, is the medicine.',
    reversedMeaning: 'Excess, impatience, or inner imbalance is asking for recalibration.',
    loveMeaning: 'Mutual pacing and emotional moderation create trust.',
    careerMeaning: 'Small, consistent adjustments will outperform dramatic swings.',
    spiritualMeaning: 'Healing arrives through harmony between body, mind, and spirit.',
    prompt: 'Where do I need a gentler, more sustainable rhythm?',
    element: 'Sagittarius',
    timing: 'Golden hour',
  },
  {
    id: 'major-devil',
    name: 'The Devil',
    number: 15,
    suit: null,
    arcana: 'major',
    keywords: ['attachment', 'shadow', 'temptation'],
    uprightMeaning: 'Notice where fear, compulsion, or performance has more power than truth.',
    reversedMeaning: 'Release is possible now. Name the pattern and the grip weakens.',
    loveMeaning: 'Desire is real, but so are unhealthy loops. Distinguish chemistry from captivity.',
    careerMeaning: 'Beware of burnout, ego traps, or chasing validation over purpose.',
    spiritualMeaning: 'Shadow work begins by being honest about what still hooks you.',
    prompt: 'Which pattern keeps promising relief while making me smaller?',
    element: 'Capricorn',
    timing: 'Late night',
  },
  {
    id: 'major-tower',
    name: 'The Tower',
    number: 16,
    suit: null,
    arcana: 'major',
    keywords: ['rupture', 'truth', 'awakening'],
    uprightMeaning: 'A false structure is cracking so truth can enter. Let what is unstable reveal itself.',
    reversedMeaning: 'The shake-up may be internal, delayed, or resisted, but truth is still moving through.',
    loveMeaning: 'A shaky dynamic cannot be stabilized by pretending.',
    careerMeaning: 'A sudden reset can clear space for a more honest direction.',
    spiritualMeaning: 'Awakening is rarely tidy, but it is clarifying.',
    prompt: 'What truth is breaking through my defenses now?',
    element: 'Mars',
    timing: 'Lightning strike',
  },
  {
    id: 'major-star',
    name: 'The Star',
    number: 17,
    suit: null,
    arcana: 'major',
    keywords: ['hope', 'healing', 'guidance'],
    uprightMeaning: 'Hope returns with quiet certainty. Trust the long light, even if the road is still dark.',
    reversedMeaning: 'Discouragement may be dimming your signal. Reconnect with what restores faith.',
    loveMeaning: 'Healing and honesty create softer, truer intimacy.',
    careerMeaning: 'Vision work is favored. Share what you are building with sincerity.',
    spiritualMeaning: 'The universe is not asking for perfection, only openness.',
    prompt: 'What restores my faith in the future?',
    element: 'Aquarius',
    timing: 'After the storm',
  },
  {
    id: 'major-moon',
    name: 'The Moon',
    number: 18,
    suit: null,
    arcana: 'major',
    keywords: ['dreams', 'uncertainty', 'intuition'],
    uprightMeaning: 'Not everything is visible yet. Move slowly, listen deeply, and let intuition guide the path.',
    reversedMeaning: 'Confusion may be lifting, or fear may be distorting perception. Name what is imagined and what is real.',
    loveMeaning: 'Emotional complexity needs patience, not assumptions.',
    careerMeaning: 'Ambiguity is part of the process. Verify what you can and trust what your instincts keep flagging.',
    spiritualMeaning: 'Dreams, symbols, and lunar tides are carrying messages.',
    prompt: 'What feeling keeps surfacing even when I try to dismiss it?',
    element: 'Pisces',
    timing: 'Moonrise',
  },
  {
    id: 'major-sun',
    name: 'The Sun',
    number: 19,
    suit: null,
    arcana: 'major',
    keywords: ['joy', 'clarity', 'vitality'],
    uprightMeaning: 'Warmth, confidence, and visible truth are on your side. Let yourself be fully seen.',
    reversedMeaning: 'Joy may be present but muted by overthinking or temporary fog. Simplify.',
    loveMeaning: 'Playfulness and candor open the heart wider than strategy.',
    careerMeaning: 'Recognition grows when you stop hiding your strongest work.',
    spiritualMeaning: 'Your natural radiance is part of the medicine.',
    prompt: 'Where can I allow more joy without needing to earn it first?',
    element: 'Sun',
    timing: 'High noon',
  },
  {
    id: 'major-judgement',
    name: 'Judgement',
    number: 20,
    suit: null,
    arcana: 'major',
    keywords: ['calling', 'reckoning', 'rebirth'],
    uprightMeaning: 'A wake-up call is clarifying what truly matters. Respond to the invitation, not the fear.',
    reversedMeaning: 'Self-doubt or avoidance may be muting a clear inner summons.',
    loveMeaning: 'Forgiveness and truth-telling can reset a bond on stronger terms.',
    careerMeaning: 'Your work may be asking for a more honest mission or public voice.',
    spiritualMeaning: 'Awakening is a return to what has always been true.',
    prompt: 'What calling am I ready to answer more fully?',
    element: 'Pluto',
    timing: 'Reveille',
  },
  {
    id: 'major-world',
    name: 'The World',
    number: 21,
    suit: null,
    arcana: 'major',
    keywords: ['completion', 'integration', 'arrival'],
    uprightMeaning: 'A cycle is closing with wisdom. Celebrate the completion before rushing into the next beginning.',
    reversedMeaning: 'Loose ends or unfinished integration may be delaying closure. Finish the ritual.',
    loveMeaning: 'Wholeness inside yourself changes what kind of connection you can sustain.',
    careerMeaning: 'A milestone has been earned. Name it, honor it, and prepare for the next horizon.',
    spiritualMeaning: 'Completion is its own portal.',
    prompt: 'What chapter deserves a real ending and acknowledgement?',
    element: 'Saturn',
    timing: 'Completion bell',
  },
];

const MINOR_RANKS = [
  {
    label: 'Ace',
    number: 1,
    keywords: ['spark', 'invitation', 'seed'],
    upright: 'A fresh pulse of energy is available.',
    reversed: 'The opening is present, but fear or delay can dim it.',
  },
  {
    label: 'Two',
    number: 2,
    keywords: ['choice', 'balance', 'exchange'],
    upright: 'A decision or partnership is taking shape.',
    reversed: 'Indecision or imbalance is muddying the next step.',
  },
  {
    label: 'Three',
    number: 3,
    keywords: ['growth', 'expression', 'expansion'],
    upright: 'Momentum grows when your effort is shared or witnessed.',
    reversed: 'Scattered energy can slow what wants to bloom.',
  },
  {
    label: 'Four',
    number: 4,
    keywords: ['structure', 'stability', 'containment'],
    upright: 'Hold what matters and protect your resources.',
    reversed: 'Control or stagnation can keep energy from circulating.',
  },
  {
    label: 'Five',
    number: 5,
    keywords: ['friction', 'change', 'challenge'],
    upright: 'A tension point is asking for adaptation and honesty.',
    reversed: 'The conflict may be easing, or it may be going underground.',
  },
  {
    label: 'Six',
    number: 6,
    keywords: ['movement', 'support', 'rebalancing'],
    upright: 'Relief arrives through help, transition, or reciprocity.',
    reversed: 'Support may be uneven, delayed, or hard to receive.',
  },
  {
    label: 'Seven',
    number: 7,
    keywords: ['evaluation', 'faith', 'strategy'],
    upright: 'Stay with the process long enough to see the pattern.',
    reversed: 'Impatience can make you abandon a path too early.',
  },
  {
    label: 'Eight',
    number: 8,
    keywords: ['motion', 'craft', 'focus'],
    upright: 'Practice and momentum are compounding quickly.',
    reversed: 'Rushing or fixation can undercut quality.',
  },
  {
    label: 'Nine',
    number: 9,
    keywords: ['culmination', 'resilience', 'threshold'],
    upright: 'You are closer to mastery than your fatigue suggests.',
    reversed: 'Weariness or worry is asking for recovery before the final push.',
  },
  {
    label: 'Ten',
    number: 10,
    keywords: ['completion', 'weight', 'legacy'],
    upright: 'A cycle reaches fullness, carrying both reward and responsibility.',
    reversed: 'Something has become too heavy to carry the old way.',
  },
  {
    label: 'Page',
    number: 11,
    keywords: ['message', 'curiosity', 'study'],
    upright: 'A learner mindset brings fresh information and possibility.',
    reversed: 'Immaturity, missed messages, or distraction can blur the lesson.',
  },
  {
    label: 'Knight',
    number: 12,
    keywords: ['pursuit', 'drive', 'commitment'],
    upright: 'Energy wants a direction and an active next step.',
    reversed: 'Force, impatience, or inconsistency may be wasting momentum.',
  },
  {
    label: 'Queen',
    number: 13,
    keywords: ['embodiment', 'maturity', 'magnetism'],
    upright: 'This card asks you to embody the quality, not chase it.',
    reversed: 'Overprotection or depletion can distort your natural wisdom.',
  },
  {
    label: 'King',
    number: 14,
    keywords: ['mastery', 'leadership', 'command'],
    upright: 'Your authority grows when it is paired with steadiness and service.',
    reversed: 'Control issues or rigidity can weaken true leadership.',
  },
] as const;

const SUIT_SEEDS: Array<{
  suit: TarotSuit;
  element: string;
  focus: string;
  loveLens: string;
  careerLens: string;
  spiritualLens: string;
  timing: string;
}> = [
  {
    suit: 'Wands',
    element: 'Fire',
    focus: 'creative momentum and desire',
    loveLens: 'passion, magnetism, and honest initiation',
    careerLens: 'ambition, visibility, and brave execution',
    spiritualLens: 'life force, courage, and sacred action',
    timing: 'Fast-moving',
  },
  {
    suit: 'Cups',
    element: 'Water',
    focus: 'emotion, intimacy, and imagination',
    loveLens: 'vulnerability, affection, and emotional reciprocity',
    careerLens: 'intuition, collaboration, and meaningful work',
    spiritualLens: 'devotion, sensitivity, and soul connection',
    timing: 'Fluid',
  },
  {
    suit: 'Swords',
    element: 'Air',
    focus: 'thought, truth, and discernment',
    loveLens: 'clear communication and honest boundaries',
    careerLens: 'strategy, analysis, and decisive conversations',
    spiritualLens: 'clarity, perception, and mental liberation',
    timing: 'Swift',
  },
  {
    suit: 'Pentacles',
    element: 'Earth',
    focus: 'resources, body, and practical reality',
    loveLens: 'stability, trust, and building something real',
    careerLens: 'money, craftsmanship, and sustainable growth',
    spiritualLens: 'grounding, stewardship, and embodied presence',
    timing: 'Slow and steady',
  },
];

function slugify(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-');
}

function createMinorCard(
  suitSeed: (typeof SUIT_SEEDS)[number],
  rankSeed: (typeof MINOR_RANKS)[number],
): TarotCard {
  const name = `${rankSeed.label} of ${suitSeed.suit}`;
  const keywordLine = rankSeed.keywords.join(', ');

  return {
    id: `${slugify(rankSeed.label)}-${slugify(suitSeed.suit)}`,
    name,
    number: rankSeed.number,
    suit: suitSeed.suit,
    arcana: 'minor',
    keywords: [...rankSeed.keywords, suitSeed.element.toLowerCase()],
    uprightMeaning: `${rankSeed.upright} In ${suitSeed.focus}, ${name} emphasizes ${keywordLine}.`,
    reversedMeaning: `${rankSeed.reversed} In ${suitSeed.focus}, ${name} asks for recalibration before the lesson can land.`,
    loveMeaning: `${name} speaks to ${suitSeed.loveLens}. Let ${rankSeed.keywords[0]} guide the heart without forcing an outcome.`,
    careerMeaning: `${name} highlights ${suitSeed.careerLens}. Work with ${rankSeed.keywords[1]} and clear priorities.`,
    spiritualMeaning: `${name} opens a path through ${suitSeed.spiritualLens}. Stay present to the lesson in ordinary life.`,
    prompt: `Where is ${name.toLowerCase()} asking me to act with more ${rankSeed.keywords[0]}?`,
    element: suitSeed.element,
    timing: suitSeed.timing,
  };
}

const MINOR_ARCANA = SUIT_SEEDS.flatMap((suitSeed) =>
  MINOR_RANKS.map((rankSeed) => createMinorCard(suitSeed, rankSeed)),
);

export const TAROT_DECK: TarotCard[] = [...MAJOR_ARCANA, ...MINOR_ARCANA];

export const TAROT_DECK_BY_ID = Object.fromEntries(
  TAROT_DECK.map((card) => [card.id, card]),
) as Record<string, TarotCard>;

export const TAROT_DECK_BY_NAME = Object.fromEntries(
  TAROT_DECK.map((card) => [card.name.toLowerCase(), card]),
) as Record<string, TarotCard>;

export function getTarotCardById(cardId: string): TarotCard | null {
  return TAROT_DECK_BY_ID[cardId] ?? null;
}

export function getTarotCardByName(cardName: string | null | undefined): TarotCard | null {
  if (!cardName) {
    return null;
  }

  return TAROT_DECK_BY_NAME[cardName.toLowerCase()] ?? null;
}

export function hashTarotSeed(seed: string): number {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

export function drawRandomCard(options?: {
  excludeIds?: string[];
  random?: () => number;
}): TarotCard {
  const excludeSet = new Set(options?.excludeIds ?? []);
  const pool = TAROT_DECK.filter((card) => !excludeSet.has(card.id));
  const random = options?.random ?? Math.random;

  if (pool.length === 0) {
    return TAROT_DECK[0];
  }

  const index = Math.floor(random() * pool.length);
  return pool[index] ?? pool[0];
}

export function drawRandomCards(
  count: number,
  options?: { excludeIds?: string[]; random?: () => number },
): TarotCard[] {
  const pool = TAROT_DECK.filter((card) => !(options?.excludeIds ?? []).includes(card.id));
  const random = options?.random ?? Math.random;
  const working = [...pool];
  const draws: TarotCard[] = [];

  while (working.length > 0 && draws.length < count) {
    const index = Math.floor(random() * working.length);
    const [selected] = working.splice(index, 1);

    if (selected) {
      draws.push(selected);
    }
  }

  return draws;
}

export function getDeterministicTarotOrientation(seed: string): boolean {
  return hashTarotSeed(seed) % 2 === 1;
}
