import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { SURF_MODULE } from '../../definition';
import {
  createSpot,
  createSpotAlert,
  getSpotAlerts,
  setSpotAlertActive,
  deleteSpotAlert,
} from '../crud';

describe('@mylife/surf - alerts CRUD', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('surf', SURF_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;

    createSpot(adapter, 'spot-1', {
      name: 'Ocean Beach',
      region: 'san_francisco',
      breakType: 'beach',
    });
  });

  afterEach(() => {
    closeDb();
  });

  // ── createSpotAlert with rules ──

  it('creates an alert with rules and retrieves it', () => {
    createSpotAlert(adapter, 'alert-1', {
      userId: 'user-1',
      spotId: 'spot-1',
      name: 'Swell Alert',
      rules: [
        { parameter: 'swell_height_ft', operator: 'gt', value: 4, joinWith: 'and', sortOrder: 0 },
        { parameter: 'wind_speed_kts', operator: 'lt', value: 10, joinWith: 'and', sortOrder: 1 },
      ],
    });

    const alerts = getSpotAlerts(adapter, 'user-1');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.id).toBe('alert-1');
    expect(alerts[0]!.name).toBe('Swell Alert');
    expect(alerts[0]!.isActive).toBe(true);
    expect(alerts[0]!.cooldownMinutes).toBe(30);
    expect(alerts[0]!.rules).toHaveLength(2);
    expect(alerts[0]!.rules[0]!.parameter).toBe('swell_height_ft');
    expect(alerts[0]!.rules[0]!.operator).toBe('gt');
    expect(alerts[0]!.rules[0]!.value).toBe(4);
    expect(alerts[0]!.rules[1]!.parameter).toBe('wind_speed_kts');
    expect(alerts[0]!.rules[1]!.operator).toBe('lt');
    expect(alerts[0]!.rules[1]!.value).toBe(10);
  });

  it('creates an alert with custom cooldown', () => {
    createSpotAlert(adapter, 'alert-1', {
      userId: 'user-1',
      spotId: 'spot-1',
      name: 'Quick Alert',
      cooldownMinutes: 60,
      rules: [
        { parameter: 'rating', operator: 'gte', value: 4, joinWith: 'and', sortOrder: 0 },
      ],
    });

    const alerts = getSpotAlerts(adapter, 'user-1');
    expect(alerts[0]!.cooldownMinutes).toBe(60);
  });

  // ── getSpotAlerts with filters ──

  it('filters alerts by spotId', () => {
    createSpot(adapter, 'spot-2', {
      name: 'Fort Point',
      region: 'san_francisco',
      breakType: 'point',
    });

    createSpotAlert(adapter, 'alert-1', {
      userId: 'user-1',
      spotId: 'spot-1',
      name: 'Alert for OB',
      rules: [{ parameter: 'swell_height_ft', operator: 'gt', value: 3, joinWith: 'and', sortOrder: 0 }],
    });
    createSpotAlert(adapter, 'alert-2', {
      userId: 'user-1',
      spotId: 'spot-2',
      name: 'Alert for FP',
      rules: [{ parameter: 'swell_height_ft', operator: 'gt', value: 5, joinWith: 'and', sortOrder: 0 }],
    });

    const spot1Alerts = getSpotAlerts(adapter, 'user-1', 'spot-1');
    expect(spot1Alerts).toHaveLength(1);
    expect(spot1Alerts[0]!.name).toBe('Alert for OB');

    const allAlerts = getSpotAlerts(adapter, 'user-1');
    expect(allAlerts).toHaveLength(2);
  });

  it('returns empty array for non-existent user', () => {
    expect(getSpotAlerts(adapter, 'no-user')).toEqual([]);
  });

  // ── setSpotAlertActive ──

  it('deactivates an alert', () => {
    createSpotAlert(adapter, 'alert-1', {
      userId: 'user-1',
      spotId: 'spot-1',
      name: 'Alert',
      rules: [{ parameter: 'swell_height_ft', operator: 'gt', value: 3, joinWith: 'and', sortOrder: 0 }],
    });

    setSpotAlertActive(adapter, 'alert-1', false);
    const alerts = getSpotAlerts(adapter, 'user-1');
    expect(alerts[0]!.isActive).toBe(false);
  });

  it('reactivates an alert', () => {
    createSpotAlert(adapter, 'alert-1', {
      userId: 'user-1',
      spotId: 'spot-1',
      name: 'Alert',
      rules: [{ parameter: 'swell_height_ft', operator: 'gt', value: 3, joinWith: 'and', sortOrder: 0 }],
    });

    setSpotAlertActive(adapter, 'alert-1', false);
    setSpotAlertActive(adapter, 'alert-1', true);
    const alerts = getSpotAlerts(adapter, 'user-1');
    expect(alerts[0]!.isActive).toBe(true);
  });

  // ── deleteSpotAlert ──

  it('deletes an alert by id', () => {
    createSpotAlert(adapter, 'alert-1', {
      userId: 'user-1',
      spotId: 'spot-1',
      name: 'Alert',
      rules: [{ parameter: 'swell_height_ft', operator: 'gt', value: 3, joinWith: 'and', sortOrder: 0 }],
    });

    deleteSpotAlert(adapter, 'alert-1');
    expect(getSpotAlerts(adapter, 'user-1')).toEqual([]);
  });

  // ── Rules join ordering ──

  it('preserves rule sort order', () => {
    createSpotAlert(adapter, 'alert-1', {
      userId: 'user-1',
      spotId: 'spot-1',
      name: 'Complex Alert',
      rules: [
        { parameter: 'swell_height_ft', operator: 'gt', value: 3, joinWith: 'and', sortOrder: 0 },
        { parameter: 'wind_speed_kts', operator: 'lt', value: 10, joinWith: 'and', sortOrder: 1 },
        { parameter: 'rating', operator: 'gte', value: 3, joinWith: 'or', sortOrder: 2 },
      ],
    });

    const alerts = getSpotAlerts(adapter, 'user-1');
    const rules = alerts[0]!.rules;
    expect(rules[0]!.sortOrder).toBe(0);
    expect(rules[1]!.sortOrder).toBe(1);
    expect(rules[2]!.sortOrder).toBe(2);
    expect(rules[2]!.joinWith).toBe('or');
  });
});
