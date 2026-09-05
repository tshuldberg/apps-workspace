export interface DiningDishMacros {
  /** Calories for this dish. */
  calories: number;
  /** Protein in grams. */
  proteinG?: number;
  /** Carbohydrates in grams. */
  carbsG?: number;
  /** Fat in grams. */
  fatG?: number;
}

export interface DiningVisitContext {
  restaurantName: string;
  visitDate: string;
  dishes: Array<{ name: string; course: string | null }>;
}

export function buildNutritionLogFromVisit(context: DiningVisitContext): {
  prefillMealLabel: string;
  prefillNotes: string;
  sourceModule: 'dining';
} {
  const dishList = context.dishes.map(d => d.name).join(', ');
  return {
    prefillMealLabel: `Dining at ${context.restaurantName}`,
    prefillNotes: dishList ? `Dishes: ${dishList}` : `Meal at ${context.restaurantName}`,
    sourceModule: 'dining',
  };
}

/**
 * Map a dining course value onto a nutrition meal type.
 * Nutrition meal types are breakfast, lunch, dinner, snack.
 */
export function diningCourseToMealType(course: string | null): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  switch ((course ?? '').toLowerCase()) {
    case 'dessert':
    case 'side':
    case 'drink':
      return 'snack';
    case 'appetizer':
    case 'main':
    default:
      return 'dinner';
  }
}

export interface DiningMealNutritionSpec {
  /** Date for the food log entry (YYYY-MM-DD). */
  date: string;
  /** Nutrition meal type the entry should be filed under. */
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  /** Human readable note describing where this meal came from. */
  notes: string;
  /** Source module marker so callers can tag the persisted food. */
  sourceModule: 'dining';
  /** Custom food rows to create and log, one per dish with macro data. */
  foods: Array<{
    name: string;
    brand: string;
    servingSize: number;
    servingUnit: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }>;
  /** Aggregate macro totals across all included dishes. */
  totals: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
}

/**
 * Build a persistable nutrition spec from a dining visit and its dishes.
 *
 * Only dishes that carry macro data (a positive calorie value) are included as
 * food rows, since a nutrition log item requires real macro numbers. The
 * returned spec is a plain data structure: callers persist it with the
 * nutrition CRUD (createCustomFood, createFoodLogEntry, addFoodLogItem). This
 * stays free of any database, network, or React Native dependency so it remains
 * safe to import from both the Expo mobile app and the Next.js web app.
 */
export function buildNutritionMealFromVisit(
  context: DiningVisitContext,
  dishMacros: Array<DiningDishMacros | null | undefined>,
): DiningMealNutritionSpec {
  const foods: DiningMealNutritionSpec['foods'] = [];
  const totals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

  context.dishes.forEach((dish, index) => {
    const macros = dishMacros[index];
    if (!macros || !(macros.calories > 0)) return;

    const proteinG = macros.proteinG ?? 0;
    const carbsG = macros.carbsG ?? 0;
    const fatG = macros.fatG ?? 0;

    foods.push({
      name: dish.name,
      brand: context.restaurantName,
      servingSize: 1,
      servingUnit: 'serving',
      calories: macros.calories,
      proteinG,
      carbsG,
      fatG,
    });

    totals.calories += macros.calories;
    totals.proteinG += proteinG;
    totals.carbsG += carbsG;
    totals.fatG += fatG;
  });

  const firstCourse = context.dishes[0]?.course ?? null;
  const base = buildNutritionLogFromVisit(context);

  return {
    date: context.visitDate,
    mealType: diningCourseToMealType(firstCourse),
    notes: base.prefillNotes,
    sourceModule: 'dining',
    foods,
    totals,
  };
}
