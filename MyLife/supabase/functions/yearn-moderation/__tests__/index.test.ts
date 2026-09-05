import { describe, expect, it, vi } from 'vitest';
import {
  handleRequest,
  rpcCallForOp,
  type YearnModerationDeps,
  type YearnModerationSupabaseClient,
} from '../index.ts';

const ADMIN_SECRET = 'yearn-moderation-admin-secret';
const SERVICE_ROLE_KEY = 'service-role-key';
const REPORT_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_USER_ID = '22222222-2222-4222-8222-222222222222';
const ESCALATION_ID = '33333333-3333-4333-8333-333333333333';

interface HarnessOptions {
  envOverrides?: Record<string, string | undefined>;
  rpcData?: unknown;
  rpcError?: unknown;
  rpcThrows?: boolean;
}

function makeRequest(
  body: unknown,
  options: { authorization?: string | null; method?: string } = {},
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const authorization = options.authorization === undefined
    ? `Bearer ${ADMIN_SECRET}`
    : options.authorization;
  if (authorization) headers.set('Authorization', authorization);
  return new Request('http://localhost/functions/v1/yearn-moderation', {
    method: options.method ?? 'POST',
    headers,
    body: options.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

function createHarness(options: HarnessOptions = {}) {
  const rpc = options.rpcThrows
    ? vi.fn().mockRejectedValue(new Error('network down'))
    : vi.fn().mockResolvedValue({
        data: options.rpcData ?? null,
        error: options.rpcError ?? null,
      });
  const schema = vi.fn().mockReturnValue({ rpc });
  const client: YearnModerationSupabaseClient = { schema };
  const createClient = vi.fn().mockReturnValue(client);
  const env: Record<string, string | undefined> = {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    YEARN_MODERATION_ADMIN_SECRET: ADMIN_SECRET,
    ...options.envOverrides,
  };
  const deps: YearnModerationDeps = {
    env: (key) => env[key],
    createClient,
  };
  return { deps, rpc, schema, createClient };
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('yearn-moderation handleRequest', () => {
  it.each([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'YEARN_MODERATION_ADMIN_SECRET',
  ])('fails closed with 503 when %s is missing', async (key) => {
    const { deps } = createHarness({ envOverrides: { [key]: undefined } });
    const response = await handleRequest(makeRequest({ op: 'list_reports' }), deps);
    expect(response.status).toBe(503);
    expect(await bodyOf(response)).toEqual({ error: 'not_configured' });
  });

  it('rejects non-POST methods', async () => {
    const { deps } = createHarness();
    const response = await handleRequest(makeRequest(null, { method: 'GET' }), deps);
    expect(response.status).toBe(405);
  });

  it('rejects a missing Authorization header without touching the client', async () => {
    const { deps, createClient } = createHarness();
    const response = await handleRequest(
      makeRequest({ op: 'list_reports' }, { authorization: null }),
      deps,
    );
    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('rejects a wrong admin secret', async () => {
    const { deps, createClient } = createHarness();
    const response = await handleRequest(
      makeRequest({ op: 'list_reports' }, { authorization: 'Bearer wrong-secret' }),
      deps,
    );
    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON bodies', async () => {
    const { deps } = createHarness();
    const headers = new Headers({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_SECRET}`,
    });
    const request = new Request('http://localhost/functions/v1/yearn-moderation', {
      method: 'POST',
      headers,
      body: 'not-json',
    });
    const response = await handleRequest(request, deps);
    expect(response.status).toBe(400);
    expect(await bodyOf(response)).toEqual({ error: 'malformed_body' });
  });

  it('rejects unknown ops', async () => {
    const { deps, rpc } = createHarness();
    const response = await handleRequest(makeRequest({ op: 'drop_tables' }), deps);
    expect(response.status).toBe(400);
    expect(await bodyOf(response)).toEqual({ error: 'unknown_op' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('routes list_reports through the yearn schema with clamped params', async () => {
    const { deps, rpc, schema } = createHarness({ rpcData: [] });
    const response = await handleRequest(
      makeRequest({ op: 'list_reports', status: 'open', limit: 500 }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(schema).toHaveBeenCalledWith('yearn');
    expect(rpc).toHaveBeenCalledWith('list_reports', {
      p_status: 'open',
      p_limit: 200,
      p_before: null,
    });
    expect(await bodyOf(response)).toEqual({ data: [] });
  });

  it('applies a moderation action with the full parameter set', async () => {
    const { deps, rpc } = createHarness();
    const response = await handleRequest(
      makeRequest({
        op: 'apply_action',
        targetUserId: TARGET_USER_ID,
        action: 'suspend',
        actor: 'ops:trey',
        reason: 'harassment',
        reportId: REPORT_ID,
        suspendUntil: '2026-08-06T00:00:00.000Z',
        detail: { source: 'queue' },
      }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('apply_moderation_action', {
      p_target_user_id: TARGET_USER_ID,
      p_action: 'suspend',
      p_actor: 'ops:trey',
      p_reason: 'harassment',
      p_report_id: REPORT_ID,
      p_suspend_until: '2026-08-06T00:00:00.000Z',
      p_detail: { source: 'queue' },
    });
  });

  it('surfaces RPC errors as rpc_failed with the database message', async () => {
    const { deps } = createHarness({
      rpcError: { message: 'moderate_report: report not found' },
    });
    const response = await handleRequest(
      makeRequest({
        op: 'set_report_status',
        reportId: REPORT_ID,
        status: 'actioned',
        reviewer: 'ops:trey',
      }),
      deps,
    );
    expect(response.status).toBe(400);
    expect(await bodyOf(response)).toEqual({
      error: 'rpc_failed',
      message: 'moderate_report: report not found',
    });
  });

  it('maps client exceptions to a 500 rpc_failed', async () => {
    const { deps } = createHarness({ rpcThrows: true });
    const response = await handleRequest(
      makeRequest({ op: 'get_report', reportId: REPORT_ID }),
      deps,
    );
    expect(response.status).toBe(500);
    expect(await bodyOf(response)).toEqual({ error: 'rpc_failed' });
  });
});

describe('rpcCallForOp validation', () => {
  it('refuses the transmitted escalation status (NCMEC transmission is founder-gated)', () => {
    expect(
      rpcCallForOp({
        op: 'advance_escalation',
        escalationId: ESCALATION_ID,
        status: 'transmitted',
        operator: 'ops:trey',
      }),
    ).toBe('invalid_status');
  });

  it('advances an escalation to ready_for_transmission', () => {
    expect(
      rpcCallForOp({
        op: 'advance_escalation',
        escalationId: ESCALATION_ID,
        status: 'ready_for_transmission',
        operator: 'ops:trey',
      }),
    ).toEqual({
      name: 'advance_safety_escalation',
      params: {
        p_escalation_id: ESCALATION_ID,
        p_new_status: 'ready_for_transmission',
        p_operator: 'ops:trey',
      },
    });
  });

  it('requires an operator to advance an escalation', () => {
    expect(
      rpcCallForOp({
        op: 'advance_escalation',
        escalationId: ESCALATION_ID,
        status: 'dismissed',
        operator: '   ',
      }),
    ).toBe('invalid_operator');
  });

  it('rejects malformed report ids', () => {
    expect(rpcCallForOp({ op: 'get_report', reportId: 'not-a-uuid' })).toBe(
      'invalid_report_id',
    );
  });

  it('rejects invalid report statuses', () => {
    expect(
      rpcCallForOp({
        op: 'set_report_status',
        reportId: REPORT_ID,
        status: 'deleted',
        reviewer: 'ops:trey',
      }),
    ).toBe('invalid_status');
  });

  it('requires a reviewer for report status changes', () => {
    expect(
      rpcCallForOp({
        op: 'set_report_status',
        reportId: REPORT_ID,
        status: 'dismissed',
        reviewer: '',
      }),
    ).toBe('invalid_reviewer');
  });

  it('rejects unknown moderation actions', () => {
    expect(
      rpcCallForOp({
        op: 'apply_action',
        targetUserId: TARGET_USER_ID,
        action: 'shadowban',
        actor: 'ops:trey',
      }),
    ).toBe('invalid_action');
  });

  it('rejects invalid suspendUntil timestamps', () => {
    expect(
      rpcCallForOp({
        op: 'apply_action',
        targetUserId: TARGET_USER_ID,
        action: 'suspend',
        actor: 'ops:trey',
        suspendUntil: 'tomorrow-ish',
      }),
    ).toBe('invalid_suspend_until');
  });

  it('rejects non-object action detail payloads', () => {
    expect(
      rpcCallForOp({
        op: 'apply_action',
        targetUserId: TARGET_USER_ID,
        action: 'warn',
        actor: 'ops:trey',
        detail: ['a'],
      }),
    ).toBe('invalid_detail');
  });

  it('rejects invalid escalation list statuses', () => {
    expect(rpcCallForOp({ op: 'list_escalations', status: 'archived' })).toBe(
      'invalid_status',
    );
  });

  it('accepts every legal escalation list status', () => {
    for (const status of [
      'pending_registration',
      'ready_for_transmission',
      'transmitted',
      'dismissed',
    ]) {
      expect(rpcCallForOp({ op: 'list_escalations', status })).toEqual({
        name: 'list_safety_escalations',
        params: { p_status: status, p_limit: 50, p_before: null },
      });
    }
  });

  it('defaults and clamps the list limit', () => {
    expect(rpcCallForOp({ op: 'list_reports', limit: 0 })).toEqual({
      name: 'list_reports',
      params: { p_status: null, p_limit: 1, p_before: null },
    });
    expect(rpcCallForOp({ op: 'list_reports', limit: 2.5 })).toEqual({
      name: 'list_reports',
      params: { p_status: null, p_limit: 50, p_before: null },
    });
  });

  it('rejects invalid before cursors', () => {
    expect(rpcCallForOp({ op: 'list_reports', before: 'yesterday' })).toBe(
      'invalid_before',
    );
  });

  it('lists verification submissions with a validated status', () => {
    expect(rpcCallForOp({ op: 'list_verifications', status: 'pending_review' })).toEqual({
      name: 'list_verification_submissions',
      params: { p_status: 'pending_review', p_limit: 50, p_before: null },
    });
    expect(rpcCallForOp({ op: 'list_verifications', status: 'archived' })).toBe(
      'invalid_status',
    );
  });

  it('reviews a verification with only the three legal decisions', () => {
    expect(
      rpcCallForOp({
        op: 'review_verification',
        submissionId: REPORT_ID,
        decision: 'approved',
        reviewer: 'ops:trey',
      }),
    ).toEqual({
      name: 'review_verification',
      params: {
        p_submission_id: REPORT_ID,
        p_decision: 'approved',
        p_reviewer: 'ops:trey',
        p_reason: null,
      },
    });
    // A client can never push a submission back to pending or superseded.
    for (const decision of ['pending_review', 'superseded', 'verified']) {
      expect(
        rpcCallForOp({
          op: 'review_verification',
          submissionId: REPORT_ID,
          decision,
          reviewer: 'ops:trey',
        }),
      ).toBe('invalid_decision');
    }
  });

  it('requires a reviewer to review a verification', () => {
    expect(
      rpcCallForOp({
        op: 'review_verification',
        submissionId: REPORT_ID,
        decision: 'rejected',
        reviewer: ' ',
      }),
    ).toBe('invalid_reviewer');
  });
});
