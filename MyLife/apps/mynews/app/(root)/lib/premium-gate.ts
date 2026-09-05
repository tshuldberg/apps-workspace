/**
 * The PremiumGate decision, extracted as a pure function so the rules that
 * matter most can be tested without a React Native renderer:
 *
 *  - an unconfigured build NEVER renders purchase controls (no store
 *    connection means no paywall, no simulated access),
 *  - entitlement-exempt routes (legal, notices, account) render regardless,
 *  - everything else keeps the gate.
 */

import { isEntitlementExemptRoute } from './entitlement-routes';

export type MyNewsGateStatus = 'loading' | 'entitled' | 'locked' | 'unavailable' | 'error';

/**
 * 'children'    render the app.
 * 'loading'     entitlement is still being resolved.
 * 'unavailable' honest not-configured state, no purchase controls.
 * 'paywall'     purchase and restore controls.
 */
export type PremiumGateView = 'children' | 'loading' | 'unavailable' | 'paywall';

export interface PremiumGateInput {
  isEntitled: boolean;
  isConfigured: boolean;
  status: MyNewsGateStatus;
  segments: readonly string[];
}

export function premiumGateView(input: PremiumGateInput): PremiumGateView {
  if (input.isEntitled) return 'children';
  if (isEntitlementExemptRoute(input.segments)) return 'children';
  if (input.status === 'loading') return 'loading';
  if (!input.isConfigured) return 'unavailable';
  return 'paywall';
}
