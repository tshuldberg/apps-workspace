/**
 * MyShop -> MyBudget integration adapters (P8-A).
 *
 * Pure helpers. No DB writes here. The Shop module never inserts into Budget
 * tables. Instead, it builds suggestion shapes that Budget can consume via its
 * own CRUD. If MyBudget is disabled, callers simply do not invoke these
 * helpers; nothing throws and no partner-module schema is assumed.
 */

import type { Purchase, Category } from '../models/schemas';

/**
 * Mapping from MyShop's 11 known categories to budget envelope/category names.
 * Names align with common envelope labels users create in MyBudget.
 */
const SHOP_TO_BUDGET_CATEGORY: Record<Category, string> = {
  tech: 'Electronics',
  clothing: 'Clothing',
  books: 'Books',
  home: 'Home',
  kitchen: 'Home',
  gaming: 'Gaming',
  music: 'Music',
  sports: 'Sports',
  gifts: 'Gifts',
  hobby: 'Hobby',
  other: 'Shopping',
};

/** Default fallback when a category is unknown or new. */
const DEFAULT_BUDGET_CATEGORY = 'Shopping';

/**
 * Deterministic mapping from a shop category to a budget category name.
 * Unknown categories fall back to "Shopping" so the helper never throws.
 */
export function mapShopCategoryToBudgetCategory(shopCategory: string): string {
  return (
    SHOP_TO_BUDGET_CATEGORY[shopCategory as Category] ?? DEFAULT_BUDGET_CATEGORY
  );
}

/**
 * Suggestion shape MyBudget can ingest. Pure data; no IO.
 *
 * Note: bg_transactions has no source_module / source_id columns today, so the
 * accepter helper in @mylife/budget encodes provenance into the `note` field
 * with a stable prefix. The fields below remain in the suggestion shape so the
 * UI layer can show "from Shop" without a DB schema change.
 */
export interface BudgetTransactionSuggestion {
  categoryName: string;
  amountCents: number;
  descriptor: string;
  occurredAt: string;
  sourceModule: 'shop';
  sourcePurchaseId: string;
}

/**
 * Pure transform from a Shop Purchase row to a Budget transaction suggestion.
 * Returns the shape MyBudget will use to create a transaction; this helper
 * never touches a DB.
 */
export function buildBudgetTransactionSuggestion(
  purchase: Purchase,
): BudgetTransactionSuggestion {
  return {
    categoryName: mapShopCategoryToBudgetCategory(purchase.category),
    amountCents: purchase.priceCents,
    descriptor: purchase.store
      ? `${purchase.name} (${purchase.store})`
      : purchase.name,
    occurredAt: purchase.purchaseDate,
    sourceModule: 'shop',
    sourcePurchaseId: purchase.id,
  };
}

/**
 * Aggregate monthly shop spending for MyBudget's category breakdown view.
 *
 * - `purchases` may be empty (MyShop disabled, no rows) — returns zeros.
 * - Returned amounts are in cents.
 * - Filters by year/month parsed from `purchase.purchaseDate` (YYYY-MM-DD).
 *   Returned purchases are ignored.
 */
export function summarizeMonthlyShopSpendingForBudget(
  purchases: Purchase[],
  year: number,
  month: number,
): { totalCents: number; byCategory: Record<string, number> } {
  if (!purchases || purchases.length === 0) {
    return { totalCents: 0, byCategory: {} };
  }

  const monthStr = String(month).padStart(2, '0');
  const prefix = `${year}-${monthStr}`;

  let totalCents = 0;
  const byCategory: Record<string, number> = {};

  for (const p of purchases) {
    if (p.returned) continue;
    if (typeof p.purchaseDate !== 'string') continue;
    if (!p.purchaseDate.startsWith(prefix)) continue;

    const budgetCat = mapShopCategoryToBudgetCategory(p.category);
    totalCents += p.priceCents;
    byCategory[budgetCat] = (byCategory[budgetCat] ?? 0) + p.priceCents;
  }

  return { totalCents, byCategory };
}
