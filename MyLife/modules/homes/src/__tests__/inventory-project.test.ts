import { describe, it, expect } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';

// CRUD imports
import { createRoom, getRoom, getRoomsForProperty, updateRoom, deleteRoom } from '../db/rooms';
import {
  createInventoryItem,
  getInventoryItem,
  getItemsForRoom,
  getItemsForProperty,
  updateInventoryItem,
  deleteInventoryItem,
} from '../db/inventory';
import {
  createProject,
  getProject,
  getProjectsForProperty,
  getActiveProjects,
  updateProject,
  deleteProject,
} from '../db/projects';
import { createPhase, getPhase, getPhasesForProject, updatePhase, deletePhase } from '../db/project-phases';
import {
  createProjectPhoto,
  getPhotosForProject,
  getPhotosForPhase,
  deleteProjectPhoto,
} from '../db/project-photos';

// Engine imports
import {
  getPropertyInventoryValue,
  getRoomSummary,
  getItemsByCategory,
  getHighValueItems,
  exportInventoryCSV,
} from '../engines/inventory-engine';
import {
  getProjectSummary,
  getBudgetVsActual,
  getPhaseProgress,
  getActiveProjectCount,
} from '../engines/project-engine';

import type { InventoryItem, Room, Project, ProjectPhase } from '../types';

// -- Mock Database --

function createMockDb(queryResults: Record<string, unknown[]> = {}) {
  const executed: Array<{ sql: string; params: unknown[] }> = [];
  return {
    db: {
      query: <T>(sql: string, _params?: unknown[]): T[] => {
        for (const [pattern, result] of Object.entries(queryResults)) {
          if (sql.includes(pattern)) return result as T[];
        }
        return [] as T[];
      },
      execute: (sql: string, params?: unknown[]) => {
        executed.push({ sql, params: params ?? [] });
      },
      transaction: (fn: () => void) => fn(),
    } as DatabaseAdapter,
    executed,
  };
}

// -- Room CRUD --

describe('Room CRUD', () => {
  it('createRoom inserts and returns a Room', () => {
    const { db, executed } = createMockDb();
    const room = createRoom(db, 'r1', {
      propertyId: 'p1',
      name: 'Living Room',
      roomType: 'living',
      sortOrder: 1,
    });

    expect(room.id).toBe('r1');
    expect(room.propertyId).toBe('p1');
    expect(room.name).toBe('Living Room');
    expect(room.roomType).toBe('living');
    expect(room.sortOrder).toBe(1);
    expect(room.createdAt).toBeTruthy();
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_rooms');
  });

  it('createRoom uses defaults when optional fields are omitted', () => {
    const { db } = createMockDb();
    const room = createRoom(db, 'r2', { propertyId: 'p1', name: 'Storage' });

    expect(room.roomType).toBe('other');
    expect(room.sortOrder).toBe(0);
  });

  it('getRoom returns a Room when found', () => {
    const { db } = createMockDb({
      'hm_rooms': [{
        id: 'r1',
        property_id: 'p1',
        name: 'Kitchen',
        room_type: 'kitchen',
        sort_order: 2,
        created_at: '2026-01-01T00:00:00.000Z',
      }],
    });

    const room = getRoom(db, 'r1');
    expect(room).not.toBeNull();
    expect(room!.name).toBe('Kitchen');
    expect(room!.roomType).toBe('kitchen');
  });

  it('getRoom returns null when not found', () => {
    const { db } = createMockDb();
    expect(getRoom(db, 'missing')).toBeNull();
  });

  it('getRoomsForProperty returns rooms sorted by sort_order', () => {
    const { db } = createMockDb({
      'hm_rooms': [
        { id: 'r1', property_id: 'p1', name: 'A', room_type: 'other', sort_order: 0, created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'r2', property_id: 'p1', name: 'B', room_type: 'kitchen', sort_order: 1, created_at: '2026-01-01T00:00:00.000Z' },
      ],
    });

    const rooms = getRoomsForProperty(db, 'p1');
    expect(rooms).toHaveLength(2);
    expect(rooms[0].id).toBe('r1');
  });

  it('updateRoom executes SET with provided fields', () => {
    const { db, executed } = createMockDb();
    updateRoom(db, 'r1', { name: 'Office', roomType: 'office' });

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE hm_rooms');
    expect(executed[0].sql).toContain('name = ?');
    expect(executed[0].sql).toContain('room_type = ?');
  });

  it('updateRoom does nothing when input is empty', () => {
    const { db, executed } = createMockDb();
    updateRoom(db, 'r1', {});
    expect(executed).toHaveLength(0);
  });

  it('deleteRoom removes the room', () => {
    const { db, executed } = createMockDb();
    deleteRoom(db, 'r1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM hm_rooms');
    expect(executed[0].params).toContain('r1');
  });
});

