import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { GARDEN_MODULE } from '../definition';
import { createPlant, createZone } from '../db/crud';
import {
  updateZone, getZoneStats,
  createIdentification, getIdentificationsForPlant,
  createSeasonalTask, completeSeasonalTask, snoozeSeasonalTask, getPendingSeasonalTasks,
  createHarvest, getHarvests, getHarvestStats, getCropTypes,
  createDiagnosis, updateDiagnosisStatus, getActiveDiagnoses, getDiagnosisHistory,
  createWishListItem, getWishList, markWishListAcquired, deleteWishListItem,
  createPropagation, advancePropagationStage, linkPropagationChild, getActivePropagations, getPropagationStats,
  createLightReading, getLightReadingsForZone, getZoneAverageLux,
  createLayout, getLayouts, deleteLayout, createLayoutItem, getLayoutItems,
  getFrostConfig, setFrostConfig,
} from '../db/crud-v2';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('garden', GARDEN_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Zone V2', () => {
  it('updates zone with V2 fields', () => {
    createZone(testDb.adapter, 'z1', { name: 'Living Room' });
    const updated = updateZone(testDb.adapter, 'z1', {
      zoneType: 'room', icon: '🛋️', lightLevel: 'bright_indirect', humidity: 'medium',
    });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('Living Room');
  });

  it('returns zone stats', () => {
    createZone(testDb.adapter, 'z2', { name: 'Bathroom' });
    createPlant(testDb.adapter, 'p1', { name: 'Fern', zone: 'z2', status: 'healthy', waterFrequencyDays: 3 });
    createPlant(testDb.adapter, 'p2', { name: 'Orchid', zone: 'z2', status: 'needs_attention' });
    const stats = getZoneStats(testDb.adapter, 'z2');
    expect(stats.plantCount).toBe(2);
    expect(stats.healthyCount).toBe(1);
    expect(stats.needsAttentionCount).toBe(1);
  });
});

describe('Identification CRUD', () => {
  it('creates and retrieves identifications', () => {
    createPlant(testDb.adapter, 'p1', { name: 'Unknown' });
    const id = createIdentification(testDb.adapter, 'id1', {
      plantId: 'p1', imageUri: '/photos/plant.jpg',
      topSpecies: 'Monstera deliciosa', topCommonName: 'Swiss Cheese Plant',
      topConfidence: 0.95,
    });
    expect(id.topSpecies).toBe('Monstera deliciosa');
    const records = getIdentificationsForPlant(testDb.adapter, 'p1');
    expect(records).toHaveLength(1);
    expect(records[0].topConfidence).toBe(0.95);
  });
});

describe('Seasonal Task CRUD', () => {
  it('creates and completes tasks', () => {
    createPlant(testDb.adapter, 'p1', { name: 'Fern' });
    createSeasonalTask(testDb.adapter, 'st1', {
      plantId: 'p1', season: 'spring', taskType: 'increase_watering',
      description: 'Increase watering', dueMonth: 2,
    });
    let pending = getPendingSeasonalTasks(testDb.adapter, 'spring');
    expect(pending).toHaveLength(1);

    completeSeasonalTask(testDb.adapter, 'st1');
    pending = getPendingSeasonalTasks(testDb.adapter, 'spring');
    expect(pending).toHaveLength(0);
  });

  it('snoozes tasks', () => {
    createSeasonalTask(testDb.adapter, 'st2', {
      season: 'fall', taskType: 'stop_fertilizing', description: 'Stop fertilizing',
    });
    snoozeSeasonalTask(testDb.adapter, 'st2', '2099-12-31');
    const pending = getPendingSeasonalTasks(testDb.adapter, 'fall');
    expect(pending).toHaveLength(0);
  });
});

