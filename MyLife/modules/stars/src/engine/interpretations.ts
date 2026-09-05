import type { ZodiacSign, MoonPhase } from '../types';
import type { AspectType, TransitEvent } from './transits';

// ── Moon Phase Interpretations ───────────────────────────────────────

export const MOON_PHASE_INTERPRETATIONS: Record<MoonPhase, string> = {
  new_moon: 'A time for new beginnings, setting intentions, and planting seeds for what you want to grow. Reflect on your goals and take the first step.',
  waxing_crescent: 'Momentum is building. Focus on gathering resources, making plans, and nurturing your intentions from the New Moon.',
  first_quarter: 'A time for action and decision. You may face obstacles that test your commitment. Push through with determination.',
  waxing_gibbous: 'Refine and adjust your approach. Pay attention to details and make corrections before the culmination of the Full Moon.',
  full_moon: 'Peak illumination and emotional intensity. What you started at the New Moon comes to fruition. Release what no longer serves you.',
  waning_gibbous: 'Practice gratitude and share what you have learned. This is a time for teaching, mentoring, and giving back.',
  last_quarter: 'Let go of what is not working. Reassess your direction, release old habits, and prepare for the coming cycle.',
  waning_crescent: 'Rest, surrender, and prepare. This is the final phase before renewal. Spend time in reflection and self-care.',
};

// ── Moon Sign Interpretations ────────────────────────────────────────

export const MOON_SIGN_INTERPRETATIONS: Record<ZodiacSign, string> = {
  aries: 'Moon in Aries brings bold emotional energy. You may feel impulsive and ready to take action. Channel this fire into starting something new.',
  taurus: 'Moon in Taurus creates a desire for comfort and stability. Enjoy sensory pleasures, tend to your finances, and ground yourself in nature.',
  gemini: 'Moon in Gemini makes you chatty and curious. Connect with others, learn something new, and let your mind explore freely.',
  cancer: 'Moon in Cancer heightens emotional sensitivity. Nurture yourself and loved ones. Home and family matters take center stage.',
  leo: 'Moon in Leo brings warmth, creativity, and a desire to be seen. Express yourself, play, and enjoy the spotlight.',
  virgo: 'Moon in Virgo focuses on details, health, and service. Organize your space, refine your routines, and attend to practical matters.',
  libra: 'Moon in Libra emphasizes relationships, balance, and beauty. Seek harmony in your connections and appreciate art and aesthetics.',
  scorpio: 'Moon in Scorpio intensifies emotions and deepens intuition. Dive into what matters, face truths, and embrace transformation.',
  sagittarius: 'Moon in Sagittarius sparks adventure and optimism. Expand your horizons through travel, learning, or philosophical exploration.',
  capricorn: 'Moon in Capricorn brings ambition and discipline. Focus on your goals, take responsibility, and build toward long-term success.',
  aquarius: 'Moon in Aquarius inspires innovation and independence. Think outside the box, connect with your community, and champion your ideals.',
  pisces: 'Moon in Pisces heightens empathy and imagination. Trust your intuition, engage in creative or spiritual practices, and be gentle with yourself.',
};

// ── Zodiac Season Descriptions ───────────────────────────────────────

