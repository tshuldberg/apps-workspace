/**
 * Backwards-compatible ingredient renderer (F-034).
 *
 * Existing recipes whose ingredients were stored as raw strings still render
 * via this helper. New recipes have structured fields populated by the parser
 * but should still round-trip back to a clean human-readable form.
 *
 * If structured fields are present we format them as `qty unit item, prep`.
 * Otherwise we fall back to the raw `name` column.
 */
import type { Ingredient } from '../types';

export interface DisplayableIngredient {
  name?: string | null;
  quantity?: string | null;
  quantity_value?: number | null;
  unit?: string | null;
  item?: string | null;
  prep_note?: string | null;
}

function formatQuantity(input: DisplayableIngredient): string | null {
  if (input.quantity_value != null && Number.isFinite(input.quantity_value)) {
    const v = input.quantity_value;
    // Render integers cleanly; up to 2 decimal places otherwise.
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 100) / 100);
  }
  if (input.quantity && input.quantity.trim().length > 0) {
    return input.quantity.trim();
  }
  return null;
}

export function displayIngredient(ingredient: DisplayableIngredient): string {
  const itemRaw = (ingredient.item ?? '').trim();
  const item = itemRaw.length > 0 ? itemRaw : (ingredient.name ?? '').trim();

  // No structured fields at all: fall back to the raw name string.
  const hasStructuredFields =
    ingredient.quantity_value != null ||
    (ingredient.quantity && ingredient.quantity.trim().length > 0) ||
    (ingredient.unit && ingredient.unit.trim().length > 0) ||
    (ingredient.prep_note && ingredient.prep_note.trim().length > 0) ||
    (itemRaw.length > 0 && itemRaw !== (ingredient.name ?? '').trim());

  if (!hasStructuredFields) {
    return (ingredient.name ?? '').trim();
  }

  const qty = formatQuantity(ingredient);
  const unit = (ingredient.unit ?? '').trim();
  const prep = (ingredient.prep_note ?? '').trim();

  const parts: string[] = [];
  const head = [qty, unit].filter((p) => p && p.length > 0).join(' ');
  if (head.length > 0) parts.push(head);
  if (item.length > 0) parts.push(item);

  const head2 = parts.join(' ').trim();
  if (prep.length > 0) {
    return head2.length > 0 ? `${head2}, ${prep}` : prep;
  }
  return head2.length > 0 ? head2 : (ingredient.name ?? '').trim();
}

/** Convenience for the full Ingredient row from the DB. */
export function displayIngredientRow(row: Ingredient): string {
  return displayIngredient({
    name: row.name,
    quantity: row.quantity,
    quantity_value: row.quantity_value,
    unit: row.unit,
    item: row.item,
    prep_note: row.prep_note,
  });
}
