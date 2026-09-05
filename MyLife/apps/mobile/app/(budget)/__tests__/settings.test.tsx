import { act, fireEvent, render, screen } from '@testing-library/react';
import { Alert, Share } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BudgetSettingsScreen from '../settings';

const pushMock = vi.fn();
const mockDb = { id: 'mock-db' };

const getGoalsMock = vi.fn();
const getSettingMock = vi.fn();
const serializeBudgetExportJsonMock = vi.fn();
const exportBudgetTransactionsCsvMock = vi.fn();
const resetBudgetDataMock = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => mockDb,
}));

vi.mock('@mylife/budget', () => ({
  getGoals: (...args: unknown[]) => getGoalsMock(...args),
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  serializeBudgetExportJson: (...args: unknown[]) => serializeBudgetExportJsonMock(...args),
  exportBudgetTransactionsCsv: (...args: unknown[]) => exportBudgetTransactionsCsvMock(...args),
  resetBudgetData: (...args: unknown[]) => resetBudgetDataMock(...args),
}));

type AlertButton = {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
};

function latestAlertButtons(): AlertButton[] {
  const latest = vi.mocked(Alert.alert).mock.calls.at(-1);
  return (latest?.[2] as AlertButton[] | undefined) ?? [];
}

describe('BudgetSettingsScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGoalsMock.mockReturnValue([{ id: 'goal-1' }, { id: 'goal-2' }]);
    getSettingMock.mockReturnValue('USD');
    serializeBudgetExportJsonMock.mockReturnValue('{"schemaVersion":1}');
    exportBudgetTransactionsCsvMock.mockReturnValue('id,amount\n');
    resetBudgetDataMock.mockReturnValue({
      rowsDeleted: 18,
      tablesVisited: 29,
      defaultsRestored: true,
    });
  });

  it('renders budget settings with live summary values', () => {
    render(<BudgetSettingsScreen />);

    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(screen.getByText('2 goals')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
    expect(screen.getByText('JSON backup / transactions CSV')).toBeInTheDocument();
  });

  it('exports json backup and transactions csv through Share', async () => {
    render(<BudgetSettingsScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Export Data/i }));

    const jsonButton = latestAlertButtons().find((button) => button.text === 'JSON Backup');
    await jsonButton?.onPress?.();

    expect(serializeBudgetExportJsonMock).toHaveBeenCalledWith(mockDb);
    expect(vi.mocked(Share.share)).toHaveBeenCalledWith({
      message: '{"schemaVersion":1}',
      title: 'MyBudget Backup',
    });

    fireEvent.click(screen.getByRole('button', { name: /Export Data/i }));

    const csvButton = latestAlertButtons().find((button) => button.text === 'Transactions CSV');
    await csvButton?.onPress?.();

    expect(exportBudgetTransactionsCsvMock).toHaveBeenCalledWith(mockDb);
    expect(vi.mocked(Share.share)).toHaveBeenCalledWith({
      message: 'id,amount\n',
      title: 'MyBudget Transactions Export',
    });
  });

  it('resets budget data after destructive confirmation', async () => {
    render(<BudgetSettingsScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Reset All Data/i }));

    const resetButton = latestAlertButtons().find((button) => button.text === 'Reset');
    await act(async () => {
      await resetButton?.onPress?.();
    });

    expect(resetBudgetDataMock).toHaveBeenCalledWith(mockDb);
    expect(vi.mocked(Alert.alert)).toHaveBeenCalledWith(
      'Reset Complete',
      expect.stringContaining('Removed 18 rows'),
    );
  });
});
