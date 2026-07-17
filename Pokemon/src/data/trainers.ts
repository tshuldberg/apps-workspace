// === All Key Trainer Definitions ===

import type { TrainerData } from './game-types.ts';

export const TRAINERS: Record<string, TrainerData> = {
  // ========================================
  // GYM LEADERS
  // ========================================
  'gym-brock': {
    id: 'gym-brock', className: 'Gym Leader', name: 'Brock', ai: 'gym-leader', reward: 1386,
    pokemon: [
      { speciesId: 74, level: 12, moves: [33, 111] },
      { speciesId: 95, level: 14, moves: [33, 103, 20, 117] },
    ],
  },
  'gym-misty': {
    id: 'gym-misty', className: 'Gym Leader', name: 'Misty', ai: 'gym-leader', reward: 2079,
    pokemon: [
      { speciesId: 120, level: 18, moves: [33, 55, 106] },
      { speciesId: 121, level: 21, moves: [33, 55, 106, 61] },
    ],
  },
  'gym-surge': {
    id: 'gym-surge', className: 'Gym Leader', name: 'Lt. Surge', ai: 'gym-leader', reward: 2376,
    pokemon: [
      { speciesId: 100, level: 21, moves: [33, 103, 49, 120] },
      { speciesId: 25, level: 18, moves: [84, 45, 98, 86] },
      { speciesId: 26, level: 24, moves: [84, 86, 25, 129] },
    ],
  },
  'gym-erika': {
    id: 'gym-erika', className: 'Gym Leader', name: 'Erika', ai: 'gym-leader', reward: 2871,
    pokemon: [
      { speciesId: 71, level: 29, moves: [75, 77, 35, 79] },
      { speciesId: 114, level: 24, moves: [132, 20, 78, 71] },
      { speciesId: 45, level: 29, moves: [80, 78, 72, 79] },
    ],
  },
  'gym-koga': {
    id: 'gym-koga', className: 'Gym Leader', name: 'Koga', ai: 'gym-leader', reward: 4257,
    pokemon: [
      { speciesId: 109, level: 37, moves: [33, 123, 108, 120] },
      { speciesId: 89, level: 39, moves: [1, 107, 124, 103] },
      { speciesId: 109, level: 37, moves: [33, 123, 108, 120] },
      { speciesId: 110, level: 43, moves: [33, 123, 108, 153] },
    ],
  },
  'gym-sabrina': {
    id: 'gym-sabrina', className: 'Gym Leader', name: 'Sabrina', ai: 'gym-leader', reward: 4257,
    pokemon: [
      { speciesId: 64, level: 38, moves: [93, 105, 60, 134] },
      { speciesId: 122, level: 37, moves: [93, 112, 113, 3] },
      { speciesId: 49, level: 38, moves: [141, 77, 60, 79] },
      { speciesId: 65, level: 43, moves: [94, 105, 115, 134] },
    ],
  },
  'gym-blaine': {
    id: 'gym-blaine', className: 'Gym Leader', name: 'Blaine', ai: 'gym-leader', reward: 4653,
    pokemon: [
      { speciesId: 58, level: 42, moves: [52, 43, 36, 97] },
      { speciesId: 77, level: 40, moves: [52, 39, 23, 83] },
      { speciesId: 78, level: 42, moves: [52, 23, 83, 36] },
      { speciesId: 59, level: 47, moves: [52, 126, 36, 97] },
    ],
  },
  'gym-giovanni': {
    id: 'gym-giovanni', className: 'Gym Leader', name: 'Giovanni', ai: 'gym-leader', reward: 4950,
    pokemon: [
      { speciesId: 111, level: 45, moves: [30, 23, 88, 43] },
      { speciesId: 51, level: 42, moves: [10, 91, 28, 163] },
      { speciesId: 31, level: 44, moves: [33, 34, 40, 89] },
      { speciesId: 34, level: 45, moves: [30, 37, 40, 89] },
      { speciesId: 112, level: 50, moves: [30, 23, 32, 89] },
    ],
  },

  // ========================================
  // ELITE FOUR
  // ========================================
  'elite-lorelei': {
    id: 'elite-lorelei', className: 'Elite Four', name: 'Lorelei', ai: 'elite', reward: 5544,
    pokemon: [
      { speciesId: 87, level: 54, moves: [62, 156, 36, 58] },
      { speciesId: 91, level: 53, moves: [131, 128, 48, 62] },
      { speciesId: 80, level: 54, moves: [55, 133, 110, 94] },
      { speciesId: 124, level: 56, moves: [3, 142, 34, 59] },
      { speciesId: 131, level: 56, moves: [34, 109, 58, 56] },
    ],
  },
  'elite-bruno': {
    id: 'elite-bruno', className: 'Elite Four', name: 'Bruno', ai: 'elite', reward: 5742,
    pokemon: [
      { speciesId: 95, level: 53, moves: [33, 103, 20, 99] },
      { speciesId: 107, level: 55, moves: [4, 97, 7, 8] },
      { speciesId: 106, level: 55, moves: [24, 96, 27, 136] },
      { speciesId: 95, level: 56, moves: [33, 103, 21, 99] },
      { speciesId: 68, level: 58, moves: [2, 67, 69, 66] },
    ],
  },
  'elite-agatha': {
    id: 'elite-agatha', className: 'Elite Four', name: 'Agatha', ai: 'elite', reward: 5940,
    pokemon: [
      { speciesId: 94, level: 56, moves: [109, 101, 95, 138] },
      { speciesId: 42, level: 56, moves: [17, 109, 141, 114] },
      { speciesId: 93, level: 55, moves: [109, 101, 95, 138] },
      { speciesId: 24, level: 58, moves: [44, 137, 103, 51] },
      { speciesId: 94, level: 60, moves: [109, 101, 95, 138] },
    ],
  },
  'elite-lance': {
    id: 'elite-lance', className: 'Elite Four', name: 'Lance', ai: 'elite', reward: 6138,
    pokemon: [
      { speciesId: 130, level: 58, moves: [56, 82, 43, 63] },
      { speciesId: 148, level: 56, moves: [97, 21, 86, 82] },
      { speciesId: 148, level: 56, moves: [97, 21, 86, 82] },
      { speciesId: 142, level: 60, moves: [17, 97, 48, 63] },
      { speciesId: 149, level: 62, moves: [97, 21, 63, 112] },
    ],
  },

  // ========================================
  // CHAMPION VARIANTS
  // ========================================
  'champion-bulbasaur': {
    id: 'champion-bulbasaur', className: 'Champion', name: 'Blue', ai: 'elite', reward: 6930,
    pokemon: [
      { speciesId: 18, level: 61, moves: [17, 119, 28, 98] },
      { speciesId: 65, level: 59, moves: [94, 105, 115, 134] },
      { speciesId: 112, level: 61, moves: [30, 23, 89, 32] },
      { speciesId: 130, level: 61, moves: [56, 82, 43, 63] },
      { speciesId: 59, level: 63, moves: [52, 126, 43, 36] },
      { speciesId: 6, level: 65, moves: [163, 53, 43, 83] },
    ],
  },
  'champion-charmander': {
    id: 'champion-charmander', className: 'Champion', name: 'Blue', ai: 'elite', reward: 6930,
    pokemon: [
      { speciesId: 18, level: 61, moves: [17, 119, 28, 98] },
      { speciesId: 65, level: 59, moves: [94, 105, 115, 134] },
      { speciesId: 112, level: 61, moves: [30, 23, 89, 32] },
      { speciesId: 103, level: 61, moves: [140, 95, 76, 23] },
      { speciesId: 130, level: 61, moves: [56, 82, 43, 63] },
      { speciesId: 9, level: 65, moves: [55, 56, 44, 58] },
    ],
  },
  'champion-squirtle': {
    id: 'champion-squirtle', className: 'Champion', name: 'Blue', ai: 'elite', reward: 6930,
    pokemon: [
      { speciesId: 18, level: 61, moves: [17, 119, 28, 98] },
      { speciesId: 65, level: 59, moves: [94, 105, 115, 134] },
      { speciesId: 112, level: 61, moves: [30, 23, 89, 32] },
      { speciesId: 59, level: 63, moves: [52, 126, 43, 36] },
      { speciesId: 103, level: 61, moves: [140, 95, 76, 23] },
      { speciesId: 3, level: 65, moves: [75, 77, 79, 76] },
    ],
  },

  // ========================================
  // ROUTE 1 TRAINERS
  // ========================================
  // Route 1 has no trainers in the original game.

  // ========================================
  // ROUTE 2 TRAINERS
  // ========================================
  'route2-bug1': {
    id: 'route2-bug1', className: 'Bug Catcher', name: 'Rick', ai: 'basic', reward: 70,
    pokemon: [
      { speciesId: 13, level: 7 }, { speciesId: 10, level: 7 },
    ],
  },

  // ========================================
  // VIRIDIAN FOREST TRAINERS
  // ========================================
  'vforest-bug1': {
    id: 'vforest-bug1', className: 'Bug Catcher', name: 'Rick', ai: 'basic', reward: 60,
    pokemon: [
      { speciesId: 13, level: 6 }, { speciesId: 10, level: 6 },
    ],
  },
  'vforest-bug2': {
    id: 'vforest-bug2', className: 'Bug Catcher', name: 'Doug', ai: 'basic', reward: 70,
    pokemon: [
      { speciesId: 13, level: 7 }, { speciesId: 14, level: 7 }, { speciesId: 13, level: 7 },
    ],
  },
  'vforest-bug3': {
    id: 'vforest-bug3', className: 'Bug Catcher', name: 'Sammy', ai: 'basic', reward: 90,
    pokemon: [
      { speciesId: 13, level: 9 },
    ],
  },

  // ========================================
  // ROUTE 3 TRAINERS
  // ========================================
  'route3-lass1': {
    id: 'route3-lass1', className: 'Lass', name: 'Janice', ai: 'basic', reward: 135,
    pokemon: [
      { speciesId: 16, level: 9 }, { speciesId: 16, level: 9 },
    ],
  },
  'route3-youngster1': {
    id: 'route3-youngster1', className: 'Youngster', name: 'Calvin', ai: 'basic', reward: 165,
    pokemon: [
      { speciesId: 21, level: 11 },
    ],
  },
  'route3-youngster2': {
    id: 'route3-youngster2', className: 'Youngster', name: 'Ben', ai: 'basic', reward: 140,
    pokemon: [
      { speciesId: 19, level: 11 }, { speciesId: 23, level: 11 },
    ],
  },
  'route3-bug1': {
    id: 'route3-bug1', className: 'Bug Catcher', name: 'Colton', ai: 'basic', reward: 90,
    pokemon: [
      { speciesId: 10, level: 10 }, { speciesId: 13, level: 10 }, { speciesId: 10, level: 10 },
    ],
  },
  'route3-lass2': {
    id: 'route3-lass2', className: 'Lass', name: 'Sally', ai: 'basic', reward: 135,
    pokemon: [
      { speciesId: 29, level: 9 }, { speciesId: 32, level: 9 },
    ],
  },
  'route3-youngster3': {
    id: 'route3-youngster3', className: 'Youngster', name: 'Josh', ai: 'basic', reward: 150,
    pokemon: [
      { speciesId: 19, level: 10 }, { speciesId: 19, level: 10 }, { speciesId: 41, level: 10 },
    ],
  },
  'route3-bug2': {
    id: 'route3-bug2', className: 'Bug Catcher', name: 'Greg', ai: 'basic', reward: 90,
    pokemon: [
      { speciesId: 13, level: 9 }, { speciesId: 13, level: 9 }, { speciesId: 11, level: 9 },
    ],
  },
  'route3-lass3': {
    id: 'route3-lass3', className: 'Lass', name: 'Robin', ai: 'basic', reward: 145,
    pokemon: [
      { speciesId: 39, level: 11 }, { speciesId: 35, level: 11 },
    ],
  },

  // ========================================
  // MT. MOON TRAINERS
  // ========================================
  'mtmoon-bug1': {
    id: 'mtmoon-bug1', className: 'Bug Catcher', name: 'Kent', ai: 'basic', reward: 110,
    pokemon: [
      { speciesId: 13, level: 11 }, { speciesId: 14, level: 11 },
    ],
  },
  'mtmoon-lass1': {
    id: 'mtmoon-lass1', className: 'Lass', name: 'Iris', ai: 'basic', reward: 150,
    pokemon: [
      { speciesId: 35, level: 10 }, { speciesId: 35, level: 10 },
    ],
  },
  'mtmoon-hiker1': {
    id: 'mtmoon-hiker1', className: 'Hiker', name: 'Marcos', ai: 'basic', reward: 385,
    pokemon: [
      { speciesId: 74, level: 10 }, { speciesId: 74, level: 10 }, { speciesId: 95, level: 10 },
    ],
  },
  'mtmoon-rocket1': {
    id: 'mtmoon-rocket1', className: 'Team Rocket', name: 'Grunt', ai: 'smart', reward: 330,
    pokemon: [
      { speciesId: 27, level: 11 }, { speciesId: 19, level: 11 }, { speciesId: 41, level: 11 },
    ],
  },
  'mtmoon-hiker2': {
    id: 'mtmoon-hiker2', className: 'Hiker', name: 'Franklin', ai: 'basic', reward: 420,
    pokemon: [
      { speciesId: 74, level: 12 }, { speciesId: 95, level: 12 },
    ],
  },
  'mtmoon-rocket2': {
    id: 'mtmoon-rocket2', className: 'Team Rocket', name: 'Grunt', ai: 'smart', reward: 396,
    pokemon: [
      { speciesId: 41, level: 13 }, { speciesId: 23, level: 13 },
    ],
  },
  'mtmoon-super-nerd': {
    id: 'mtmoon-super-nerd', className: 'Super Nerd', name: 'Miguel', ai: 'smart', reward: 540,
    pokemon: [
      { speciesId: 81, level: 11 }, { speciesId: 100, level: 11 }, { speciesId: 81, level: 11 },
    ],
  },
  'mtmoon-rocket3': {
    id: 'mtmoon-rocket3', className: 'Team Rocket', name: 'Grunt', ai: 'smart', reward: 462,
    pokemon: [
      { speciesId: 19, level: 13 }, { speciesId: 41, level: 13 },
    ],
  },
  'mtmoon-rocket4': {
    id: 'mtmoon-rocket4', className: 'Team Rocket', name: 'Grunt', ai: 'smart', reward: 495,
    pokemon: [
      { speciesId: 19, level: 16 }, { speciesId: 41, level: 16 },
    ],
  },

  // ========================================
  // ROUTE 4 (after Mt. Moon) - no trainers
  // ========================================

  // ========================================
  // ROUTE 24 (NUGGET BRIDGE) TRAINERS
  // ========================================
  'route24-bug1': {
    id: 'route24-bug1', className: 'Bug Catcher', name: 'Cale', ai: 'basic', reward: 140,
    pokemon: [
      { speciesId: 10, level: 14 }, { speciesId: 13, level: 14 },
    ],
  },
  'route24-lass1': {
    id: 'route24-lass1', className: 'Lass', name: 'Ali', ai: 'basic', reward: 195,
    pokemon: [
      { speciesId: 16, level: 13 }, { speciesId: 29, level: 13 }, { speciesId: 16, level: 13 },
    ],
  },
  'route24-youngster1': {
    id: 'route24-youngster1', className: 'Youngster', name: 'Timmy', ai: 'basic', reward: 210,
    pokemon: [
      { speciesId: 27, level: 14 }, { speciesId: 23, level: 14 },
    ],
  },
  'route24-lass2': {
    id: 'route24-lass2', className: 'Lass', name: 'Reli', ai: 'basic', reward: 210,
    pokemon: [
      { speciesId: 29, level: 14 }, { speciesId: 29, level: 14 },
    ],
  },
  'route24-jr-trainer1': {
    id: 'route24-jr-trainer1', className: 'Jr. Trainer M', name: 'Ethan', ai: 'smart', reward: 260,
    pokemon: [
      { speciesId: 56, level: 14 },
    ],
  },
  'route24-rocket1': {
    id: 'route24-rocket1', className: 'Team Rocket', name: 'Grunt', ai: 'smart', reward: 550,
    pokemon: [
      { speciesId: 23, level: 15 }, { speciesId: 41, level: 15 },
    ],
  },

  // ========================================
  // ROUTE 25 TRAINERS
  // ========================================
  'route25-hiker1': {
    id: 'route25-hiker1', className: 'Hiker', name: 'Nob', ai: 'basic', reward: 490,
    pokemon: [
      { speciesId: 74, level: 13 }, { speciesId: 74, level: 13 }, { speciesId: 95, level: 13 },
    ],
  },
  'route25-youngster1': {
    id: 'route25-youngster1', className: 'Youngster', name: 'Dan', ai: 'basic', reward: 210,
    pokemon: [
      { speciesId: 80, level: 14 },
    ],
  },
  'route25-lass1': {
    id: 'route25-lass1', className: 'Lass', name: 'Haley', ai: 'basic', reward: 195,
    pokemon: [
      { speciesId: 43, level: 13 }, { speciesId: 16, level: 13 },
    ],
  },
  'route25-hiker2': {
    id: 'route25-hiker2', className: 'Hiker', name: 'Lenny', ai: 'basic', reward: 525,
    pokemon: [
      { speciesId: 74, level: 15 }, { speciesId: 95, level: 15 },
    ],
  },

  // ========================================
  // ROUTE 5/6 TRAINERS
  // ========================================
  'route6-bug1': {
    id: 'route6-bug1', className: 'Bug Catcher', name: 'Keigo', ai: 'basic', reward: 160,
    pokemon: [
      { speciesId: 13, level: 16 }, { speciesId: 10, level: 16 }, { speciesId: 13, level: 16 },
    ],
  },
  'route6-jr-trainer1': {
    id: 'route6-jr-trainer1', className: 'Jr. Trainer F', name: 'Raina', ai: 'basic', reward: 350,
    pokemon: [
      { speciesId: 19, level: 16 }, { speciesId: 25, level: 16 },
    ],
  },
  'route6-youngster1': {
    id: 'route6-youngster1', className: 'Youngster', name: 'Dillon', ai: 'basic', reward: 255,
    pokemon: [
      { speciesId: 29, level: 17 }, { speciesId: 32, level: 17 },
    ],
  },

  // ========================================
  // S.S. ANNE TRAINERS
  // ========================================
  'ssanne-sailor1': {
    id: 'ssanne-sailor1', className: 'Sailor', name: 'Trevor', ai: 'basic', reward: 525,
    pokemon: [
      { speciesId: 66, level: 17 }, { speciesId: 66, level: 17 },
    ],
  },
  'ssanne-gentleman1': {
    id: 'ssanne-gentleman1', className: 'Gentleman', name: 'Arthur', ai: 'smart', reward: 1540,
    pokemon: [
      { speciesId: 58, level: 18 }, { speciesId: 77, level: 18 },
    ],
  },

  // ========================================
  // ROUTE 9/10 TRAINERS
  // ========================================
  'route9-jr-trainer1': {
    id: 'route9-jr-trainer1', className: 'Jr. Trainer F', name: 'Emma', ai: 'basic', reward: 400,
    pokemon: [
      { speciesId: 32, level: 20 }, { speciesId: 29, level: 20 },
    ],
  },
  'route9-hiker1': {
    id: 'route9-hiker1', className: 'Hiker', name: 'Jeremy', ai: 'basic', reward: 665,
    pokemon: [
      { speciesId: 66, level: 19 }, { speciesId: 95, level: 19 },
    ],
  },
  'route9-bug1': {
    id: 'route9-bug1', className: 'Bug Catcher', name: 'Brent', ai: 'basic', reward: 200,
    pokemon: [
      { speciesId: 15, level: 20 }, { speciesId: 14, level: 20 },
    ],
  },
  'route10-hiker1': {
    id: 'route10-hiker1', className: 'Hiker', name: 'Clark', ai: 'basic', reward: 700,
    pokemon: [
      { speciesId: 74, level: 20 }, { speciesId: 95, level: 20 },
    ],
  },
  'route10-youngster1': {
    id: 'route10-youngster1', className: 'Youngster', name: 'Chad', ai: 'basic', reward: 315,
    pokemon: [
      { speciesId: 23, level: 21 },
    ],
  },

  // ========================================
  // RIVAL ENCOUNTERS
  // ========================================
  'rival-oak-lab': {
    id: 'rival-oak-lab', className: 'Rival', name: 'Blue', ai: 'smart', reward: 175,
    pokemon: [
      { speciesId: 4, level: 5 }, // Will be set based on player starter
    ],
  },
  'rival-route22-early': {
    id: 'rival-route22-early', className: 'Rival', name: 'Blue', ai: 'smart', reward: 280,
    pokemon: [
      { speciesId: 16, level: 9 },
      { speciesId: 4, level: 9 }, // Starter-dependent
    ],
  },
  'rival-cerulean': {
    id: 'rival-cerulean', className: 'Rival', name: 'Blue', ai: 'smart', reward: 500,
    pokemon: [
      { speciesId: 16, level: 18 },
      { speciesId: 19, level: 15 },
      { speciesId: 63, level: 15 },
      { speciesId: 5, level: 17 }, // Starter-dependent
    ],
  },

  // ========================================
  // ADDITIONAL ROUTE TRAINERS (filling to 50+ regular trainers)
  // ========================================
  'route4-lass1': {
    id: 'route4-lass1', className: 'Lass', name: 'Crissy', ai: 'basic', reward: 165,
    pokemon: [
      { speciesId: 32, level: 11 }, { speciesId: 29, level: 11 },
    ],
  },
  'vforest-bug4': {
    id: 'vforest-bug4', className: 'Bug Catcher', name: 'Anthony', ai: 'basic', reward: 80,
    pokemon: [
      { speciesId: 10, level: 7 }, { speciesId: 14, level: 7 }, { speciesId: 10, level: 8 },
    ],
  },
  'route3-youngster4': {
    id: 'route3-youngster4', className: 'Youngster', name: 'Tommy', ai: 'basic', reward: 140,
    pokemon: [
      { speciesId: 19, level: 9 }, { speciesId: 19, level: 9 },
    ],
  },
  'route3-bug3': {
    id: 'route3-bug3', className: 'Bug Catcher', name: 'James', ai: 'basic', reward: 100,
    pokemon: [
      { speciesId: 10, level: 11 }, { speciesId: 11, level: 11 },
    ],
  },
  'mtmoon-lass2': {
    id: 'mtmoon-lass2', className: 'Lass', name: 'Miriam', ai: 'basic', reward: 160,
    pokemon: [
      { speciesId: 39, level: 11 }, { speciesId: 43, level: 11 },
    ],
  },
  'mtmoon-hiker3': {
    id: 'mtmoon-hiker3', className: 'Hiker', name: 'Allen', ai: 'basic', reward: 455,
    pokemon: [
      { speciesId: 74, level: 11 }, { speciesId: 74, level: 11 },
    ],
  },
  'route6-lass1': {
    id: 'route6-lass1', className: 'Lass', name: 'Dana', ai: 'basic', reward: 240,
    pokemon: [
      { speciesId: 43, level: 16 }, { speciesId: 39, level: 16 },
    ],
  },
  'route6-youngster2': {
    id: 'route6-youngster2', className: 'Youngster', name: 'Joey', ai: 'basic', reward: 240,
    pokemon: [
      { speciesId: 19, level: 16 },
    ],
  },
  'route9-youngster1': {
    id: 'route9-youngster1', className: 'Youngster', name: 'Dave', ai: 'basic', reward: 285,
    pokemon: [
      { speciesId: 27, level: 19 }, { speciesId: 19, level: 19 },
    ],
  },
  'route9-lass1': {
    id: 'route9-lass1', className: 'Lass', name: 'Shannon', ai: 'basic', reward: 285,
    pokemon: [
      { speciesId: 29, level: 19 }, { speciesId: 29, level: 19 },
    ],
  },
  'route10-lass1': {
    id: 'route10-lass1', className: 'Lass', name: 'Terry', ai: 'basic', reward: 300,
    pokemon: [
      { speciesId: 16, level: 20 }, { speciesId: 29, level: 20 },
    ],
  },
  'route10-hiker2': {
    id: 'route10-hiker2', className: 'Hiker', name: 'Trent', ai: 'basic', reward: 735,
    pokemon: [
      { speciesId: 95, level: 21 }, { speciesId: 74, level: 21 },
    ],
  },
};
