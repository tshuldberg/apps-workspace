/**
 * Recipe quick-start templates (F-035).
 *
 * Each template seeds the `recipes/new.tsx` form with placeholder ingredients
 * and a step skeleton so first-time authors aren't staring at blank fields.
 *
 * Placeholders are wrapped in square brackets so it's obvious they need
 * replacement. Templates are intentionally generic; personalised templates
 * from past recipes are explicitly out of scope (per ticket).
 */

export type RecipeTemplateId = 'pasta' | 'soup' | 'bake' | 'stir-fry';

export interface RecipeTemplateSeed {
  id: RecipeTemplateId;
  /** i18n key for the chip label */
  labelKey:
    | 'recipe_template_pasta'
    | 'recipe_template_soup'
    | 'recipe_template_bake'
    | 'recipe_template_stirfry';
  /** Suggested title placeholder (untranslated; user edits anyway) */
  titlePlaceholder: string;
  servings: number;
  prepTimeMins: number;
  cookTimeMins: number;
  difficulty: 'easy' | 'medium' | 'hard';
  /** Pre-formatted ingredient lines (one per line). Each runs through the parser. */
  ingredientLines: string[];
  /** Pre-formatted step lines (one per line). */
  stepLines: string[];
}

export const RECIPE_TEMPLATES: ReadonlyArray<RecipeTemplateSeed> = [
  {
    id: 'pasta',
    labelKey: 'recipe_template_pasta',
    titlePlaceholder: 'Weeknight pasta',
    servings: 4,
    prepTimeMins: 10,
    cookTimeMins: 15,
    difficulty: 'easy',
    ingredientLines: [
      '400 g [pasta type]',
      '2 tbsp olive oil',
      '3 cloves garlic, minced',
      '1 cup [sauce base]',
      '200 g [protein]',
      'salt and pepper, to taste',
    ],
    stepLines: [
      'Bring a large pot of salted water to a boil',
      'Cook the pasta until al dente, then reserve a cup of pasta water and drain',
      'Heat olive oil in a pan and saute the garlic until fragrant',
      'Add the sauce base and protein, simmer until heated through',
      'Toss the pasta with the sauce, loosen with pasta water, season and serve',
    ],
  },
  {
    id: 'soup',
    labelKey: 'recipe_template_soup',
    titlePlaceholder: 'Weeknight soup',
    servings: 4,
    prepTimeMins: 15,
    cookTimeMins: 30,
    difficulty: 'easy',
    ingredientLines: [
      '1 tbsp olive oil',
      '1 medium onion, diced',
      '2 cloves garlic, minced',
      '4 cups [stock]',
      '300 g [main vegetable]',
      'salt and pepper, to taste',
    ],
    stepLines: [
      'Heat olive oil in a large pot over medium heat',
      'Saute the onion and garlic until soft',
      'Add the stock and main vegetable, bring to a simmer',
      'Cook until everything is tender',
      'Season to taste and serve',
    ],
  },
  {
    id: 'bake',
    labelKey: 'recipe_template_bake',
    titlePlaceholder: 'Easy bake',
    servings: 6,
    prepTimeMins: 20,
    cookTimeMins: 35,
    difficulty: 'medium',
    ingredientLines: [
      '2 cups [flour or base]',
      '1 cup [liquid]',
      '2 large eggs',
      '1 tsp salt',
      '1 cup [filling or topping]',
    ],
    stepLines: [
      'Preheat the oven to 180 C (350 F)',
      'Mix the dry ingredients in a large bowl',
      'Whisk the liquid and eggs in a separate bowl',
      'Combine the wet and dry mixtures, fold in the filling',
      'Pour into a greased baking dish and bake until set',
    ],
  },
  {
    id: 'stir-fry',
    labelKey: 'recipe_template_stirfry',
    titlePlaceholder: 'Quick stir-fry',
    servings: 2,
    prepTimeMins: 15,
    cookTimeMins: 10,
    difficulty: 'easy',
    ingredientLines: [
      '2 tbsp neutral oil',
      '300 g [protein], sliced thin',
      '3 cups [mixed vegetables]',
      '2 cloves garlic, minced',
      '2 tbsp [stir-fry sauce]',
      '1 tsp toasted sesame oil',
    ],
    stepLines: [
      'Heat the oil in a wok over high heat',
      'Sear the protein quickly, then remove and set aside',
      'Add the vegetables and garlic, stir-fry until just tender',
      'Return the protein to the wok and add the sauce',
      'Toss with toasted sesame oil and serve over rice',
    ],
  },
];

export function getRecipeTemplate(id: RecipeTemplateId): RecipeTemplateSeed | null {
  return RECIPE_TEMPLATES.find((t) => t.id === id) ?? null;
}
