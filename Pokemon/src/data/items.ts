// === All Gen 1 Item Definitions ===

import type { ItemData } from './game-types.ts';

export const ITEMS: Record<number, ItemData> = {
  // === Pokeballs (IDs 1-5) ===
  1: { id: 1, name: 'Poke Ball', category: 'pokeball', price: 200, description: 'A basic ball for catching Pokemon.', effect: 'catch-1x' },
  2: { id: 2, name: 'Great Ball', category: 'pokeball', price: 600, description: 'A good ball with a higher catch rate.', effect: 'catch-1.5x' },
  3: { id: 3, name: 'Ultra Ball', category: 'pokeball', price: 1200, description: 'A high-performance ball.', effect: 'catch-2x' },
  4: { id: 4, name: 'Master Ball', category: 'pokeball', price: 0, description: 'The best ball that catches without fail.', effect: 'catch-255x' },
  5: { id: 5, name: 'Safari Ball', category: 'pokeball', price: 0, description: 'A ball used only in the Safari Zone.', effect: 'catch-1.5x' },

  // === Medicine (IDs 10-30) ===
  10: { id: 10, name: 'Potion', category: 'medicine', price: 300, description: 'Restores 20 HP.', effect: 'heal-20' },
  11: { id: 11, name: 'Super Potion', category: 'medicine', price: 700, description: 'Restores 50 HP.', effect: 'heal-50' },
  12: { id: 12, name: 'Hyper Potion', category: 'medicine', price: 1200, description: 'Restores 200 HP.', effect: 'heal-200' },
  13: { id: 13, name: 'Max Potion', category: 'medicine', price: 2500, description: 'Restores all HP.', effect: 'heal-full' },
  14: { id: 14, name: 'Full Restore', category: 'medicine', price: 3000, description: 'Restores all HP and cures status.', effect: 'heal-full-status' },
  15: { id: 15, name: 'Revive', category: 'medicine', price: 1500, description: 'Revives a fainted Pokemon to half HP.', effect: 'revive-half' },
  16: { id: 16, name: 'Max Revive', category: 'medicine', price: 0, description: 'Revives a fainted Pokemon to full HP.', effect: 'revive-full' },
  17: { id: 17, name: 'Antidote', category: 'medicine', price: 100, description: 'Cures poison.', effect: 'cure-poison' },
  18: { id: 18, name: 'Burn Heal', category: 'medicine', price: 250, description: 'Cures a burn.', effect: 'cure-burn' },
  19: { id: 19, name: 'Ice Heal', category: 'medicine', price: 250, description: 'Cures freezing.', effect: 'cure-freeze' },
  20: { id: 20, name: 'Awakening', category: 'medicine', price: 200, description: 'Wakes a sleeping Pokemon.', effect: 'cure-sleep' },
  21: { id: 21, name: 'Parlyz Heal', category: 'medicine', price: 200, description: 'Cures paralysis.', effect: 'cure-paralyze' },
  22: { id: 22, name: 'Full Heal', category: 'medicine', price: 600, description: 'Cures all status conditions.', effect: 'cure-all' },

  // === Battle Items (IDs 40-50) ===
  40: { id: 40, name: 'X Attack', category: 'battle', price: 500, description: 'Raises Attack during battle.', effect: 'battle-atk-up' },
  41: { id: 41, name: 'X Defend', category: 'battle', price: 550, description: 'Raises Defense during battle.', effect: 'battle-def-up' },
  42: { id: 42, name: 'X Speed', category: 'battle', price: 350, description: 'Raises Speed during battle.', effect: 'battle-spd-up' },
  43: { id: 43, name: 'X Special', category: 'battle', price: 350, description: 'Raises Special during battle.', effect: 'battle-spc-up' },
  44: { id: 44, name: 'Guard Spec.', category: 'battle', price: 700, description: 'Prevents stat reduction.', effect: 'battle-guard-spec' },
  45: { id: 45, name: 'Dire Hit', category: 'battle', price: 650, description: 'Raises critical hit ratio.', effect: 'battle-crit-up' },
  46: { id: 46, name: 'Poke Doll', category: 'battle', price: 1000, description: 'Use to flee from wild Pokemon.', effect: 'flee' },

  // === Evolution Stones (IDs 60-65) ===
  60: { id: 60, name: 'Fire Stone', category: 'evolution-stone', price: 2100, description: 'Evolves certain Fire-type Pokemon.' },
  61: { id: 61, name: 'Water Stone', category: 'evolution-stone', price: 2100, description: 'Evolves certain Water-type Pokemon.' },
  62: { id: 62, name: 'Thunder Stone', category: 'evolution-stone', price: 2100, description: 'Evolves certain Electric-type Pokemon.' },
  63: { id: 63, name: 'Leaf Stone', category: 'evolution-stone', price: 2100, description: 'Evolves certain Grass-type Pokemon.' },
  64: { id: 64, name: 'Moon Stone', category: 'evolution-stone', price: 0, description: 'Evolves certain Pokemon.' },

  // === Key Items (IDs 100+) ===
  100: { id: 100, name: 'Bicycle', category: 'key', price: 0, description: 'A folding bicycle for faster travel.' },
  101: { id: 101, name: 'Old Rod', category: 'key', price: 0, description: 'An old fishing rod. Use by water.' },
  102: { id: 102, name: 'Good Rod', category: 'key', price: 0, description: 'A decent fishing rod.' },
  103: { id: 103, name: 'Super Rod', category: 'key', price: 0, description: 'The best fishing rod.' },
  104: { id: 104, name: 'Town Map', category: 'key', price: 0, description: 'A map of the Kanto region.' },
  105: { id: 105, name: 'Poke Flute', category: 'key', price: 0, description: 'Wakes sleeping Pokemon.' },
  106: { id: 106, name: 'Silph Scope', category: 'key', price: 0, description: 'Identifies ghost Pokemon.' },
  107: { id: 107, name: 'Lift Key', category: 'key', price: 0, description: 'Key for the Rocket Hideout elevator.' },
  108: { id: 108, name: 'Card Key', category: 'key', price: 0, description: 'Key for Silph Co. doors.' },
  109: { id: 109, name: 'S.S. Ticket', category: 'key', price: 0, description: 'Ticket for the S.S. Anne.' },
  110: { id: 110, name: 'Gold Teeth', category: 'key', price: 0, description: 'The Safari Zone warden\'s gold teeth.' },
  111: { id: 111, name: 'Secret Key', category: 'key', price: 0, description: 'Key to Cinnabar Island Gym.' },
  112: { id: 112, name: 'Coin Case', category: 'key', price: 0, description: 'Holds coins for the Game Corner.' },
  113: { id: 113, name: 'Itemfinder', category: 'key', price: 0, description: 'Detects hidden items nearby.' },
  114: { id: 114, name: 'Exp. All', category: 'key', price: 0, description: 'Shares EXP among all party Pokemon.' },
  115: { id: 115, name: "Oak's Parcel", category: 'key', price: 0, description: "A parcel for Prof. Oak." },
  116: { id: 116, name: 'Helix Fossil', category: 'key', price: 0, description: 'A fossil of an ancient Pokemon.' },
  117: { id: 117, name: 'Dome Fossil', category: 'key', price: 0, description: 'A fossil of an ancient Pokemon.' },
  118: { id: 118, name: 'Old Amber', category: 'key', price: 0, description: 'Amber with an ancient Pokemon inside.' },

  // === TMs (IDs 200-249) ===
  200: { id: 200, name: 'TM01', category: 'tm', price: 3000, description: 'Teaches Mega Punch.', effect: 'teach-5' },
  201: { id: 201, name: 'TM02', category: 'tm', price: 2000, description: 'Teaches Razor Wind.', effect: 'teach-13' },
  202: { id: 202, name: 'TM03', category: 'tm', price: 0, description: 'Teaches Swords Dance.', effect: 'teach-14' },
  203: { id: 203, name: 'TM04', category: 'tm', price: 0, description: 'Teaches Whirlwind.', effect: 'teach-18' },
  204: { id: 204, name: 'TM05', category: 'tm', price: 1000, description: 'Teaches Mega Kick.', effect: 'teach-25' },
  205: { id: 205, name: 'TM06', category: 'tm', price: 0, description: 'Teaches Toxic.', effect: 'teach-92' },
  206: { id: 206, name: 'TM07', category: 'tm', price: 2000, description: 'Teaches Horn Drill.', effect: 'teach-32' },
  207: { id: 207, name: 'TM08', category: 'tm', price: 0, description: 'Teaches Body Slam.', effect: 'teach-34' },
  208: { id: 208, name: 'TM09', category: 'tm', price: 0, description: 'Teaches Take Down.', effect: 'teach-36' },
  209: { id: 209, name: 'TM10', category: 'tm', price: 0, description: 'Teaches Double-Edge.', effect: 'teach-38' },
  210: { id: 210, name: 'TM11', category: 'tm', price: 0, description: 'Teaches Bubble Beam.', effect: 'teach-61' },
  211: { id: 211, name: 'TM12', category: 'tm', price: 0, description: 'Teaches Water Gun.', effect: 'teach-55' },
  212: { id: 212, name: 'TM13', category: 'tm', price: 0, description: 'Teaches Ice Beam.', effect: 'teach-58' },
  213: { id: 213, name: 'TM14', category: 'tm', price: 0, description: 'Teaches Blizzard.', effect: 'teach-59' },
  214: { id: 214, name: 'TM15', category: 'tm', price: 0, description: 'Teaches Hyper Beam.', effect: 'teach-63' },
  215: { id: 215, name: 'TM16', category: 'tm', price: 0, description: 'Teaches Pay Day.', effect: 'teach-6' },
  216: { id: 216, name: 'TM17', category: 'tm', price: 0, description: 'Teaches Submission.', effect: 'teach-66' },
  217: { id: 217, name: 'TM18', category: 'tm', price: 0, description: 'Teaches Counter.', effect: 'teach-68' },
  218: { id: 218, name: 'TM19', category: 'tm', price: 0, description: 'Teaches Seismic Toss.', effect: 'teach-69' },
  219: { id: 219, name: 'TM20', category: 'tm', price: 0, description: 'Teaches Rage.', effect: 'teach-99' },
  220: { id: 220, name: 'TM21', category: 'tm', price: 0, description: 'Teaches Mega Drain.', effect: 'teach-72' },
  221: { id: 221, name: 'TM22', category: 'tm', price: 0, description: 'Teaches Solar Beam.', effect: 'teach-76' },
  222: { id: 222, name: 'TM23', category: 'tm', price: 0, description: 'Teaches Dragon Rage.', effect: 'teach-82' },
  223: { id: 223, name: 'TM24', category: 'tm', price: 0, description: 'Teaches Thunderbolt.', effect: 'teach-85' },
  224: { id: 224, name: 'TM25', category: 'tm', price: 0, description: 'Teaches Thunder.', effect: 'teach-87' },
  225: { id: 225, name: 'TM26', category: 'tm', price: 0, description: 'Teaches Earthquake.', effect: 'teach-89' },
  226: { id: 226, name: 'TM27', category: 'tm', price: 0, description: 'Teaches Fissure.', effect: 'teach-90' },
  227: { id: 227, name: 'TM28', category: 'tm', price: 0, description: 'Teaches Dig.', effect: 'teach-91' },
  228: { id: 228, name: 'TM29', category: 'tm', price: 0, description: 'Teaches Psychic.', effect: 'teach-94' },
  229: { id: 229, name: 'TM30', category: 'tm', price: 0, description: 'Teaches Teleport.', effect: 'teach-100' },
  230: { id: 230, name: 'TM31', category: 'tm', price: 0, description: 'Teaches Mimic.', effect: 'teach-102' },
  231: { id: 231, name: 'TM32', category: 'tm', price: 1000, description: 'Teaches Double Team.', effect: 'teach-104' },
  232: { id: 232, name: 'TM33', category: 'tm', price: 0, description: 'Teaches Reflect.', effect: 'teach-115' },
  233: { id: 233, name: 'TM34', category: 'tm', price: 0, description: 'Teaches Bide.', effect: 'teach-117' },
  234: { id: 234, name: 'TM35', category: 'tm', price: 0, description: 'Teaches Metronome.', effect: 'teach-118' },
  235: { id: 235, name: 'TM36', category: 'tm', price: 0, description: 'Teaches Self-Destruct.', effect: 'teach-120' },
  236: { id: 236, name: 'TM37', category: 'tm', price: 0, description: 'Teaches Egg Bomb.', effect: 'teach-121' },
  237: { id: 237, name: 'TM38', category: 'tm', price: 0, description: 'Teaches Fire Blast.', effect: 'teach-126' },
  238: { id: 238, name: 'TM39', category: 'tm', price: 0, description: 'Teaches Swift.', effect: 'teach-129' },
  239: { id: 239, name: 'TM40', category: 'tm', price: 0, description: 'Teaches Skull Bash.', effect: 'teach-130' },
  240: { id: 240, name: 'TM41', category: 'tm', price: 0, description: 'Teaches Softboiled.', effect: 'teach-135' },
  241: { id: 241, name: 'TM42', category: 'tm', price: 0, description: 'Teaches Dream Eater.', effect: 'teach-138' },
  242: { id: 242, name: 'TM43', category: 'tm', price: 0, description: 'Teaches Sky Attack.', effect: 'teach-143' },
  243: { id: 243, name: 'TM44', category: 'tm', price: 0, description: 'Teaches Rest.', effect: 'teach-156' },
  244: { id: 244, name: 'TM45', category: 'tm', price: 0, description: 'Teaches Thunder Wave.', effect: 'teach-86' },
  245: { id: 245, name: 'TM46', category: 'tm', price: 0, description: 'Teaches Psywave.', effect: 'teach-149' },
  246: { id: 246, name: 'TM47', category: 'tm', price: 0, description: 'Teaches Explosion.', effect: 'teach-153' },
  247: { id: 247, name: 'TM48', category: 'tm', price: 0, description: 'Teaches Rock Slide.', effect: 'teach-157' },
  248: { id: 248, name: 'TM49', category: 'tm', price: 0, description: 'Teaches Tri Attack.', effect: 'teach-161' },
  249: { id: 249, name: 'TM50', category: 'tm', price: 0, description: 'Teaches Substitute.', effect: 'teach-164' },

  // === HMs (IDs 250-254) ===
  250: { id: 250, name: 'HM01', category: 'hm', price: 0, description: 'Teaches Cut.', effect: 'teach-15' },
  251: { id: 251, name: 'HM02', category: 'hm', price: 0, description: 'Teaches Fly.', effect: 'teach-19' },
  252: { id: 252, name: 'HM03', category: 'hm', price: 0, description: 'Teaches Surf.', effect: 'teach-57' },
  253: { id: 253, name: 'HM04', category: 'hm', price: 0, description: 'Teaches Strength.', effect: 'teach-70' },
  254: { id: 254, name: 'HM05', category: 'hm', price: 0, description: 'Teaches Flash.', effect: 'teach-148' },

  // === Misc Items (IDs 300+) ===
  300: { id: 300, name: 'Rare Candy', category: 'misc', price: 0, description: 'Raises a Pokemon by one level.', effect: 'level-up' },
  301: { id: 301, name: 'PP Up', category: 'misc', price: 0, description: 'Raises the max PP of a move.', effect: 'pp-up' },
  302: { id: 302, name: 'Calcium', category: 'misc', price: 9800, description: 'Raises Special stat.', effect: 'ev-special' },
  303: { id: 303, name: 'Iron', category: 'misc', price: 9800, description: 'Raises Defense stat.', effect: 'ev-defense' },
  304: { id: 304, name: 'Protein', category: 'misc', price: 9800, description: 'Raises Attack stat.', effect: 'ev-attack' },
  305: { id: 305, name: 'Carbos', category: 'misc', price: 9800, description: 'Raises Speed stat.', effect: 'ev-speed' },
  306: { id: 306, name: 'HP Up', category: 'misc', price: 9800, description: 'Raises HP stat.', effect: 'ev-hp' },
  307: { id: 307, name: 'Nugget', category: 'misc', price: 5000, description: 'Sell for a high price.', effect: 'sell' },
  308: { id: 308, name: 'Escape Rope', category: 'misc', price: 550, description: 'Escape from a dungeon.', effect: 'escape' },
  309: { id: 309, name: 'Repel', category: 'misc', price: 350, description: 'Repels weak wild Pokemon for 100 steps.', effect: 'repel-100' },
  310: { id: 310, name: 'Super Repel', category: 'misc', price: 500, description: 'Repels weak wild Pokemon for 200 steps.', effect: 'repel-200' },
  311: { id: 311, name: 'Max Repel', category: 'misc', price: 700, description: 'Repels weak wild Pokemon for 250 steps.', effect: 'repel-250' },
  312: { id: 312, name: 'Fresh Water', category: 'misc', price: 200, description: 'Restores 50 HP.', effect: 'heal-50' },
  313: { id: 313, name: 'Soda Pop', category: 'misc', price: 300, description: 'Restores 60 HP.', effect: 'heal-60' },
  314: { id: 314, name: 'Lemonade', category: 'misc', price: 350, description: 'Restores 80 HP.', effect: 'heal-80' },
  315: { id: 315, name: 'Ether', category: 'misc', price: 0, description: 'Restores 10 PP of one move.', effect: 'pp-10' },
  316: { id: 316, name: 'Max Ether', category: 'misc', price: 0, description: 'Fully restores PP of one move.', effect: 'pp-full' },
  317: { id: 317, name: 'Elixir', category: 'misc', price: 0, description: 'Restores 10 PP of all moves.', effect: 'pp-all-10' },
  318: { id: 318, name: 'Max Elixir', category: 'misc', price: 0, description: 'Fully restores PP of all moves.', effect: 'pp-all-full' },
};