describe('Harvest CRUD', () => {
  it('creates a harvest with all fields', () => {
    createPlant(testDb.adapter, 'p1', { name: 'Tomato' });
    const h = createHarvest(testDb.adapter, 'h1', {
      plantId: 'p1', quantity: 500, unit: 'grams', cropType: 'tomato', qualityRating: 4,
    });
    expect(h.quantity).toBe(500);
    expect(h.unit).toBe('grams');
    expect(h.cropType).toBe('tomato');
  });

  it('rejects zero quantity', () => {
    createPlant(testDb.adapter, 'p1', { name: 'Tomato' });
    expect(() => createHarvest(testDb.adapter, 'h2', { plantId: 'p1', quantity: 0, unit: 'grams' })).toThrow();
  });

  it('filters harvests by plant and crop type', () => {
    createPlant(testDb.adapter, 'p1', { name: 'Tomato' });
    createPlant(testDb.adapter, 'p2', { name: 'Basil' });
    createHarvest(testDb.adapter, 'h1', { plantId: 'p1', quantity: 300, cropType: 'tomato' });
    createHarvest(testDb.adapter, 'h2', { plantId: 'p2', quantity: 50, cropType: 'basil' });
    expect(getHarvests(testDb.adapter, { plantId: 'p1' })).toHaveLength(1);
    expect(getHarvests(testDb.adapter, { cropType: 'tomato' })).toHaveLength(1);
  });

  it('returns harvest stats', () => {
    createPlant(testDb.adapter, 'p1', { name: 'Tomato' });
    createHarvest(testDb.adapter, 'h1', { plantId: 'p1', quantity: 300, date: '2026-06-15' });
    createHarvest(testDb.adapter, 'h2', { plantId: 'p1', quantity: 200, date: '2026-07-01' });
    const stats = getHarvestStats(testDb.adapter, 2026);
    expect(stats.totalQuantity).toBe(500);
    expect(stats.totalHarvests).toBe(2);
    expect(stats.topProducer?.plantId).toBe('p1');
  });

  it('returns crop types', () => {
    createPlant(testDb.adapter, 'p1', { name: 'Tomato' });
    createHarvest(testDb.adapter, 'h1', { plantId: 'p1', quantity: 100, cropType: 'tomato' });
    createHarvest(testDb.adapter, 'h2', { plantId: 'p1', quantity: 50, cropType: 'basil' });
    const types = getCropTypes(testDb.adapter);
    expect(types).toContain('tomato');
    expect(types).toContain('basil');
  });
});

describe('Diagnosis CRUD', () => {
  it('creates a diagnosis and updates status', () => {
    createPlant(testDb.adapter, 'p1', { name: 'Sick Plant' });
    createDiagnosis(testDb.adapter, 'd1', {
      plantId: 'p1', type: 'pest', symptoms: ['yellowing_leaves', 'sticky_residue'],
      diagnosisName: 'Aphids', diagnosisConfidence: 0.85, severity: 'mild',
    });

    let active = getActiveDiagnoses(testDb.adapter, 'p1');
    expect(active).toHaveLength(1);
    expect(active[0].diagnosisName).toBe('Aphids');

    updateDiagnosisStatus(testDb.adapter, 'd1', 'in_treatment');
    active = getActiveDiagnoses(testDb.adapter, 'p1');
    expect(active).toHaveLength(1);
    expect(active[0].treatmentStatus).toBe('in_treatment');

    updateDiagnosisStatus(testDb.adapter, 'd1', 'resolved');
    active = getActiveDiagnoses(testDb.adapter, 'p1');
    expect(active).toHaveLength(0);
    const history = getDiagnosisHistory(testDb.adapter, 'p1');
    expect(history).toHaveLength(1);
    expect(history[0].resolvedDate).not.toBeNull();
  });
});

