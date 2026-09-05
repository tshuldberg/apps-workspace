import { describe, expect, it, vi } from 'vitest';
import {
  detectClipboardKind,
  importFromClipboardText,
  importRecipeFromUrl,
  parseRecipeJsonLd,
  parseRecipeText,
} from '../recipe-import';

describe('detectClipboardKind', () => {
  it('returns empty for whitespace-only input', () => {
    expect(detectClipboardKind('')).toBe('empty');
    expect(detectClipboardKind('   ')).toBe('empty');
  });

  it('detects http and https URLs', () => {
    expect(detectClipboardKind('https://example.com/recipe')).toBe('url');
    expect(detectClipboardKind('http://example.com/recipe')).toBe('url');
  });

  it('treats anything else as text', () => {
    expect(detectClipboardKind('Pad Thai\nIngredients:\n- noodles')).toBe('text');
    expect(detectClipboardKind('not-a-url')).toBe('text');
    expect(detectClipboardKind('file:///etc/passwd')).toBe('text');
  });
});

describe('parseRecipeText', () => {
  it('parses a structured recipe with explicit headers', () => {
    const text = `
Pad Thai

Ingredients:
8 oz rice noodles
1 lb chicken
2 tbsp fish sauce

Instructions:
1. Soak noodles.
2. Stir fry chicken.
3. Combine and toss.
    `;
    const draft = parseRecipeText(text);
    expect(draft.title).toBe('Pad Thai');
    expect(draft.ingredients).toEqual([
      '8 oz rice noodles',
      '1 lb chicken',
      '2 tbsp fish sauce',
    ]);
    expect(draft.steps).toEqual([
      'Soak noodles.',
      'Stir fry chicken.',
      'Combine and toss.',
    ]);
    expect(draft.source).toBe('text');
    expect(draft.sourceUrl).toBeNull();
  });

  it('falls back to a placeholder title on empty text', () => {
    const draft = parseRecipeText('   ');
    expect(draft.title).toBe('Untitled recipe');
    expect(draft.ingredients).toEqual([]);
    expect(draft.steps).toEqual([]);
  });

  it('preserves servings, prep time, and cook time when present', () => {
    const text = `
Tomato Soup
Serves 4. Prep 10 min. Cook 20 min.

Ingredients:
4 tomatoes
1 onion

Instructions:
1. Sauté onion.
2. Simmer tomatoes.
    `;
    const draft = parseRecipeText(text);
    expect(draft.servings).toBe(4);
    expect(draft.prepTimeMins).toBe(10);
    expect(draft.cookTimeMins).toBe(20);
  });
});