// -- Inventory CRUD --

describe('Inventory CRUD', () => {
  it('createInventoryItem inserts and returns an InventoryItem', () => {
    const { db, executed } = createMockDb();
    const item = createInventoryItem(db, 'i1', {
      roomId: 'r1',
      propertyId: 'p1',
      name: 'Couch',
      category: 'furniture',
      brand: 'IKEA',
      purchasePriceCents: 50000,
      estimatedValueCents: 30000,
    });

    expect(item.id).toBe('i1');
    expect(item.name).toBe('Couch');
    expect(item.category).toBe('furniture');
    expect(item.brand).toBe('IKEA');
    expect(item.condition).toBe('good');
    expect(item.purchasePriceCents).toBe(50000);
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_inventory_items');
  });

  it('createInventoryItem uses defaults for optional fields', () => {
    const { db } = createMockDb();
    const item = createInventoryItem(db, 'i2', {
      roomId: 'r1',
      propertyId: 'p1',
      name: 'Lamp',
    });

    expect(item.category).toBe('other');
    expect(item.condition).toBe('good');
    expect(item.brand).toBeNull();
    expect(item.model).toBeNull();
    expect(item.serialNumber).toBeNull();
    expect(item.photoUri).toBeNull();
  });

  it('getInventoryItem returns the item when found', () => {
    const { db } = createMockDb({
      'hm_inventory_items': [{
        id: 'i1',
        room_id: 'r1',
        property_id: 'p1',
        name: 'TV',
        category: 'electronics',
        brand: 'Samsung',
        model: 'Q80',
        serial_number: 'SN123',
        purchase_date: '2025-06-01',
        purchase_price_cents: 100000,
        estimated_value_cents: 80000,
        condition: 'good',
        photo_uri: null,
        warranty_expiry: '2027-06-01',
        document_id: null,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }],
    });

    const item = getInventoryItem(db, 'i1');
    expect(item).not.toBeNull();
    expect(item!.name).toBe('TV');
    expect(item!.brand).toBe('Samsung');
    expect(item!.estimatedValueCents).toBe(80000);
  });

  it('getInventoryItem returns null when not found', () => {
    const { db } = createMockDb();
    expect(getInventoryItem(db, 'missing')).toBeNull();
  });

  it('getItemsForRoom returns items for the given room', () => {
    const { db } = createMockDb({
      'hm_inventory_items': [
        { id: 'i1', room_id: 'r1', property_id: 'p1', name: 'Chair', category: 'furniture', brand: null, model: null, serial_number: null, purchase_date: null, purchase_price_cents: null, estimated_value_cents: null, condition: 'good', photo_uri: null, warranty_expiry: null, document_id: null, notes: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
    });

    const items = getItemsForRoom(db, 'r1');
    expect(items).toHaveLength(1);
    expect(items[0].roomId).toBe('r1');
  });

  it('getItemsForProperty returns items for the given property', () => {
    const { db } = createMockDb({
      'hm_inventory_items': [
        { id: 'i1', room_id: 'r1', property_id: 'p1', name: 'Desk', category: 'furniture', brand: null, model: null, serial_number: null, purchase_date: null, purchase_price_cents: null, estimated_value_cents: 5000, condition: 'good', photo_uri: null, warranty_expiry: null, document_id: null, notes: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 'i2', room_id: 'r2', property_id: 'p1', name: 'Shelf', category: 'furniture', brand: null, model: null, serial_number: null, purchase_date: null, purchase_price_cents: null, estimated_value_cents: 3000, condition: 'fair', photo_uri: null, warranty_expiry: null, document_id: null, notes: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
    });

    const items = getItemsForProperty(db, 'p1');
    expect(items).toHaveLength(2);
  });

  it('updateInventoryItem executes SET with provided fields', () => {
    const { db, executed } = createMockDb();
    updateInventoryItem(db, 'i1', { name: 'Updated Couch', condition: 'fair' });

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE hm_inventory_items');
    expect(executed[0].sql).toContain('name = ?');
    expect(executed[0].sql).toContain('condition = ?');
  });

  it('updateInventoryItem does nothing when input is empty', () => {
    const { db, executed } = createMockDb();
    updateInventoryItem(db, 'i1', {});
    expect(executed).toHaveLength(0);
  });

  it('deleteInventoryItem removes the item', () => {
    const { db, executed } = createMockDb();
    deleteInventoryItem(db, 'i1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM hm_inventory_items');
  });
});

// -- Inventory Engine --

describe('Inventory Engine', () => {
  const makeItem = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
    id: 'i1',
    roomId: 'r1',
    propertyId: 'p1',
    name: 'Test Item',
    category: 'other',
    brand: null,
    model: null,
    serialNumber: null,
    purchaseDate: null,
    purchasePriceCents: null,
    estimatedValueCents: null,
    condition: 'good',
    photoUri: null,
    warrantyExpiry: null,
    documentId: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  const makeRoom = (overrides: Partial<Room> = {}): Room => ({
    id: 'r1',
    propertyId: 'p1',
    name: 'Room',
    roomType: 'other',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('getPropertyInventoryValue sums estimated and purchase values', () => {
    const items = [
      makeItem({ id: 'i1', estimatedValueCents: 10000, purchasePriceCents: 15000 }),
      makeItem({ id: 'i2', estimatedValueCents: 5000, purchasePriceCents: 8000 }),
      makeItem({ id: 'i3', estimatedValueCents: null, purchasePriceCents: null }),
    ];

    const result = getPropertyInventoryValue(items);
    expect(result.totalEstimatedCents).toBe(15000);
    expect(result.totalPurchaseCents).toBe(23000);
    expect(result.itemCount).toBe(3);
  });

  it('getPropertyInventoryValue returns zeros for empty list', () => {
    const result = getPropertyInventoryValue([]);
    expect(result.totalEstimatedCents).toBe(0);
    expect(result.totalPurchaseCents).toBe(0);
    expect(result.itemCount).toBe(0);
  });

  it('getRoomSummary groups items by room and sums values', () => {
    const rooms = [
      makeRoom({ id: 'r1', name: 'Bedroom' }),
      makeRoom({ id: 'r2', name: 'Kitchen' }),
    ];
    const items = [
      makeItem({ id: 'i1', roomId: 'r1', estimatedValueCents: 5000 }),
      makeItem({ id: 'i2', roomId: 'r1', estimatedValueCents: 3000 }),
      makeItem({ id: 'i3', roomId: 'r2', estimatedValueCents: 10000 }),
    ];

    const summary = getRoomSummary(items, rooms);
    expect(summary).toHaveLength(2);

    const bedroom = summary.find((s) => s.room.id === 'r1')!;
    expect(bedroom.itemCount).toBe(2);
    expect(bedroom.totalValueCents).toBe(8000);

    const kitchen = summary.find((s) => s.room.id === 'r2')!;
    expect(kitchen.itemCount).toBe(1);
    expect(kitchen.totalValueCents).toBe(10000);
  });

  it('getRoomSummary includes rooms with zero items', () => {
    const rooms = [makeRoom({ id: 'r1' })];
    const summary = getRoomSummary([], rooms);

    expect(summary).toHaveLength(1);
    expect(summary[0].itemCount).toBe(0);
    expect(summary[0].totalValueCents).toBe(0);
  });

  it('getItemsByCategory groups items by category', () => {
    const items = [
      makeItem({ id: 'i1', category: 'furniture' }),
      makeItem({ id: 'i2', category: 'electronics' }),
      makeItem({ id: 'i3', category: 'furniture' }),
    ];

    const result = getItemsByCategory(items);
    expect(result.get('furniture')).toHaveLength(2);
    expect(result.get('electronics')).toHaveLength(1);
    expect(result.has('art')).toBe(false);
  });

  it('getHighValueItems filters items above threshold', () => {
    const items = [
      makeItem({ id: 'i1', estimatedValueCents: 50000 }),
      makeItem({ id: 'i2', estimatedValueCents: 1000 }),
      makeItem({ id: 'i3', estimatedValueCents: null }),
      makeItem({ id: 'i4', estimatedValueCents: 100000 }),
    ];

    const result = getHighValueItems(items, 10000);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toContain('i1');
    expect(result.map((i) => i.id)).toContain('i4');
  });

  it('getHighValueItems returns empty for no matches', () => {
    const items = [makeItem({ estimatedValueCents: 500 })];
    expect(getHighValueItems(items, 10000)).toHaveLength(0);
  });

  it('exportInventoryCSV produces correct header and rows', () => {
    const items = [
      makeItem({
        id: 'i1',
        roomId: 'r1',
        name: 'Desk',
        category: 'furniture',
        brand: 'IKEA',
        model: 'MALM',
        serialNumber: 'SN001',
        condition: 'good',
        purchaseDate: '2025-01-15',
        purchasePriceCents: 25000,
        estimatedValueCents: 20000,
      }),
    ];

    const csv = exportInventoryCSV(items);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Name,Category,Brand,Model,Serial,Condition,PurchaseDate,PurchasePrice,EstimatedValue,Room');
    expect(lines[1]).toContain('Desk');
    expect(lines[1]).toContain('furniture');
    expect(lines[1]).toContain('IKEA');
    expect(lines[1]).toContain('250.00');
    expect(lines[1]).toContain('200.00');
  });

  it('exportInventoryCSV escapes commas in values', () => {
    const items = [
      makeItem({
        name: 'Couch, Large',
        category: 'furniture',
      }),
    ];

    const csv = exportInventoryCSV(items);
    expect(csv).toContain('"Couch, Large"');
  });

  it('exportInventoryCSV handles empty items list', () => {
    const csv = exportInventoryCSV([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Name,Category,Brand,Model,Serial,Condition,PurchaseDate,PurchasePrice,EstimatedValue,Room');
  });
});

// -- Project CRUD --

describe('Project CRUD', () => {
  it('createProject inserts and returns a Project', () => {
    const { db, executed } = createMockDb();
    const project = createProject(db, 'pj1', {
      propertyId: 'p1',
      name: 'Kitchen Remodel',
      description: 'Full kitchen renovation',
      budgetCents: 2000000,
      category: 'kitchen',
      priority: 'high',
    });

    expect(project.id).toBe('pj1');
    expect(project.name).toBe('Kitchen Remodel');
    expect(project.budgetCents).toBe(2000000);
    expect(project.status).toBe('planning');
    expect(project.actualCostCents).toBe(0);
    expect(project.category).toBe('kitchen');
    expect(project.priority).toBe('high');
    expect(project.actualEndDate).toBeNull();
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_projects');
  });

  it('createProject uses defaults when optional fields are omitted', () => {
    const { db } = createMockDb();
    const project = createProject(db, 'pj2', {
      propertyId: 'p1',
      name: 'Paint Fence',
    });

    expect(project.status).toBe('planning');
    expect(project.budgetCents).toBe(0);
    expect(project.actualCostCents).toBe(0);
    expect(project.priority).toBe('medium');
    expect(project.category).toBe('other');
    expect(project.description).toBeNull();
    expect(project.startDate).toBeNull();
  });

  it('getProject returns the project when found', () => {
    const { db } = createMockDb({
      'hm_projects': [{
        id: 'pj1',
        property_id: 'p1',
        name: 'Deck Build',
        description: null,
        status: 'in_progress',
        budget_cents: 500000,
        actual_cost_cents: 200000,
        start_date: '2026-03-01',
        target_end_date: '2026-06-01',
        actual_end_date: null,
        priority: 'high',
        category: 'exterior',
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      }],
    });

    const project = getProject(db, 'pj1');
    expect(project).not.toBeNull();
    expect(project!.name).toBe('Deck Build');
    expect(project!.status).toBe('in_progress');
    expect(project!.budgetCents).toBe(500000);
  });

  it('getProject returns null when not found', () => {
    const { db } = createMockDb();
    expect(getProject(db, 'missing')).toBeNull();
  });

  it('getProjectsForProperty returns projects for the property', () => {
    const { db } = createMockDb({
      'hm_projects': [
        { id: 'pj1', property_id: 'p1', name: 'A', description: null, status: 'planning', budget_cents: 0, actual_cost_cents: 0, start_date: null, target_end_date: null, actual_end_date: null, priority: 'medium', category: 'other', notes: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 'pj2', property_id: 'p1', name: 'B', description: null, status: 'completed', budget_cents: 0, actual_cost_cents: 0, start_date: null, target_end_date: null, actual_end_date: null, priority: 'low', category: 'other', notes: null, created_at: '2026-01-02T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z' },
      ],
    });

    const projects = getProjectsForProperty(db, 'p1');
    expect(projects).toHaveLength(2);
  });

  it('getActiveProjects returns only planning and in_progress projects', () => {
    const { db } = createMockDb({
      'hm_projects': [
        { id: 'pj1', property_id: 'p1', name: 'Active', description: null, status: 'in_progress', budget_cents: 0, actual_cost_cents: 0, start_date: null, target_end_date: null, actual_end_date: null, priority: 'medium', category: 'other', notes: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
    });

    const projects = getActiveProjects(db);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Active');
  });

  it('updateProject executes SET with provided fields', () => {
    const { db, executed } = createMockDb();
    updateProject(db, 'pj1', {
      name: 'Updated Name',
      status: 'in_progress',
      actualCostCents: 150000,
    });

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE hm_projects');
    expect(executed[0].sql).toContain('name = ?');
    expect(executed[0].sql).toContain('status = ?');
    expect(executed[0].sql).toContain('actual_cost_cents = ?');
  });

  it('updateProject does nothing when input is empty', () => {
    const { db, executed } = createMockDb();
    updateProject(db, 'pj1', {});
    expect(executed).toHaveLength(0);
  });

  it('deleteProject removes the project', () => {
    const { db, executed } = createMockDb();
    deleteProject(db, 'pj1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM hm_projects');
    expect(executed[0].params).toContain('pj1');
  });
});

// -- Phase CRUD --

describe('Phase CRUD', () => {
  it('createPhase inserts and returns a ProjectPhase', () => {
    const { db, executed } = createMockDb();
    const phase = createPhase(db, 'ph1', {
      projectId: 'pj1',
      name: 'Demolition',
      description: 'Remove old cabinets',
      sortOrder: 1,
      budgetCents: 50000,
    });

    expect(phase.id).toBe('ph1');
    expect(phase.projectId).toBe('pj1');
    expect(phase.name).toBe('Demolition');
    expect(phase.status).toBe('pending');
    expect(phase.sortOrder).toBe(1);
    expect(phase.budgetCents).toBe(50000);
    expect(phase.startDate).toBeNull();
    expect(phase.endDate).toBeNull();
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_project_phases');
  });

  it('createPhase uses defaults for optional fields', () => {
    const { db } = createMockDb();
    const phase = createPhase(db, 'ph2', {
      projectId: 'pj1',
      name: 'Painting',
    });

    expect(phase.sortOrder).toBe(0);
    expect(phase.budgetCents).toBeNull();
    expect(phase.contractorId).toBeNull();
    expect(phase.description).toBeNull();
    expect(phase.notes).toBeNull();
  });

  it('getPhase returns the phase when found', () => {
    const { db } = createMockDb({
      'hm_project_phases': [{
        id: 'ph1',
        project_id: 'pj1',
        name: 'Framing',
        description: null,
        sort_order: 0,
        status: 'in_progress',
        start_date: '2026-03-01',
        end_date: null,
        budget_cents: 30000,
        contractor_id: 'c1',
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      }],
    });

    const phase = getPhase(db, 'ph1');
    expect(phase).not.toBeNull();
    expect(phase!.name).toBe('Framing');
    expect(phase!.status).toBe('in_progress');
  });

  it('getPhase returns null when not found', () => {
    const { db } = createMockDb();
    expect(getPhase(db, 'missing')).toBeNull();
  });

  it('getPhasesForProject returns phases sorted by sort_order', () => {
    const { db } = createMockDb({
      'hm_project_phases': [
        { id: 'ph1', project_id: 'pj1', name: 'A', description: null, sort_order: 0, status: 'completed', start_date: null, end_date: null, budget_cents: null, contractor_id: null, notes: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 'ph2', project_id: 'pj1', name: 'B', description: null, sort_order: 1, status: 'pending', start_date: null, end_date: null, budget_cents: null, contractor_id: null, notes: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
    });

    const phases = getPhasesForProject(db, 'pj1');
    expect(phases).toHaveLength(2);
    expect(phases[0].name).toBe('A');
    expect(phases[1].name).toBe('B');
  });

  it('updatePhase executes SET with provided fields', () => {
    const { db, executed } = createMockDb();
    updatePhase(db, 'ph1', { status: 'completed', endDate: '2026-04-01' });

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE hm_project_phases');
    expect(executed[0].sql).toContain('status = ?');
    expect(executed[0].sql).toContain('end_date = ?');
  });

  it('updatePhase does nothing when input is empty', () => {
    const { db, executed } = createMockDb();
    updatePhase(db, 'ph1', {});
    expect(executed).toHaveLength(0);
  });

  it('deletePhase removes the phase', () => {
    const { db, executed } = createMockDb();
    deletePhase(db, 'ph1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM hm_project_phases');
  });
});

// -- Photo CRUD --

describe('Photo CRUD', () => {
  it('createProjectPhoto inserts and returns a ProjectPhoto', () => {
    const { db, executed } = createMockDb();
    const photo = createProjectPhoto(db, 'pt1', {
      projectId: 'pj1',
      phaseId: 'ph1',
      photoUri: 'file:///photos/before.jpg',
      caption: 'Before demolition',
      photoType: 'before',
      sortOrder: 0,
    });

    expect(photo.id).toBe('pt1');
    expect(photo.projectId).toBe('pj1');
    expect(photo.phaseId).toBe('ph1');
    expect(photo.photoUri).toBe('file:///photos/before.jpg');
    expect(photo.caption).toBe('Before demolition');
    expect(photo.photoType).toBe('before');
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_project_photos');
  });

  it('createProjectPhoto uses defaults for optional fields', () => {
    const { db } = createMockDb();
    const photo = createProjectPhoto(db, 'pt2', {
      projectId: 'pj1',
      photoUri: 'file:///photos/progress.jpg',
    });

    expect(photo.phaseId).toBeNull();
    expect(photo.caption).toBeNull();
    expect(photo.photoType).toBe('during');
    expect(photo.sortOrder).toBe(0);
  });

  it('getPhotosForProject returns photos for the project', () => {
    const { db } = createMockDb({
      'hm_project_photos': [
        { id: 'pt1', project_id: 'pj1', phase_id: null, photo_uri: 'a.jpg', caption: null, photo_type: 'before', sort_order: 0, created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'pt2', project_id: 'pj1', phase_id: 'ph1', photo_uri: 'b.jpg', caption: null, photo_type: 'after', sort_order: 1, created_at: '2026-01-01T00:00:00.000Z' },
      ],
    });

    const photos = getPhotosForProject(db, 'pj1');
    expect(photos).toHaveLength(2);
  });

  it('getPhotosForPhase returns photos for the phase', () => {
    const { db } = createMockDb({
      'hm_project_photos': [
        { id: 'pt1', project_id: 'pj1', phase_id: 'ph1', photo_uri: 'a.jpg', caption: null, photo_type: 'during', sort_order: 0, created_at: '2026-01-01T00:00:00.000Z' },
      ],
    });

    const photos = getPhotosForPhase(db, 'ph1');
    expect(photos).toHaveLength(1);
    expect(photos[0].phaseId).toBe('ph1');
  });

  it('deleteProjectPhoto removes the photo', () => {
    const { db, executed } = createMockDb();
    deleteProjectPhoto(db, 'pt1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM hm_project_photos');
  });
});

// -- Project Engine --

describe('Project Engine', () => {
  const makeProject = (overrides: Partial<Project> = {}): Project => ({
    id: 'pj1',
    propertyId: 'p1',
    name: 'Test Project',
    description: null,
    status: 'in_progress',
    budgetCents: 100000,
    actualCostCents: 60000,
    startDate: '2026-01-01',
    targetEndDate: '2026-06-01',
    actualEndDate: null,
    priority: 'medium',
    category: 'other',
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  const makePhase = (overrides: Partial<ProjectPhase> = {}): ProjectPhase => ({
    id: 'ph1',
    projectId: 'pj1',
    name: 'Phase',
    description: null,
    sortOrder: 0,
    status: 'pending',
    startDate: null,
    endDate: null,
    budgetCents: null,
    contractorId: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('getProjectSummary computes progress and budget status', () => {
    const project = makeProject({ budgetCents: 100000, actualCostCents: 60000 });
    const phases = [
      makePhase({ id: 'ph1', status: 'completed' }),
      makePhase({ id: 'ph2', status: 'completed' }),
      makePhase({ id: 'ph3', status: 'in_progress' }),
      makePhase({ id: 'ph4', status: 'pending' }),
    ];

    const summary = getProjectSummary(project, phases);
    expect(summary.totalPhases).toBe(4);
    expect(summary.completedPhases).toBe(2);
    expect(summary.progressPercent).toBe(50);
    expect(summary.budgetCents).toBe(100000);
    expect(summary.actualCostCents).toBe(60000);
    expect(summary.isOverBudget).toBe(false);
  });

  it('getProjectSummary detects over budget', () => {
    const project = makeProject({ budgetCents: 50000, actualCostCents: 75000 });
    const summary = getProjectSummary(project, []);

    expect(summary.isOverBudget).toBe(true);
    expect(summary.progressPercent).toBe(0);
  });

  it('getProjectSummary handles zero phases', () => {
    const project = makeProject();
    const summary = getProjectSummary(project, []);

    expect(summary.totalPhases).toBe(0);
    expect(summary.completedPhases).toBe(0);
    expect(summary.progressPercent).toBe(0);
  });

  it('getBudgetVsActual computes remaining and percent used', () => {
    const project = makeProject({ budgetCents: 200000, actualCostCents: 150000 });

    const result = getBudgetVsActual(project);
    expect(result.budgetCents).toBe(200000);
    expect(result.actualCostCents).toBe(150000);
    expect(result.remainingCents).toBe(50000);
    expect(result.percentUsed).toBe(75);
  });

  it('getBudgetVsActual handles zero budget', () => {
    const project = makeProject({ budgetCents: 0, actualCostCents: 0 });

    const result = getBudgetVsActual(project);
    expect(result.percentUsed).toBe(0);
    expect(result.remainingCents).toBe(0);
  });

  it('getBudgetVsActual handles negative remaining (over budget)', () => {
    const project = makeProject({ budgetCents: 50000, actualCostCents: 80000 });

    const result = getBudgetVsActual(project);
    expect(result.remainingCents).toBe(-30000);
    expect(result.percentUsed).toBe(160);
  });

  it('getPhaseProgress counts phases by status', () => {
    const phases = [
      makePhase({ id: 'ph1', status: 'completed' }),
      makePhase({ id: 'ph2', status: 'completed' }),
      makePhase({ id: 'ph3', status: 'in_progress' }),
      makePhase({ id: 'ph4', status: 'pending' }),
      makePhase({ id: 'ph5', status: 'skipped' }),
    ];

    const progress = getPhaseProgress(phases);
    expect(progress.pending).toBe(1);
    expect(progress.inProgress).toBe(1);
    expect(progress.completed).toBe(2);
    expect(progress.skipped).toBe(1);
  });

  it('getPhaseProgress returns zeros for empty phases', () => {
    const progress = getPhaseProgress([]);
    expect(progress.pending).toBe(0);
    expect(progress.inProgress).toBe(0);
    expect(progress.completed).toBe(0);
    expect(progress.skipped).toBe(0);
  });

  it('getActiveProjectCount counts planning and in_progress projects', () => {
    const projects = [
      makeProject({ id: 'pj1', status: 'planning' }),
      makeProject({ id: 'pj2', status: 'in_progress' }),
      makeProject({ id: 'pj3', status: 'completed' }),
      makeProject({ id: 'pj4', status: 'cancelled' }),
      makeProject({ id: 'pj5', status: 'on_hold' }),
    ];

    expect(getActiveProjectCount(projects)).toBe(2);
  });

  it('getActiveProjectCount returns 0 for no active projects', () => {
    const projects = [
      makeProject({ status: 'completed' }),
      makeProject({ status: 'cancelled' }),
    ];

    expect(getActiveProjectCount(projects)).toBe(0);
  });
});
