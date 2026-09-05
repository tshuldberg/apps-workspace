import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getRecipeIngredientsForDisplay,
  getRecipeStepsForDisplay,
} from '../recipe-display-content';

const RECIPE_DETAIL_FILE = path.resolve(process.cwd(), 'app', '(root)', 'recipe', '[id].tsx');

describe('recipe display content policy', () => {
  it('returns an honest empty ingredient list when demo content is hidden', () => {
    // Arrange
    const providedIngredients: string[] = [];

    // Act
    const displayedIngredients = getRecipeIngredientsForDisplay(providedIngredients, false);

    // Assert
    expect(displayedIngredients).toEqual([]);
  });

  it('returns an honest empty step list when demo content is hidden', () => {
    // Arrange
    const providedSteps: string[] = [];

    // Act
    const displayedSteps = getRecipeStepsForDisplay(providedSteps, false);

    // Assert
    expect(displayedSteps).toEqual([]);
  });

  it('returns demo ingredients for an empty demo recipe when demo content is shown', () => {
    // Arrange
    const providedIngredients: string[] = [];

    // Act
    const displayedIngredients = getRecipeIngredientsForDisplay(providedIngredients, true);

    // Assert
    expect(displayedIngredients).toContain('200g rice noodles (pad thai noodles)');
  });

  it('returns demo steps for an empty demo recipe when demo content is shown', () => {
    // Arrange
    const providedSteps: string[] = [];

    // Act
    const displayedSteps = getRecipeStepsForDisplay(providedSteps, true);

    // Assert
    expect(displayedSteps[0]).toContain('Soak rice noodles');
  });

  it('preserves chef-provided ingredients and steps in either policy branch', () => {
    // Arrange
    const ingredients = ['1 real ingredient'];
    const steps = ['1 real step'];

    // Act
    const hiddenDemoContent = {
      ingredients: getRecipeIngredientsForDisplay(ingredients, false),
      steps: getRecipeStepsForDisplay(steps, false),
    };
    const shownDemoContent = {
      ingredients: getRecipeIngredientsForDisplay(ingredients, true),
      steps: getRecipeStepsForDisplay(steps, true),
    };

    // Assert
    expect(hiddenDemoContent).toEqual({ ingredients, steps });
    expect(shownDemoContent).toEqual({ ingredients, steps });
  });
});

describe('RecipeDetailScreen fixture isolation contract', () => {
  it('renders localized honest empty states when display arrays are empty', () => {
    // Arrange
    const source = readFileSync(RECIPE_DETAIL_FILE, 'utf8');

    // Act
    const emptyStateKeys = [
      "t('The chef has not provided ingredients yet.')",
      "t('The chef has not provided steps yet.')",
    ];

    // Assert
    expect(source).toContain('displayIngredients.length > 0');
    expect(source).toContain('displaySteps.length > 0');
    for (const key of emptyStateKeys) expect(source).toContain(key);
  });

  it('uses display-only arrays only in the ingredient and step render sections', () => {
    // Arrange
    const source = readFileSync(RECIPE_DETAIL_FILE, 'utf8');

    // Act
    const displayBindings = [
      'RecipeIngredientsSection ingredients={displayIngredients}',
      'RecipeStepsSection steps={displaySteps}',
    ];

    // Assert
    for (const binding of displayBindings) expect(source).toContain(binding);
    expect(source).not.toContain('ingredients: displayIngredients');
    expect(source).not.toContain('steps: displaySteps');
  });

  it('passes only chef-provided ingredients to grocery and nutrition flows', () => {
    // Arrange
    const source = readFileSync(RECIPE_DETAIL_FILE, 'utf8');

    // Act
    const providedIngredientBindings = source.match(/ingredients: providedIngredients/g) ?? [];

    // Assert
    expect(source).toContain('ingredients={providedIngredients}');
    expect(providedIngredientBindings.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('providedIngredients.length === 0');
  });

  it('saves only chef-provided steps to the private Kitchen recipe', () => {
    // Arrange
    const source = readFileSync(RECIPE_DETAIL_FILE, 'utf8');

    // Act
    const saveCallStart = source.indexOf('const saved = saveCommunityRecipeToKitchen');
    const saveCall = source.slice(
      saveCallStart,
      source.indexOf('setSaveState(saved)', saveCallStart),
    );

    // Assert
    expect(saveCall).toContain('ingredients: providedIngredients');
    expect(saveCall).toContain('steps: providedSteps');
    expect(saveCall).not.toContain('displayIngredients');
    expect(saveCall).not.toContain('displaySteps');
  });
});
