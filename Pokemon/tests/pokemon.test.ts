import { describe, it, expect } from 'vitest';
import { POKEMON } from '../src/data/pokemon.ts';
import { MOVES } from '../src/data/moves.ts';
import { TYPES } from '../src/data/types.ts';

describe('Pokemon data', () => {
  const pokemonIds = Object.keys(POKEMON).map(Number);
  const validTypes = new Set(TYPES);

  it('has all 151 Pokemon', () => {
    expect(pokemonIds.length).toBe(151);
  });

  it('has IDs from 1 to 151', () => {
    for (let i = 1; i <= 151; i++) {
      expect(POKEMON[i]).toBeDefined();
      expect(POKEMON[i].id).toBe(i);
    }
  });

  it('every Pokemon has valid types', () => {
    for (const poke of Object.values(POKEMON)) {
      expect(poke.types.length).toBeGreaterThanOrEqual(1);
      expect(poke.types.length).toBeLessThanOrEqual(2);
      for (const t of poke.types) {
        expect(validTypes.has(t)).toBe(true);
      }
    }
  });

  it('every Pokemon has positive base stats', () => {
    for (const poke of Object.values(POKEMON)) {
      expect(poke.baseStats.hp).toBeGreaterThan(0);
      expect(poke.baseStats.attack).toBeGreaterThan(0);
      expect(poke.baseStats.defense).toBeGreaterThan(0);
      expect(poke.baseStats.special).toBeGreaterThan(0);
      expect(poke.baseStats.speed).toBeGreaterThan(0);
    }
  });

  it('every Pokemon has valid catch rate', () => {
    for (const poke of Object.values(POKEMON)) {
      expect(poke.catchRate).toBeGreaterThanOrEqual(0);
      expect(poke.catchRate).toBeLessThanOrEqual(255);
    }
  });

  it('every Pokemon has a valid growth rate', () => {
    const validRates = new Set(['fast', 'medium-fast', 'medium-slow', 'slow']);
    for (const poke of Object.values(POKEMON)) {
      expect(validRates.has(poke.growthRate)).toBe(true);
    }
  });

  it('learnset move IDs reference valid moves', () => {
    for (const poke of Object.values(POKEMON)) {
      for (const entry of poke.learnset) {
        expect(MOVES[entry.moveId]).toBeDefined();
      }
    }
  });

  it('evolution targets reference valid Pokemon', () => {
    for (const poke of Object.values(POKEMON)) {
      if (poke.evolution) {
        expect(POKEMON[poke.evolution.into]).toBeDefined();
      }
    }
  });

  // Specific Pokemon spot checks
  it('Bulbasaur has correct data', () => {
    const bulbasaur = POKEMON[1];
    expect(bulbasaur.name).toBe('Bulbasaur');
    expect(bulbasaur.types).toEqual(['Grass', 'Poison']);
    expect(bulbasaur.baseStats.hp).toBe(45);
    expect(bulbasaur.baseStats.attack).toBe(49);
    expect(bulbasaur.baseStats.defense).toBe(49);
    expect(bulbasaur.baseStats.special).toBe(65);
    expect(bulbasaur.baseStats.speed).toBe(45);
    expect(bulbasaur.evolution).toEqual({ method: 'level', level: 16, into: 2 });
  });

  it('Pikachu has correct data', () => {
    const pikachu = POKEMON[25];
    expect(pikachu.name).toBe('Pikachu');
    expect(pikachu.types).toEqual(['Electric']);
    expect(pikachu.baseStats.hp).toBe(35);
    expect(pikachu.baseStats.attack).toBe(55);
    expect(pikachu.baseStats.defense).toBe(30);
    expect(pikachu.baseStats.special).toBe(50);
    expect(pikachu.baseStats.speed).toBe(90);
    expect(pikachu.evolution).toEqual({ method: 'stone', stone: 'Thunder Stone', into: 26 });
  });

  it('Mewtwo has correct data', () => {
    const mewtwo = POKEMON[150];
    expect(mewtwo.name).toBe('Mewtwo');
    expect(mewtwo.types).toEqual(['Psychic']);
    expect(mewtwo.baseStats.hp).toBe(106);
    expect(mewtwo.baseStats.attack).toBe(110);
    expect(mewtwo.baseStats.defense).toBe(90);
    expect(mewtwo.baseStats.special).toBe(154);
    expect(mewtwo.baseStats.speed).toBe(130);
    expect(mewtwo.evolution).toBeNull();
  });

  it('Mew has correct data', () => {
    const mew = POKEMON[151];
    expect(mew.name).toBe('Mew');
    expect(mew.types).toEqual(['Psychic']);
    expect(mew.baseStats.hp).toBe(100);
    expect(mew.baseStats.attack).toBe(100);
    expect(mew.baseStats.defense).toBe(100);
    expect(mew.baseStats.special).toBe(100);
    expect(mew.baseStats.speed).toBe(100);
  });

  it('Charizard is Fire/Flying', () => {
    expect(POKEMON[6].types).toEqual(['Fire', 'Flying']);
  });

  it('Gyarados is Water/Flying', () => {
    expect(POKEMON[130].types).toEqual(['Water', 'Flying']);
  });

  it('Snorlax has 160 base HP', () => {
    expect(POKEMON[143].baseStats.hp).toBe(160);
  });

  it('Chansey has 250 base HP and 5 Attack/Defense', () => {
    expect(POKEMON[113].baseStats.hp).toBe(250);
    expect(POKEMON[113].baseStats.attack).toBe(5);
    expect(POKEMON[113].baseStats.defense).toBe(5);
  });

  it('Mew can learn all TMs', () => {
    expect(POKEMON[151].tmMoves.length).toBe(50);
  });
});
