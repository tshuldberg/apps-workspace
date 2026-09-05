import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { CYCLE_MODULE } from '../definition';
import {
  createPartnerLink,
  getActivePartnerLink,
  getPartnerLinkByCode,
  updatePartnerLink,
  revokePartnerLink,
  createPregnancyConfig,
} from '../db/crud';
import {
  generateShareCode,
  generateSharedView,
  validateSnapshot,
  isSnapshotStale,
} from '../engine/sharing';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('cycle', CYCLE_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// ── Share Code Generation ─────────────────────────────────────────────

describe('generateShareCode', () => {
  it('produces a 6-character string', () => {
    const code = generateShareCode();
    expect(code.length).toBe(6);
  });

  it('uses only safe alphabet characters', () => {
    const safeChars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    for (let i = 0; i < 50; i++) {
      const code = generateShareCode();
      for (const char of code) {
        expect(safeChars).toContain(char);
      }
    }
  });

  it('excludes ambiguous characters (0, O, 1, I, L)', () => {
    const ambiguous = ['0', 'O', '1', 'I', 'L'];
    for (let i = 0; i < 100; i++) {
      const code = generateShareCode();
      for (const char of ambiguous) {
        expect(code).not.toContain(char);
      }
    }
  });
});

// ── Shared View Generation ────────────────────────────────────────────

describe('generateSharedView', () => {
  const makeLink = (overrides: Record<string, unknown> = {}) => ({
    id: 'link1',
    linkCode: 'ABC123',
    partnerName: null,
    status: 'active' as const,
    sharePhase: true,
    sharePredictions: true,
    shareFertileWindow: false,
    shareSymptoms: false,
    shareMood: false,
    shareTemperature: false,
    sharePregnancy: true,
    createdAt: '2026-03-22T00:00:00Z',
    updatedAt: '2026-03-22T00:00:00Z',
    ...overrides,
  });

  it('includes phase and predictions when enabled', () => {
    const view = generateSharedView(makeLink(), {
      currentPhase: 'follicular',
      cycleDay: 10,
      predictedNextPeriod: '2026-04-05',
    });
    expect(view.currentPhase).toBe('follicular');
    expect(view.cycleDay).toBe(10);
    expect(view.predictedNextPeriod).toBe('2026-04-05');
  });

  it('excludes fertile window when share_fertile_window=false', () => {
    const view = generateSharedView(makeLink({ shareFertileWindow: false }), {
      fertileWindowStart: '2026-03-28',
      fertileWindowEnd: '2026-04-01',
    });
    expect(view.fertileWindowStart).toBeNull();
    expect(view.fertileWindowEnd).toBeNull();
  });

  it('includes fertile window when share_fertile_window=true', () => {
    const view = generateSharedView(makeLink({ shareFertileWindow: true }), {
      fertileWindowStart: '2026-03-28',
      fertileWindowEnd: '2026-04-01',
    });
    expect(view.fertileWindowStart).toBe('2026-03-28');
    expect(view.fertileWindowEnd).toBe('2026-04-01');
  });

  it('excludes symptom summary when share_symptoms=false', () => {
    const view = generateSharedView(makeLink({ shareSymptoms: false }), {
      symptomCount: 3,
    });
    expect(view.symptomSummary).toBeNull();
  });

  it('includes symptom count (not names) when share_symptoms=true', () => {
    const view = generateSharedView(makeLink({ shareSymptoms: true }), {
      symptomCount: 3,
    });
    expect(view.symptomSummary).toBe('3 symptoms logged today');
  });

  it('uses singular for 1 symptom', () => {
    const view = generateSharedView(makeLink({ shareSymptoms: true }), {
      symptomCount: 1,
    });
    expect(view.symptomSummary).toBe('1 symptom logged today');
  });

  it('includes pregnancy data when pregnant and share_pregnancy=true', () => {
    const view = generateSharedView(makeLink({ sharePregnancy: true }), {
      pregnancyWeek: 20,
      pregnancyDueDate: '2026-08-01',
    });
    expect(view.pregnancyWeek).toBe(20);
    expect(view.pregnancyDueDate).toBe('2026-08-01');
  });

  it('excludes pregnancy data when share_pregnancy=false', () => {
    const view = generateSharedView(makeLink({ sharePregnancy: false }), {
      pregnancyWeek: 20,
      pregnancyDueDate: '2026-08-01',
    });
    expect(view.pregnancyWeek).toBeNull();
    expect(view.pregnancyDueDate).toBeNull();
  });

  it('never includes notes (notes are not a field in SharedCycleView)', () => {
    const view = generateSharedView(makeLink(), {});
    expect('notes' in view).toBe(false);
  });

  it('sets version to 1 and linkCode correctly', () => {
    const view = generateSharedView(makeLink(), {});
    expect(view.version).toBe(1);
    expect(view.linkCode).toBe('ABC123');
  });
});

// ── Snapshot Validation ───────────────────────────────────────────────

describe('validateSnapshot', () => {
  it('accepts valid snapshot with matching link code', () => {
    const snapshot = {
      version: 1,
      linkCode: 'ABC123',
      generatedAt: '2026-03-22T10:00:00Z',
      currentPhase: 'follicular',
      cycleDay: 10,
      predictedNextPeriod: '2026-04-05',
      fertileWindowStart: null,
      fertileWindowEnd: null,
      symptomSummary: null,
      pregnancyWeek: null,
      pregnancyDueDate: null,
      partnerName: null,
    };
    const result = validateSnapshot(snapshot, 'ABC123');
    expect(result.valid).toBe(true);
  });

  it('rejects snapshot with mismatched link code', () => {
    const snapshot = {
      version: 1,
      linkCode: 'ABC123',
      generatedAt: '2026-03-22T10:00:00Z',
      currentPhase: null,
      cycleDay: null,
      predictedNextPeriod: null,
      fertileWindowStart: null,
      fertileWindowEnd: null,
      symptomSummary: null,
      pregnancyWeek: null,
      pregnancyDueDate: null,
      partnerName: null,
    };
    const result = validateSnapshot(snapshot, 'XYZ789');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("doesn't match");
    }
  });

  it('rejects malformed JSON', () => {
    const result = validateSnapshot({ foo: 'bar' }, 'ABC123');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Invalid snapshot format');
    }
  });

  it('rejects null', () => {
    const result = validateSnapshot(null, 'ABC123');
    expect(result.valid).toBe(false);
  });
});

