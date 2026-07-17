import type { SaveData } from './data/game-types.ts';
import { createPokemon } from './battle/stats.ts';

const SAVE_KEY = 'pokemon-red-save';

export function hasSaveData(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function saveGame(data: SaveData): void {
  const json = JSON.stringify(data);
  localStorage.setItem(SAVE_KEY, json);
}

export function loadGame(): SaveData | null {
  const json = localStorage.getItem(SAVE_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json) as SaveData;
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function createNewSave(playerName: string, rivalName: string): SaveData {
  // Start with a Level 5 Charmander (species 4) as default starter
  const starter = createPokemon(4, 5, 'CHARMANDER');
  starter.originalTrainer = playerName;

  return {
    playerName,
    rivalName,
    party: [starter],
    pcBoxes: Array.from({ length: 12 }, () => Array(20).fill(null)),
    bag: [],
    money: 3000,
    badges: Array(8).fill(false),
    eventFlags: {},
    currentMap: 'pallet-town',
    playerX: 5,
    playerY: 4,
    playerDirection: 'down',
    playTime: 0,
    pokedexSeen: [],
    pokedexCaught: [],
    starterChoice: 0,
  };
}
