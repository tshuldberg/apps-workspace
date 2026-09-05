// ---------------------------------------------------------------------------
// Hosted / self-host entitlement model
// (distinct from the mobile IAP entitlement model in types.ts)
// ---------------------------------------------------------------------------

/** Deployment mode for the MyLife web/server installation. */
export type PlanMode = 'hosted' | 'self_host' | 'local_only';

/**
 * Unsigned entitlement payload — does not yet have a signature.
 * Produced by the billing issuer before signing.
 */
export interface UnsignedEntitlements {
  appId: string;
  /** Stable authenticated billing subject when the entitlement is user-bound. */
  subjectId?: string;
  mode: PlanMode;
  hostedActive: boolean;
  selfHostLicense: boolean;
  updatePackYear?: number;
  features: string[];
  issuedAt: string;
  expiresAt?: string;
}

/**
 * Signed entitlement token — stored client-side and verified server-side.
 */
export interface Entitlements extends UnsignedEntitlements {
  signature: string;
}
