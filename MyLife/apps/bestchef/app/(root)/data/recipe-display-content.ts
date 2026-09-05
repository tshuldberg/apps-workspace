import { shouldShowDemoContent } from './public-render-policy';

const SAMPLE_INGREDIENTS: readonly string[] = [
  '200g rice noodles (pad thai noodles)',
  '3 tbsp tamarind paste',
  '2 tbsp fish sauce',
  '1 tbsp palm sugar (or brown sugar)',
  '2 eggs',
  '150g firm tofu, cubed',
  '100g bean sprouts',
  '3 green onions, sliced',
  '3 tbsp crushed peanuts',
  '1 lime, cut into wedges',
  '2 tbsp vegetable oil',
  'Dried chili flakes to taste',
];

const SAMPLE_STEPS: readonly string[] = [
  'Soak rice noodles in warm water for 30 minutes until pliable. Drain.',
  'Mix tamarind paste, fish sauce, and palm sugar in a small bowl until sugar dissolves.',
  'Heat oil in a wok over high heat until smoking. Add tofu and fry until golden on all sides.',
  'Push tofu to one side, crack eggs into the wok. Scramble quickly.',
  'Add drained noodles and tamarind sauce. Toss with tongs for 2-3 minutes until noodles absorb the sauce.',
  'Add bean sprouts and half the green onions. Toss for 30 seconds.',
  'Plate and garnish with crushed peanuts, remaining green onions, lime wedge, and chili flakes.',
];

export function getRecipeIngredientsForDisplay(
  ingredients: readonly string[],
  showDemoContent = shouldShowDemoContent(),
): string[] {
  if (ingredients.length > 0) return [...ingredients];
  return showDemoContent ? [...SAMPLE_INGREDIENTS] : [];
}

export function getRecipeStepsForDisplay(
  steps: readonly string[] | null | undefined,
  showDemoContent = shouldShowDemoContent(),
): string[] {
  if (steps && steps.length > 0) return [...steps];
  return showDemoContent ? [...SAMPLE_STEPS] : [];
}
