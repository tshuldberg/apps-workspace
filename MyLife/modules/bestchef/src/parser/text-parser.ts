import type { ParsedRecipe } from '../types';

const DECORATION_RE = /[═─━│┃┄┅┆┇┈┉┊┋*~#_=\-]{3,}/g;
const INGREDIENT_HEADER_RE = /^(?:ingredients?)\s*:?\s*$/i;
const STEP_HEADER_RE = /^(?:instructions?|directions?|steps?|method|preparation|procedure)\s*:?\s*$/i;
const STEP_NUMBER_RE = /^(?:step\s+)?\d+[.):\-]\s*/i;
const PREP_TIME_RE = /(?:prep(?:\s*time)?)\s*:?\s*(\d+)\s*(?:min(?:utes?)?|m\b)/i;
const COOK_TIME_RE = /(?:cook(?:\s*time)?|bake\s*time)\s*:?\s*(\d+)\s*(?:min(?:utes?)?|m\b)/i;
const SERVINGS_RE = /(?:serves?|servings?|yield|makes)\s*:?\s*(\d+)/i;
const LOOKS_LIKE_INGREDIENT_RE = /^(?:\d|[-•▪▸►]\s)/;

export function parseRecipeFromText(text: string): ParsedRecipe {
  const lines = cleanLines(text);
  if (lines.length === 0) {
    return { title: '', ingredients: [], steps: [] };
  }

  const structured = parseWithHeaders(lines);
  if (structured) {
    return structured;
  }

  return parseHeuristic(lines);
}

function cleanLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(DECORATION_RE, '').trim())
    .filter((line) => line.length > 0);
}

function extractMetadata(headerLines: string[]): {
  prep_time_min?: number;
  cook_time_min?: number;
  servings?: number;
  titleLine: string;
  descriptionLines: string[];
} {
  let prep_time_min: number | undefined;
  let cook_time_min: number | undefined;
  let servings: number | undefined;
  const nonMetaLines: string[] = [];

  for (const line of headerLines) {
    let consumed = false;

    const prepMatch = line.match(PREP_TIME_RE);
    if (prepMatch) {
      prep_time_min = Number.parseInt(prepMatch[1], 10);
      consumed = true;
    }

    const cookMatch = line.match(COOK_TIME_RE);
    if (cookMatch) {
      cook_time_min = Number.parseInt(cookMatch[1], 10);
      consumed = true;
    }

    const servingsMatch = line.match(SERVINGS_RE);
    if (servingsMatch) {
      servings = Number.parseInt(servingsMatch[1], 10);
      consumed = true;
    }

    if (!consumed) {
      nonMetaLines.push(line);
    }
  }

  return {
    prep_time_min,
    cook_time_min,
    servings,
    titleLine: nonMetaLines[0] ?? '',
    descriptionLines: nonMetaLines.slice(1),
  };
}

function parseWithHeaders(lines: string[]): ParsedRecipe | null {
  let ingredientStart = -1;
  let stepStart = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (INGREDIENT_HEADER_RE.test(lines[index]) && ingredientStart === -1) {
      ingredientStart = index;
    } else if (STEP_HEADER_RE.test(lines[index]) && stepStart === -1) {
      stepStart = index;
    }
  }

  if (ingredientStart === -1 && stepStart === -1) {
    return null;
  }

  const firstSection = Math.min(
    ingredientStart === -1 ? Number.POSITIVE_INFINITY : ingredientStart,
    stepStart === -1 ? Number.POSITIVE_INFINITY : stepStart,
  );
  const headerLines = lines.slice(0, firstSection);
  const { prep_time_min, cook_time_min, servings, titleLine, descriptionLines } =
    extractMetadata(headerLines);

  let ingredients: string[] = [];
  if (ingredientStart !== -1) {
    const endIndex = stepStart !== -1 && stepStart > ingredientStart ? stepStart : lines.length;
    ingredients = lines
      .slice(ingredientStart + 1, endIndex)
      .filter((line) => !STEP_HEADER_RE.test(line) && !INGREDIENT_HEADER_RE.test(line))
      .map(stripBullet);
  }

  let steps: string[] = [];
  if (stepStart !== -1) {
    const endIndex = ingredientStart !== -1 && ingredientStart > stepStart ? ingredientStart : lines.length;
    steps = lines
      .slice(stepStart + 1, endIndex)
      .filter((line) => !STEP_HEADER_RE.test(line) && !INGREDIENT_HEADER_RE.test(line))
      .map(stripStepNumbering);
  }

  const recipe: ParsedRecipe = {
    title: titleLine,
    ingredients,
    steps,
  };

  if (descriptionLines.length > 0) recipe.description = descriptionLines.join(' ');
  if (prep_time_min !== undefined) recipe.prep_time_min = prep_time_min;
  if (cook_time_min !== undefined) recipe.cook_time_min = cook_time_min;
  if (servings !== undefined) recipe.servings = servings;

  return recipe;
}

function parseHeuristic(lines: string[]): ParsedRecipe {
  const title = lines[0];
  const remaining = lines.slice(1);
  const ingredients: string[] = [];
  const steps: string[] = [];
  const descriptionLines: string[] = [];
  let foundContent = false;

  for (const line of remaining) {
    if (LOOKS_LIKE_INGREDIENT_RE.test(line)) {
      ingredients.push(stripBullet(line));
      foundContent = true;
    } else if (foundContent || line.length > 60) {
      steps.push(stripStepNumbering(line));
      foundContent = true;
    } else {
      descriptionLines.push(line);
    }
  }

  const recipe: ParsedRecipe = { title, ingredients, steps };
  if (descriptionLines.length > 0) {
    recipe.description = descriptionLines.join(' ');
  }
  return recipe;
}

function stripBullet(line: string): string {
  return line.replace(/^[-•▪▸►]\s*/, '').trim();
}

function stripStepNumbering(line: string): string {
  return line.replace(STEP_NUMBER_RE, '').trim();
}
