// === Story Events — Major story beats and progression flags ===

import type { SaveData } from '../data/game-types.ts';

/** All story event flags used in the game */
export type StoryFlag =
  // Opening sequence
  | 'intro-complete'
  | 'left-house'
  // Starter selection
  | 'entered-oak-lab'
  | 'starter-selected'
  | 'first-rival-battle-won'
  // Oak's Parcel quest
  | 'oaks-parcel-received'
  | 'oaks-parcel-delivered'
  | 'pokedex-received'
  // Viridian Forest & Pewter
  | 'boulder-badge'
  // Cerulean / Route 24-25
  | 'nugget-bridge-complete'
  | 'bill-helped'
  | 'ss-ticket-received'
  | 'cascade-badge'
  | 'cerulean-rocket-defeated'
  // Vermilion
  | 'ss-anne-rival-defeated'
  | 'hm01-cut-received'
  | 'thunder-badge'
  // Lavender / Celadon / Rocket
  | 'rocket-hideout-cleared'
  | 'silph-scope-received'
  | 'pokemon-tower-cleared'
  | 'poke-flute-received'
  | 'rainbow-badge'
  // Saffron
  | 'silph-co-cleared'
  | 'master-ball-received'
  | 'marsh-badge'
  | 'fighting-dojo-cleared'
  // Fuchsia
  | 'soul-badge'
  | 'gold-teeth-found'
  | 'hm04-strength-received'
  | 'hm03-surf-received'
  // Cinnabar
  | 'secret-key-found'
  | 'volcano-badge'
  // Viridian (return)
  | 'earth-badge'
  // Victory Road / Elite Four
  | 'victory-road-cleared'
  | 'elite-four-lorelei-defeated'
  | 'elite-four-bruno-defeated'
  | 'elite-four-agatha-defeated'
  | 'elite-four-lance-defeated'
  | 'champion-defeated'
  | 'hall-of-fame-entered'
  // Post-game
  | 'cerulean-cave-unlocked'
  | 'mewtwo-encountered'
  // Legendary birds
  | 'articuno-encountered'
  | 'zapdos-encountered'
  | 'moltres-encountered'
  // Snorlax events
  | 'snorlax-route12-cleared'
  | 'snorlax-route16-cleared';

/** Check if a story flag is set */
export function hasFlag(save: SaveData, flag: string): boolean {
  return save.eventFlags[flag] === true;
}

/** Set a story flag */
export function setFlag(save: SaveData, flag: string): void {
  save.eventFlags[flag] = true;
}

/** Get badges collected count */
export function badgeCount(save: SaveData): number {
  return save.badges.filter(Boolean).length;
}

/** Badge index mapping */
export const BADGE_INDEX = {
  BOULDER: 0,
  CASCADE: 1,
  THUNDER: 2,
  RAINBOW: 3,
  SOUL: 4,
  MARSH: 5,
  VOLCANO: 6,
  EARTH: 7,
} as const;

/** Award a badge */
export function awardBadge(save: SaveData, badge: keyof typeof BADGE_INDEX): void {
  save.badges[BADGE_INDEX[badge]] = true;
}

/** Check if player has a specific badge */
export function hasBadge(save: SaveData, badge: keyof typeof BADGE_INDEX): boolean {
  return save.badges[BADGE_INDEX[badge]] === true;
}

/** Starter Pokemon species IDs */
export const STARTER_IDS = {
  BULBASAUR: 1,
  CHARMANDER: 4,
  SQUIRTLE: 7,
} as const;

/** Rival's starter based on player's choice */
export function getRivalStarter(playerStarter: number): number {
  switch (playerStarter) {
    case STARTER_IDS.BULBASAUR: return STARTER_IDS.CHARMANDER;
    case STARTER_IDS.CHARMANDER: return STARTER_IDS.SQUIRTLE;
    case STARTER_IDS.SQUIRTLE: return STARTER_IDS.BULBASAUR;
    default: return STARTER_IDS.SQUIRTLE;
  }
}

/** Story progression order — maps story gates to required flags */
export const STORY_GATES: Record<string, string> = {
  // Old man in Viridian blocks north path until parcel delivered
  'viridian-north-passage': 'oaks-parcel-delivered',
  // Viridian Gym locked until 7 badges
  'gym-viridian-door': 'soul-badge',
  // SS Anne requires ticket
  'ss-anne-entrance': 'ss-ticket-received',
  // Cut tree requires HM01
  'cut-tree': 'hm01-cut-received',
  // Rock Tunnel requires Flash (optional, just dark)
  'rock-tunnel-light': 'hm05-flash-received',
  // Pokemon Tower ghost requires Silph Scope
  'pokemon-tower-ghost': 'silph-scope-received',
  // Snorlax requires Poke Flute
  'snorlax-wake': 'poke-flute-received',
  // Cycling Road requires Bicycle
  'cycling-road': 'bicycle-received',
  // Strength boulders require HM04
  'strength-boulder': 'hm04-strength-received',
  // Surf water requires HM03
  'surf-water': 'hm03-surf-received',
  // Cinnabar Gym requires Secret Key
  'gym-cinnabar-door': 'secret-key-found',
  // Saffron City gates guarded by Rockets
  'saffron-gate': 'rocket-hideout-cleared',
  // Victory Road requires all 8 badges
  'victory-road-gate': 'earth-badge',
  // Cerulean Cave requires Champion defeated
  'cerulean-cave-entrance': 'champion-defeated',
};

/** Check if a story gate is passable */
export function isGateOpen(save: SaveData, gateId: string): boolean {
  const requiredFlag = STORY_GATES[gateId];
  if (!requiredFlag) return true;
  return hasFlag(save, requiredFlag);
}

/** Key story event handlers */
export const STORY_EVENTS = {
  /** Player selects starter in Oak's Lab */
  selectStarter(save: SaveData, starterSpeciesId: number): void {
    save.starterChoice = starterSpeciesId;
    setFlag(save, 'starter-selected');
  },

  /** Player wins first rival battle */
  winFirstRivalBattle(save: SaveData): void {
    setFlag(save, 'first-rival-battle-won');
  },

  /** Player delivers Oak's Parcel */
  deliverOaksParcel(save: SaveData): void {
    setFlag(save, 'oaks-parcel-delivered');
    setFlag(save, 'pokedex-received');
  },

  /** Player defeats a Gym Leader */
  defeatGymLeader(save: SaveData, badge: keyof typeof BADGE_INDEX): void {
    awardBadge(save, badge);
    setFlag(save, `${badge.toLowerCase()}-badge` as StoryFlag);
  },

  /** Player clears Rocket Hideout */
  clearRocketHideout(save: SaveData): void {
    setFlag(save, 'rocket-hideout-cleared');
    setFlag(save, 'silph-scope-received');
  },

  /** Player clears Pokemon Tower */
  clearPokemonTower(save: SaveData): void {
    setFlag(save, 'pokemon-tower-cleared');
    setFlag(save, 'poke-flute-received');
  },

  /** Player clears Silph Co */
  clearSilphCo(save: SaveData): void {
    setFlag(save, 'silph-co-cleared');
    setFlag(save, 'master-ball-received');
  },

  /** Player becomes Champion */
  becomeChampion(save: SaveData): void {
    setFlag(save, 'champion-defeated');
    setFlag(save, 'hall-of-fame-entered');
    setFlag(save, 'cerulean-cave-unlocked');
  },
};
