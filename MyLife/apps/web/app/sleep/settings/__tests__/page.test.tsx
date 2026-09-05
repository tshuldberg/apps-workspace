import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SLEEP_MODULE } from '@mylife/sleep';
import SleepSettingsPage from '../page';

let testDb: InMemoryTestDatabase;

vi.mock('@/lib/db', () => ({
  getAdapter: () => testDb.adapter,
}));

vi.mock('../../actions', () => ({
  saveSleepSettingsAction: vi.fn(),
}));

vi.mock('../SleepReminderPermission', () => ({
  SleepReminderPermission: () => <div>Browser permission</div>,
}));

describe('SleepSettingsPage', () => {
  beforeEach(() => {
    testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
  });

  afterEach(() => {
    testDb.close();
  });

  it('renders target and reminder settings', () => {
    render(<SleepSettingsPage />);

    expect(screen.getByText('Target hours')).toBeInTheDocument();
    expect(screen.getByText('Enable bedtime reminder')).toBeInTheDocument();
    expect(screen.getByText('Export for Therapist')).toBeInTheDocument();
    expect(screen.getByText('Sleep restriction window')).toBeInTheDocument();
    expect(screen.getByText('Enable sleep restriction tracking')).toBeInTheDocument();
    expect(screen.getByText('Browser permission')).toBeInTheDocument();
    expect(screen.getByText('Save Settings')).toBeInTheDocument();
  });
});
