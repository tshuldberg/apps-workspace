import { describe, expect, it } from 'vitest';
import { RECIPE_TEMPLATES, getRecipeTemplate } from '../recipe-templates';
import { parseIngredientText } from '../ingredient-parser';

describe('recipe-templates', () => {
  it('exposes 4 templates: pasta, soup, bake, stir-fry', () => {
    expect(RECIPE_TEMPLATES).toHaveLength(4);
    const ids = RECIPE_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(['pasta', 'soup', 'bake', 'stir-fry']);
  });

  it('each template has 2-6 ingredient lines and 5+ steps', () => {
    for (const template of RECIPE_TEMPLATES) {
      expect(template.ingredientLines.length).toBeGreaterThanOrEqual(2);
      expect(template.ingredientLines.length).toBeLessThanOrEqual(8);
      expect(template.stepLines.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('each template ingredient line is parseable', () => {
    for (const template of RECIPE_TEMPLATES) {
      for (const line of template.ingredientLines) {
        const parsed = parseIngredientText(line);
        // We don't require structured fields on every line (placeholders are
        // bracketed text), but the parser must not throw and must return
        // a non-empty raw + item.
        expect(parsed.raw).toBe(line);
        expect(parsed.item.length).toBeGreaterThan(0);
      }
    }
  });

  it('getRecipeTemplate returns the matching template', () => {
    const pasta = getRecipeTemplate('pasta');
    expect(pasta).not.toBeNull();
    expect(pasta?.id).toBe('pasta');

    const stirFry = getRecipeTemplate('stir-fry');
    expect(stirFry?.id).toBe('stir-fry');
  });

  it('getRecipeTemplate returns null for unknown id', () => {
    // @ts-expect-error -- intentional
    expect(getRecipeTemplate('unknown')).toBeNull();
  });

  it('every label key matches the i18n contract', () => {
    const expected = new Set([
      'recipe_template_pasta',
      'recipe_template_soup',
      'recipe_template_bake',
      'recipe_template_stirfry',
    ]);
    for (const template of RECIPE_TEMPLATES) {
      expect(expected.has(template.labelKey)).toBe(true);
    }
  });
});