// ── Snapshot Staleness ────────────────────────────────────────────────

describe('isSnapshotStale', () => {
  it('returns false for recent snapshots', () => {
    const recent = new Date('2026-03-20T00:00:00Z').toISOString();
    expect(isSnapshotStale(recent, '2026-03-22T00:00:00Z')).toBe(false);
  });

  it('returns true for snapshots older than 30 days', () => {
    const old = new Date('2026-02-01T00:00:00Z').toISOString();
    expect(isSnapshotStale(old, '2026-03-22T00:00:00Z')).toBe(true);
  });

  it('returns false for exactly 30 days', () => {
    const exact = new Date('2026-02-20T00:00:00Z').toISOString();
    expect(isSnapshotStale(exact, '2026-03-22T00:00:00Z')).toBe(false);
  });
});

// ── Partner Link CRUD ─────────────────────────────────────────────────

describe('Partner Link CRUD', () => {
  it('creates a partner link with defaults', () => {
    const link = createPartnerLink(testDb.adapter, 'l1');
    expect(link.id).toBe('l1');
    expect(link.status).toBe('active');
    expect(link.linkCode.length).toBe(6);
    expect(link.sharePhase).toBe(true);
    expect(link.sharePredictions).toBe(true);
    expect(link.shareFertileWindow).toBe(false);
    expect(link.shareSymptoms).toBe(false);
    expect(link.shareMood).toBe(false);
    expect(link.shareTemperature).toBe(false);
    expect(link.sharePregnancy).toBe(true);
  });

  it('creates link with custom preferences', () => {
    const link = createPartnerLink(testDb.adapter, 'l1', {
      partnerName: 'Alex',
      shareFertileWindow: true,
      shareSymptoms: true,
      shareMood: true,
      shareTemperature: true,
    });
    expect(link.partnerName).toBe('Alex');
    expect(link.shareFertileWindow).toBe(true);
    expect(link.shareSymptoms).toBe(true);
    expect(link.shareMood).toBe(true);
    expect(link.shareTemperature).toBe(true);
  });

  it('rejects creation when active link exists', () => {
    createPartnerLink(testDb.adapter, 'l1');
    expect(() => createPartnerLink(testDb.adapter, 'l2')).toThrow(
      'An active partner link already exists',
    );
  });

  it('getActivePartnerLink returns active link', () => {
    createPartnerLink(testDb.adapter, 'l1');
    const active = getActivePartnerLink(testDb.adapter);
    expect(active).not.toBeNull();
    expect(active!.id).toBe('l1');
  });

  it('getActivePartnerLink returns null when none', () => {
    expect(getActivePartnerLink(testDb.adapter)).toBeNull();
  });

  it('getPartnerLinkByCode finds by code', () => {
    const created = createPartnerLink(testDb.adapter, 'l1');
    const found = getPartnerLinkByCode(testDb.adapter, created.linkCode);
    expect(found).not.toBeNull();
    expect(found!.id).toBe('l1');
  });

  it('revokePartnerLink sets status to revoked', () => {
    createPartnerLink(testDb.adapter, 'l1');
    const revoked = revokePartnerLink(testDb.adapter, 'l1');
    expect(revoked!.status).toBe('revoked');

    // No active link
    expect(getActivePartnerLink(testDb.adapter)).toBeNull();
  });

  it('allows new link after revoking previous', () => {
    createPartnerLink(testDb.adapter, 'l1');
    revokePartnerLink(testDb.adapter, 'l1');
    const newLink = createPartnerLink(testDb.adapter, 'l2');
    expect(newLink.id).toBe('l2');
    expect(newLink.status).toBe('active');
  });

  it('updatePartnerLink changes sharing preferences', () => {
    createPartnerLink(testDb.adapter, 'l1');
    const updated = updatePartnerLink(testDb.adapter, 'l1', {
      shareFertileWindow: true,
      shareMood: true,
      shareTemperature: true,
      partnerName: 'Sam',
    });
    expect(updated!.shareFertileWindow).toBe(true);
    expect(updated!.shareMood).toBe(true);
    expect(updated!.shareTemperature).toBe(true);
    expect(updated!.partnerName).toBe('Sam');
  });
});

