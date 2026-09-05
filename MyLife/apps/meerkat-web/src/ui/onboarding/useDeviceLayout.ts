import { useSyncExternalStore } from 'react';
import type { DatabaseAdapter } from '@mylife/db';
import { deviceLayoutRevision, getDeviceLayoutDefault, getLayoutDeviceClass, subscribeDeviceLayout, type LayoutDeviceClass } from '../../lib/device-layout-core';

export function browserLayoutClass(): LayoutDeviceClass {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop';
}
export function useDeviceLayout(db: DatabaseAdapter) {
  const revision = useSyncExternalStore(subscribeDeviceLayout, deviceLayoutRevision, deviceLayoutRevision);
  const profile = getLayoutDeviceClass(db, browserLayoutClass());
  return { profile, choice: getDeviceLayoutDefault(db, profile), revision };
}