export const ZODIAC_SEASON_DESCRIPTIONS: Record<ZodiacSign, { title: string; brief: string; full: string }> = {
  aries: {
    title: 'Sun enters Aries -- Aries Season Begins',
    brief: 'The Spring Equinox marks the astrological new year. Aries season brings fresh starts and bold energy.',
    full: 'As the Sun crosses into Aries, the first sign of the zodiac, we enter a period of initiation and renewal. This is the astrological new year, a time to set bold intentions and take decisive action. The fiery energy of Aries encourages courage, independence, and pioneering spirit.',
  },
  taurus: {
    title: 'Sun enters Taurus -- Taurus Season Begins',
    brief: 'Taurus season slows the pace and grounds us in sensory pleasures, financial matters, and steady growth.',
    full: 'The Sun moves into Taurus, shifting the energy from impulsive to deliberate. This earth sign season asks us to slow down, build something lasting, and enjoy the physical world. Focus on finances, comfort, and cultivating patience.',
  },
  gemini: {
    title: 'Sun enters Gemini -- Gemini Season Begins',
    brief: 'Gemini season sparks curiosity, communication, and social connections. Ideas flow freely.',
    full: 'As the Sun enters Gemini, the air fills with intellectual energy. This is a time for learning, networking, and exploring new ideas. Communication skills are heightened, making it ideal for writing, speaking, and connecting.',
  },
  cancer: {
    title: 'Sun enters Cancer -- Cancer Season Begins',
    brief: 'The Summer Solstice ushers in Cancer season, turning attention to home, family, and emotional roots.',
    full: 'The Sun enters Cancer at the Summer Solstice, marking the longest day and a turn inward. This water sign season emphasizes emotional security, family bonds, and nurturing. Create a safe space for yourself and those you love.',
  },
  leo: {
    title: 'Sun enters Leo -- Leo Season Begins',
    brief: 'Leo season celebrates creativity, self-expression, and the joy of being alive. Shine brightly.',
    full: 'The Sun enters its home sign of Leo, bringing warmth, vitality, and creative fire. This is a time to express yourself authentically, pursue what brings you joy, and lead with your heart. Embrace your inner performer.',
  },
  virgo: {
    title: 'Sun enters Virgo -- Virgo Season Begins',
    brief: 'Virgo season brings focus to health, organization, and refinement. Time to get your life in order.',
    full: 'As the Sun enters Virgo, the energy shifts to practical matters. This earth sign season is ideal for establishing routines, improving health habits, organizing your space, and attending to details that have been overlooked.',
  },
  libra: {
    title: 'Sun enters Libra -- Libra Season Begins',
    brief: 'The Autumn Equinox brings Libra season, emphasizing balance, partnerships, and social harmony.',
    full: 'The Sun enters Libra at the Autumn Equinox, bringing a desire for balance and beauty. This air sign season highlights relationships, fairness, and aesthetic appreciation. Seek equilibrium in all areas of life.',
  },
  scorpio: {
    title: 'Sun enters Scorpio -- Scorpio Season Begins',
    brief: 'Scorpio season deepens our focus on transformation, intimacy, and uncovering hidden truths.',
    full: 'As the Sun enters Scorpio, the energy becomes intense and probing. This water sign season invites deep emotional work, transformation, and letting go of what no longer serves you. Face your shadows with courage.',
  },
  sagittarius: {
    title: 'Sun enters Sagittarius -- Sagittarius Season Begins',
    brief: 'Sagittarius season expands horizons with adventure, philosophy, and optimistic exploration.',
    full: 'The Sun enters Sagittarius, igniting a fire for adventure and meaning. This is a time for travel, higher learning, and expanding your worldview. Embrace optimism and the quest for truth.',
  },
  capricorn: {
    title: 'Sun enters Capricorn -- Capricorn Season Begins',
    brief: 'The Winter Solstice marks Capricorn season, bringing ambition, discipline, and long-term goal setting.',
    full: 'The Sun enters Capricorn at the Winter Solstice, the shortest day of the year. This earth sign season emphasizes structure, ambition, and building toward your goals. Set concrete plans and commit to the work.',
  },
  aquarius: {
    title: 'Sun enters Aquarius -- Aquarius Season Begins',
    brief: 'Aquarius season brings innovation, humanitarian ideals, and a desire to break free from convention.',
    full: 'As the Sun enters Aquarius, the energy shifts to collective consciousness and innovation. This air sign season encourages thinking about the future, championing causes, and embracing your individuality.',
  },
  pisces: {
    title: 'Sun enters Pisces -- Pisces Season Begins',
    brief: 'Pisces season closes the zodiac year with imagination, compassion, and spiritual reflection.',
    full: 'The Sun enters Pisces, the final sign of the zodiac, bringing a time of reflection, compassion, and spiritual connection. This water sign season invites you to dream, create, and dissolve boundaries between yourself and the divine.',
  },
};

// ── Compatibility Descriptions ───────────────────────────────────────

