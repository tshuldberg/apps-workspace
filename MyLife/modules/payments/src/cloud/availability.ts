import {
  createPaymentsDisclosureCallout,
} from '../compliance/disclosures/content';
import type {
  PaymentDisclosure,
} from '../types';

export type PaymentsCapabilityId = 'send' | 'funding' | 'card' | 'remittance';
export type PaymentsCapabilityHealth = 'operational' | 'degraded' | 'disabled';

export interface PaymentsCapabilityHealthCheck {
  capability: PaymentsCapabilityId;
  health: PaymentsCapabilityHealth;
  reason: string | null;
}

export interface PaymentsMaintenanceWindow {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}

export interface PaymentsAvailabilitySnapshot {
  checks: PaymentsCapabilityHealthCheck[];
  maintenanceWindows?: PaymentsMaintenanceWindow[];
  operatorOverride?: Partial<Record<PaymentsCapabilityId, PaymentsCapabilityHealth>>;
}

export interface PaymentsAvailabilityViewModel {
  readOnly: boolean;
  actions: Record<PaymentsCapabilityId, {
    enabled: boolean;
    health: PaymentsCapabilityHealth;
    message: string;
  }>;
  banner: PaymentDisclosure | null;
}

const CAPABILITIES: PaymentsCapabilityId[] = ['send', 'funding', 'card', 'remittance'];

function healthRank(health: PaymentsCapabilityHealth): number {
  switch (health) {
    case 'operational':
      return 0;
    case 'degraded':
      return 1;
    case 'disabled':
      return 2;
  }
}

function label(capability: PaymentsCapabilityId): string {
  switch (capability) {
    case 'send':
      return 'Send';
    case 'funding':
      return 'Funding';
    case 'card':
      return 'Card';
    case 'remittance':
      return 'Remittance';
  }
}

export function buildPaymentsAvailabilityViewModel(
  snapshot: PaymentsAvailabilitySnapshot,
): PaymentsAvailabilityViewModel {
  const actions = Object.fromEntries(
    CAPABILITIES.map((capability) => {
      const base = snapshot.checks.find((check) => check.capability === capability);
      const override = snapshot.operatorOverride?.[capability];
      const health = override ?? base?.health ?? 'operational';
      const reason = base?.reason ?? (override ? 'Operator override is active.' : null);

      return [
        capability,
        {
          enabled: health !== 'disabled',
          health,
          message: reason ?? `${label(capability)} is available.`,
        },
      ];
    }),
  ) as PaymentsAvailabilityViewModel['actions'];
  const worst = Object.values(actions).reduce<PaymentsCapabilityHealth>(
    (current, action) => (
      healthRank(action.health) > healthRank(current) ? action.health : current
    ),
    'operational',
  );
  const readOnly = Object.values(actions).every((action) => action.health === 'disabled');

  return {
    readOnly,
    actions,
    banner:
      worst === 'operational'
        ? null
        : createPaymentsDisclosureCallout({
            id: `payments_availability_${worst}`,
            tone: worst === 'disabled' ? 'danger' : 'warning',
            title: worst === 'disabled' ? 'Payments actions paused' : 'Payments degraded',
            body:
              worst === 'disabled'
                ? 'Risky money movement is disabled while balances and activity remain readable.'
                : 'Some payments actions may be queued, slower, or temporarily unavailable.',
          }),
  };
}