describe('parseRecipeJsonLd', () => {
  it('extracts a recipe from JSON-LD schema.org markup', async () => {
    const html = `
<!DOCTYPE html>
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Chocolate Cake",
        "description": "A moist chocolate cake.",
        "recipeIngredient": ["2 cups flour", "1 cup sugar", "3 eggs"],
        "recipeInstructions": [
          { "@type": "HowToStep", "text": "Mix dry ingredients." },
          { "@type": "HowToStep", "text": "Add eggs." },
          { "@type": "HowToStep", "text": "Bake at 350F for 30 minutes." }
        ],
        "prepTime": "PT15M",
        "cookTime": "PT30M",
        "recipeYield": "8 servings",
        "image": "https://example.com/cake.jpg",
        "keywords": "dessert, chocolate"
      }
    </script>
  </head>
  <body></body>
</html>`;
    const draft = await parseRecipeJsonLd(html, 'https://example.com/cake');
    expect(draft).not.toBeNull();
    expect(draft!.title).toBe('Chocolate Cake');
    expect(draft!.description).toBe('A moist chocolate cake.');
    expect(draft!.ingredients).toEqual(['2 cups flour', '1 cup sugar', '3 eggs']);
    expect(draft!.steps).toEqual([
      'Mix dry ingredients.',
      'Add eggs.',
      'Bake at 350F for 30 minutes.',
    ]);
    expect(draft!.prepTimeMins).toBe(15);
    expect(draft!.cookTimeMins).toBe(30);
    expect(draft!.servings).toBe(8);
    expect(draft!.imageUrl).toBe('https://example.com/cake.jpg');
    expect(draft!.tags).toEqual(expect.arrayContaining(['dessert', 'chocolate']));
    expect(draft!.sourceUrl).toBe('https://example.com/cake');
    expect(draft!.source).toBe('url');
  });

  it('extracts a recipe from schema.org microdata markup', async () => {
    const html = `
<html>
  <body>
    <article itemscope itemtype="https://schema.org/Recipe">
      <h1 itemprop="name">Banana Bread</h1>
      <p itemprop="description">A simple loaf.</p>
      <meta itemprop="prepTime" content="PT10M" />
      <meta itemprop="cookTime" content="PT45M" />
      <span itemprop="recipeYield">1 loaf</span>
      <ul>
        <li itemprop="recipeIngredient">3 bananas</li>
        <li itemprop="recipeIngredient">2 cups flour</li>
      </ul>
      <ol>
        <li itemprop="recipeInstructions">Mash bananas.</li>
        <li itemprop="recipeInstructions">Bake until done.</li>
      </ol>
      <img itemprop="image" src="https://example.com/bread.jpg" />
    </article>
  </body>
</html>`;
    const draft = await parseRecipeJsonLd(html, 'https://example.com/bread');
    expect(draft).not.toBeNull();
    expect(draft!.title).toBe('Banana Bread');
    expect(draft!.description).toBe('A simple loaf.');
    expect(draft!.ingredients).toEqual(['3 bananas', '2 cups flour']);
    expect(draft!.steps).toEqual(['Mash bananas.', 'Bake until done.']);
    expect(draft!.prepTimeMins).toBe(10);
    expect(draft!.cookTimeMins).toBe(45);
    expect(draft!.servings).toBe(1);
    expect(draft!.imageUrl).toBe('https://example.com/bread.jpg');
  });

  it('returns null when HTML lacks structured recipe data', async () => {
    const html = '<html><body><p>No structured data here.</p></body></html>';
    const draft = await parseRecipeJsonLd(html, 'https://example.com/x');
    expect(draft).toBeNull();
  });
});

describe('importRecipeFromUrl', () => {
  it('returns null on non-2xx HTTP responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '',
    } as unknown as Response);
    const draft = await importRecipeFromUrl('https://example.com/x', { fetchImpl });
    expect(draft).toBeNull();
  });

  it('parses JSON-LD when fetch succeeds', async () => {
    const html = `
<html><head><script type="application/ld+json">
{"@context":"https://schema.org","@type":"Recipe","name":"Soup","recipeIngredient":["1 onion"],"recipeInstructions":["Simmer."]}
</script></head></html>`;
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    } as unknown as Response);
    const draft = await importRecipeFromUrl('https://example.com/soup', { fetchImpl });
    expect(draft).not.toBeNull();
    expect(draft!.title).toBe('Soup');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/soup',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('returns null on network errors', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const draft = await importRecipeFromUrl('https://example.com/x', { fetchImpl });
    expect(draft).toBeNull();
  });

  it('respects the allowedHostsRegex guard', async () => {
    const fetchImpl = vi.fn();
    const draft = await importRecipeFromUrl('https://attacker.example/x', {
      fetchImpl,
      allowedHostsRegex: /^trusted\.example$/,
    });
    expect(draft).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('importFromClipboardText', () => {
  it('routes URLs through importRecipeFromUrl', async () => {
    const html = `
<html><head><script type="application/ld+json">
{"@type":"Recipe","name":"Quick","recipeIngredient":["a"],"recipeInstructions":["b"]}
</script></head></html>`;
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    } as unknown as Response);
    const draft = await importFromClipboardText('https://example.com/quick', { fetchImpl });
    expect(draft).not.toBeNull();
    expect(draft!.title).toBe('Quick');
    expect(draft!.source).toBe('url');
  });

  it('routes plain text through parseRecipeText', async () => {
    const draft = await importFromClipboardText(`Quesadilla\n\nIngredients:\n- tortilla\n- cheese\n\nInstructions:\n1. Heat pan.\n2. Melt cheese.`);
    expect(draft).not.toBeNull();
    expect(draft!.title).toBe('Quesadilla');
    expect(draft!.source).toBe('text');
    expect(draft!.ingredients).toContain('tortilla');
  });

  it('returns null on empty input', async () => {
    expect(await importFromClipboardText('')).toBeNull();
    expect(await importFromClipboardText('   ')).toBeNull();
  });
});
