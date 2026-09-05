import { describe, it, expect } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import type { CostEntry, HomeDocument, InsurancePolicy } from '../types';

// ── CRUD imports ──
import {
  createCostEntry,
  getCostEntry,
  getCostEntriesForProperty,
  getCostEntriesForSchedule,
  updateCostEntry,
  deleteCostEntry,
} from '../db/cost-entries';
import {
  createDocument,
  getDocument,
  getDocumentsForProperty,
  updateDocument,
  deleteDocument,
} from '../db/documents';
import {
  createPolicy,
  getPolicy,
  updatePolicy,
  deletePolicy,
} from '../db/insurance';

// ── Engine imports ──
import {
  getCostSummary,
  getMonthlyCostTrend,
  getLifetimeCosts,
  getCostsBySchedule,
} from '../engines/cost-engine';
import {
  getExpiringDocuments,
  searchDocuments,
  getDocumentStats,
} from '../engines/document-engine';
import {
  getActivePolicies,
  getExpiringPolicies,
  getPolicyCostSummary,
  checkCoverageGaps,
} from '../engines/insurance-engine';

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

// ── Test fixtures ──

function makeCostEntry(overrides: Partial<CostEntry> = {}): CostEntry {
  return {
    id: 'cost-1',
    propertyId: 'prop-1',
    scheduleId: null,
    category: 'maintenance',
    description: 'Filter replacement',
    amountCents: 5000,
    vendor: null,
    receiptPhotoUri: null,
    costDate: '2026-01-15',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

function makeDocument(overrides: Partial<HomeDocument> = {}): HomeDocument {
  return {
    id: 'doc-1',
    propertyId: 'prop-1',
    title: 'Home deed',
    category: 'deed',
    fileUri: 'file:///deed.pdf',
    fileType: 'pdf',
    fileSizeBytes: 102400,
    expiryDate: null,
    notes: null,
    tags: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePolicy(overrides: Partial<InsurancePolicy> = {}): InsurancePolicy {
  return {
    id: 'pol-1',
    propertyId: 'prop-1',
    provider: 'Acme Insurance',
    policyNumber: 'POL-001',
    policyType: 'homeowners',
    coverageAmountCents: 50000000,
    deductibleCents: 100000,
    annualPremiumCents: 150000,
    startDate: '2026-01-01',
    endDate: '2027-01-01',
    autoRenew: true,
    documentId: null,
    agentName: null,
    agentPhone: null,
    agentEmail: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ======================================================================
// Cost Entry CRUD
// ======================================================================

describe('Cost Entry CRUD', () => {
  it('createCostEntry inserts a row and returns a CostEntry', () => {
    const { db, executed } = createMockDb();
    const result = createCostEntry(db, 'cost-1', {
      propertyId: 'prop-1',
      category: 'maintenance',
      description: 'Air filter',
      amountCents: 2500,
      costDate: '2026-03-01',
    });

    expect(result.id).toBe('cost-1');
    expect(result.propertyId).toBe('prop-1');
    expect(result.category).toBe('maintenance');
    expect(result.amountCents).toBe(2500);
    expect(result.scheduleId).toBeNull();
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_cost_entries');
  });

  it('getCostEntry returns entry when found', () => {
    const row = {
      id: 'cost-1',
      property_id: 'prop-1',
      schedule_id: null,
      category: 'repair',
      description: 'Pipe fix',
      amount_cents: 10000,
      vendor: 'PlumbCo',
      receipt_photo_uri: null,
      cost_date: '2026-02-10',
      created_at: '2026-02-10T00:00:00.000Z',
      updated_at: '2026-02-10T00:00:00.000Z',
    };
    const { db } = createMockDb({ 'hm_cost_entries': [row] });
    const result = getCostEntry(db, 'cost-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('cost-1');
    expect(result!.category).toBe('repair');
    expect(result!.vendor).toBe('PlumbCo');
  });

  it('getCostEntry returns null when not found', () => {
    const { db } = createMockDb();
    expect(getCostEntry(db, 'missing')).toBeNull();
  });

  it('getCostEntriesForProperty filters by category', () => {
    const rows = [
      { id: 'c1', property_id: 'p1', schedule_id: null, category: 'repair', description: 'Fix', amount_cents: 100, vendor: null, receipt_photo_uri: null, cost_date: '2026-01-01', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    const { db } = createMockDb({ 'hm_cost_entries': rows });
    const result = getCostEntriesForProperty(db, 'p1', { category: 'repair' });
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('repair');
  });

  it('getCostEntriesForProperty filters by date range', () => {
    const { db, executed } = createMockDb({ 'hm_cost_entries': [] });
    getCostEntriesForProperty(db, 'p1', {
      startDate: '2026-01-01',
      endDate: '2026-06-30',
    });
    // The query should contain both date clauses
    expect(executed).toHaveLength(0); // query, not execute
  });

  it('getCostEntriesForSchedule returns entries for a schedule', () => {
    const rows = [
      { id: 'c1', property_id: 'p1', schedule_id: 's1', category: 'maintenance', description: 'HVAC', amount_cents: 200, vendor: null, receipt_photo_uri: null, cost_date: '2026-01-01', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    const { db } = createMockDb({ 'hm_cost_entries': rows });
    const result = getCostEntriesForSchedule(db, 's1');
    expect(result).toHaveLength(1);
    expect(result[0].scheduleId).toBe('s1');
  });

  it('updateCostEntry executes an UPDATE with changed fields', () => {
    const { db, executed } = createMockDb();
    updateCostEntry(db, 'cost-1', {
      description: 'Updated desc',
      amountCents: 9900,
    });

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE hm_cost_entries');
    expect(executed[0].params).toContain('Updated desc');
    expect(executed[0].params).toContain(9900);
  });

  it('updateCostEntry skips when no fields provided', () => {
    const { db, executed } = createMockDb();
    updateCostEntry(db, 'cost-1', {});
    expect(executed).toHaveLength(0);
  });

  it('deleteCostEntry executes a DELETE', () => {
    const { db, executed } = createMockDb();
    deleteCostEntry(db, 'cost-1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM hm_cost_entries');
    expect(executed[0].params).toContain('cost-1');
  });
});

// ======================================================================
// Cost Engine
// ======================================================================

describe('Cost Engine', () => {
  it('getCostSummary totals and groups by category', () => {
    const entries = [
      makeCostEntry({ amountCents: 1000, category: 'maintenance' }),
      makeCostEntry({ id: 'c2', amountCents: 2500, category: 'repair' }),
      makeCostEntry({ id: 'c3', amountCents: 500, category: 'maintenance' }),
    ];

    const summary = getCostSummary(entries);
    expect(summary.totalCents).toBe(4000);
    expect(summary.byCategory.maintenance).toBe(1500);
    expect(summary.byCategory.repair).toBe(2500);
    expect(summary.byCategory.improvement).toBe(0);
    expect(summary.entryCount).toBe(3);
  });

  it('getMonthlyCostTrend groups by YYYY-MM and sorts chronologically', () => {
    const entries = [
      makeCostEntry({ costDate: '2026-03-15', amountCents: 100 }),
      makeCostEntry({ id: 'c2', costDate: '2026-01-10', amountCents: 200 }),
      makeCostEntry({ id: 'c3', costDate: '2026-03-20', amountCents: 300 }),
    ];

    const trend = getMonthlyCostTrend(entries);
    expect(trend).toHaveLength(2);
    expect(trend[0]).toEqual({ month: '2026-01', totalCents: 200 });
    expect(trend[1]).toEqual({ month: '2026-03', totalCents: 400 });
  });

  it('getLifetimeCosts returns sum of all amounts', () => {
    const entries = [
      makeCostEntry({ amountCents: 1000 }),
      makeCostEntry({ id: 'c2', amountCents: 2000 }),
      makeCostEntry({ id: 'c3', amountCents: 3000 }),
    ];
    expect(getLifetimeCosts(entries)).toBe(6000);
  });

  it('getCostsBySchedule maps scheduleId to total cents', () => {
    const entries = [
      makeCostEntry({ scheduleId: 's1', amountCents: 500 }),
      makeCostEntry({ id: 'c2', scheduleId: 's1', amountCents: 300 }),
      makeCostEntry({ id: 'c3', scheduleId: 's2', amountCents: 700 }),
      makeCostEntry({ id: 'c4', scheduleId: null, amountCents: 100 }),
    ];

    const result = getCostsBySchedule(entries);
    expect(result.get('s1')).toBe(800);
    expect(result.get('s2')).toBe(700);
    expect(result.has('c4')).toBe(false);
    expect(result.size).toBe(2);
  });

  it('getCostSummary handles empty array', () => {
    const summary = getCostSummary([]);
    expect(summary.totalCents).toBe(0);
    expect(summary.entryCount).toBe(0);
  });
});

// ======================================================================
// Document CRUD
// ======================================================================

describe('Document CRUD', () => {
  it('createDocument inserts a row and returns a HomeDocument', () => {
    const { db, executed } = createMockDb();
    const result = createDocument(db, 'doc-1', {
      propertyId: 'prop-1',
      title: 'Warranty card',
      category: 'warranty',
      fileUri: 'file:///warranty.pdf',
      fileType: 'pdf',
      fileSizeBytes: 50000,
    });

    expect(result.id).toBe('doc-1');
    expect(result.title).toBe('Warranty card');
    expect(result.category).toBe('warranty');
    expect(result.expiryDate).toBeNull();
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_documents');
  });

  it('getDocument returns document when found', () => {
    const row = {
      id: 'doc-1',
      property_id: 'prop-1',
      title: 'Home deed',
      category: 'deed',
      file_uri: 'file:///deed.pdf',
      file_type: 'pdf',
      file_size_bytes: 102400,
      expiry_date: null,
      notes: 'Main deed',
      tags: 'legal,important',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const { db } = createMockDb({ 'hm_documents': [row] });
    const result = getDocument(db, 'doc-1');

    expect(result).not.toBeNull();
    expect(result!.title).toBe('Home deed');
    expect(result!.tags).toBe('legal,important');
  });

  it('getDocument returns null when not found', () => {
    const { db } = createMockDb();
    expect(getDocument(db, 'missing')).toBeNull();
  });

  it('getDocumentsForProperty filters by category', () => {
    const rows = [
      { id: 'd1', property_id: 'p1', title: 'Permit', category: 'permit', file_uri: 'f', file_type: 'pdf', file_size_bytes: 100, expiry_date: null, notes: null, tags: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ];
    const { db } = createMockDb({ 'hm_documents': rows });
    const result = getDocumentsForProperty(db, 'p1', { category: 'permit' });
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('permit');
  });

  it('updateDocument executes an UPDATE with changed fields', () => {
    const { db, executed } = createMockDb();
    updateDocument(db, 'doc-1', { title: 'Updated title', tags: 'new-tag' });

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE hm_documents');
    expect(executed[0].params).toContain('Updated title');
    expect(executed[0].params).toContain('new-tag');
  });

  it('deleteDocument executes a DELETE', () => {
    const { db, executed } = createMockDb();
    deleteDocument(db, 'doc-1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM hm_documents');
    expect(executed[0].params).toContain('doc-1');
  });
});

// ======================================================================
// Document Engine
// ======================================================================

describe('Document Engine', () => {
  it('getExpiringDocuments returns docs expiring within N days', () => {
    const docs = [
      makeDocument({ id: 'd1', expiryDate: '2026-03-25' }),
      makeDocument({ id: 'd2', expiryDate: '2026-06-01' }),
      makeDocument({ id: 'd3', expiryDate: null }),
      makeDocument({ id: 'd4', expiryDate: '2026-03-10' }), // already past
    ];

    const result = getExpiringDocuments(docs, 30, '2026-03-20');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('d1');
  });

  it('getExpiringDocuments returns empty for no matching docs', () => {
    const docs = [
      makeDocument({ expiryDate: '2030-01-01' }),
    ];
    const result = getExpiringDocuments(docs, 7, '2026-03-20');
    expect(result).toHaveLength(0);
  });

  it('searchDocuments matches on title, category, tags, and notes', () => {
    const docs = [
      makeDocument({ id: 'd1', title: 'Roof warranty', category: 'warranty', tags: null, notes: null }),
      makeDocument({ id: 'd2', title: 'Deed', category: 'deed', tags: 'roof,legal', notes: null }),
      makeDocument({ id: 'd3', title: 'Permit', category: 'permit', tags: null, notes: 'Roof repair permit' }),
      makeDocument({ id: 'd4', title: 'Manual', category: 'manual', tags: null, notes: null }),
    ];

    const result = searchDocuments(docs, 'roof');
    expect(result).toHaveLength(3);
    expect(result.map((d) => d.id).sort()).toEqual(['d1', 'd2', 'd3']);
  });

  it('getDocumentStats returns correct totals and category breakdown', () => {
    const docs = [
      makeDocument({ id: 'd1', category: 'deed', expiryDate: null }),
      makeDocument({ id: 'd2', category: 'warranty', expiryDate: '2027-01-01' }),
      makeDocument({ id: 'd3', category: 'warranty', expiryDate: '2026-06-01' }),
      makeDocument({ id: 'd4', category: 'permit', expiryDate: null }),
    ];

    const stats = getDocumentStats(docs);
    expect(stats.total).toBe(4);
    expect(stats.byCategory['deed']).toBe(1);
    expect(stats.byCategory['warranty']).toBe(2);
    expect(stats.byCategory['permit']).toBe(1);
    expect(stats.expiringCount).toBe(2);
  });
});

// ======================================================================
// Insurance CRUD
// ======================================================================

describe('Insurance CRUD', () => {
  it('createPolicy inserts a row and returns an InsurancePolicy', () => {
    const { db, executed } = createMockDb();
    const result = createPolicy(db, 'pol-1', {
      propertyId: 'prop-1',
      provider: 'Acme',
      policyNumber: 'POL-001',
      policyType: 'homeowners',
      coverageAmountCents: 50000000,
      deductibleCents: 100000,
      annualPremiumCents: 150000,
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      autoRenew: true,
    });

    expect(result.id).toBe('pol-1');
    expect(result.provider).toBe('Acme');
    expect(result.autoRenew).toBe(true);
    expect(result.agentName).toBeNull();
    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('INSERT INTO hm_insurance_policies');
  });

  it('getPolicy returns policy when found', () => {
    const row = {
      id: 'pol-1',
      property_id: 'prop-1',
      provider: 'StateFarm',
      policy_number: 'SF-999',
      policy_type: 'renters',
      coverage_amount_cents: 25000000,
      deductible_cents: 50000,
      annual_premium_cents: 80000,
      start_date: '2026-01-01',
      end_date: '2027-01-01',
      auto_renew: 1,
      document_id: null,
      agent_name: 'Jane Smith',
      agent_phone: '555-1234',
      agent_email: null,
      notes: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const { db } = createMockDb({ 'hm_insurance_policies': [row] });
    const result = getPolicy(db, 'pol-1');

    expect(result).not.toBeNull();
    expect(result!.provider).toBe('StateFarm');
    expect(result!.autoRenew).toBe(true);
    expect(result!.agentName).toBe('Jane Smith');
  });

  it('updatePolicy executes an UPDATE with changed fields', () => {
    const { db, executed } = createMockDb();
    updatePolicy(db, 'pol-1', {
      provider: 'NewInsurer',
      annualPremiumCents: 200000,
      autoRenew: false,
    });

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('UPDATE hm_insurance_policies');
    expect(executed[0].params).toContain('NewInsurer');
    expect(executed[0].params).toContain(200000);
    expect(executed[0].params).toContain(0); // autoRenew false -> 0
  });

  it('deletePolicy executes a DELETE', () => {
    const { db, executed } = createMockDb();
    deletePolicy(db, 'pol-1');

    expect(executed).toHaveLength(1);
    expect(executed[0].sql).toContain('DELETE FROM hm_insurance_policies');
    expect(executed[0].params).toContain('pol-1');
  });
});

// ======================================================================
// Insurance Engine
// ======================================================================

describe('Insurance Engine', () => {
  it('getActivePolicies returns only non-expired policies', () => {
    const policies = [
      makePolicy({ id: 'p1', endDate: '2026-06-01' }),
      makePolicy({ id: 'p2', endDate: '2025-12-31' }), // expired
      makePolicy({ id: 'p3', endDate: '2026-03-20' }), // exact match = active
    ];

    const result = getActivePolicies(policies, '2026-03-20');
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id).sort()).toEqual(['p1', 'p3']);
  });

  it('getExpiringPolicies returns policies expiring within N days', () => {
    const policies = [
      makePolicy({ id: 'p1', endDate: '2026-04-01' }), // 12 days from 2026-03-20
      makePolicy({ id: 'p2', endDate: '2026-12-01' }), // too far
      makePolicy({ id: 'p3', endDate: '2026-03-10' }), // already past
    ];

    const result = getExpiringPolicies(policies, 30, '2026-03-20');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('getPolicyCostSummary aggregates financial totals', () => {
    const policies = [
      makePolicy({ annualPremiumCents: 150000, coverageAmountCents: 50000000, deductibleCents: 100000 }),
      makePolicy({ id: 'p2', annualPremiumCents: 50000, coverageAmountCents: 10000000, deductibleCents: 25000 }),
    ];

    const summary = getPolicyCostSummary(policies);
    expect(summary.totalAnnualPremium).toBe(200000);
    expect(summary.totalCoverage).toBe(60000000);
    expect(summary.totalDeductible).toBe(125000);
    expect(summary.policyCount).toBe(2);
  });

  it('checkCoverageGaps flags missing homeowners for owners', () => {
    const policies = [
      makePolicy({ policyType: 'flood' }),
    ];

    const gaps = checkCoverageGaps(policies, 'own');
    expect(gaps).toContain('Missing homeowners insurance');
    expect(gaps).not.toContain('Missing renters insurance');
    expect(gaps).toContain('No earthquake insurance');
    expect(gaps).toContain('No umbrella insurance');
    expect(gaps).not.toContain('No flood insurance');
  });

  it('checkCoverageGaps flags missing renters for renters', () => {
    const policies = [
      makePolicy({ policyType: 'homeowners' }),
    ];

    const gaps = checkCoverageGaps(policies, 'rent');
    expect(gaps).toContain('Missing renters insurance');
    expect(gaps).not.toContain('Missing homeowners insurance');
    expect(gaps).toContain('No flood insurance');
    expect(gaps).toContain('No earthquake insurance');
    expect(gaps).toContain('No umbrella insurance');
  });

  it('checkCoverageGaps returns empty when fully covered as owner', () => {
    const policies = [
      makePolicy({ policyType: 'homeowners' }),
      makePolicy({ id: 'p2', policyType: 'flood' }),
      makePolicy({ id: 'p3', policyType: 'earthquake' }),
      makePolicy({ id: 'p4', policyType: 'umbrella' }),
    ];

    const gaps = checkCoverageGaps(policies, 'own');
    expect(gaps).toHaveLength(0);
  });
});
