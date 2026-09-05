import { describe, expect, it, vi } from 'vitest';
import { consumeProviderQuota, isProviderKillSwitchEnabled } from '../broker';

describe('provider kill switch', () => {
  it('is enabled only when BESTCHEF_PROVIDER_KILL_SWITCH=1', () => {
    expect(
      isProviderKillSwitchEnabled((k) =>
        k === 'BESTCHEF_PROVIDER_KILL_SWITCH' ? '1' : undefined,
      ),
    ).toBe(true);
    expect(isProviderKillSwitchEnabled(() => '0')).toBe(false);
    expect(isProviderKillSwitchEnabled(() => undefined)).toBe(false);
  });
});

describe('consumeProviderQuota', () => {
  it('allows when the RPC says allowed and converts the window to seconds', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { allowed: true, reason: 'ok' }, error: null });
    const res = await consumeProviderQuota(rpc, 'user-1', 'vision', 30, 60_000);
    expect(res).toEqual({ allowed: true, reason: 'ok' });
    expect(rpc).toHaveBeenCalledWith('bc_consume_provider_quota', {
      p_user_id: 'user-1',
      p_fn: 'vision',
      p_max: 30,
      p_window_seconds: 60,
    });
  });

  it('denies with the reason the RPC returns', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: false, reason: 'global_daily_cap' },
      error: null,
    });
    expect(await consumeProviderQuota(rpc, 'u', 'vision', 30, 60_000)).toEqual({
      allowed: false,
      reason: 'global_daily_cap',
    });
  });

  it('fails closed on an RPC error', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await consumeProviderQuota(rpc, 'u', 'vision', 30, 60_000)).toEqual({
      allowed: false,
      reason: 'quota_error',
    });
  });

  it('fails closed when the RPC throws', async () => {
    const rpc = vi.fn().mockRejectedValue(new Error('network'));
    expect(await consumeProviderQuota(rpc, 'u', 'vision', 30, 60_000)).toEqual({
      allowed: false,
      reason: 'quota_error',
    });
  });
});
