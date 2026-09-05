/**
 * DMCA registered-agent configuration loader (Plan 43 WP-43C).
 *
 * Replaces the hardcoded `DMCA_REGISTERED_AGENT` placeholder (configured:false) in dmca-intake.ts
 * with a VALIDATED runtime configuration. The founder + counsel supply the legal identity (real
 * name, operating entity, physical address, email, phone, and the U.S. Copyright Office
 * registration date); this module only validates and enforces the configured workflow -- it never
 * invents a legal fact.
 *
 * Fail-closed contract (NC-43.6):
 *  - FIRST-PARTY production REFUSES to launch while ANY required field is a placeholder or empty.
 *    `loadDmcaAgentConfig({ requireConfigured: true })` throws with the exact missing fields.
 *  - SELF-HOST may run without a registered-agent claim, but the served block says so accurately
 *    (`configured: false` + an honest notice), never a fabricated agent identity.
 *
 * The loader also carries the response-deadline policy (takedown notification + counter-notice
 * windows) that the DMCA alert evaluator (operator-alerts.ts) reads to flag unresolved items past
 * their deadline. Counsel/founder own the actual day counts; the code enforces whatever is set.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;
const PLACEHOLDER_RE = /<[^>]*>|FOUNDER TO|TO PROVIDE|TO REGISTER/iu;

/** The founder-supplied registered-agent identity. Every field is required for first-party mode. */
export interface DmcaAgentIdentity {
  agentName: string;
  organization: string;
  address: string;
  email: string;
  phone: string;
  /** ISO date (YYYY-MM-DD) the agent was registered with the U.S. Copyright Office. */
  registrationDate: string;
}

/** Response-deadline policy in days. Founder/counsel own the counts; code enforces them. */
export interface DmcaDeadlinePolicy {
  /** Days within which the operator must action or reject a received notice. */
  notificationDeadlineDays: number;
  /** Days a counter-noticed item is held before restoration is permitted (512(g), 10-14 business). */
  counterNoticeDeadlineDays: number;
}

export const DEFAULT_DMCA_DEADLINE_POLICY: DmcaDeadlinePolicy = {
  // Conservative defaults. Counsel confirms the operational targets; these only bound the alerting.
  notificationDeadlineDays: 5,
  counterNoticeDeadlineDays: 14,
};

/** The resolved config the intake route serves and the alert evaluator reads. */
export type DmcaAgentConfig =
  | {
      configured: true;
      deployment: 'first_party' | 'self_host';
      agent: DmcaAgentIdentity;
      deadlines: DmcaDeadlinePolicy;
    }
  | {
      configured: false;
      deployment: 'self_host';
      /** Honest notice served when no agent is registered. Never a fabricated identity. */
      notice: string;
      deadlines: DmcaDeadlinePolicy;
    };

const SELF_HOST_UNCONFIGURED_NOTICE =
  'This node runs in self-host mode without a registered DMCA designated agent. Notices are '
  + 'received and retained for the operator, but no Copyright Office agent registration is '
  + 'published here. Contact the operating entity for formal service of process.';

const REQUIRED_FIELDS: ReadonlyArray<keyof DmcaAgentIdentity> = [
  'agentName', 'organization', 'address', 'email', 'phone', 'registrationDate',
];

/** Raw env-shaped input; every field optional so a partial config produces exact missing-field errors. */
export interface DmcaAgentConfigInput {
  agentName?: string;
  organization?: string;
  address?: string;
  email?: string;
  phone?: string;
  registrationDate?: string;
  notificationDeadlineDays?: number;
  counterNoticeDeadlineDays?: number;
}

export interface LoadDmcaAgentConfigOptions {
  /** First-party production: refuse to resolve unless every field is present + non-placeholder. */
  requireConfigured: boolean;
  deployment: 'first_party' | 'self_host';
}

export class DmcaAgentConfigError extends Error {
  constructor(
    message: string,
    readonly missingFields: readonly string[],
  ) {
    super(message);
    this.name = 'DmcaAgentConfigError';
  }
}

/** True when a value is present and not a `<placeholder>`/`FOUNDER TO ...` stub. */
function isRealValue(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER_RE.test(value);
}

function fieldDefects(input: DmcaAgentConfigInput): string[] {
  const missing: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!isRealValue(input[field])) missing.push(field);
  }
  // Even a present email/date must be well-formed to be a real registered agent.
  if (isRealValue(input.email) && !EMAIL_RE.test(input.email.trim())) {
    if (!missing.includes('email')) missing.push('email');
  }
  if (isRealValue(input.registrationDate)) {
    const trimmed = input.registrationDate.trim();
    if (!ISO_DATE_RE.test(trimmed) || !Number.isFinite(Date.parse(trimmed))) {
      if (!missing.includes('registrationDate')) missing.push('registrationDate');
    }
  }
  return missing;
}

