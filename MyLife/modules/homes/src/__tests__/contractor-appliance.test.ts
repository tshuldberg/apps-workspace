import { describe, it, expect } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import type { Contractor, ContractorService, Appliance } from '../types';
import {
  createContractor,
  getContractor,
  getAllContractors,
  getContractorsForProperty,
  updateContractor,
  toggleFavorite,
  deleteContractor,
} from '../db/contractors';
import {
  createService,
  getServicesForContractor,
  getServicesForSchedule,
  deleteService,
} from '../db/contractor-services';
import {
  createAppliance,
  getAppliance,
  getAppliancesForProperty,
  updateAppliance,
  deleteAppliance,
} from '../db/appliances';
import {
  getContractorsBySpecialty,
  getFavoriteContractors,
  getContractorForTaskType,
  getContractorStats,
} from '../engines/contractor-engine';
import {
  getWarrantyStatus,
  getAppliancesNeedingAttention,
  searchAppliances,
  getAppliancesByCategory,
} from '../engines/appliance-engine';

// ── Mock Database ──

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

// ── Helpers ──

function makeContractor(overrides: Partial<Contractor> = {}): Contractor {
  return {
    id: 'c-1',
    propertyId: 'prop-1',
    name: 'Joe Plumber',
    company: 'Joe Plumbing Co',
    specialty: 'plumbing',
    phone: '555-1234',
    email: 'joe@plumbing.com',
    website: null,
    address: null,
    rating: 4,
    notes: null,
    isFavorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeService(overrides: Partial<ContractorService> = {}): ContractorService {
  return {
    id: 'svc-1',
    contractorId: 'c-1',
    scheduleId: null,
    description: 'Fixed leak',
    serviceDate: '2026-03-01',
    costCents: 15000,
    rating: 4,
    notes: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAppliance(overrides: Partial<Appliance> = {}): Appliance {
  return {
    id: 'app-1',
    propertyId: 'prop-1',
    roomId: null,
    inventoryItemId: null,
    name: 'Samsung Fridge',
    brand: 'Samsung',
    modelNumber: 'RF28R7351SR',
    serialNumber: 'SN12345',
    purchaseDate: '2024-01-15',
    purchasePriceCents: 200000,
    warrantyExpiry: '2027-01-15',
    manualUri: null,
    photoUri: null,
    category: 'kitchen',
    condition: 'good',
    scheduleId: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── Contractor CRUD ──

describe('contractor CRUD', () => {
  it('creates a contractor with required fields', () => {
    const { db, executed } = createMockDb();
    const contractor = createContractor(db, 'c-1', {
      name: 'Joe Plumber',
      specialty: 'plumbing',
    });

    expect(contractor.id).toBe('c-1');
    expect(contractor.name).toBe('Joe Plumber');
    expect(contractor.specialty).toBe('plumbing');
    expect(contractor.isFavorite).toBe(false);
    expect(contractor.propertyId).toBeNull();
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_contractors');
  });

  it('creates a contractor with all optional fields', () => {
    const { db } = createMockDb();
    const contractor = createContractor(db, 'c-2', {
      propertyId: 'prop-1',
      name: 'Jane Electric',
      company: 'Spark Co',
      specialty: 'electrical',
      phone: '555-9999',
      email: 'jane@spark.com',
      website: 'https://spark.com',
      address: '100 Volt Ave',
      rating: 5,
      notes: 'Best electrician',
      isFavorite: true,
    });

    expect(contractor.company).toBe('Spark Co');
    expect(contractor.specialty).toBe('electrical');
    expect(contractor.isFavorite).toBe(true);
    expect(contractor.propertyId).toBe('prop-1');
    expect(contractor.rating).toBe(5);
  });

  it('gets a contractor by id', () => {
    const { db } = createMockDb({
      'hm_contractors': [{
        id: 'c-1',
        property_id: 'prop-1',
        name: 'Joe',
        company: null,
        specialty: 'plumbing',
        phone: null,
        email: null,
        website: null,
        address: null,
        rating: null,
        notes: null,
        is_favorite: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }],
    });
    const contractor = getContractor(db, 'c-1');
    expect(contractor).not.toBeNull();
    expect(contractor!.name).toBe('Joe');
    expect(contractor!.isFavorite).toBe(false);
  });

  it('returns null for nonexistent contractor', () => {
    const { db } = createMockDb();
    expect(getContractor(db, 'no-such')).toBeNull();
  });

  it('gets all contractors', () => {
    const { db } = createMockDb({
      'hm_contractors': [
        { id: 'c-1', property_id: null, name: 'A', company: null, specialty: 'general', phone: null, email: null, website: null, address: null, rating: null, notes: null, is_favorite: 0, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 'c-2', property_id: 'prop-1', name: 'B', company: null, specialty: 'plumbing', phone: null, email: null, website: null, address: null, rating: null, notes: null, is_favorite: 1, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
    });
    const result = getAllContractors(db);
    expect(result).toHaveLength(2);
  });

  it('gets contractors for property (includes general contractors with null property_id)', () => {
    const { db, executed } = createMockDb();
    getContractorsForProperty(db, 'prop-1');

    // Verify query includes the OR condition for null property_id
    expect(executed).toHaveLength(0); // query, not execute
  });

  it('toggles favorite', () => {
    const { db, executed } = createMockDb();
    toggleFavorite(db, 'c-1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('is_favorite = CASE');
    expect(executed[0].params[1]).toBe('c-1');
  });

  it('updates contractor fields', () => {
    const { db, executed } = createMockDb();
    updateContractor(db, 'c-1', {
      name: 'New Name',
      rating: 5,
    });

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE hm_contractors SET');
    expect(executed[0].params).toContain('New Name');
    expect(executed[0].params).toContain(5);
  });

  it('skips update when no fields provided', () => {
    const { db, executed } = createMockDb();
    updateContractor(db, 'c-1', {});
    expect(executed).toHaveLength(0);
  });

  it('deletes a contractor', () => {
    const { db, executed } = createMockDb();
    deleteContractor(db, 'c-1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM hm_contractors');
    expect(executed[0].params[0]).toBe('c-1');
  });
});

// ── Contractor Service CRUD ──

describe('contractor service CRUD', () => {
  it('creates a service with required fields', () => {
    const { db, executed } = createMockDb();
    const service = createService(db, 'svc-1', {
      contractorId: 'c-1',
      description: 'Annual HVAC tune-up',
      serviceDate: '2026-03-15',
    });

    expect(service.id).toBe('svc-1');
    expect(service.contractorId).toBe('c-1');
    expect(service.description).toBe('Annual HVAC tune-up');
    expect(service.costCents).toBeNull();
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_contractor_services');
  });

  it('creates a service with all optional fields', () => {
    const { db } = createMockDb();
    const service = createService(db, 'svc-2', {
      contractorId: 'c-1',
      scheduleId: 'sched-1',
      description: 'Pipe repair',
      serviceDate: '2026-04-01',
      costCents: 25000,
      rating: 5,
      notes: 'Quick and clean',
    });

    expect(service.scheduleId).toBe('sched-1');
    expect(service.costCents).toBe(25000);
    expect(service.rating).toBe(5);
  });

  it('gets services for a contractor', () => {
    const { db } = createMockDb({
      'contractor_id': [
        { id: 'svc-1', contractor_id: 'c-1', schedule_id: null, description: 'Fix leak', service_date: '2026-03-01', cost_cents: 15000, rating: 4, notes: null, created_at: '2026-03-01T00:00:00.000Z' },
      ],
    });
    const services = getServicesForContractor(db, 'c-1');
    expect(services).toHaveLength(1);
    expect(services[0].description).toBe('Fix leak');
  });

  it('gets services for a schedule', () => {
    const { db } = createMockDb({
      'schedule_id': [
        { id: 'svc-1', contractor_id: 'c-1', schedule_id: 'sched-1', description: 'HVAC service', service_date: '2026-03-01', cost_cents: 20000, rating: 5, notes: null, created_at: '2026-03-01T00:00:00.000Z' },
      ],
    });
    const services = getServicesForSchedule(db, 'sched-1');
    expect(services).toHaveLength(1);
    expect(services[0].scheduleId).toBe('sched-1');
  });

  it('deletes a service', () => {
    const { db, executed } = createMockDb();
    deleteService(db, 'svc-1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM hm_contractor_services');
    expect(executed[0].params[0]).toBe('svc-1');
  });
});

// ── Contractor Engine ──

describe('contractor engine', () => {
  const plumber = makeContractor({ id: 'c-1', specialty: 'plumbing' });
  const electrician = makeContractor({ id: 'c-2', specialty: 'electrical', name: 'Jane Electric' });
  const hvacPro = makeContractor({ id: 'c-3', specialty: 'hvac', name: 'Cool Air Co' });
  const generalGuy = makeContractor({ id: 'c-4', specialty: 'general', name: 'Handy Man' });
  const favPlumber = makeContractor({ id: 'c-5', specialty: 'plumbing', name: 'Top Plumber', isFavorite: true });
  const allContractors = [plumber, electrician, hvacPro, generalGuy, favPlumber];

  it('filters by specialty', () => {
    const result = getContractorsBySpecialty(allContractors, 'plumbing');
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.specialty === 'plumbing')).toBe(true);
  });

  it('returns empty array for unmatched specialty', () => {
    const result = getContractorsBySpecialty(allContractors, 'roofing');
    expect(result).toHaveLength(0);
  });

  it('gets favorite contractors', () => {
    const result = getFavoriteContractors(allContractors);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c-5');
  });

  it('maps hvac task type to hvac specialty contractors (plus general)', () => {
    const result = getContractorForTaskType(allContractors, 'hvac');
    expect(result).toHaveLength(2); // hvacPro + generalGuy
    const ids = result.map((c) => c.id);
    expect(ids).toContain('c-3');
    expect(ids).toContain('c-4');
  });

  it('maps specific task type hvac_filter to hvac specialty', () => {
    const result = getContractorForTaskType(allContractors, 'hvac_filter');
    expect(result).toHaveLength(2); // hvacPro + generalGuy
  });

  it('maps water_heater_flush to plumbing specialty', () => {
    const result = getContractorForTaskType(allContractors, 'water_heater_flush');
    expect(result).toHaveLength(3); // plumber + generalGuy + favPlumber
    const specialties = result.map((c) => c.specialty);
    expect(specialties).toContain('plumbing');
    expect(specialties).toContain('general');
  });

  it('maps general task type to all contractors', () => {
    const result = getContractorForTaskType(allContractors, 'general');
    expect(result).toHaveLength(5);
  });

  it('returns only general contractors for unknown task type', () => {
    const result = getContractorForTaskType(allContractors, 'unknown_task');
    expect(result).toHaveLength(1);
    expect(result[0].specialty).toBe('general');
  });

  it('computes stats from services', () => {
    const services: ContractorService[] = [
      makeService({ id: 'svc-1', costCents: 15000, rating: 4 }),
      makeService({ id: 'svc-2', costCents: 25000, rating: 5 }),
      makeService({ id: 'svc-3', costCents: 10000, rating: null }),
    ];
    const stats = getContractorStats(services);
    expect(stats.totalServices).toBe(3);
    expect(stats.totalSpentCents).toBe(50000);
    expect(stats.averageRating).toBe(4.5);
  });

  it('returns zero average rating when no services have ratings', () => {
    const services: ContractorService[] = [
      makeService({ id: 'svc-1', costCents: 10000, rating: null }),
    ];
    const stats = getContractorStats(services);
    expect(stats.averageRating).toBe(0);
  });

  it('returns zero stats for empty services array', () => {
    const stats = getContractorStats([]);
    expect(stats.totalServices).toBe(0);
    expect(stats.totalSpentCents).toBe(0);
    expect(stats.averageRating).toBe(0);
  });
});

// ── Appliance CRUD ──

describe('appliance CRUD', () => {
  it('creates an appliance with required fields', () => {
    const { db, executed } = createMockDb();
    const appliance = createAppliance(db, 'app-1', {
      propertyId: 'prop-1',
      name: 'Samsung Fridge',
    });

    expect(appliance.id).toBe('app-1');
    expect(appliance.name).toBe('Samsung Fridge');
    expect(appliance.category).toBe('other');
    expect(appliance.condition).toBe('good');
    expect(appliance.brand).toBeNull();
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_appliances');
  });

  it('creates an appliance with all optional fields', () => {
    const { db } = createMockDb();
    const appliance = createAppliance(db, 'app-2', {
      propertyId: 'prop-1',
      roomId: 'room-1',
      inventoryItemId: 'inv-1',
      name: 'LG Washer',
      brand: 'LG',
      modelNumber: 'WM4000',
      serialNumber: 'LG-SN-001',
      purchaseDate: '2024-06-15',
      purchasePriceCents: 85000,
      warrantyExpiry: '2027-06-15',
      manualUri: '/manuals/lg-washer.pdf',
      photoUri: '/photos/washer.jpg',
      category: 'laundry',
      condition: 'new',
      scheduleId: 'sched-1',
      notes: 'Front loader',
    });

    expect(appliance.brand).toBe('LG');
    expect(appliance.category).toBe('laundry');
    expect(appliance.condition).toBe('new');
    expect(appliance.manualUri).toBe('/manuals/lg-washer.pdf');
  });

  it('gets an appliance by id', () => {
    const { db } = createMockDb({
      'hm_appliances': [{
        id: 'app-1',
        property_id: 'prop-1',
        room_id: null,
        inventory_item_id: null,
        name: 'Dishwasher',
        brand: 'Bosch',
        model_number: 'SHP88',
        serial_number: null,
        purchase_date: null,
        purchase_price_cents: null,
        warranty_expiry: '2027-01-01',
        manual_uri: null,
        photo_uri: null,
        category: 'kitchen',
        condition: 'good',
        schedule_id: null,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }],
    });
    const appliance = getAppliance(db, 'app-1');
    expect(appliance).not.toBeNull();
    expect(appliance!.name).toBe('Dishwasher');
    expect(appliance!.brand).toBe('Bosch');
  });

  it('returns null for nonexistent appliance', () => {
    const { db } = createMockDb();
    expect(getAppliance(db, 'no-such')).toBeNull();
  });

  it('gets appliances for a property', () => {
    const { db } = createMockDb({
      'hm_appliances': [
        { id: 'app-1', property_id: 'prop-1', room_id: null, inventory_item_id: null, name: 'Fridge', brand: null, model_number: null, serial_number: null, purchase_date: null, purchase_price_cents: null, warranty_expiry: null, manual_uri: null, photo_uri: null, category: 'kitchen', condition: 'good', schedule_id: null, notes: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 'app-2', property_id: 'prop-1', room_id: null, inventory_item_id: null, name: 'Washer', brand: null, model_number: null, serial_number: null, purchase_date: null, purchase_price_cents: null, warranty_expiry: null, manual_uri: null, photo_uri: null, category: 'laundry', condition: 'good', schedule_id: null, notes: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
    });
    const result = getAppliancesForProperty(db, 'prop-1');
    expect(result).toHaveLength(2);
  });

  it('updates appliance fields', () => {
    const { db, executed } = createMockDb();
    updateAppliance(db, 'app-1', {
      name: 'Updated Fridge',
      condition: 'fair',
      warrantyExpiry: '2028-01-01',
    });

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE hm_appliances SET');
    expect(executed[0].params).toContain('Updated Fridge');
    expect(executed[0].params).toContain('fair');
  });

  it('skips update when no fields provided', () => {
    const { db, executed } = createMockDb();
    updateAppliance(db, 'app-1', {});
    expect(executed).toHaveLength(0);
  });

  it('deletes an appliance', () => {
    const { db, executed } = createMockDb();
    deleteAppliance(db, 'app-1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM hm_appliances');
    expect(executed[0].params[0]).toBe('app-1');
  });
});

// ── Appliance Engine ──

describe('appliance engine', () => {
  describe('getWarrantyStatus', () => {
    it('returns "active" when warranty is more than 30 days away', () => {
      expect(getWarrantyStatus({ warrantyExpiry: '2027-01-15' }, '2026-06-01')).toBe('active');
    });

    it('returns "expiring_soon" when warranty is within 30 days', () => {
      expect(getWarrantyStatus({ warrantyExpiry: '2026-06-20' }, '2026-06-01')).toBe('expiring_soon');
    });

    it('returns "expiring_soon" on exact day of expiry (0 days remaining)', () => {
      expect(getWarrantyStatus({ warrantyExpiry: '2026-06-01' }, '2026-06-01')).toBe('expiring_soon');
    });

    it('returns "expired" when warranty is in the past', () => {
      expect(getWarrantyStatus({ warrantyExpiry: '2025-01-01' }, '2026-06-01')).toBe('expired');
    });

    it('returns "unknown" when warrantyExpiry is null', () => {
      expect(getWarrantyStatus({ warrantyExpiry: null })).toBe('unknown');
    });
  });

  describe('getAppliancesNeedingAttention', () => {
    it('returns appliances with expired warranty', () => {
      const appliances = [
        makeAppliance({ id: 'a1', warrantyExpiry: '2025-01-01' }),
        makeAppliance({ id: 'a2', warrantyExpiry: '2028-01-01' }),
      ];
      const result = getAppliancesNeedingAttention(appliances, '2026-06-01');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });

    it('returns appliances with expiring soon warranty', () => {
      const appliances = [
        makeAppliance({ id: 'a1', warrantyExpiry: '2026-06-20' }),
      ];
      const result = getAppliancesNeedingAttention(appliances, '2026-06-01');
      expect(result).toHaveLength(1);
    });

    it('returns appliances with poor condition regardless of warranty', () => {
      const appliances = [
        makeAppliance({ id: 'a1', condition: 'poor', warrantyExpiry: '2028-01-01' }),
      ];
      const result = getAppliancesNeedingAttention(appliances, '2026-06-01');
      expect(result).toHaveLength(1);
    });

    it('excludes healthy appliances', () => {
      const appliances = [
        makeAppliance({ id: 'a1', condition: 'good', warrantyExpiry: '2028-01-01' }),
        makeAppliance({ id: 'a2', condition: 'new', warrantyExpiry: null }),
      ];
      const result = getAppliancesNeedingAttention(appliances, '2026-06-01');
      expect(result).toHaveLength(0);
    });
  });

  describe('searchAppliances', () => {
    const appliances = [
      makeAppliance({ id: 'a1', name: 'Samsung Fridge', brand: 'Samsung', modelNumber: 'RF28R7351SR', serialNumber: 'SN12345' }),
      makeAppliance({ id: 'a2', name: 'LG Washer', brand: 'LG', modelNumber: 'WM4000', serialNumber: 'LG-001' }),
      makeAppliance({ id: 'a3', name: 'Bosch Dishwasher', brand: 'Bosch', modelNumber: 'SHP88', serialNumber: null }),
    ];

    it('searches by name', () => {
      const result = searchAppliances(appliances, 'fridge');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });

    it('searches by brand (case-insensitive)', () => {
      const result = searchAppliances(appliances, 'samsung');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });

    it('searches by model number', () => {
      const result = searchAppliances(appliances, 'WM4000');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a2');
    });

    it('searches by serial number', () => {
      const result = searchAppliances(appliances, 'SN12345');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });

    it('returns empty array for no matches', () => {
      const result = searchAppliances(appliances, 'microwave');
      expect(result).toHaveLength(0);
    });
  });

  describe('getAppliancesByCategory', () => {
    it('groups appliances by category', () => {
      const appliances = [
        makeAppliance({ id: 'a1', category: 'kitchen' }),
        makeAppliance({ id: 'a2', category: 'laundry' }),
        makeAppliance({ id: 'a3', category: 'kitchen' }),
        makeAppliance({ id: 'a4', category: 'hvac' }),
      ];
      const grouped = getAppliancesByCategory(appliances);
      expect(grouped.size).toBe(3);
      expect(grouped.get('kitchen')).toHaveLength(2);
      expect(grouped.get('laundry')).toHaveLength(1);
      expect(grouped.get('hvac')).toHaveLength(1);
    });

    it('returns empty map for empty array', () => {
      const grouped = getAppliancesByCategory([]);
      expect(grouped.size).toBe(0);
    });
  });
});
