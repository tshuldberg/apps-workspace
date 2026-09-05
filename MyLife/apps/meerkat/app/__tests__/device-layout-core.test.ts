import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { ensureSyncBootstrap, configureSyncSecretStore, createInMemorySyncSecretStore } from '@mylife/sync';
import { getDeviceLayoutDefault, getLayoutDeviceClass, setDeviceLayoutDefault, setLayoutDeviceClass, deviceHomeLayout, subscribeDeviceLayout } from '../(root)/data/device-layout-core';
import { ensureMeerkatTables } from '../(root)/data/db';
import { draftLayoutProblems } from '../(root)/data/community-layout-core';
import { ONBOARDING_EXPERIENCES } from '../(root)/data/onboarding-experience-core';
let db: InMemoryTestDatabase;
beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase(); ensureSyncBootstrap(db.adapter); ensureMeerkatTables(db.adapter);
});
afterEach(() => db.close());
describe('device-local layout defaults', () => {
  it('follows the community by default and never writes on read', () => {
    expect(getLayoutDeviceClass(db.adapter, 'desktop')).toBe('desktop');
    expect(getLayoutDeviceClass(db.adapter, 'mobile')).toBe('mobile');
    expect(deviceHomeLayout(db.adapter, 'mobile', 'Friends', 'general')).toBeNull();
    expect(db.adapter.query('SELECT * FROM mk_settings WHERE key LIKE ?', ['layout_%'])).toEqual([]);
  });
  it('keeps desktop/mobile profiles independent and retains them when switching', () => {
    setDeviceLayoutDefault(db.adapter, 'desktop', 'video');
    setDeviceLayoutDefault(db.adapter, 'mobile', 'shorts');
    setLayoutDeviceClass(db.adapter, 'desktop');
    expect(deviceHomeLayout(db.adapter, 'mobile', 'Friends', 'discussion', ['video', 'shortform'])?.capabilities).toEqual(['video']);
    setLayoutDeviceClass(db.adapter, 'mobile');
    const home = deviceHomeLayout(db.adapter, 'desktop', 'Friends', 'discussion', ['video', 'shortform'])!;
    expect(home.capabilities).toEqual(['shortform']);
    expect(home.home.find((node) => node.type === 'chat')?.config.channelId).toBe('discussion');
    expect(getDeviceLayoutDefault(db.adapter, 'desktop')).toBe('video');
    expect(getDeviceLayoutDefault(db.adapter, 'mobile')).toBe('shorts');
    expect(db.adapter.query('SELECT * FROM sync_change_log')).toEqual([]);
  });
  it('loads every starter with valid blocks and retains chat even when media is unfinished', () => {
    for (const item of ONBOARDING_EXPERIENCES) {
      setDeviceLayoutDefault(db.adapter, 'mobile', item.id);
      const home = deviceHomeLayout(db.adapter, 'mobile', 'Our group', 'actual-channel')!;
      expect(draftLayoutProblems(home)).toEqual([]);
      expect(home.home.some((node) => node.type === 'chat' && node.config.channelId === 'actual-channel')).toBe(true);
    }
  });
  it('cannot grant a capability that the verified owner layout did not declare', () => {
    setDeviceLayoutDefault(db.adapter, 'mobile', 'live');
    expect(deviceHomeLayout(db.adapter, 'mobile', 'Friends', 'general')?.capabilities).toEqual([]);
    expect(deviceHomeLayout(db.adapter, 'mobile', 'Friends', 'general', ['live'])?.capabilities).toEqual(['live']);
  });
  it('returns to the owner layout and recovers from corrupt settings', () => {
    setDeviceLayoutDefault(db.adapter, 'mobile', 'live');
    setDeviceLayoutDefault(db.adapter, 'mobile', 'community');
    expect(deviceHomeLayout(db.adapter, 'mobile', 'Friends')).toBeNull();
    db.adapter.execute("INSERT OR REPLACE INTO mk_settings (key,value) VALUES ('layout_default:mobile','unknown')");
    db.adapter.execute("INSERT OR REPLACE INTO mk_settings (key,value) VALUES ('layout_device_class','unknown')");
    expect(deviceHomeLayout(db.adapter, 'mobile', 'Friends')).toBeNull();
    expect(getLayoutDeviceClass(db.adapter, 'mobile')).toBe('mobile');
  });
  it('refuses unknown values and signals local changes without publishing sync events', () => {
    let calls = 0;
    const unsubscribe = subscribeDeviceLayout(() => { calls += 1; });
    expect(() => setDeviceLayoutDefault(db.adapter, 'mobile', 'bogus' as never)).toThrow('known layout');
    expect(() => setLayoutDeviceClass(db.adapter, 'bogus' as never)).toThrow('desktop or mobile');
    expect(calls).toBe(0);
    setDeviceLayoutDefault(db.adapter, 'mobile', 'live');
    expect(calls).toBe(1);
    unsubscribe();
    setDeviceLayoutDefault(db.adapter, 'mobile', 'standard');
    expect(calls).toBe(1);
    expect(db.adapter.query('SELECT * FROM sync_change_log')).toEqual([]);
  });
});
