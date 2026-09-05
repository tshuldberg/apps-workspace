import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { WEB_SUPPORTED_MODULE_IDS, WEB_VISIBLE_MODULE_IDS } from '@/lib/modules';
import { getEnabledModuleIds } from '../actions';
import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  getEnabledModules,
  enableModule,
  getPreference,
  setPreference,
} from '@mylife/db';

vi.mock('@/lib/db', () => ({
  getAdapter: vi.fn(),
  ensureModuleMigrations: vi.fn(),
}));

vi.mock('@mylife/db', () => ({
  getEnabledModules: vi.fn(),
  enableModule: vi.fn(),
  disableModule: vi.fn(),
  incrementAggregateEventCounter: vi.fn(),
  listAggregateEventCounters: vi.fn(),
  getPreference: vi.fn(),
  setPreference: vi.fn(),
}));

vi.mock('@/lib/entitlements', () => ({
  getModeConfig: vi.fn(),
  saveModeConfig: vi.fn(),
  getStoredEntitlement: vi.fn(),
  saveEntitlement: vi.fn(),
}));

vi.mock('@/lib/server-endpoint', () => ({
  resolveCurrentApiBaseUrl: vi.fn(),
  testSelfHostConnection: vi.fn(),
}));

const mockGetAdapter = vi.mocked(getAdapter);
const mockEnsureModuleMigrations = vi.mocked(ensureModuleMigrations);
const mockGetEnabledModules = vi.mocked(getEnabledModules);
const mockEnableModule = vi.mocked(enableModule);
const mockGetPreference = vi.mocked(getPreference);
const mockSetPreference = vi.mocked(setPreference);

describe('getEnabledModuleIds', () => {
  const dbAdapter = {} as DatabaseAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdapter.mockReturnValue(dbAdapter);
    mockGetPreference.mockReturnValue(undefined);
  });

  it('bootstraps all web-supported modules when no modules are enabled', async () => {
    mockGetEnabledModules.mockReturnValue([]);

    const ids = await getEnabledModuleIds();

    expect(ids).toEqual(WEB_VISIBLE_MODULE_IDS);
    expect(mockEnableModule).toHaveBeenCalledTimes(WEB_VISIBLE_MODULE_IDS.length);
    expect(mockEnsureModuleMigrations).toHaveBeenCalledTimes(
      WEB_VISIBLE_MODULE_IDS.length,
    );
    for (const moduleId of WEB_VISIBLE_MODULE_IDS) {
      expect(mockEnableModule).toHaveBeenCalledWith(dbAdapter, moduleId);
      expect(mockEnsureModuleMigrations).toHaveBeenCalledWith(moduleId);
    }
    expect(mockSetPreference).toHaveBeenCalledWith(
      dbAdapter,
      'web.bootstrap.enabled_modules.v5',
      '1',
    );
  });

  it('bootstraps when legacy state has only books enabled', async () => {
    mockGetEnabledModules.mockReturnValue([
      { module_id: 'books', enabled_at: '2026-02-25 04:12:44' },
    ]);

    const ids = await getEnabledModuleIds();

    expect(ids).toEqual(WEB_VISIBLE_MODULE_IDS);
    expect(mockEnableModule).toHaveBeenCalledTimes(WEB_VISIBLE_MODULE_IDS.length);
    expect(mockSetPreference).toHaveBeenCalledWith(
      dbAdapter,
      'web.bootstrap.enabled_modules.v5',
      '1',
    );
  });

  it('upgrades partial enabled state by enabling missing web-supported modules', async () => {
    mockGetEnabledModules.mockReturnValue([
      { module_id: 'books', enabled_at: '2026-02-25 04:12:44' },
      { module_id: 'budget', enabled_at: '2026-02-25 04:13:44' },
    ]);

    const ids = await getEnabledModuleIds();

    expect(ids).toEqual(WEB_VISIBLE_MODULE_IDS);
    expect(mockEnableModule).toHaveBeenCalledTimes(
      WEB_VISIBLE_MODULE_IDS.length - 2,
    );
    expect(mockEnableModule).not.toHaveBeenCalledWith(dbAdapter, 'books');
    expect(mockEnableModule).not.toHaveBeenCalledWith(dbAdapter, 'budget');
    expect(mockSetPreference).toHaveBeenCalledWith(
      dbAdapter,
      'web.bootstrap.enabled_modules.v5',
      '1',
    );
  });

  it('returns current enabled modules without bootstrapping when already configured', async () => {
    mockGetPreference.mockReturnValue('1');
    mockGetEnabledModules.mockReturnValue([
      { module_id: 'books', enabled_at: '2026-02-25 04:12:44' },
      { module_id: 'budget', enabled_at: '2026-02-25 04:13:44' },
    ]);

    const ids = await getEnabledModuleIds();

    expect(ids).toEqual(['books', 'budget']);
    expect(mockEnableModule).not.toHaveBeenCalled();
    expect(mockEnsureModuleMigrations).not.toHaveBeenCalled();
    expect(mockSetPreference).not.toHaveBeenCalled();
  });

  it('filters out hidden and unsupported modules from enabled results', async () => {
    mockGetPreference.mockReturnValue('1');
    mockGetEnabledModules.mockReturnValue([
      { module_id: 'books', enabled_at: '2026-02-25 04:12:44' },
      { module_id: 'payments', enabled_at: '2026-02-25 04:12:54' },
      { module_id: 'surf', enabled_at: '2026-02-25 04:13:44' },
      { module_id: 'workouts', enabled_at: '2026-02-25 04:14:44' },
      { module_id: 'subs', enabled_at: '2026-02-25 04:15:44' },
    ]);

    const ids = await getEnabledModuleIds();

    expect(ids).toEqual(['books', 'workouts']);
    expect(mockEnableModule).not.toHaveBeenCalled();
  });

  it('keeps payments out of the bootstrap set but surfaces overridden modules', () => {
    expect(WEB_SUPPORTED_MODULE_IDS).toContain('payments');
    expect(WEB_SUPPORTED_MODULE_IDS).toContain('sleep');
    expect(WEB_VISIBLE_MODULE_IDS).not.toContain('payments');
    expect(WEB_VISIBLE_MODULE_IDS).toContain('sleep');
    expect(WEB_VISIBLE_MODULE_IDS).toContain('dining');
    expect(WEB_VISIBLE_MODULE_IDS).toContain('rsvp');
    expect(WEB_VISIBLE_MODULE_IDS).toContain('sports');
    expect(WEB_VISIBLE_MODULE_IDS).toContain('health');
  });
});
