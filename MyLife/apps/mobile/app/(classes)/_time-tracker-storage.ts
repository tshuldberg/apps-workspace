import { Storage } from 'expo-sqlite/kv-store';
import type { TimeTrackerStorage } from '@mylife/classes';

export const classesTimerStorage: TimeTrackerStorage = {
  getItem(key) {
    return Storage.getItem(key);
  },
  setItem(key, value) {
    return Storage.setItem(key, value);
  },
  removeItem(key) {
    return Storage.removeItem(key);
  },
};
