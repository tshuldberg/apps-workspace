// === Gen 1 Type System ===

export const TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic',
  'Bug', 'Rock', 'Ghost', 'Dragon',
] as const;

export type Type = typeof TYPES[number];

// Type effectiveness chart: EFFECTIVENESS[attacking][defending] = multiplier
// 0 = immune, 0.5 = not very effective, 1 = normal, 2 = super effective
// Gen 1 specific: Ghost has NO EFFECT on Psychic (bug), Bug SE on Poison, Poison SE on Bug
const E: Record<Type, Partial<Record<Type, number>>> = {
  Normal:   { Rock: 0.5, Ghost: 0 },
  Fire:     { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5 },
  Water:    { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass:    { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5 },
  Ice:      { Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0 },
  Poison:   { Grass: 2, Poison: 0.5, Ground: 0.5, Bug: 2, Rock: 0.5, Ghost: 0.5 },
  Ground:   { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2 },
  Flying:   { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5 },
  Psychic:  { Fighting: 2, Poison: 2, Psychic: 0.5 },
  Bug:      { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 2, Flying: 0.5, Psychic: 2, Ghost: 0.5 },
  Rock:     { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2 },
  Ghost:    { Normal: 0, Ghost: 2, Psychic: 0 },
  Dragon:   { Dragon: 2 },
};

/** Get type effectiveness multiplier for an attacking type vs a single defending type */
export function getTypeEffectiveness(attacking: Type, defending: Type): number {
  return E[attacking]?.[defending] ?? 1;
}

/** Get combined type effectiveness for an attacking type vs one or two defending types */
export function getEffectiveness(attacking: Type, defending: readonly Type[]): number {
  let mult = 1;
  for (const def of defending) {
    mult *= getTypeEffectiveness(attacking, def);
  }
  return mult;
}

/** In Gen 1, physical/special is determined by TYPE, not by individual move */
export const SPECIAL_TYPES: ReadonlySet<Type> = new Set([
  'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Psychic', 'Dragon',
]);

export function isSpecialType(type: Type): boolean {
  return SPECIAL_TYPES.has(type);
}
