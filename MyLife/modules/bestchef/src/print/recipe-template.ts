import type { Recipe, StructuredIngredient, Step } from '../types';
import { formatQuantity } from '../utils/fractions';
import { formatDuration } from '../utils/time';

export interface PrintOptions {
  includePhoto?: boolean;
  /** BCP 47 tag for the printed date; falls back to the device locale. */
  locale?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMetadataRow(recipe: Recipe): string {
  const parts: string[] = [];
  if (recipe.prep_time_mins) parts.push(`Prep: ${formatDuration(recipe.prep_time_mins)}`);
  if (recipe.cook_time_mins) parts.push(`Cook: ${formatDuration(recipe.cook_time_mins)}`);
  if (recipe.total_time_mins) parts.push(`Total: ${formatDuration(recipe.total_time_mins)}`);
  if (recipe.servings) parts.push(`Serves: ${recipe.servings}`);
  if (recipe.difficulty) parts.push(`Difficulty: ${recipe.difficulty}`);
  if (parts.length === 0) return '';
  return `<p style="color:#666;font-size:13px;margin:8px 0 16px 0;">${parts.join(' &nbsp;|&nbsp; ')}</p>`;
}

function buildIngredientsHtml(ingredients: StructuredIngredient[]): string {
  if (ingredients.length === 0) {
    return '<p style="color:#999;font-style:italic;">No ingredients listed.</p>';
  }

  const sections = new Map<string | null, StructuredIngredient[]>();
  for (const ing of ingredients) {
    const section = ing.section ?? null;
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section)!.push(ing);
  }

  let html = '';
  for (const [section, items] of sections) {
    if (section) {
      html += `<p style="font-weight:bold;margin:12px 0 4px 0;">${escapeHtml(section)}</p>`;
    }
    html += '<ul style="margin:0 0 8px 0;padding-left:20px;">';
    for (const ing of items) {
      const qty = formatQuantity(ing.quantity_value);
      const unit = ing.unit ?? '';
      const item = escapeHtml(ing.item || ing.name);
      const prepNote = ing.prep_note ? `, ${escapeHtml(ing.prep_note)}` : '';
      const parts = [qty, unit, item].filter(Boolean).join(' ');
      html += `<li style="margin:2px 0;">${parts}${prepNote}</li>`;
    }
    html += '</ul>';
  }
  return html;
}

function buildStepsHtml(steps: Step[]): string {
  if (steps.length === 0) {
    return '<p style="color:#999;font-style:italic;">No steps listed.</p>';
  }

  const sorted = [...steps].sort((a, b) => a.sort_order - b.sort_order);
  let html = '<ol style="margin:0;padding-left:20px;line-height:1.6;">';
  for (const step of sorted) {
    html += `<li style="margin:6px 0;">${escapeHtml(step.instruction)}</li>`;
  }
  html += '</ol>';
  return html;
}

export function generatePrintHtml(
  recipe: Recipe,
  ingredients: StructuredIngredient[],
  steps: Step[],
  _tags: string[],
  options: PrintOptions = {},
): string {
  const title = escapeHtml(recipe.title);
  const metadataRow = buildMetadataRow(recipe);
  const source = recipe.source_url
    ? `<p style="color:#999;font-size:12px;text-align:center;">Source: ${escapeHtml(recipe.source_url)}</p>`
    : '<p style="color:#999;font-size:12px;text-align:center;">From MyRecipes</p>';

  const photoHtml =
    options.includePhoto && recipe.image_uri
      ? `<div style="text-align:center;margin:12px 0;"><img src="${escapeHtml(recipe.image_uri)}" style="max-width:100%;max-height:300px;border-radius:8px;" /></div>`
      : '';

  const descriptionHtml = recipe.description
    ? `<p style="color:#444;margin:0 0 16px 0;">${escapeHtml(recipe.description)}</p>`
    : '';

  const notesHtml = recipe.notes
    ? `<div style="margin-top:16px;"><h3 style="font-size:16px;margin:0 0 4px 0;">Notes</h3><p style="font-style:italic;color:#444;">${escapeHtml(recipe.notes)}</p></div>`
    : '';

  let printDate: string;
  try {
    printDate = new Date().toLocaleDateString(options.locale ?? undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    printDate = new Date().toISOString().slice(0, 10);
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @media print {
    body { margin: 0.75in; }
    .no-print { display: none; }
  }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14px;
    color: #111;
    background: #fff;
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
    line-height: 1.5;
  }
</style>
</head>
<body>
<h1 style="text-align:center;font-size:24px;margin-bottom:4px;">${title}</h1>
${source}
${photoHtml}
${metadataRow}
${descriptionHtml}
<h2 style="font-size:18px;border-bottom:1px solid #ccc;padding-bottom:4px;">Ingredients</h2>
${buildIngredientsHtml(ingredients)}
<h2 style="font-size:18px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:20px;">Steps</h2>
${buildStepsHtml(steps)}
${notesHtml}
<hr style="margin-top:24px;border:none;border-top:1px solid #ddd;" />
<p style="text-align:center;color:#999;font-size:11px;">Printed from MyLife &mdash; ${printDate}</p>
</body>
</html>`;
}