export const ELEMENT_COMPATIBILITY_DESCRIPTIONS: Record<string, string> = {
  'fire+fire': 'Fire meets fire: passionate, dynamic, and exciting. You inspire each other but must manage ego clashes and burnout.',
  'earth+earth': 'Earth meets earth: stable, reliable, and grounded. You build together beautifully but may need to inject spontaneity.',
  'air+air': 'Air meets air: intellectually stimulating, communicative, and social. Keep each other grounded and emotionally present.',
  'water+water': 'Water meets water: deeply emotional, intuitive, and nurturing. You understand each other profoundly but watch for co-dependency.',
  'fire+air': 'Fire and air: energizing and expansive. Air fans the flames of fire, creating passion and intellectual spark.',
  'air+fire': 'Air and fire: energizing and expansive. Air fans the flames of fire, creating passion and intellectual spark.',
  'earth+water': 'Earth and water: nourishing and fertile. Water feeds the earth, creating growth, stability, and emotional depth.',
  'water+earth': 'Earth and water: nourishing and fertile. Water feeds the earth, creating growth, stability, and emotional depth.',
  'fire+water': 'Fire and water: steamy but volatile. Passion runs high, but emotional needs and action styles often clash.',
  'water+fire': 'Fire and water: steamy but volatile. Passion runs high, but emotional needs and action styles often clash.',
  'fire+earth': 'Fire and earth: determined but friction-prone. Fire wants to leap while earth wants to plan. Find the balance.',
  'earth+fire': 'Fire and earth: determined but friction-prone. Fire wants to leap while earth wants to plan. Find the balance.',
  'air+water': 'Air and water: imaginative but mismatched. Air intellectualizes feelings while water feels deeply. Bridge the gap with patience.',
  'water+air': 'Air and water: imaginative but mismatched. Air intellectualizes feelings while water feels deeply. Bridge the gap with patience.',
  'air+earth': 'Air and earth: idea meets execution. Air brings vision, earth brings practicality. Respect each other\'s pace.',
  'earth+air': 'Air and earth: idea meets execution. Air brings vision, earth brings practicality. Respect each other\'s pace.',
};

// ── Retrograde Survival Tips ─────────────────────────────────────────

export type Planet = 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

export const RETROGRADE_TIPS: Record<Planet, string[]> = {
  mercury: [
    'Double-check all emails and texts before sending',
    'Back up your devices and important files',
    'Avoid signing contracts or making major purchases if possible',
    'Revisit old projects rather than starting new ones',
    'Be patient with miscommunications and travel delays',
  ],
  venus: [
    'Avoid making drastic changes to your appearance',
    'Reflect on relationship patterns rather than starting new romances',
    'Revisit your values and what truly matters to you',
    'Be cautious with large financial decisions',
    'Reconnect with old friends or creative projects',
  ],
  mars: [
    'Channel frustration into physical exercise',
    'Avoid unnecessary confrontations and arguments',
    'Review your strategies and plans rather than launching new ones',
    'Be extra careful with sharp objects and physical activities',
    'Reflect on what drives and motivates you',
  ],
  jupiter: [
    'Review your long-term goals and beliefs',
    'Avoid overcommitting to new ventures',
    'Reflect on your personal philosophy and growth',
    'Revisit educational or travel plans',
    'Practice gratitude for what you already have',
  ],
  saturn: [
    'Reassess your responsibilities and boundaries',
    'Review career goals and professional structures',
    'Address unfinished duties rather than taking on new ones',
    'Reflect on lessons from past challenges',
    'Strengthen foundations before building higher',
  ],
  uranus: [
    'Expect the unexpected and stay flexible',
    'Reflect on where you need more freedom in life',
    'Avoid making sudden, irreversible changes',
    'Revisit innovative ideas that were set aside',
    'Embrace inner change rather than forcing external disruption',
  ],
  neptune: [
    'Pay extra attention to boundaries in relationships',
    'Avoid escapist behaviors and addictive patterns',
    'Revisit creative and spiritual practices',
    'Question illusions and seek clarity',
    'Trust your intuition but verify important facts',
  ],
  pluto: [
    'Allow deep inner transformation to unfold naturally',
    'Revisit power dynamics in your relationships',
    'Release control and trust the process',
    'Address unresolved psychological patterns',
    'Embrace endings as necessary for rebirth',
  ],
};