/** Mapping of TM numbers (1-50) to move IDs */
export const TM_MOVE_MAP: Record<number, number> = {
  1: 5,    // Mega Punch
  2: 13,   // Razor Wind
  3: 14,   // Swords Dance
  4: 18,   // Whirlwind
  5: 25,   // Mega Kick
  6: 92,   // Toxic
  7: 32,   // Horn Drill
  8: 34,   // Body Slam
  9: 36,   // Take Down
  10: 38,  // Double-Edge
  11: 61,  // Bubble Beam
  12: 55,  // Water Gun
  13: 58,  // Ice Beam
  14: 59,  // Blizzard
  15: 63,  // Hyper Beam
  16: 6,   // Pay Day
  17: 66,  // Submission
  18: 68,  // Counter
  19: 69,  // Seismic Toss
  20: 99,  // Rage
  21: 72,  // Mega Drain
  22: 76,  // Solar Beam
  23: 82,  // Dragon Rage
  24: 85,  // Thunderbolt
  25: 87,  // Thunder
  26: 89,  // Earthquake
  27: 90,  // Fissure
  28: 91,  // Dig
  29: 94,  // Psychic
  30: 100, // Teleport
  31: 102, // Mimic
  32: 104, // Double Team
  33: 115, // Reflect
  34: 117, // Bide
  35: 118, // Metronome
  36: 120, // Self-Destruct
  37: 121, // Egg Bomb
  38: 126, // Fire Blast
  39: 129, // Swift
  40: 130, // Skull Bash
  41: 135, // Softboiled
  42: 138, // Dream Eater
  43: 143, // Sky Attack
  44: 156, // Rest
  45: 86,  // Thunder Wave
  46: 149, // Psywave
  47: 153, // Explosion
  48: 157, // Rock Slide
  49: 161, // Tri Attack
  50: 164, // Substitute
};

/** Mapping of HM numbers (1-5) to move IDs */
export const HM_MOVE_MAP: Record<number, number> = {
  1: 15,   // Cut
  2: 19,   // Fly
  3: 57,   // Surf
  4: 70,   // Strength
  5: 148,  // Flash
};
