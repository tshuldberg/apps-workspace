import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { GARDEN_MODULE } from '../definition';
import {
  createPlant,
  getPlantById,
  getPlants,
  updatePlant,
  deletePlant,
  getPlantCount,
  waterPlant,
  createEntry,
  getEntriesForPlant,
  getEntriesByDate,
  deleteEntry,
  createZone,
  getZones,
  deleteZone,
  createSeed,
  getSeeds,
  updateSeedQuantity,
  deleteSeed,
  getSetting,
  setSetting,
  getGardenStats,
  getWateringSchedule,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('garden', GARDEN_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Plants CRUD', () => {
  it('creates a plant with defaults', () => {
    const plant = createPlant(testDb.adapter, 'p1', { name: 'Monstera' });
    expect(plant.id).toBe('p1');
    expect(plant.name).toBe('Monstera');
    expect(plant.location).toBe('indoor');
    expect(plant.status).toBe('healthy');
    expect(plant.lastWatered).toBeNull();
  });

  it('creates a plant with full details', () => {
    const plant = createPlant(testDb.adapter, 'p2', {
      name: 'Tomato',
      species: 'Solanum lycopersicum',
      location: 'outdoor',
      waterFrequencyDays: 2,
      status: 'healthy',
      acquiredDate: '2026-03-01',
    });
    expect(plant.species).toBe('Solanum lycopersicum');
    expect(plant.waterFrequencyDays).toBe(2);
  });

  it('gets plant by id', () => {
    createPlant(testDb.adapter, 'p3', { name: 'Cactus' });
    expect(getPlantById(testDb.adapter, 'p3')).not.toBeNull();
    expect(getPlantById(testDb.adapter, 'nope')).toBeNull();
  });

  it('lists plants with filters', () => {
    createPlant(testDb.adapter, 'p4', { name: 'Indoor Fern', location: 'indoor' });
    createPlant(testDb.adapter, 'p5', { name: 'Outdoor Rose', location: 'outdoor' });
    const indoor = getPlants(testDb.adapter, { location: 'indoor' });
    expect(indoor).toHaveLength(1);
    expect(indoor[0].name).toBe('Indoor Fern');
  });

  it('updates a plant', () => {
    createPlant(testDb.adapter, 'p6', { name: 'Old Name' });
    const updated = updatePlant(testDb.adapter, 'p6', { name: 'New Name', status: 'dormant' });
    expect(updated!.name).toBe('New Name');
    expect(updated!.status).toBe('dormant');
  });

  it('deletes a plant and cascades entries', () => {
    createPlant(testDb.adapter, 'p7', { name: 'Temp' });
    createEntry(testDb.adapter, 'e1', { plantId: 'p7', action: 'water' });
    deletePlant(testDb.adapter, 'p7');
    expect(getPlantById(testDb.adapter, 'p7')).toBeNull();
    expect(getEntriesForPlant(testDb.adapter, 'p7')).toHaveLength(0);
  });

  it('counts plants', () => {
    expect(getPlantCount(testDb.adapter)).toBe(0);
    createPlant(testDb.adapter, 'pc1', { name: 'A' });
    createPlant(testDb.adapter, 'pc2', { name: 'B' });
    expect(getPlantCount(testDb.adapter)).toBe(2);
  });

  it('waters a plant and creates entry', () => {
    createPlant(testDb.adapter, 'pw', { name: 'Thirsty', waterFrequencyDays: 7 });
    waterPlant(testDb.adapter, 'pw');
    const plant = getPlantById(testDb.adapter, 'pw');
    expect(plant!.lastWatered).not.toBeNull();
    const entries = getEntriesForPlant(testDb.adapter, 'pw');
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('water');
  });
});