export const RETROGRADE_INTERPRETATIONS: Record<Planet, string> = {
  mercury: 'Mercury retrograde slows communication, technology, and travel. Misunderstandings are common, and plans may shift unexpectedly. Use this time to revisit, revise, and reflect rather than launching new initiatives.',
  venus: 'Venus retrograde turns attention inward on relationships and values. Past lovers may reappear, and you may question what you truly desire. Avoid major cosmetic changes or financial commitments.',
  mars: 'Mars retrograde drains forward momentum and can redirect anger inward. Frustration may build if you force action. Instead, review your strategies and conserve energy for when Mars goes direct.',
  jupiter: 'Jupiter retrograde invites internal growth rather than external expansion. Your beliefs and philosophy are up for review. Opportunities may slow, but wisdom deepens.',
  saturn: 'Saturn retrograde loosens rigid structures and invites you to reassess your responsibilities. Career matters may stall, but this is a chance to rebuild on stronger foundations.',
  uranus: 'Uranus retrograde shifts revolutionary energy inward. External disruptions quiet down while internal awakenings intensify. Reflect on where you need authentic change.',
  neptune: 'Neptune retrograde lifts the veil on illusions. Dreams and fantasies come into sharper focus, allowing you to see reality more clearly. Spiritual insights deepen.',
  pluto: 'Pluto retrograde deepens the process of psychological transformation. Power dynamics surface for examination. This is a time for profound inner work and releasing what you have outgrown.',
};

// ── Progressed Moon Interpretations ──────────────────────────────────

export const PROGRESSED_MOON_INTERPRETATIONS: Record<ZodiacSign, string> = {
  aries: 'Your progressed Moon in Aries marks a period of emotional independence and new beginnings. You feel a strong urge to assert yourself and may initiate major life changes.',
  taurus: 'Your progressed Moon in Taurus brings a need for emotional stability and material security. You seek comfort, routine, and tangible results during this period.',
  gemini: 'Your progressed Moon in Gemini stimulates emotional curiosity and communication. You may feel restless and eager to learn, connect, and share ideas.',
  cancer: 'Your progressed Moon in Cancer deepens emotional sensitivity and turns focus toward home and family. Nurturing yourself and creating security become paramount.',
  leo: 'Your progressed Moon in Leo awakens a desire for creative expression and recognition. You feel more confident and ready to put yourself out there.',
  virgo: 'Your progressed Moon in Virgo brings emotional focus to health, work, and self-improvement. You become more analytical about your feelings and daily routines.',
  libra: 'Your progressed Moon in Libra shifts emotional needs toward partnership and harmony. Relationships take center stage, and you seek balance in all areas.',
  scorpio: 'Your progressed Moon in Scorpio intensifies emotions and drives deep psychological transformation. You confront hidden truths and emerge stronger.',
  sagittarius: 'Your progressed Moon in Sagittarius expands your emotional world through adventure, education, and philosophy. You crave freedom and meaningful experiences.',
  capricorn: 'Your progressed Moon in Capricorn brings emotional maturity and ambition. You take on more responsibility and work toward concrete achievements.',
  aquarius: 'Your progressed Moon in Aquarius shifts emotional focus toward community, innovation, and ideals. You seek emotional freedom and authentic self-expression.',
  pisces: 'Your progressed Moon in Pisces dissolves emotional boundaries and heightens intuition. This is a deeply spiritual and creative period requiring compassion and rest.',
};

// ── Journal Mood Labels ──────────────────────────────────────────────

export const JOURNAL_MOODS = [
  'hopeful', 'inspired', 'calm', 'anxious', 'frustrated',
  'joyful', 'contemplative', 'reflective', 'energized', 'grateful', 'drained',
] as const;

export type JournalMood = typeof JOURNAL_MOODS[number];

export const JOURNAL_INTENTIONS = [
  'new moon intention',
  'full moon release',
  'gratitude',
  'manifestation',
  'shadow work',
  'clarity',
  'healing',
  'integration',
] as const;