describe('Wish List CRUD', () => {
  it('creates and lists wish list items sorted by priority', () => {
    createWishListItem(testDb.adapter, 'w1', { name: 'Monstera', priority: 'low' });
    createWishListItem(testDb.adapter, 'w2', { name: 'Fiddle Leaf', priority: 'high' });
    createWishListItem(testDb.adapter, 'w3', { name: 'Pothos', priority: 'medium' });
    const list = getWishList(testDb.adapter);
    expect(list).toHaveLength(3);
    expect(list[0].name).toBe('Fiddle Leaf'); // high first
    expect(list[2].name).toBe('Monstera'); // low last
  });

  it('marks item as acquired', () => {
    createPlant(testDb.adapter, 'plant-123', { name: 'Monstera' });
    createWishListItem(testDb.adapter, 'w1', { name: 'Monstera' });
    markWishListAcquired(testDb.adapter, 'w1', 'plant-123');
    const list = getWishList(testDb.adapter); // excludes acquired by default
    expect(list).toHaveLength(0);
    const all = getWishList(testDb.adapter, true);
    expect(all).toHaveLength(1);
    expect(all[0].acquired).toBe(true);
    expect(all[0].acquiredPlantId).toBe('plant-123');
  });

  it('deletes wish list item', () => {
    createWishListItem(testDb.adapter, 'w1', { name: 'Temp' });
    deleteWishListItem(testDb.adapter, 'w1');
    expect(getWishList(testDb.adapter, true)).toHaveLength(0);
  });
});

describe('Propagation CRUD', () => {
  it('creates and advances propagation stages', () => {
    createPlant(testDb.adapter, 'p1', { name: 'Monstera' });
    createPropagation(testDb.adapter, 'pr1', {
      parentPlantId: 'p1', method: 'stem_cutting', medium: 'water',
    });

    let active = getActivePropagations(testDb.adapter);
    expect(active).toHaveLength(1);
    expect(active[0].currentStage).toBe('started');

    advancePropagationStage(testDb.adapter, 'pr1', 'rooting');
    active = getActivePropagations(testDb.adapter);
    expect(active[0].currentStage).toBe('rooting');

    advancePropagationStage(testDb.adapter, 'pr1', 'ready');
    active = getActivePropagations(testDb.adapter);
    expect(active[0].currentStage).toBe('ready');
  });

  it('links child plant on potting', () => {
    createPlant(testDb.adapter, 'p1', { name: 'Parent' });
    createPropagation(testDb.adapter, 'pr1', { parentPlantId: 'p1', method: 'division' });
    advancePropagationStage(testDb.adapter, 'pr1', 'ready');
    createPlant(testDb.adapter, 'p2', { name: 'Child' });
    linkPropagationChild(testDb.adapter, 'pr1', 'p2');

    const active = getActivePropagations(testDb.adapter);
    expect(active).toHaveLength(0); // potted is terminal
  });

  it('returns propagation stats', () => {
    createPlant(testDb.adapter, 'child1', { name: 'Child' });
    createPropagation(testDb.adapter, 'pr1', { method: 'stem_cutting' });
    linkPropagationChild(testDb.adapter, 'pr1', 'child1');
    createPropagation(testDb.adapter, 'pr2', { method: 'leaf_cutting' });
    advancePropagationStage(testDb.adapter, 'pr2', 'failed');
    createPropagation(testDb.adapter, 'pr3', { method: 'division' });

    const stats = getPropagationStats(testDb.adapter);
    expect(stats.total).toBe(3);
    expect(stats.successCount).toBe(1);
    expect(stats.failedCount).toBe(1);
    expect(stats.activeCount).toBe(1);
    expect(stats.successRate).toBeCloseTo(33.3, 0);
  });
});

