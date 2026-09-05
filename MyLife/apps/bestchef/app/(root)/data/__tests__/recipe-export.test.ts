import { describe, expect, it } from 'vitest';
import type { Ingredient, Recipe, Step } from '@mylife/bestchef';
import {
  buildSavedRecipePlainText,
  buildSavedRecipePrintHtml,
  savedRecipeAttribution,
} from '../recipe-export';

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    title: 'Pad Thai Night',
    description: 'A less salty weeknight version.',
    servings: 2,
    prep_time_mins: 20,
    cook_time_mins: 8,
    total_time_mins: 28,
    difficulty: 'easy',
    source_url: 'https://bestchef.app/recipe/submission-pad-thai',
    source_submission_id: 'submission-pad-thai',
    source_chef_id: 'chef-1',
    source_chef_name: 'Somchai K.',
    source_chef_handle: 'somchai_bkk',
    image_uri: 'https://cdn.bestchef.app/pad-thai.jpg',
    is_favorite: 1,
    rating: 0,
    notes: null,
    created_at: '2026-04-27T00:00:00.000Z',
    updated_at: '2026-04-27T01:00:00.000Z',
    ...overrides,
  };
}

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: 'ingredient-1',
    recipe_id: 'recipe-1',
    name: '2 tbsp fish sauce',
    quantity: '2',
    unit: 'tbsp',
    sort_order: 0,
    section: null,
    quantity_value: 2,
    item: 'fish sauce',
    prep_note: null,
    is_optional: 0,
    ...overrides,
  };
}

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: 'step-1',
    recipe_id: 'recipe-1',
    step_number: 1,
    instruction: 'Toss sauce for 8 minutes',
    timer_minutes: 8,
    sort_order: 0,
    section: null,
    ...overrides,
  };
}

describe('saved recipe export helpers', () => {
  it('builds chef attribution from source handles', () => {
    expect(savedRecipeAttribution(makeRecipe())).toBe('Saved from @somchai_bkk');
    expect(savedRecipeAttribution(makeRecipe({ source_chef_handle: null }))).toBe('Saved from Somchai K.');
    expect(savedRecipeAttribution(makeRecipe({
      source_chef_handle: null,
      source_chef_name: null,
    }))).toBe('Source: https://bestchef.app/recipe/submission-pad-thai');
  });

  it('renders plain text without markup', () => {
    const text = buildSavedRecipePlainText({
      recipe: makeRecipe(),
      ingredients: [
        makeIngredient(),
        makeIngredient({ id: 'ingredient-2', name: '200 g rice noodles', quantity: '200', unit: 'g', item: 'rice noodles' }),
      ],
      steps: [makeStep()],
    });

    expect(text).toContain('Pad Thai Night');
    expect(text).toContain('Saved from @somchai_bkk');
    expect(text).toContain('Photo: https://cdn.bestchef.app/pad-thai.jpg');
    expect(text).toContain('- 2 tbsp fish sauce');
    expect(text).toContain('1. Toss sauce for 8 minutes');
    expect(text).not.toMatch(/<\/?[a-z][\s\S]*>/i);
  });

  it('renders print HTML with photo, attribution, and page sizing styles', () => {
    const html = buildSavedRecipePrintHtml({
      recipe: makeRecipe({ title: 'Pad <Thai> & Sauce' }),
      ingredients: [makeIngredient()],
      steps: [makeStep()],
    });

    expect(html).toContain('@page { size: auto; margin: 0.65in; }');
    expect(html).toContain('max-width: 7.25in');
    expect(html).toContain('Pad &lt;Thai&gt; &amp; Sauce');
    expect(html).toContain('Saved from @somchai_bkk');
    expect(html).toContain('https://cdn.bestchef.app/pad-thai.jpg');
    expect(html).toContain('<ul><li>2 tbsp fish sauce</li></ul>');
    expect(html).toContain('<ol><li>Toss sauce for 8 minutes</li></ol>');
  });
});
