import { describe, it, expect } from 'vitest';
import { parseRecipeFromText } from '../text-parser';

describe('parseRecipeFromText', () => {
  describe('standard recipe with headers', () => {
    it('parses recipe with Ingredients and Instructions sections', () => {
      const text = `
Chocolate Chip Cookies

Ingredients:
2 cups all-purpose flour
1 cup butter
1 cup sugar
2 large eggs

Instructions:
1. Preheat oven to 375F.
2. Mix flour and butter.
3. Add sugar and eggs.
4. Bake for 12 minutes.
      `;

      const result = parseRecipeFromText(text);
      expect(result.title).toBe('Chocolate Chip Cookies');
      expect(result.ingredients).toEqual([
        '2 cups all-purpose flour',
        '1 cup butter',
        '1 cup sugar',
        '2 large eggs',
      ]);
      expect(result.steps).toEqual([
        'Preheat oven to 375F.',
        'Mix flour and butter.',
        'Add sugar and eggs.',
        'Bake for 12 minutes.',
      ]);
    });
  });

  describe('alternate section header names', () => {
    it('parses recipe with "Directions" instead of "Instructions"', () => {
      const text = `
Pasta Salad

Ingredients
1 lb pasta
1 cup cherry tomatoes

Directions
Cook pasta according to package directions.
Toss with tomatoes.
      `;

      const result = parseRecipeFromText(text);
      expect(result.title).toBe('Pasta Salad');
      expect(result.ingredients).toHaveLength(2);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0]).toBe('Cook pasta according to package directions.');
    });

    it('parses recipe with "Method" section', () => {
      const text = `
Simple Soup

Ingredients:
1 onion
2 cups broth

Method:
Saute the onion.
Add broth and simmer.
      `;

      const result = parseRecipeFromText(text);
      expect(result.steps).toEqual([
        'Saute the onion.',
        'Add broth and simmer.',
      ]);
    });
  });

  describe('metadata extraction', () => {
    it('extracts prep time and cook time from header area', () => {
      const text = `
Grilled Chicken
Prep: 15 minutes
Cook time: 30 min

Ingredients:
2 chicken breasts

Instructions:
Grill until done.
      `;

      const result = parseRecipeFromText(text);
      expect(result.title).toBe('Grilled Chicken');
      expect(result.prep_time_min).toBe(15);
      expect(result.cook_time_min).toBe(30);
    });

    it('extracts servings from header area', () => {
      const text = `
Bean Soup
Serves 6

Ingredients:
2 cans beans
4 cups broth

Instructions:
Combine and simmer.
      `;

      const result = parseRecipeFromText(text);
      expect(result.servings).toBe(6);
    });

    it('extracts "Servings:" format', () => {
      const text = `
Quick Rice
Servings: 4

Ingredients:
2 cups rice

Instructions:
Cook rice.
      `;

      const result = parseRecipeFromText(text);
      expect(result.servings).toBe(4);
    });

    it('extracts "Makes" format', () => {
      const text = `
Muffins
Makes 12

Ingredients:
2 cups flour

Instructions:
Bake at 350.
      `;

      const result = parseRecipeFromText(text);
      expect(result.servings).toBe(12);
    });
  });

  describe('heuristic mode (no section headers)', () => {
    it('uses heuristic when no headers are present', () => {
      const text = `
Quick Guacamole
A simple dip recipe
2 avocados
1 lime
1/2 tsp salt
Mash avocados. Squeeze lime. Add salt and stir. Serve immediately with chips.
      `;

      const result = parseRecipeFromText(text);
      expect(result.title).toBe('Quick Guacamole');
      expect(result.description).toBe('A simple dip recipe');
      expect(result.ingredients).toContain('2 avocados');
      expect(result.ingredients).toContain('1 lime');
      expect(result.ingredients).toContain('1/2 tsp salt');
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('identifies bullet-prefixed lines as ingredients', () => {
      const text = `
Smoothie
- 1 banana
- 1 cup milk
- 1 tbsp honey
Blend everything until smooth.
      `;

      const result = parseRecipeFromText(text);
      expect(result.ingredients).toEqual([
        '1 banana',
        '1 cup milk',
        '1 tbsp honey',
      ]);
      expect(result.steps).toHaveLength(1);
    });
  });

  describe('decoration characters', () => {
    it('strips decoration characters from lines', () => {
      const text = `
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Classic Pancakes
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Ingredients:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
2 cups flour
1 cup milk

Instructions:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
Mix and cook on griddle.
      `;

      const result = parseRecipeFromText(text);
      expect(result.title).toBe('Classic Pancakes');
      expect(result.ingredients).toEqual(['2 cups flour', '1 cup milk']);
      expect(result.steps).toEqual(['Mix and cook on griddle.']);
    });
  });

  describe('step numbering', () => {
    it('strips "1." style numbering from steps', () => {
      const text = `
Toast

Ingredients:
1 slice bread

Instructions:
1. Place bread in toaster.
2. Wait until golden.
3. Remove and butter.
      `;

      const result = parseRecipeFromText(text);
      expect(result.steps).toEqual([
        'Place bread in toaster.',
        'Wait until golden.',
        'Remove and butter.',
      ]);
    });

    it('strips "Step 1:" style numbering from steps', () => {
      const text = `
Omelette

Ingredients:
3 eggs

Instructions:
Step 1: Beat the eggs.
Step 2: Pour into pan.
Step 3: Cook until set.
      `;

      const result = parseRecipeFromText(text);
      expect(result.steps).toEqual([
        'Beat the eggs.',
        'Pour into pan.',
        'Cook until set.',
      ]);
    });

    it('strips "1)" style numbering from steps', () => {
      const text = `
Rice

Ingredients:
1 cup rice

Directions:
1) Rinse rice.
2) Add water.
3) Cook for 20 minutes.
      `;

      const result = parseRecipeFromText(text);
      expect(result.steps).toEqual([
        'Rinse rice.',
        'Add water.',
        'Cook for 20 minutes.',
      ]);
    });
  });

  describe('edge cases', () => {
    it('returns empty recipe for empty input', () => {
      const result = parseRecipeFromText('');
      expect(result.title).toBe('');
      expect(result.ingredients).toEqual([]);
      expect(result.steps).toEqual([]);
    });

    it('returns empty recipe for whitespace-only input', () => {
      const result = parseRecipeFromText('   \n  \n   ');
      expect(result.title).toBe('');
      expect(result.ingredients).toEqual([]);
      expect(result.steps).toEqual([]);
    });

    it('handles recipe with only ingredients (no steps)', () => {
      const text = `
Shopping List Pasta

Ingredients:
1 lb spaghetti
1 jar marinara
1 cup parmesan
      `;

      const result = parseRecipeFromText(text);
      expect(result.title).toBe('Shopping List Pasta');
      expect(result.ingredients).toHaveLength(3);
      expect(result.steps).toEqual([]);
    });

    it('includes description from lines between title and first header', () => {
      const text = `
Grandma's Apple Pie
A family favorite passed down through generations

Ingredients:
6 apples

Instructions:
Bake at 350.
      `;

      const result = parseRecipeFromText(text);
      expect(result.title).toBe("Grandma's Apple Pie");
      expect(result.description).toBe(
        'A family favorite passed down through generations',
      );
    });
  });
});
