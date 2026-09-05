export interface DiningDishContext {
  dishName: string;
  restaurantName: string;
  notes: string | null;
  course: string | null;
}

export function buildRecipeFromDish(context: DiningDishContext): {
  prefillName: string;
  prefillNotes: string;
  sourceModule: 'dining';
} {
  return {
    prefillName: `${context.dishName} (inspired by ${context.restaurantName})`,
    prefillNotes: [
      context.notes,
      context.course ? `Course: ${context.course}` : null,
      `Inspired by a dish at ${context.restaurantName}`,
    ].filter(Boolean).join('\n'),
    sourceModule: 'dining',
  };
}
