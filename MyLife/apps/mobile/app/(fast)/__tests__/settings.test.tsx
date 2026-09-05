import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FastSettingsScreen from '../settings';

const mockDb = { id: 'mock-db' };

const getSettingMock = vi.fn();
const setSettingMock = vi.fn();
const getNotificationPreferencesMock = vi.fn();
const setNotificationPreferenceMock = vi.fn();
const listGoalsMock = vi.fn();
const listGoalProgressMock = vi.fn();
const createGoalMock = vi.fn();
const upsertGoalMock = vi.fn();
const refreshGoalProgressMock = vi.fn();
const setWaterTargetMock = vi.fn();
const exportFastsCSVMock = vi.fn();
const exportWeightCSVMock = vi.fn();
const probeHealthSyncStatusMock = vi.fn();
const syncHealthDataMock = vi.fn();

vi.mock('@mylife/fast', () => ({
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
  getNotificationPreferences: (...args: unknown[]) => getNotificationPreferencesMock(...args),
  setNotificationPreference: (...args: unknown[]) => setNotificationPreferenceMock(...args),
  listGoals: (...args: unknown[]) => listGoalsMock(...args),
  listGoalProgress: (...args: unknown[]) => listGoalProgressMock(...args),
  createGoal: (...args: unknown[]) => createGoalMock(...args),
  upsertGoal: (...args: unknown[]) => upsertGoalMock(...args),
  refreshGoalProgress: (...args: unknown[]) => refreshGoalProgressMock(...args),
  setWaterTarget: (...args: unknown[]) => setWaterTargetMock(...args),
  exportFastsCSV: (...args: unknown[]) => exportFastsCSVMock(...args),
  exportWeightCSV: (...args: unknown[]) => exportWeightCSVMock(...args),
  getBeverageTypes: vi.fn(() => []),
  createBeverageType: vi.fn(),
  updateBeverageType: vi.fn(),
  deleteBeverageType: vi.fn(),
  getContainerPresets: vi.fn(() => []),
  createContainerPreset: vi.fn(),
  updateContainerPreset: vi.fn(),
  deleteContainerPreset: vi.fn(),
  volumeToGlasses: vi.fn((oz: number) => oz / 8),
  calculatePersonalizedTarget: vi.fn(() => 64),
  generateReminderSlots: vi.fn(() => []),
}));

vi.mock('../../../lib/health-sync', () => ({
  getHealthSyncStatus: () => ({
    available: true,
    platform: 'ios',
    reason: 'Health sync is available.',
  }),
  probeHealthSyncStatus: (...args: unknown[]) => probeHealthSyncStatusMock(...args),
  syncHealthData: (...args: unknown[]) => syncHealthDataMock(...args),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

describe('FastSettingsScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingMock.mockImplementation((_db: unknown, key: string) => {
      if (key === 'defaultProtocol') return '16:8';
      if (key === 'healthSyncEnabled') return '0';
      if (key === 'healthReadWeight') return '0';
      if (key === 'healthWriteFasts') return '0';
      if (key === 'waterDailyTarget') return '8';
      return null;
    });
    getNotificationPreferencesMock.mockReturnValue({
      fastStart: false,
      progress25: false,
      progress50: false,
      progress75: false,
      fastComplete: false,
    });
    listGoalsMock.mockReturnValue([]);
    listGoalProgressMock.mockReturnValue([]);
    probeHealthSyncStatusMock.mockResolvedValue({
      available: true,
      platform: 'ios',
      reason: 'Health sync is available.',
    });
    syncHealthDataMock.mockResolvedValue({
      available: true,
      platform: 'ios',
      importedWeightEntries: 0,
      exportedFasts: 0,
      message: 'Synced.',
    });
    exportFastsCSVMock.mockReturnValue('id,protocol\n');
    exportWeightCSVMock.mockReturnValue('id,weight_value\n');
  });

  it('saves updated protocol, notification, goal, and health settings', () => {
    render(<FastSettingsScreen />);

    fireEvent.change(screen.getByPlaceholderText('16:8'), {
      target: { value: '18:6' },
    });

    const switches = screen.getAllByRole('checkbox');
    fireEvent.click(switches[0]); // fastStart notification
    fireEvent.click(switches[6]); // health sync enabled
    fireEvent.click(switches[7]); // read weight
    fireEvent.click(switches[8]); // write fasts

    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    expect(setSettingMock).toHaveBeenCalledWith(mockDb, 'defaultProtocol', '18:6');
    expect(setSettingMock).toHaveBeenCalledWith(mockDb, 'healthSyncEnabled', '1');
    expect(setSettingMock).toHaveBeenCalledWith(mockDb, 'healthReadWeight', '1');
    expect(setSettingMock).toHaveBeenCalledWith(mockDb, 'healthWriteFasts', '1');
    expect(setNotificationPreferenceMock).toHaveBeenCalledWith(mockDb, 'fastStart', true);
    expect(createGoalMock).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        type: 'fasts_per_week',
      }),
    );
    expect(refreshGoalProgressMock).toHaveBeenCalledWith(mockDb);
    expect(upsertGoalMock).not.toHaveBeenCalled();
  });

  it('renders data export and about sections', () => {
    render(<FastSettingsScreen />);

    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export as CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erase All Data' })).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('MyFast v0.1.0')).toBeInTheDocument();
  });

  it('calls export functions when Export as CSV is pressed', () => {
    render(<FastSettingsScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Export as CSV' }));

    expect(exportFastsCSVMock).toHaveBeenCalledWith(mockDb);
    expect(exportWeightCSVMock).toHaveBeenCalledWith(mockDb);
  });
});
