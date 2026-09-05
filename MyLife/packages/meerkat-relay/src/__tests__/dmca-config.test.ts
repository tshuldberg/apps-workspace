import { describe, expect, it } from 'vitest';
import {
  loadDmcaAgentConfig,
  resolveDmcaAgentConfigFromEnv,
  dmcaAgentPublicBlock,
  DmcaAgentConfigError,
  DEFAULT_DMCA_DEADLINE_POLICY,
  type DmcaAgentConfigInput,
} from '../dmca-config';

const COMPLETE: DmcaAgentConfigInput = {
  agentName: 'Jane Counsel',
  organization: 'Meerkat Networks LLC',
  address: '1 Market St, San Francisco, CA 94105',
  email: 'dmca@meerkat.example',
  phone: '+1-555-0100',
  registrationDate: '2026-06-01',
};

describe('DMCA agent config loader', () => {
  it('refuses first-party launch while any placeholder/empty field remains', () => {
    const placeholder: DmcaAgentConfigInput = {
      agentName: '<DMCA designated agent name -- FOUNDER TO REGISTER (P15)>',
      organization: '<Meerkat operating entity -- FOUNDER TO PROVIDE>',
      address: '',
      email: '<dmca@ -- FOUNDER TO PROVIDE>',
      phone: '',
      registrationDate: '',
    };
    let error: unknown;
    try {
      loadDmcaAgentConfig(placeholder, { requireConfigured: true, deployment: 'first_party' });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(DmcaAgentConfigError);
    const missing = (error as DmcaAgentConfigError).missingFields;
    expect(missing).toEqual(expect.arrayContaining([
      'agentName', 'organization', 'address', 'email', 'phone', 'registrationDate',
    ]));
  });

  it('accepts a complete first-party config', () => {
    const config = loadDmcaAgentConfig(COMPLETE, { requireConfigured: true, deployment: 'first_party' });
    expect(config).toMatchObject({ configured: true, deployment: 'first_party' });
    if (!config.configured) throw new Error('expected configured');
    expect(config.agent.email).toBe('dmca@meerkat.example');
    expect(config.deadlines).toEqual(DEFAULT_DMCA_DEADLINE_POLICY);
  });

  it('rejects a malformed email even when present', () => {
    expect(() => loadDmcaAgentConfig(
      { ...COMPLETE, email: 'not-an-email' },
      { requireConfigured: true, deployment: 'first_party' },
    )).toThrow(DmcaAgentConfigError);
  });

  it('rejects a malformed registration date even when present', () => {
    expect(() => loadDmcaAgentConfig(
      { ...COMPLETE, registrationDate: 'June 2026' },
      { requireConfigured: true, deployment: 'first_party' },
    )).toThrow(DmcaAgentConfigError);
  });

  it('self-host runs without an agent, resolving an honest unconfigured block', () => {
    const config = loadDmcaAgentConfig({}, { requireConfigured: false, deployment: 'self_host' });
    expect(config.configured).toBe(false);
    if (config.configured) throw new Error('expected unconfigured');
    expect(config.notice).toMatch(/self-host/i);
    const block = dmcaAgentPublicBlock(config);
    expect(block).toMatchObject({ configured: false });
    expect(JSON.stringify(block)).not.toMatch(/agentName/);
  });

  it('honors overridden deadline days', () => {
    const config = loadDmcaAgentConfig(
      { ...COMPLETE, notificationDeadlineDays: 3, counterNoticeDeadlineDays: 10 },
      { requireConfigured: true, deployment: 'first_party' },
    );
    expect(config.deadlines).toEqual({ notificationDeadlineDays: 3, counterNoticeDeadlineDays: 10 });
  });

  it('the public block for a configured agent carries the identity, not the deadlines', () => {
    const config = loadDmcaAgentConfig(COMPLETE, { requireConfigured: true, deployment: 'first_party' });
    const block = dmcaAgentPublicBlock(config);
    expect(block).toMatchObject({ configured: true, agentName: 'Jane Counsel' });
    expect(block).not.toHaveProperty('notificationDeadlineDays');
  });
});

describe('resolveDmcaAgentConfigFromEnv', () => {
  it('first-party env with placeholders throws', () => {
    expect(() => resolveDmcaAgentConfigFromEnv({
      MEERKAT_DEPLOYMENT_PROFILE: 'first_party',
      MEERKAT_DMCA_AGENT_NAME: '<FOUNDER TO REGISTER>',
    } as NodeJS.ProcessEnv)).toThrow(DmcaAgentConfigError);
  });

  it('accepts the canonical hyphenated first-party deployment profile and still fails closed', () => {
    expect(() => resolveDmcaAgentConfigFromEnv({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
    } as NodeJS.ProcessEnv)).toThrow(DmcaAgentConfigError);
  });

  it('self-host env with no agent resolves unconfigured', () => {
    const config = resolveDmcaAgentConfigFromEnv({} as NodeJS.ProcessEnv);
    expect(config.configured).toBe(false);
  });

  it('first-party env with a complete agent resolves configured', () => {
    const config = resolveDmcaAgentConfigFromEnv({
      MEERKAT_DEPLOYMENT_PROFILE: 'first_party',
      MEERKAT_DMCA_AGENT_NAME: COMPLETE.agentName,
      MEERKAT_DMCA_AGENT_ORG: COMPLETE.organization,
      MEERKAT_DMCA_AGENT_ADDRESS: COMPLETE.address,
      MEERKAT_DMCA_AGENT_EMAIL: COMPLETE.email,
      MEERKAT_DMCA_AGENT_PHONE: COMPLETE.phone,
      MEERKAT_DMCA_AGENT_REGISTRATION_DATE: COMPLETE.registrationDate,
    } as NodeJS.ProcessEnv);
    expect(config).toMatchObject({ configured: true, deployment: 'first_party' });
  });
});
