import type { CompanionEntry, CompanionRelationship } from '../types';
import { COMPANION_DATA } from './companion-data';

// Pre-build lookup map for O(1) pair checks
const pairMap = new Map<string, CompanionEntry>();
for (const entry of COMPANION_DATA) {
  pairMap.set(`${entry.plantA}|${entry.plantB}`, entry);
}

function normalizeKey(a: string, b: string): string {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  return na < nb ? `${na}|${nb}` : `${nb}|${na}`;
}

/**
 * Check compatibility between two plants.
 * Returns the relationship entry or a neutral result if no data.
 */
export function checkCompatibility(plantA: string, plantB: string): {
  relationship: CompanionRelationship;
  benefit: string;
  category: string;
} {
  const key = normalizeKey(plantA, plantB);
  const entry = pairMap.get(key);
  if (entry) {
    return { relationship: entry.relationship, benefit: entry.benefit, category: entry.category };
  }
  return { relationship: 'neutral', benefit: `No known strong interaction between ${plantA} and ${plantB}.`, category: 'none' };
}

/**
 * Get all companions for a given plant.
 */
export function getCompanions(plantName: string): CompanionEntry[] {
  const name = plantName.toLowerCase().trim();
  return COMPANION_DATA.filter(
    (e) => (e.plantA === name || e.plantB === name) && e.relationship === 'companion',
  );
}

/**
 * Get all antagonists for a given plant.
 */
export function getAntagonists(plantName: string): CompanionEntry[] {
  const name = plantName.toLowerCase().trim();
  return COMPANION_DATA.filter(
    (e) => (e.plantA === name || e.plantB === name) && e.relationship === 'antagonist',
  );
}

/**
 * Search plants in the companion database by name (fuzzy prefix match).
 */
export function searchCompanionPlants(query: string): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const plants = new Set<string>();
  for (const entry of COMPANION_DATA) {
    if (entry.plantA.includes(q)) plants.add(entry.plantA);
    if (entry.plantB.includes(q)) plants.add(entry.plantB);
  }
  return [...plants].sort();
}

/**
 * Get all unique plant names in the companion database.
 */
export function getAllCompanionPlants(): string[] {
  const plants = new Set<string>();
  for (const entry of COMPANION_DATA) {
    plants.add(entry.plantA);
    plants.add(entry.plantB);
  }
  return [...plants].filter((p) => p !== 'most_plants').sort();
}