// ── Integration Tests ─────────────────────────────────────────────────

describe('Partner Sync Integration', () => {
  it('full flow: create link -> generate snapshot -> validate on partner side', () => {
    const link = createPartnerLink(testDb.adapter, 'l1', {
      partnerName: 'Alex',
    });

    // Generate shared view
    const view = generateSharedView(link, {
      currentPhase: 'follicular',
      cycleDay: 10,
      predictedNextPeriod: '2026-04-05',
      displayName: 'Jordan',
    });

    expect(view.linkCode).toBe(link.linkCode);
    expect(view.currentPhase).toBe('follicular');
    expect(view.partnerName).toBe('Jordan');

    // Partner validates the snapshot
    const result = validateSnapshot(view, link.linkCode);
    expect(result.valid).toBe(true);
  });

  it('revocation flow: revoke -> snapshot validation still works for existing data', () => {
    const link = createPartnerLink(testDb.adapter, 'l1');

    const view = generateSharedView(link, {
      currentPhase: 'luteal',
      cycleDay: 22,
    });

    revokePartnerLink(testDb.adapter, 'l1');

    // Existing snapshot is still valid structurally
    const result = validateSnapshot(view, link.linkCode);
    expect(result.valid).toBe(true);

    // But the link is revoked in the DB
    const found = getPartnerLinkByCode(testDb.adapter, link.linkCode);
    expect(found!.status).toBe('revoked');
  });

  it('privacy flow: disable fertile window -> snapshot has null fertile window', () => {
    const link = createPartnerLink(testDb.adapter, 'l1', {
      shareFertileWindow: false,
    });

    const view = generateSharedView(link, {
      fertileWindowStart: '2026-03-28',
      fertileWindowEnd: '2026-04-01',
    });

    expect(view.fertileWindowStart).toBeNull();
    expect(view.fertileWindowEnd).toBeNull();
  });

  it('pregnancy-aware sharing: shows pregnancy data when active', () => {
    createPregnancyConfig(testDb.adapter, 'p1', {
      startMethod: 'due_date',
      dueDate: '2026-08-01',
    });

    const link = createPartnerLink(testDb.adapter, 'l1', {
      sharePregnancy: true,
    });

    const view = generateSharedView(link, {
      pregnancyWeek: 20,
      pregnancyDueDate: '2026-08-01',
    });

    expect(view.pregnancyWeek).toBe(20);
    expect(view.pregnancyDueDate).toBe('2026-08-01');
  });
});
