import { describe, it, expect } from 'vitest';
import type { Recipe, StructuredIngredient, Step } from '../../types';
import { generatePrintHtml } from '../recipe-template';

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    title: 'Test Recipe',
    description: 'A test recipe',
    servings: 4,
    prep_time_mins: 15,
    cook_time_mins: 30,
    total_time_mins: 45,
    difficulty: 'medium',
    source_url: null,
    source_submission_id: null,
    source_chef_id: null,
    source_chef_name: null,
    source_chef_handle: null,
    image_uri: null,
    is_favorite: 0,
    rating: 0,
    notes: 'Some notes here',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeIngredient(overrides: Partial<StructuredIngredient> = {}): StructuredIngredient {
  return {
    id: 'i1',
    recipe_id: 'r1',
    section: null,
    quantity_value: 2,
    quantity: '2',
    unit: 'cups',
    item: 'flour',
    name: 'flour',
    prep_note: null,
    is_optional: 0,
    sort_order: 0,
    ...overrides,
  };
}

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: 's1',
    recipe_id: 'r1',
    step_number: 1,
    instruction: 'Mix ingredients',
    timer_minutes: null,
    sort_order: 0,
    ...overrides,
  };
}

describe('generatePrintHtml', () => {
  it('includes recipe title in output', () => {
    const html = generatePrintHtml(makeRecipe(), [makeIngredient()], [makeStep()], ['italian']);
    expect(html).toContain('Test Recipe');
  });

  it('includes all ingredients with formatted quantities', () => {
    const ingredients = [
      makeIngredient({ id: 'i1', quantity_value: 0.5, unit: 'cup', item: 'sugar' }),
      makeIngredient({ id: 'i2', quantity_value: 2, unit: 'tbsp', item: 'butter' }),
    ];
    const html = generatePrintHtml(makeRecipe(), ingredients, [makeStep()], []);
    expect(html).toContain('1/2');
    expect(html).toContain('sugar');
    expect(html).toContain('2');
    expect(html).toContain('butter');
  });

  it('includes numbered steps', () => {
    const steps = [
      makeStep({ id: 's1', instruction: 'Preheat oven', sort_order: 0 }),
      makeStep({ id: 's2', instruction: 'Mix flour and sugar', sort_order: 1 }),
    ];
    const html = generatePrintHtml(makeRecipe(), [makeIngredient()], steps, []);
    expect(html).toContain('Preheat oven');
    expect(html).toContain('Mix flour and sugar');
    expect(html).toContain('<ol');
  });

  it('omits description section when description is null', () => {
    const html = generatePrintHtml(makeRecipe({ description: null }), [], [], []);
    expect(html).not.toContain('A test recipe');
  });

  it('omits notes section when notes is null', () => {
    const html = generatePrintHtml(makeRecipe({ notes: null }), [], [], []);
    expect(html).not.toContain('Notes');
    expect(html).not.toContain('Some notes here');
  });

  it('renders section headers when ingredients have sections', () => {
    const ingredients = [
      makeIngredient({ id: 'i1', section: 'For the sauce', item: 'tomato' }),
      makeIngredient({ id: 'i2', section: 'For the dough', item: 'flour' }),
    ];
    const html = generatePrintHtml(makeRecipe(), ingredients, [], []);
    expect(html).toContain('For the sauce');
    expect(html).toContain('For the dough');
  });

  it('includes recipe photo when includePhoto option is true', () => {
    const recipe = makeRecipe({ image_uri: 'https://example.com/photo.jpg' });
    const html = generatePrintHtml(recipe, [], [], [], { includePhoto: true });
    expect(html).toContain('https://example.com/photo.jpg');
    expect(html).toContain('<img');
  });

  it('omits recipe photo when includePhoto option is false (default)', () => {
    const recipe = makeRecipe({ image_uri: 'https://example.com/photo.jpg' });
    const html = generatePrintHtml(recipe, [], [], []);
    expect(html).not.toContain('<img');
  });

  it('includes metadata row (times, servings, difficulty)', () => {
    const html = generatePrintHtml(makeRecipe(), [], [], []);
    expect(html).toContain('Prep: 15 min');
    expect(html).toContain('Cook: 30 min');
    expect(html).toContain('Serves: 4');
    expect(html).toContain('Difficulty: medium');
  });

  it('handles empty ingredients array', () => {
    const html = generatePrintHtml(makeRecipe(), [], [makeStep()], []);
    expect(html).toContain('No ingredients listed');
  });

  it('handles empty steps array', () => {
    const html = generatePrintHtml(makeRecipe(), [makeIngredient()], [], []);
    expect(html).toContain('No steps listed');
  });

  it('includes print date in footer', () => {
    const html = generatePrintHtml(makeRecipe(), [], [], []);
    expect(html).toContain('Printed from MyLife');
  });
});
