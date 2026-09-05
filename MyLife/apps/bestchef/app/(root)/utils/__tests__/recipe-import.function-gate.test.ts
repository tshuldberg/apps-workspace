import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';
import { parseRecipeJsonLd } from '../recipe-import';

describe('parseRecipeJsonLd function quality gate', () => {
  it('matches contract behavior for known cases', async () => {
    const draft = await parseRecipeJsonLd(
      buildRecipeJsonLdHtml({
        name: 'Function Gate Soup',
        recipeIngredient: ['1 onion', '2 cups stock'],
        recipeInstructions: ['Dice onion.', 'Simmer with stock.'],
        prepTime: 'PT5M',
      }),
      'https://example.com/soup',
    );

    expect(draft).toMatchObject({
      title: 'Function Gate Soup',
      ingredients: ['1 onion', '2 cups stock'],
      steps: ['Dice onion.', 'Simmer with stock.'],
      prepTimeMins: 5,
      source: 'url',
      sourceUrl: 'https://example.com/soup',
    });

    await expect(
      parseRecipeJsonLd('<html><body>No recipe here.</body></html>', 'https://example.com/nope'),
    ).resolves.toBeNull();
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'parseRecipeJsonLd fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 0, 500);
        const text = randomHtmlText(rng, size);
        if (size % 5 === 0) {
          return buildRecipeJsonLdHtml({
            name: `Fuzz ${size}`,
            recipeIngredient: [`${size + 1} carrots`],
            recipeInstructions: [`Cook batch ${size}.`],
          });
        }
        if (size % 7 === 0) {
          return `<html><head><script type="application/ld+json">{ malformed ${text}</script></head></html>`;
        }
        return `<html><body>${text}</body></html>`;
      },
      assertCase: async (input) => {
        const result = await parseRecipeJsonLd(input, 'https://example.com/fuzz');
        if (result) {
          expect(result.title.length).toBeGreaterThan(0);
          expect(result.source).toBe('url');
          expect(result.ingredients.length + result.steps.length).toBeGreaterThan(0);
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'parseRecipeJsonLd',
      sizes: [1000, 2000, 4000],
      expected: 'linear',
      maxRatios: [6, 6],
      setup: (size) =>
        `<html><body>${'x'.repeat(size)}</body><head>${buildRecipeJsonLdHtml({
          name: 'Budget Recipe',
          recipeIngredient: ['1 cup flour'],
          recipeInstructions: ['Mix.'],
        })}</head></html>`,
      run: async (input) => {
        await parseRecipeJsonLd(input, 'https://example.com/budget');
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'parseRecipeJsonLd',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () =>
        buildRecipeJsonLdHtml({
          name: 'Memory Recipe',
          recipeIngredient: ['1 apple'],
          recipeInstructions: ['Slice.'],
        }),
      run: async (input) => {
        await parseRecipeJsonLd(input, 'https://example.com/memory');
      },
    });
  });
});

function buildRecipeJsonLdHtml(recipe: Record<string, unknown>): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    ...recipe,
  })}</script></head><body></body></html>`;
}

function randomHtmlText(rng: () => number, size: number): string {
  return Array.from({ length: size }, () => {
    const code = randomInt(rng, 32, 126);
    return String.fromCharCode(code);
  }).join('');
}
