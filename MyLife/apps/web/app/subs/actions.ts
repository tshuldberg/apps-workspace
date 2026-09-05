'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  listSubscriptions,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getSubscriptionCount,
  listCategories,
  createCategory,
  deleteCategory,
  getPriceHistory,
  addPriceChange,
  getUpcomingRenewals,
  generateRenewalEvents,
  markRenewalPaid,
  getRenewalEvents,
  logCancellationAction,
  getCancellationHistory,
  listAlternatives,
  addAlternative,
  deleteAlternative,
  searchCatalog,
  getCatalogByCategory,
  getAllCatalogEntries,
  getCostSummary,
  getCategoryBreakdown,
  getCycleBreakdown,
  getPriceChanges,
  getSpendingProjection,
  getCalendarMonth,
  getAgendaView,
  getRenewalSummary,
  getOpportunities,
  calculateTotalSavings,
  getComparison,
  getComparisonSummary,
  normalizeToMonthlyCents,
  // V2 - Bank detection
  getPendingDetections,
  getDetectedSubscription,
  listDetectedSubscriptions,
  listDismissedPayees,
  removeDismissedPayee,
  acceptDetectedSubscription,
  dismissDetectedSubscription,
  acceptAllPendingDetections,
  isPlaidConfigured,
  type CreateSubscriptionInput,
  type UpdateSubscriptionInput,
  type CreateCategoryInput,
  type CreateCancellationActionInput,
  type CreatePriceAlternativeInput,
  type SubscriptionFilter,
  type DetectionStatus,
} from '@mylife/subs';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('subs');
  return adapter;
}

// ── Subscription CRUD ────────────────────────────────────────────

export async function fetchSubscriptions(filter?: SubscriptionFilter) {
  return listSubscriptions(db(), filter);
}

export async function fetchSubscription(id: string) {
  return getSubscription(db(), id);
}

export async function doCreateSubscription(input: CreateSubscriptionInput) {
  const id = crypto.randomUUID();
  return createSubscription(db(), id, input);
}

export async function doUpdateSubscription(id: string, input: UpdateSubscriptionInput) {
  return updateSubscription(db(), id, input);
}

export async function doDeleteSubscription(id: string) {
  return deleteSubscription(db(), id);
}

export async function fetchSubscriptionCount(status?: string) {
  return getSubscriptionCount(db(), status);
}

// ── Categories ───────────────────────────────────────────────────

export async function fetchCategories() {
  return listCategories(db());
}

export async function doCreateCategory(input: CreateCategoryInput) {
  const id = crypto.randomUUID();
  return createCategory(db(), id, input);
}

export async function doDeleteCategory(id: string) {
  return deleteCategory(db(), id);
}

// ── Price History ────────────────────────────────────────────────

export async function fetchPriceHistory(subscriptionId: string) {
  return getPriceHistory(db(), subscriptionId);
}

export async function doAddPriceChange(
  subscriptionId: string,
  oldCostCents: number,
  newCostCents: number,
  notes?: string,
) {
  const id = crypto.randomUUID();
  return addPriceChange(db(), id, subscriptionId, oldCostCents, newCostCents, notes);
}

// ── Renewal Events ───────────────────────────────────────────────

export async function fetchUpcomingRenewals(daysAhead: number) {
  return getUpcomingRenewals(db(), daysAhead);
}

export async function doGenerateRenewalEvents(subscriptionId: string, monthsAhead?: number) {
  return generateRenewalEvents(db(), subscriptionId, monthsAhead);
}

export async function doMarkRenewalPaid(eventId: string) {
  return markRenewalPaid(db(), eventId);
}

export async function fetchRenewalEvents(subscriptionId: string) {
  return getRenewalEvents(db(), subscriptionId);
}

// ── Cancellation Actions ─────────────────────────────────────────

export async function doLogCancellationAction(input: CreateCancellationActionInput) {
  const id = crypto.randomUUID();
  return logCancellationAction(db(), id, input);
}

export async function fetchCancellationHistory(subscriptionId: string) {
  return getCancellationHistory(db(), subscriptionId);
}

// ── Alternatives ─────────────────────────────────────────────────

