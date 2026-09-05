/**
 * Action items (sub-tasks) engine.
 * Allows habits to have ordered sub-steps that are completed individually.
 * E.g., "Morning Routine" -> [brush teeth, stretch, journal, meditate].
 * Pure functions: no database calls, no side effects.
 */

export interface ActionItemState {
  id: string;
  label: string;
  sortOrder: number;
  isCompleted: boolean;
}

/**
 * Calculate completion progress for a habit's action items on a given date.
 */
export function calculateActionProgress(
  totalItems: number,
  completedItems: number,
): { completed: number; total: number; percentage: number; allDone: boolean } {
  if (totalItems === 0) {
    return { completed: 0, total: 0, percentage: 100, allDone: true };
  }
  const percentage = Math.round((completedItems / totalItems) * 100);
  return {
    completed: completedItems,
    total: totalItems,
    percentage,
    allDone: completedItems >= totalItems,
  };
}

/**
 * Merge action items with their completion status for a given date.
 */
export function resolveActionStates(
  items: Array<{ id: string; label: string; sortOrder: number }>,
  completedItemIds: Set<string>,
): ActionItemState[] {
  return items
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(item => ({
      id: item.id,
      label: item.label,
      sortOrder: item.sortOrder,
      isCompleted: completedItemIds.has(item.id),
    }));
}

/**
 * Reorder action items. Returns new sort orders for each item.
 * Items are identified by their ID and assigned sequential sort orders.
 */
export function reorderItems(
  orderedIds: string[],
): Array<{ id: string; sortOrder: number }> {
  return orderedIds.map((id, index) => ({ id, sortOrder: index }));
}

/**
 * Get the next uncompleted action item in the list.
 * Returns null if all items are completed.
 */
export function getNextIncomplete(states: ActionItemState[]): ActionItemState | null {
  return states.find(s => !s.isCompleted) ?? null;
}

/**
 * Check if completing all action items should auto-complete the parent habit.
 */
export function shouldAutoCompleteHabit(
  totalItems: number,
  completedItems: number,
): boolean {
  return totalItems > 0 && completedItems >= totalItems;
}
