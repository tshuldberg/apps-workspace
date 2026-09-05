/**
 * No-op notification platform for environments where
 * native notifications are unavailable (SSR, tests).
 */

import type { NotificationPlatformOps, ScheduledNotification } from './types';

let noopCounter = 0;

export const noopPlatform: NotificationPlatformOps = {
  async requestPermission(): Promise<boolean> {
    return false;
  },
  async checkPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
    return 'undetermined';
  },
  async schedule(_notification: ScheduledNotification): Promise<string> {
    noopCounter += 1;
    return `noop_${noopCounter}`;
  },
  async cancel(_platformNotificationId: string): Promise<void> {
    // no-op
  },
  async cancelAll(): Promise<void> {
    // no-op
  },
};