export async function fetchAlternatives(subscriptionId: string) {
  return listAlternatives(db(), subscriptionId);
}

export async function doAddAlternative(input: CreatePriceAlternativeInput) {
  const id = crypto.randomUUID();
  return addAlternative(db(), id, input);
}

export async function doDeleteAlternative(id: string) {
  return deleteAlternative(db(), id);
}

// ── Catalog ──────────────────────────────────────────────────────

export async function searchCatalogAction(query: string) {
  return searchCatalog(db(), query);
}

export async function fetchCatalogByCategory(categoryId: string) {
  return getCatalogByCategory(db(), categoryId);
}

export async function fetchAllCatalog() {
  return getAllCatalogEntries(db());
}

// ── Engines: Cost Analysis ───────────────────────────────────────

export async function fetchCostSummary() {
  return getCostSummary(db());
}

export async function fetchCategoryBreakdown() {
  return getCategoryBreakdown(db());
}

export async function fetchCycleBreakdown() {
  return getCycleBreakdown(db());
}

export async function fetchPriceChanges() {
  return getPriceChanges(db());
}

export async function fetchSpendingProjection() {
  return getSpendingProjection(db());
}

// ── Engines: Renewal Calendar ────────────────────────────────────

export async function fetchCalendarMonth(year: number, month: number) {
  return getCalendarMonth(db(), year, month);
}

export async function fetchAgendaView(daysAhead: number) {
  return getAgendaView(db(), daysAhead);
}

export async function fetchRenewalSummary() {
  return getRenewalSummary(db());
}

// ── Engines: Cancellation Assist ─────────────────────────────────

export async function fetchOpportunities(threshold?: number) {
  return getOpportunities(db(), threshold);
}

export async function fetchTotalSavings(year?: number) {
  return calculateTotalSavings(db(), year);
}

// ── Engines: Price Comparison ────────────────────────────────────

export async function fetchComparison(subscriptionId: string) {
  return getComparison(db(), subscriptionId);
}

export async function fetchComparisonSummary() {
  return getComparisonSummary(db());
}

// ── Helpers ──────────────────────────────────────────────────────

export async function generateAllRenewalEvents() {
  const adapter = db();
  const subs = listSubscriptions(adapter, { status: 'active', sortBy: 'name', sortOrder: 'asc' });
  for (const sub of subs) {
    generateRenewalEvents(adapter, sub.id, 12);
  }
  const trialSubs = listSubscriptions(adapter, { status: 'trial', sortBy: 'name', sortOrder: 'asc' });
  for (const sub of trialSubs) {
    generateRenewalEvents(adapter, sub.id, 12);
  }
}

export async function fetchNormalizedMonthlyCost(costCents: number, cycle: string) {
  return normalizeToMonthlyCents(costCents, cycle as Parameters<typeof normalizeToMonthlyCents>[1]);
}

// ── Bank Sync Detection ─────────────────────────────────────────

export async function fetchPlaidConfigured() {
  return isPlaidConfigured();
}

export async function fetchPendingDetections() {
  return getPendingDetections(db());
}

export async function fetchDetectedSubscription(id: string) {
  return getDetectedSubscription(db(), id);
}

export async function fetchDetections(status?: DetectionStatus) {
  return listDetectedSubscriptions(db(), status);
}

export async function doAcceptDetection(detectionId: string, overrides?: Partial<CreateSubscriptionInput>) {
  const detection = getDetectedSubscription(db(), detectionId);
  if (!detection) throw new Error(`Detection ${detectionId} not found`);
  return acceptDetectedSubscription(db(), detection, overrides);
}

export async function doDismissDetection(detectionId: string) {
  const detection = getDetectedSubscription(db(), detectionId);
  if (!detection) throw new Error(`Detection ${detectionId} not found`);
  dismissDetectedSubscription(db(), detection);
}

export async function doAcceptAllDetections(minConfidence?: number) {
  return acceptAllPendingDetections(db(), minConfidence);
}

export async function fetchDismissedPayees() {
  return listDismissedPayees(db());
}

export async function doRemoveDismissedPayee(normalizedPayee: string) {
  removeDismissedPayee(db(), normalizedPayee);
}