describe('Garden Entries', () => {
  it('creates an entry', () => {
    createPlant(testDb.adapter, 'pe', { name: 'Plant' });
    const entry = createEntry(testDb.adapter, 'e2', {
      plantId: 'pe',
      action: 'fertilize',
      notes: 'Used compost tea',
    });
    expect(entry.action).toBe('fertilize');
    expect(entry.notes).toBe('Used compost tea');
  });

  it('creates a harvest entry with quantity', () => {
    createPlant(testDb.adapter, 'ph', { name: 'Tomato' });
    const entry = createEntry(testDb.adapter, 'e3', {
      plantId: 'ph',
      action: 'harvest',
      quantityGrams: 450,
    });
    expect(entry.quantityGrams).toBe(450);
  });

  it('auto-updates lastWatered on water action', () => {
    createPlant(testDb.adapter, 'paw', { name: 'Auto Water' });
    createEntry(testDb.adapter, 'e4', { plantId: 'paw', action: 'water' });
    const plant = getPlantById(testDb.adapter, 'paw');
    expect(plant!.lastWatered).not.toBeNull();
  });

  it('lists entries by date range', () => {
    createPlant(testDb.adapter, 'pd', { name: 'Plant' });
    createEntry(testDb.adapter, 'e5', { plantId: 'pd', action: 'water', date: '2026-03-01' });
    createEntry(testDb.adapter, 'e6', { plantId: 'pd', action: 'prune', date: '2026-03-05' });
    createEntry(testDb.adapter, 'e7', { plantId: 'pd', action: 'water', date: '2026-03-10' });

    const range = getEntriesByDate(testDb.adapter, '2026-03-01', '2026-03-05');
    expect(range).toHaveLength(2);
  });

  it('deletes an entry', () => {
    createPlant(testDb.adapter, 'pde', { name: 'Plant' });
    createEntry(testDb.adapter, 'e8', { plantId: 'pde', action: 'note' });
    deleteEntry(testDb.adapter, 'e8');
    expect(getEntriesForPlant(testDb.adapter, 'pde')).toHaveLength(0);
  });
});

describe('Zones', () => {
  it('creates and lists zones', () => {
    createZone(testDb.adapter, 'z1', { name: 'Living Room', location: 'indoor' });
    createZone(testDb.adapter, 'z2', { name: 'Backyard', location: 'outdoor' });
    const zones = getZones(testDb.adapter);
    expect(zones).toHaveLength(2);
  });

  it('deletes a zone', () => {
    createZone(testDb.adapter, 'z3', { name: 'Temp' });
    deleteZone(testDb.adapter, 'z3');
    expect(getZones(testDb.adapter)).toHaveLength(0);
  });
});

describe('Seeds', () => {
  it('creates and lists seeds', () => {
    createSeed(testDb.adapter, 's1', { name: 'Basil', quantity: 50, source: 'Baker Creek' });
    const seeds = getSeeds(testDb.adapter);
    expect(seeds).toHaveLength(1);
    expect(seeds[0].quantity).toBe(50);
  });

  it('updates seed quantity', () => {
    createSeed(testDb.adapter, 's2', { name: 'Tomato', quantity: 100 });
    updateSeedQuantity(testDb.adapter, 's2', 75);
    const seeds = getSeeds(testDb.adapter);
    expect(seeds[0].quantity).toBe(75);
  });

  it('deletes a seed', () => {
    createSeed(testDb.adapter, 's3', { name: 'Temp' });
    deleteSeed(testDb.adapter, 's3');
    expect(getSeeds(testDb.adapter)).toHaveLength(0);
  });
});

describe('Settings', () => {
  it('gets and sets settings', () => {
    expect(getSetting(testDb.adapter, 'usda_zone')).toBeNull();
    setSetting(testDb.adapter, 'usda_zone', '9b');
    expect(getSetting(testDb.adapter, 'usda_zone')).toBe('9b');
  });
});

describe('Analytics', () => {
  it('returns garden stats', () => {
    createPlant(testDb.adapter, 'st1', { name: 'Healthy 1', status: 'healthy', waterFrequencyDays: 7 });
    createPlant(testDb.adapter, 'st2', { name: 'Sick', status: 'needs_attention' });
    createPlant(testDb.adapter, 'st3', { name: 'Dead', status: 'dead' });
    createEntry(testDb.adapter, 'sh1', { plantId: 'st1', action: 'harvest', quantityGrams: 200 });

    const stats = getGardenStats(testDb.adapter);
    expect(stats.totalPlants).toBe(3);
    expect(stats.healthyCount).toBe(1);
    expect(stats.needsAttentionCount).toBe(1);
    expect(stats.deadCount).toBe(1);
    expect(stats.totalHarvestGrams).toBe(200);
    expect(stats.overdueWateringCount).toBe(1); // st1 has freq but never watered
  });

  it('returns watering schedule sorted by urgency', () => {
    createPlant(testDb.adapter, 'ws1', { name: 'Daily', waterFrequencyDays: 1 });
    createPlant(testDb.adapter, 'ws2', { name: 'Weekly', waterFrequencyDays: 7 });
    createPlant(testDb.adapter, 'ws3', { name: 'No Schedule' }); // no frequency

    const schedule = getWateringSchedule(testDb.adapter);
    expect(schedule).toHaveLength(2); // ws3 excluded (no frequency)
    // Both should be overdue since never watered
    expect(schedule[0].isOverdue).toBe(true);
  });
});
