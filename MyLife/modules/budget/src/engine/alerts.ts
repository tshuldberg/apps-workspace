/**
 * Budget alert checking engine.
 *
 * Monitors envelope spending against configured thresholds and fires
 * alerts when spending crosses a percentage of the envelope's target.
 * Alerts are suppressed if already fired for the current month.
 *
 * In the hub, "categories" map to "envelopes".
 *
 * All amounts in integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlertConfig {
  id: string;
  envelopeId: string;
  thresholdPct: number; // e.g. 80 means fire at 80% of target
  isEnabled: boolean;
}

export interface AlertHistoryEntry {
  alertId: string;
  envelopeId: string;
  month: string;       // YYYY-MM
  thresholdPct: number;
  spentPct: number;
  amountSpent: number; // cents (positive, absolute spending)
  targetAmount: number; // cents
  notifiedAt: string;
}

export interface EnvelopeSpendState {
  envelopeId: string;
  name: string;
  spent: number;       // cents (positive = amount spent, absolute of activity)
  targetAmount: number; // cents
}

export interface AlertNotification {
  alertId: string;
  envelopeId: string;
  envelopeName: string;
  thresholdPct: number;
  spentPct: number;
  amountSpent: number;  // cents
  targetAmount: number; // cents
  message: string;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Check all alert configs against current budget state and return
 * alerts that should fire this month.
 */
export function checkAlerts(
  alertConfigs: AlertConfig[],
  envelopeStates: EnvelopeSpendState[],
  alertHistory: AlertHistoryEntry[],
  month: string,
): AlertNotification[] {
  const stateMap = new Map<string, EnvelopeSpendState>();
  for (const state of envelopeStates) {
    stateMap.set(state.envelopeId, state);
  }

  const notifications: AlertNotification[] = [];

  for (const alert of alertConfigs) {
    if (!alert.isEnabled) continue;

    const state = stateMap.get(alert.envelopeId);
    if (!state) continue;
    if (state.targetAmount <= 0) continue;

    if (shouldFireAlert(alert, state.spent, state.targetAmount, alertHistory, month)) {
      notifications.push(buildAlertNotification(alert, state));
    }
  }

  return notifications;
}

/**
 * Determine if an alert should fire based on threshold crossing
 * and deduplication against alert history.
 */
export function shouldFireAlert(
  alert: AlertConfig,
  spent: number,
  target: number,
  alertHistory: AlertHistoryEntry[],
  month: string,
): boolean {
  if (target <= 0) return false;

  const spentPct = Math.round((spent / target) * 100);
  if (spentPct < alert.thresholdPct) return false;

  // Check if already fired this month
  const alreadyFired = alertHistory.some(
    (entry) => entry.alertId === alert.id && entry.month === month,
  );

  return !alreadyFired;
}

/**
 * Build a display-ready alert notification.
 */
export function buildAlertNotification(
  alert: AlertConfig,
  envelope: EnvelopeSpendState,
): AlertNotification {
  const spentPct = Math.round((envelope.spent / envelope.targetAmount) * 100);

  return {
    alertId: alert.id,
    envelopeId: alert.envelopeId,
    envelopeName: envelope.name,
    thresholdPct: alert.thresholdPct,
    spentPct,
    amountSpent: envelope.spent,
    targetAmount: envelope.targetAmount,
    message: `${envelope.name}: ${spentPct}% of budget spent (threshold: ${alert.thresholdPct}%)`,
  };
}
