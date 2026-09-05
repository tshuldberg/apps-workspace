/**
 * Side-effect registration of every automation rule the hub knows about.
 *
 * The @mylife/automations registry is a module-scoped singleton; rule
 * definitions live in each module's package but do NOT self-register at
 * import time (so test harnesses can clear+re-populate the registry without
 * fighting module re-evaluation). The hub shell is the single place that
 * declares "these are the rules this app ships with".
 *
 * Idempotent: guarded so Fast Refresh / re-mounts do not double-register
 * (registerRule throws on duplicate ids).
 */
import { registerRule, getRule } from '@mylife/automations';
import { receiptToBudgetRule } from '@mylife/budget';
import { mailIcsToEventsRule } from '@mylife/mail';
import { recipeToNutritionRule } from '@mylife/bestchef';
import { highlightToFlashRule } from '@mylife/books';

let registered = false;

export function ensureAutomationsRegistered(): void {
  if (registered) return;
  if (!getRule(receiptToBudgetRule.id)) {
    try {
      registerRule(receiptToBudgetRule);
    } catch {
      // Another call registered it first; safe to ignore.
    }
  }
  if (!getRule(mailIcsToEventsRule.id)) {
    try {
      registerRule(mailIcsToEventsRule);
    } catch {
      // Another call registered it first; safe to ignore.
    }
  }
  if (!getRule(recipeToNutritionRule.id)) {
    try {
      registerRule(recipeToNutritionRule);
    } catch {
      // Another call registered it first; safe to ignore.
    }
  }
  if (!getRule(highlightToFlashRule.id)) {
    try {
      registerRule(highlightToFlashRule);
    } catch {
      // Another call registered it first; safe to ignore.
    }
  }
  registered = true;
}
