import { describe, expect, it, vi } from 'vitest';
import { restartAppForRtlChange } from '../restart';

describe('restartAppForRtlChange (audit M6: production-safe RTL restart)', () => {
  it('uses the dev reload path in __DEV__ and does not touch the production path', async () => {
    const devReload = vi.fn();
    const productionReloadAsync = vi.fn().mockResolvedValue(undefined);
    const onManualRestartRequired = vi.fn();

    await restartAppForRtlChange({
      isDev: true,
      devReload,
      productionReloadAsync,
      onManualRestartRequired,
    });

    expect(devReload).toHaveBeenCalledTimes(1);
    expect(productionReloadAsync).not.toHaveBeenCalled();
    expect(onManualRestartRequired).not.toHaveBeenCalled();
  });

  it('falls back to the manual-restart UI if the dev reload throws', async () => {
    const devReload = vi.fn(() => {
      throw new Error('DevSettings unavailable');
    });
    const productionReloadAsync = vi.fn().mockResolvedValue(undefined);
    const onManualRestartRequired = vi.fn();

    await restartAppForRtlChange({
      isDev: true,
      devReload,
      productionReloadAsync,
      onManualRestartRequired,
    });

    expect(onManualRestartRequired).toHaveBeenCalledTimes(1);
    expect(productionReloadAsync).not.toHaveBeenCalled();
  });

  it('uses Updates.reloadAsync in production builds instead of DevSettings', async () => {
    const devReload = vi.fn();
    const productionReloadAsync = vi.fn().mockResolvedValue(undefined);
    const onManualRestartRequired = vi.fn();

    await restartAppForRtlChange({
      isDev: false,
      devReload,
      productionReloadAsync,
      onManualRestartRequired,
    });

    expect(productionReloadAsync).toHaveBeenCalledTimes(1);
    expect(devReload).not.toHaveBeenCalled();
    expect(onManualRestartRequired).not.toHaveBeenCalled();
  });

  it('shows the manual-restart fallback if Updates.reloadAsync rejects (never silently no-ops)', async () => {
    const devReload = vi.fn();
    const productionReloadAsync = vi.fn().mockRejectedValue(new Error('reload failed'));
    const onManualRestartRequired = vi.fn();

    await restartAppForRtlChange({
      isDev: false,
      devReload,
      productionReloadAsync,
      onManualRestartRequired,
    });

    expect(onManualRestartRequired).toHaveBeenCalledTimes(1);
  });
});