function resolveDeadlines(input: DmcaAgentConfigInput): DmcaDeadlinePolicy {
  const notification = input.notificationDeadlineDays;
  const counter = input.counterNoticeDeadlineDays;
  return {
    notificationDeadlineDays: Number.isSafeInteger(notification) && (notification as number) > 0
      ? (notification as number)
      : DEFAULT_DMCA_DEADLINE_POLICY.notificationDeadlineDays,
    counterNoticeDeadlineDays: Number.isSafeInteger(counter) && (counter as number) > 0
      ? (counter as number)
      : DEFAULT_DMCA_DEADLINE_POLICY.counterNoticeDeadlineDays,
  };
}

/**
 * Resolve the DMCA agent configuration. In first-party production (`requireConfigured: true`) a
 * missing/placeholder field THROWS a DmcaAgentConfigError listing the exact fields, so the service
 * refuses to launch. In self-host, a partial/absent config resolves to an honest unconfigured
 * block instead of a fabricated identity.
 */
export function loadDmcaAgentConfig(
  input: DmcaAgentConfigInput,
  options: LoadDmcaAgentConfigOptions,
): DmcaAgentConfig {
  const deadlines = resolveDeadlines(input);
  const missing = fieldDefects(input);

  if (missing.length === 0) {
    return {
      configured: true,
      deployment: options.deployment,
      agent: {
        agentName: input.agentName!.trim(),
        organization: input.organization!.trim(),
        address: input.address!.trim(),
        email: input.email!.trim(),
        phone: input.phone!.trim(),
        registrationDate: input.registrationDate!.trim(),
      },
      deadlines,
    };
  }

  if (options.requireConfigured) {
    throw new DmcaAgentConfigError(
      `First-party production requires a complete DMCA registered agent; missing or placeholder: ${missing.join(', ')}`,
      missing,
    );
  }

  return {
    configured: false,
    deployment: 'self_host',
    notice: SELF_HOST_UNCONFIGURED_NOTICE,
    deadlines,
  };
}

/**
 * Read the DMCA agent config from environment variables. First-party mode is inferred from
 * MEERKAT_DEPLOYMENT_PROFILE=first_party (or an explicit requireConfigured flag), which flips the
 * fail-closed gate on.
 */
export function resolveDmcaAgentConfigFromEnv(env: NodeJS.ProcessEnv): DmcaAgentConfig {
  const profile = (env.MEERKAT_DEPLOYMENT_PROFILE ?? '').trim().toLowerCase();
  const deployment = profile === 'first_party' || profile === 'first-party'
    ? 'first_party'
    : 'self_host';
  const parseDays = (raw: string | undefined): number | undefined => {
    if (raw === undefined || raw.trim() === '') return undefined;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  };
  return loadDmcaAgentConfig(
    {
      agentName: env.MEERKAT_DMCA_AGENT_NAME,
      organization: env.MEERKAT_DMCA_AGENT_ORG,
      address: env.MEERKAT_DMCA_AGENT_ADDRESS,
      email: env.MEERKAT_DMCA_AGENT_EMAIL,
      phone: env.MEERKAT_DMCA_AGENT_PHONE,
      registrationDate: env.MEERKAT_DMCA_AGENT_REGISTRATION_DATE,
      notificationDeadlineDays: parseDays(env.MEERKAT_DMCA_NOTIFICATION_DEADLINE_DAYS),
      counterNoticeDeadlineDays: parseDays(env.MEERKAT_DMCA_COUNTER_NOTICE_DEADLINE_DAYS),
    },
    { deployment, requireConfigured: deployment === 'first_party' },
  );
}

/**
 * The public-facing agent block the `GET /public/dmca/agent` route serves. Shaped to match the
 * legacy `DMCA_REGISTERED_AGENT` constant so the route swap is transparent, but sourced from the
 * validated config. Never leaks the deadline policy (an operational detail).
 */
export function dmcaAgentPublicBlock(config: DmcaAgentConfig): Record<string, unknown> {
  if (config.configured) {
    return {
      configured: true,
      agentName: config.agent.agentName,
      organization: config.agent.organization,
      address: config.agent.address,
      email: config.agent.email,
      phone: config.agent.phone,
      registrationDate: config.agent.registrationDate,
    };
  }
  return { configured: false, notice: config.notice };
}
