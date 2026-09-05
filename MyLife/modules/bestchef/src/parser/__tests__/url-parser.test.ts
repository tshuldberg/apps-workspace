import { describe, it, expect } from 'vitest';
import { parseRecipeFromHtml, parseIsoDuration } from '../url-parser';

/** Helper to wrap JSON-LD in a minimal HTML page. */
function htmlWithJsonLd(jsonLd: object): string {
  return `
    <html><head>
      <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    </head><body></body></html>
  `;
}

describe('parseRecipeFromHtml', () => {
  describe('JSON-LD extraction', () => {
    it('parses standard Recipe type', () => {
      const html = htmlWithJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Chocolate Cake',
        description: 'A rich chocolate cake',
        recipeIngredient: ['2 cups flour', '1 cup sugar', '1/2 cup cocoa'],
        recipeInstructions: ['Mix dry ingredients.', 'Add wet ingredients.', 'Bake at 350F.'],
        prepTime: 'PT15M',
        cookTime: 'PT30M',
        recipeYield: '8 servings',
        keywords: 'chocolate, cake, dessert',
        image: 'https://example.com/cake.jpg',
      });

      const result = parseRecipeFromHtml(html);
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Chocolate Cake');
      expect(result!.description).toBe('A rich chocolate cake');
      expect(result!.ingredients).toEqual(['2 cups flour', '1 cup sugar', '1/2 cup cocoa']);
      expect(result!.steps).toEqual([
        'Mix dry ingredients.',
        'Add wet ingredients.',
        'Bake at 350F.',
      ]);
      expect(result!.prep_time_min).toBe(15);
      expect(result!.cook_time_min).toBe(30);
      expect(result!.servings).toBe(8);
      expect(result!.tags).toEqual(['chocolate', 'cake', 'dessert']);
      expect(result!.image_url).toBe('https://example.com/cake.jpg');
    });

    it('parses Recipe from @graph array', () => {
      const html = htmlWithJsonLd({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebPage', name: 'My Blog' },
          {
            '@type': 'Recipe',
            name: 'Pasta Carbonara',
            recipeIngredient: ['1 lb spaghetti', '4 eggs', '1 cup parmesan'],
            recipeInstructions: ['Cook pasta.', 'Make sauce.', 'Combine.'],
          },
        ],
      });

      const result = parseRecipeFromHtml(html);
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Pasta Carbonara');
      expect(result!.ingredients).toHaveLength(3);
      expect(result!.steps).toHaveLength(3);
    });

    it('parses HowToStep instruction objects', () => {
      const html = htmlWithJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Simple Soup',
        recipeIngredient: ['1 onion', '2 cups broth'],
        recipeInstructions: [
          { '@type': 'HowToStep', text: 'Dice the onion.' },
          { '@type': 'HowToStep', text: 'Add broth and simmer for 20 minutes.' },
        ],
      });

      const result = parseRecipeFromHtml(html);
      expect(result).not.toBeNull();
      expect(result!.steps).toEqual([
        'Dice the onion.',
        'Add broth and simmer for 20 minutes.',
      ]);
    });

    it('handles image as object with url property', () => {
      const html = htmlWithJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Salad',
        recipeIngredient: ['lettuce'],
        recipeInstructions: ['Toss.'],
        image: { '@type': 'ImageObject', url: 'https://example.com/salad.jpg' },
      });

      const result = parseRecipeFromHtml(html);
      expect(result!.image_url).toBe('https://example.com/salad.jpg');
    });

    it('handles image as array', () => {
      const html = htmlWithJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Tacos',
        recipeIngredient: ['tortillas'],
        recipeInstructions: ['Assemble.'],
        image: ['https://example.com/tacos-1.jpg', 'https://example.com/tacos-2.jpg'],
      });

      const result = parseRecipeFromHtml(html);
      expect(result!.image_url).toBe('https://example.com/tacos-1.jpg');
    });

    it('handles recipeYield as array', () => {
      const html = htmlWithJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Cookies',
        recipeIngredient: ['flour'],
        recipeInstructions: ['Bake.'],
        recipeYield: ['24', '24 cookies'],
      });

      const result = parseRecipeFromHtml(html);
      expect(result!.servings).toBe(24);
    });

    it('extracts recipeCategory as tags', () => {
      const html = htmlWithJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Stir Fry',
        recipeIngredient: ['tofu'],
        recipeInstructions: ['Stir fry.'],
        recipeCategory: 'Dinner',
        keywords: 'asian, healthy',
      });

      const result = parseRecipeFromHtml(html);
      expect(result!.tags).toEqual(['asian', 'healthy', 'Dinner']);
    });
  });

  describe('Microdata extraction', () => {
    it('extracts recipe from microdata attributes', () => {
      const html = `
        <html><body>
          <div itemscope itemtype="https://schema.org/Recipe">
            <h1 itemprop="name">Banana Bread</h1>
            <p itemprop="description">Moist and delicious</p>
            <meta itemprop="prepTime" content="PT10M" />
            <meta itemprop="cookTime" content="PT60M" />
            <span itemprop="recipeYield">1 loaf</span>
            <ul>
              <li itemprop="recipeIngredient">3 bananas</li>
              <li itemprop="recipeIngredient">2 cups flour</li>
              <li itemprop="recipeIngredient">1 cup sugar</li>
            </ul>
            <div itemprop="recipeInstructions">Mash bananas and mix with dry ingredients.</div>
            <div itemprop="recipeInstructions">Pour into pan and bake at 350F.</div>
            <img itemprop="image" src="https://example.com/bread.jpg" />
          </div>
        </body></html>
      `;

      const result = parseRecipeFromHtml(html);
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Banana Bread');
      expect(result!.description).toBe('Moist and delicious');
      expect(result!.ingredients).toEqual(['3 bananas', '2 cups flour', '1 cup sugar']);
      expect(result!.steps).toHaveLength(2);
      expect(result!.prep_time_min).toBe(10);
      expect(result!.cook_time_min).toBe(60);
      expect(result!.servings).toBe(1);
      expect(result!.image_url).toBe('https://example.com/bread.jpg');
    });

    it('handles http:// schema URL', () => {
      const html = `
        <html><body>
          <div itemscope itemtype="http://schema.org/Recipe">
            <h1 itemprop="name">Rice Bowl</h1>
            <li itemprop="recipeIngredient">1 cup rice</li>
            <div itemprop="recipeInstructions">Cook rice.</div>
          </div>
        </body></html>
      `;

      const result = parseRecipeFromHtml(html);
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Rice Bowl');
    });
  });

  describe('Meta tag fallback', () => {
    it('extracts from og:title and og:description', () => {
      const html = `
        <html><head>
          <meta property="og:title" content="Amazing Recipe Blog Post" />
          <meta property="og:description" content="A wonderful recipe from grandma." />
          <meta property="og:image" content="https://example.com/recipe.jpg" />
        </head><body><p>Recipe content without structured data</p></body></html>
      `;

      const result = parseRecipeFromHtml(html);
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Amazing Recipe Blog Post');
      expect(result!.description).toBe('A wonderful recipe from grandma.');
      expect(result!.image_url).toBe('https://example.com/recipe.jpg');
      expect(result!.ingredients).toEqual([]);
      expect(result!.steps).toEqual([]);
    });

    it('falls back to <title> when no og:title', () => {
      const html = `
        <html><head>
          <title>My Recipe Page</title>
        </head><body></body></html>
      `;

      const result = parseRecipeFromHtml(html);
      expect(result).not.toBeNull();
      expect(result!.title).toBe('My Recipe Page');
    });
  });

  describe('no recipe data', () => {
    it('returns null for empty HTML', () => {
      const result = parseRecipeFromHtml('<html><head></head><body></body></html>');
      expect(result).toBeNull();
    });

    it('returns null for page with no title', () => {
      const result = parseRecipeFromHtml('<html><head></head><body><p>Hello</p></body></html>');
      expect(result).toBeNull();
    });
  });

  describe('malformed JSON-LD', () => {
    it('does not throw on invalid JSON', () => {
      const html = `
        <html><head>
          <script type="application/ld+json">{ invalid json here }</script>
          <title>Fallback Title</title>
        </head><body></body></html>
      `;

      const result = parseRecipeFromHtml(html);
      // Should fall through to meta tag fallback
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Fallback Title');
    });

    it('skips JSON-LD with non-Recipe type', () => {
      const html = htmlWithJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Article',
        name: 'Not a recipe',
      });

      // No og:title or <title> either, so null
      const result = parseRecipeFromHtml(html);
      expect(result).toBeNull();
    });
  });
});

describe('parseIsoDuration', () => {
  it('parses PT15M to 15 minutes', () => {
    expect(parseIsoDuration('PT15M')).toBe(15);
  });

  it('parses PT1H30M to 90 minutes', () => {
    expect(parseIsoDuration('PT1H30M')).toBe(90);
  });

  it('parses PT2H to 120 minutes', () => {
    expect(parseIsoDuration('PT2H')).toBe(120);
  });

  it('parses PT45S to 1 minute (ceiling)', () => {
    expect(parseIsoDuration('PT45S')).toBe(1);
  });

  it('returns undefined for invalid duration', () => {
    expect(parseIsoDuration('not a duration')).toBeUndefined();
  });

  it('returns undefined for empty PT', () => {
    expect(parseIsoDuration('PT')).toBeUndefined();
  });
});