export type JournalIntention = typeof JOURNAL_INTENTIONS[number];

export interface JournalPromptContext {
  moonPhase: MoonPhase;
  moonSign: ZodiacSign;
  sunSign: ZodiacSign;
  retrogradePlanets?: string[];
  tarotCardName?: string | null;
  transits?: Array<
    Pick<
      TransitEvent,
      'transitingBody' | 'natalBody' | 'aspectType' | 'interpretationBrief' | 'significance'
    >
  >;
}

const MOON_PHASE_PROMPTS: Record<MoonPhase, string> = {
  new_moon: 'What intention feels ready to be planted while this New Moon begins a fresh cycle?',
  waxing_crescent: 'What small act of faith would help your intentions gain momentum today?',
  first_quarter: 'Where are you being asked to act decisively instead of staying in preparation mode?',
  waxing_gibbous: 'What part of your current path needs refinement before it is ready to bloom?',
  full_moon: 'What truth is fully illuminated for you under this Full Moon, and what are you ready to release?',
  waning_gibbous: 'What wisdom from recent events is ready to be shared, named, or integrated?',
  last_quarter: 'What pattern feels complete enough to let go of without negotiation?',
  waning_crescent: 'What would it look like to rest instead of forcing clarity before it arrives?',
};

const ASPECT_PROMPT_FRAGMENTS: Record<AspectType, string> = {
  conjunction: 'feels impossible to ignore',
  sextile: 'opens a door if you choose to walk through it',
  square: 'creates pressure that wants an honest response',
  trine: 'flows with more ease than usual',
  opposition: 'asks you to balance two truths at once',
};

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function uniquePrompts(prompts: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const prompt of prompts) {
    const normalized = prompt.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(prompt.trim());
  }

  return deduped;
}

export function getJournalPrompts(context: JournalPromptContext): string[] {
  const tarotPrompt = context.tarotCardName
    ? `What lesson from ${context.tarotCardName} mirrors the emotional weather of today?`
    : null;

  const prompts: string[] = [
    MOON_PHASE_PROMPTS[context.moonPhase],
    `With the Moon in ${titleCase(context.moonSign)}, what emotion needs the most tenderness from you today?`,
  ];

  const activeTransits = [...(context.transits ?? [])].sort((left, right) => {
    if (left.significance === right.significance) {
      return 0;
    }
    return left.significance === 'major' ? -1 : 1;
  });

  for (const transit of activeTransits.slice(0, 2)) {
    prompts.push(
      `Where does ${titleCase(transit.transitingBody)} ${transit.aspectType} your natal ${titleCase(transit.natalBody)} feel especially present because it ${ASPECT_PROMPT_FRAGMENTS[transit.aspectType]}?`,
    );
  }

  if ((context.retrogradePlanets?.length ?? 0) > 0) {
    const [firstRetrograde] = context.retrogradePlanets!;
    prompts.push(
      `What deserves a second look while ${titleCase(firstRetrograde)} retrograde asks you to review instead of rush?`,
    );
  }

  if (tarotPrompt) {
    prompts.push(tarotPrompt);
  }

  prompts.push(
    `How is ${titleCase(context.sunSign)} season shaping the way you want to show up right now?`,
  );

  const deduped = uniquePrompts(prompts);

  const limited = deduped.slice(0, 5);

  if (
    (context.retrogradePlanets?.length ?? 0) > 0
    && !limited.some((prompt) => prompt.includes(titleCase(context.retrogradePlanets![0])))
  ) {
    const retrogradePrompt = `What deserves a second look while ${titleCase(context.retrogradePlanets![0])} retrograde asks you to review instead of rush?`;
    return uniquePrompts([
      ...limited.slice(0, 4),
      retrogradePrompt,
    ]).slice(0, 5);
  }

  if (tarotPrompt && !limited.includes(tarotPrompt)) {
    return uniquePrompts([
      ...limited.slice(0, 4),
      tarotPrompt,
    ]).slice(0, 5);
  }

  return limited;
}
