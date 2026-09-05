'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { calculateReminderFireDate } from '@mylife/sleep';

export function SleepReminderPermission({
  enabled,
  targetBedtime,
  minutesBefore,
}: {
  enabled: boolean;
  targetBedtime: string;
  minutesBefore: number;
}) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [permission, setPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported',
  );

  const clearReminder = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleReminder = useCallback(() => {
    clearReminder();
    if (
      !enabled ||
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return;
    }

    const fireDate = calculateReminderFireDate(
      targetBedtime,
      minutesBefore,
      new Date(),
    );
    timeoutRef.current = setTimeout(() => {
      new Notification('Time to wind down', {
        body: `Target bedtime in ${minutesBefore} minutes.`,
      });
    }, Math.max(1, fireDate.getTime() - Date.now()));
  }, [clearReminder, enabled, minutesBefore, targetBedtime]);

  useEffect(() => {
    scheduleReminder();
    return clearReminder;
  }, [clearReminder, scheduleReminder]);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    scheduleReminder();
  }, [scheduleReminder]);

  return (
    <div style={styles.card}>
      <div>
        <p style={styles.kicker}>Browser permission</p>
        <p style={styles.copy}>
          {permission === 'granted'
            ? 'Browser reminders are allowed for this tab.'
            : permission === 'denied'
              ? 'Browser reminders are blocked in this browser.'
              : permission === 'unsupported'
                ? 'This browser does not expose the Notification API.'
                : 'Request permission to let this tab show the next wind-down reminder.'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void requestPermission()}
        style={styles.button}
      >
        Request Permission
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(167,139,250,0.24)',
    background: 'rgba(167,139,250,0.09)',
  },
  kicker: {
    margin: 0,
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  copy: {
    margin: '6px 0 0',
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  button: {
    border: '1px solid rgba(167,139,250,0.36)',
    background: 'rgba(167,139,250,0.16)',
    color: '#F5F3FF',
    borderRadius: 999,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
};
