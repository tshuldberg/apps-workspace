import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SleepFactorLogForm } from '../SleepFactorLogForm';
import { saveSleepFactorLog } from '../../actions';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock('../../actions', () => ({
  saveSleepFactorLog: vi.fn(),
}));

describe('SleepFactorLogForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveSleepFactorLog).mockResolvedValue({
      id: 'factor-1',
      sleep_entry_id: 'entry-1',
      date: '2026-04-22',
      last_caffeine_time: '18:15',
      last_meal_time: null,
      alcohol_drinks: 0,
      exercise_today: false,
      exercise_time: null,
      screen_cutoff_time: null,
      room_temp: null,
      room_light: null,
      room_noise: null,
      supplements: [],
      stress_level: 4,
      pre_sleep_activities: [],
      notes: null,
      created_at: '2026-04-22T07:00:00Z',
    });
  });

  it('saves a quick log for the selected night and routes to the linked entry', async () => {
    render(
      <SleepFactorLogForm
        closeHref="/sleep/factors"
        factorsByMode={{ tonight: null, last_night: null }}
        initialMode="last_night"
        initialQuick
        linkedEntry={null}
        referenceNowIso="2026-04-22T09:00:00-07:00"
      />,
    );

    fireEvent.change(screen.getByLabelText('Caffeine cutoff'), {
      target: { value: '18:15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stress level 4: High' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Quick Log' }));

    await waitFor(() => {
      expect(saveSleepFactorLog).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-04-22',
          last_caffeine_time: '18:15',
          stress_level: 4,
          exercise_today: false,
        }),
      );
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/sleep/entry/entry-1');
    });
  });

  it('keeps existing full-log values when saving from quick mode', async () => {
    render(
      <SleepFactorLogForm
        closeHref="/sleep/factors"
        factorsByMode={{
          last_night: {
            id: 'factor-1',
            sleep_entry_id: null,
            date: '2026-04-22',
            last_caffeine_time: '17:45',
            last_meal_time: '20:00',
            alcohol_drinks: 1,
            exercise_today: true,
            exercise_time: '18:30',
            screen_cutoff_time: '21:45',
            room_temp: 'cool',
            room_light: 'dark',
            room_noise: 'quiet',
            supplements: ['magnesium'],
            stress_level: 3,
            pre_sleep_activities: ['reading'],
            notes: 'Window noise.',
            created_at: '2026-04-22T06:50:00Z',
          },
        }}
        initialMode="last_night"
        initialQuick
        linkedEntry={null}
        referenceNowIso="2026-04-22T09:00:00-07:00"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Quick Log' }));

    await waitFor(() => {
      expect(saveSleepFactorLog).toHaveBeenCalledWith(
        expect.objectContaining({
          last_meal_time: '20:00',
          alcohol_drinks: 1,
          screen_cutoff_time: '21:45',
          room_temp: 'cool',
          supplements: ['magnesium'],
          pre_sleep_activities: ['reading'],
          notes: 'Window noise.',
        }),
      );
    });
  });
});
