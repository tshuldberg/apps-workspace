import { describe, it, expect } from 'vitest';
import { getTypeEffectiveness, getEffectiveness } from '../src/data/types.ts';

describe('Type effectiveness chart', () => {
  // Standard matchups
  it('Fire is super effective vs Grass', () => {
    expect(getTypeEffectiveness('Fire', 'Grass')).toBe(2);
  });

  it('Water is super effective vs Fire', () => {
    expect(getTypeEffectiveness('Water', 'Fire')).toBe(2);
  });

  it('Grass is super effective vs Water', () => {
    expect(getTypeEffectiveness('Grass', 'Water')).toBe(2);
  });

  it('Electric is super effective vs Water', () => {
    expect(getTypeEffectiveness('Electric', 'Water')).toBe(2);
  });

  it('Ground is immune to Electric', () => {
    expect(getTypeEffectiveness('Electric', 'Ground')).toBe(0);
  });

  it('Normal is immune to Ghost', () => {
    expect(getTypeEffectiveness('Normal', 'Ghost')).toBe(0);
  });

  it('Ghost is immune to Normal', () => {
    expect(getTypeEffectiveness('Ghost', 'Normal')).toBe(0);
  });

  it('Fighting is immune to Ghost', () => {
    expect(getTypeEffectiveness('Fighting', 'Ghost')).toBe(0);
  });

  // Gen 1 specific quirks
  it('Ghost has NO EFFECT on Psychic (Gen 1 bug)', () => {
    expect(getTypeEffectiveness('Ghost', 'Psychic')).toBe(0);
  });

  it('Bug is super effective vs Poison (Gen 1)', () => {
    expect(getTypeEffectiveness('Bug', 'Poison')).toBe(2);
  });

  it('Poison is super effective vs Bug (Gen 1)', () => {
    expect(getTypeEffectiveness('Poison', 'Bug')).toBe(2);
  });

  it('Psychic is super effective vs Poison', () => {
    expect(getTypeEffectiveness('Psychic', 'Poison')).toBe(2);
  });

  // Dual-type effectiveness
  it('Ice is 4x effective vs Dragonite (Dragon/Flying)', () => {
    expect(getEffectiveness('Ice', ['Dragon', 'Flying'])).toBe(4);
  });

  it('Electric is 0x vs Geodude (Rock/Ground)', () => {
    expect(getEffectiveness('Electric', ['Rock', 'Ground'])).toBe(0);
  });

  it('Grass is 0.25x vs Charizard (Fire/Flying)', () => {
    expect(getEffectiveness('Grass', ['Fire', 'Flying'])).toBe(0.25);
  });

  it('Normal vs Normal is 1x', () => {
    expect(getTypeEffectiveness('Normal', 'Normal')).toBe(1);
  });

  // Resistances
  it('Fire resists Fire', () => {
    expect(getTypeEffectiveness('Fire', 'Fire')).toBe(0.5);
  });

  it('Water resists Water', () => {
    expect(getTypeEffectiveness('Water', 'Water')).toBe(0.5);
  });

  it('Dragon resists all starter types? No, Dragon resists Fire/Water/Electric/Grass', () => {
    expect(getTypeEffectiveness('Fire', 'Dragon')).toBe(0.5);
    expect(getTypeEffectiveness('Water', 'Dragon')).toBe(0.5);
    expect(getTypeEffectiveness('Electric', 'Dragon')).toBe(0.5);
    expect(getTypeEffectiveness('Grass', 'Dragon')).toBe(0.5);
  });
});