describe('Light Reading CRUD', () => {
  it('creates reading with auto-classification', () => {
    createZone(testDb.adapter, 'z1', { name: 'Window' });
    const reading = createLightReading(testDb.adapter, 'lr1', {
      zoneId: 'z1', readingLux: 5000, readingDate: '2026-03-22',
    });
    expect(reading.lightLevel).toBe('bright_indirect');
  });

  it('retrieves readings for zone', () => {
    createZone(testDb.adapter, 'z1', { name: 'Window' });
    createLightReading(testDb.adapter, 'lr1', { zoneId: 'z1', readingLux: 3000 });
    createLightReading(testDb.adapter, 'lr2', { zoneId: 'z1', readingLux: 7000 });
    const readings = getLightReadingsForZone(testDb.adapter, 'z1');
    expect(readings).toHaveLength(2);
  });

  it('calculates zone average lux', () => {
    createZone(testDb.adapter, 'z1', { name: 'Window' });
    createLightReading(testDb.adapter, 'lr1', { zoneId: 'z1', readingLux: 3000 });
    createLightReading(testDb.adapter, 'lr2', { zoneId: 'z1', readingLux: 7000 });
    expect(getZoneAverageLux(testDb.adapter, 'z1')).toBe(5000);
  });

  it('returns null average for empty zone', () => {
    createZone(testDb.adapter, 'z1', { name: 'Empty' });
    expect(getZoneAverageLux(testDb.adapter, 'z1')).toBeNull();
  });
});

describe('Layout CRUD', () => {
  it('creates layout and items', () => {
    createZone(testDb.adapter, 'z1', { name: 'Raised Bed' });
    const layout = createLayout(testDb.adapter, 'lay1', {
      name: 'Spring 2026', zoneId: 'z1', widthCells: 8, heightCells: 8,
    });
    expect(layout.widthCells).toBe(8);

    createLayoutItem(testDb.adapter, 'li1', {
      layoutId: 'lay1', label: 'Tomato', x: 0, y: 0, widthCells: 2, heightCells: 2,
      itemType: 'plant', color: '#FF0000', icon: '🍅',
    });
    const items = getLayoutItems(testDb.adapter, 'lay1');
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Tomato');
  });

  it('cascades delete layout items', () => {
    createLayout(testDb.adapter, 'lay1', { name: 'Test' });
    createLayoutItem(testDb.adapter, 'li1', { layoutId: 'lay1', label: 'A', x: 0, y: 0 });
    createLayoutItem(testDb.adapter, 'li2', { layoutId: 'lay1', label: 'B', x: 1, y: 0 });
    deleteLayout(testDb.adapter, 'lay1');
    expect(getLayoutItems(testDb.adapter, 'lay1')).toHaveLength(0);
  });

  it('lists layouts by zone', () => {
    createZone(testDb.adapter, 'z1', { name: 'Bed A' });
    createLayout(testDb.adapter, 'lay1', { name: 'Spring', zoneId: 'z1' });
    createLayout(testDb.adapter, 'lay2', { name: 'Fall', zoneId: 'z1' });
    createLayout(testDb.adapter, 'lay3', { name: 'Other' });
    expect(getLayouts(testDb.adapter, 'z1')).toHaveLength(2);
    expect(getLayouts(testDb.adapter)).toHaveLength(3);
  });
});

describe('Frost Config CRUD', () => {
  it('sets and gets frost config', () => {
    expect(getFrostConfig(testDb.adapter)).toBeNull();
    setFrostConfig(testDb.adapter, {
      zipCode: '94110', usdaZone: '10a',
      avgLastFrost: '01-31', avgFirstFrost: '12-20',
    });
    const config = getFrostConfig(testDb.adapter);
    expect(config).not.toBeNull();
    expect(config!.zipCode).toBe('94110');
    expect(config!.usdaZone).toBe('10a');
    expect(config!.notificationDaysBefore).toBe(7);
  });

  it('upserts frost config', () => {
    setFrostConfig(testDb.adapter, { usdaZone: '7a', avgLastFrost: '04-05', avgFirstFrost: '10-25' });
    setFrostConfig(testDb.adapter, { usdaZone: '8a', avgLastFrost: '03-20', avgFirstFrost: '11-10' });
    const config = getFrostConfig(testDb.adapter);
    expect(config!.usdaZone).toBe('8a'); // updated, not duplicated
  });
});
