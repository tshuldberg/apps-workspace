/**
 * Seed data for the dining module.
 * Provides 30 default cuisine tags.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { createTag } from './crud/tags';

interface SeedTag {
  name: string;
  color: string;
}

const CUISINE_SEEDS: SeedTag[] = [
  { name: 'Italian', color: '#E74C3C' },
  { name: 'Japanese', color: '#E84393' },
  { name: 'Mexican', color: '#F39C12' },
  { name: 'French', color: '#3498DB' },
  { name: 'Chinese', color: '#E67E22' },
  { name: 'Thai', color: '#27AE60' },
  { name: 'Indian', color: '#D35400' },
  { name: 'Korean', color: '#8E44AD' },
  { name: 'Vietnamese', color: '#1ABC9C' },
  { name: 'Mediterranean', color: '#2980B9' },
  { name: 'American', color: '#2C3E50' },
  { name: 'BBQ', color: '#C0392B' },
  { name: 'Steakhouse', color: '#7B241C' },
  { name: 'Seafood', color: '#2471A3' },
  { name: 'Pizza', color: '#CB4335' },
  { name: 'Sushi', color: '#EC7063' },
  { name: 'Tapas', color: '#CA6F1E' },
  { name: 'Greek', color: '#1F618D' },
  { name: 'Spanish', color: '#B7950B' },
  { name: 'Middle Eastern', color: '#AF601A' },
  { name: 'Ethiopian', color: '#196F3D' },
  { name: 'Vegan', color: '#28B463' },
  { name: 'Vegetarian', color: '#82E0AA' },
  { name: 'Gluten-Free', color: '#F4D03F' },
  { name: 'Brunch', color: '#F5B041' },
  { name: 'Pub Food', color: '#5D6D7E' },
  { name: 'Wine Bar', color: '#6C3483' },
  { name: 'Cocktail Bar', color: '#A569BD' },
  { name: 'Coffee', color: '#6E2C00' },
  { name: 'Bakery', color: '#D4AC0D' },
];

/**
 * Seed the default cuisine tags into the database.
 * Uses INSERT OR IGNORE semantics via the UNIQUE constraint on name,
 * so calling this multiple times is safe.
 */
export function seedCuisineTags(
  db: DatabaseAdapter,
  generateId: () => string,
): void {
  for (const seed of CUISINE_SEEDS) {
    try {
      createTag(db, generateId(), {
        name: seed.name,
        color: seed.color,
        kind: 'cuisine',
      });
    } catch {
      // Tag already exists (UNIQUE constraint on name), skip
    }
  }
}

export { CUISINE_SEEDS };
