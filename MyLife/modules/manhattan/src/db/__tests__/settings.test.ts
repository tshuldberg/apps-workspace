import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';
import { getSetting, setSetting } from '../crud/settings';

describe('manhattan settings CRUD', () => {
  it('returns null for unknown key', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    expect(getSetting(adapter, 'nonexistent')).toBeNull();
    close();
  });

  it('reads seeded settings', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    expect(getSetting(adapter, 'defaultCity')).toBe('New York');
    close();
  });

  it('sets and retrieves a setting', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    setSetting(adapter, 'myKey', 'myValue');
    expect(getSetting(adapter, 'myKey')).toBe('myValue');
    close();
  });

  it('overwrites an existing setting', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    setSetting(adapter, 'defaultCity', 'Brooklyn');
    expect(getSetting(adapter, 'defaultCity')).toBe('Brooklyn');
    close();
  });
});
