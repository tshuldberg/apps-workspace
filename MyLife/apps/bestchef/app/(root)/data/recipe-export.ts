import type { Ingredient, Recipe, Step } from '@mylife/bestchef';

export interface SavedRecipeExportDetails {
  recipe: Recipe;
  ingredients: Ingredient[];
  steps: Step[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]?.toUpperCase()}${value.slice(1)}`;
}

function formatTime(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${hours} hr` : `${hours} hr ${remaining} min`;
}

function ingredientText(ingredient: Ingredient): string {
  return [
    ingredient.quantity,
    ingredient.unit,
    ingredient.item ?? ingredient.name,
  ].filter(Boolean).join(' ');
}

function recipeMetadata(recipe: Recipe): string[] {
  const total = recipe.total_time_mins ?? (recipe.prep_time_mins ?? 0) + (recipe.cook_time_mins ?? 0);
  return [
    recipe.servings ? `Serves ${recipe.servings}` : null,
    recipe.prep_time_mins ? `Prep ${formatTime(recipe.prep_time_mins)}` : null,
    recipe.cook_time_mins ? `Cook ${formatTime(recipe.cook_time_mins)}` : null,
    total > 0 ? `Total ${formatTime(total)}` : null,
    recipe.difficulty ? capitalize(recipe.difficulty) : null,
  ].filter((value): value is string => value !== null);
}

export function savedRecipeAttribution(recipe: Recipe): string {
  const chefHandle = recipe.source_chef_handle?.trim().replace(/^@/, '');
  if (chefHandle) return `Saved from @${chefHandle}`;
  const chefName = recipe.source_chef_name?.trim();
  if (chefName) return `Saved from ${chefName}`;
  if (recipe.source_url?.trim()) return `Source: ${recipe.source_url.trim()}`;
  return 'Saved from BestChef Kitchen';
}

export function buildSavedRecipePlainText(details: SavedRecipeExportDetails): string {
  const { recipe, ingredients, steps } = details;
  const lines = [
    recipe.title,
    savedRecipeAttribution(recipe),
    recipe.source_url ? `Original: ${recipe.source_url}` : null,
    recipe.image_uri ? `Photo: ${recipe.image_uri}` : null,
    recipe.description?.trim() || null,
    recipeMetadata(recipe).join(' | ') || null,
    '',
    'Ingredients',
    ...ingredients.map((ingredient) => `- ${ingredientText(ingredient)}`),
    '',
    'Instructions',
    ...steps.map((step, index) => `${index + 1}. ${step.instruction}`),
  ].filter((line): line is string => line !== null);

  return lines.join('\n').trim();
}

export function buildSavedRecipePrintHtml(details: SavedRecipeExportDetails): string {
  const { recipe, ingredients, steps } = details;
  const metadata = recipeMetadata(recipe);
  const attribution = savedRecipeAttribution(recipe);
  const sourceLine = recipe.source_url ? `<p class="source">Original: ${escapeHtml(recipe.source_url)}</p>` : '';
  const image = recipe.image_uri
    ? `<figure><img src="${escapeHtml(recipe.image_uri)}" alt="${escapeHtml(recipe.title)}" /></figure>`
    : '';
  const description = recipe.description?.trim()
    ? `<p class="description">${escapeHtml(recipe.description.trim())}</p>`
    : '';
  const ingredientRows = ingredients.length > 0
    ? ingredients.map((ingredient) => `<li>${escapeHtml(ingredientText(ingredient))}</li>`).join('')
    : '<li>No ingredients listed.</li>';
  const stepRows = steps.length > 0
    ? steps.map((step) => `<li>${escapeHtml(step.instruction)}</li>`).join('')
    : '<li>No instructions listed.</li>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(recipe.title)}</title>
  <style>
    @page { size: auto; margin: 0.65in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111111;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12.5pt;
      line-height: 1.45;
    }
    main {
      width: 100%;
      max-width: 7.25in;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 0.08in;
      font-size: 25pt;
      line-height: 1.12;
    }
    h2 {
      margin: 0.28in 0 0.1in;
      padding-bottom: 0.05in;
      border-bottom: 1px solid #d9d3cc;
      font-size: 15pt;
    }
    .attribution, .source, .meta {
      margin: 0.03in 0;
      color: #5f574f;
      font-size: 10.5pt;
    }
    .description {
      margin: 0.18in 0;
      color: #2f2a26;
    }
    figure {
      margin: 0.18in 0;
    }
    img {
      display: block;
      width: 100%;
      max-height: 3.25in;
      object-fit: cover;
      border-radius: 0.08in;
    }
    ul, ol {
      margin: 0;
      padding-left: 0.24in;
    }
    li {
      margin: 0.06in 0;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(recipe.title)}</h1>
    <p class="attribution">${escapeHtml(attribution)}</p>
    ${sourceLine}
    ${image}
    ${description}
    ${metadata.length > 0 ? `<p class="meta">${escapeHtml(metadata.join(' | '))}</p>` : ''}
    <h2>Ingredients</h2>
    <ul>${ingredientRows}</ul>
    <h2>Instructions</h2>
    <ol>${stepRows}</ol>
  </main>
</body>
</html>`;
}
