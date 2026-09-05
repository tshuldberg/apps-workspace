import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { CLASSES_MODULE } from '../definition';
import {
  createCertification,
  deleteCertification,
  getCertification,
  listCertifications,
  listExpiring,
  updateCertification,
} from '../db';

let adapter: DatabaseAdapter;
let close: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('classes', CLASSES_MODULE.migrations ?? []);
  adapter = testDb.adapter;
  close = testDb.close;
});

afterEach(() => close());

describe('certifications CRUD', () => {
  it('round-trips a certification', () => {
    const row = createCertification(adapter, 'cert-1', {
      name: 'AWS Solutions Architect Associate',
      issuer: 'Amazon Web Services',
      issued_at: '2026-01-15T00:00:00.000Z',
      expires_at: '2029-01-15T00:00:00.000Z',
      credential_id: 'AWS-SAA-123',
      credential_url: 'https://aws.example/cred/123',
      category: 'Cloud',
      notes_md: 'Renewal: take recert exam',
      renewal_reminder_days: 90,
    });

    expect(row.name).toBe('AWS Solutions Architect Associate');
    const fetched = getCertification(adapter, 'cert-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.credential_id).toBe('AWS-SAA-123');
    expect(fetched?.renewal_reminder_days).toBe(90);
  });

  it('handles minimal input with optional fields null', () => {
    const row = createCertification(adapter, 'cert-2', {
      name: 'Some Cert',
    });
    expect(row.issuer).toBeNull();
    expect(row.expires_at).toBeNull();
    expect(row.renewal_reminder_days).toBeNull();
  });

  it('updates fields and refreshes updated_at', async () => {
    const original = createCertification(adapter, 'cert-1', {
      name: 'Original',
    });
    await new Promise((r) => setTimeout(r, 5));
    updateCertification(adapter, 'cert-1', {
      name: 'New Name',
      issuer: 'New Issuer',
    });
    const row = getCertification(adapter, 'cert-1');
    expect(row?.name).toBe('New Name');
    expect(row?.issuer).toBe('New Issuer');
    expect(row?.updated_at).not.toBe(original.updated_at);
  });

  it('deletes a certification', () => {
    createCertification(adapter, 'cert-1', { name: 'X' });
    deleteCertification(adapter, 'cert-1');
    expect(getCertification(adapter, 'cert-1')).toBeNull();
  });

  it('lists certs with issued first (DESC), then unissued', () => {
    createCertification(adapter, 'c-old', {
      name: 'Old',
      issued_at: '2025-01-01T00:00:00.000Z',
    });
    createCertification(adapter, 'c-new', {
      name: 'New',
      issued_at: '2026-01-01T00:00:00.000Z',
    });
    createCertification(adapter, 'c-pending', { name: 'Pending' });

    const rows = listCertifications(adapter);
    expect(rows.map((r) => r.id)).toEqual(['c-new', 'c-old', 'c-pending']);
  });

  it('listExpiring returns certs in [now, now+days) window', () => {
    const now = new Date('2026-04-20T00:00:00.000Z');
    // expires in 10 days
    createCertification(adapter, 'c-soon', {
      name: 'Soon',
      expires_at: '2026-04-30T00:00:00.000Z',
    });
    // expires in 60 days
    createCertification(adapter, 'c-far', {
      name: 'Far',
      expires_at: '2026-06-19T00:00:00.000Z',
    });
    // already expired (before now)
    createCertification(adapter, 'c-past', {
      name: 'Past',
      expires_at: '2026-04-10T00:00:00.000Z',
    });
    // no expiry
    createCertification(adapter, 'c-none', {
      name: 'None',
    });

    const within30 = listExpiring(adapter, 30, now);
    expect(within30.map((r) => r.id)).toEqual(['c-soon']);

    const within90 = listExpiring(adapter, 90, now);
    expect(within90.map((r) => r.id)).toEqual(['c-soon', 'c-far']);
  });

  it('listExpiring returns [] when nothing in window', () => {
    const now = new Date('2026-04-20T00:00:00.000Z');
    createCertification(adapter, 'c-far', {
      name: 'Far',
      expires_at: '2030-01-01T00:00:00.000Z',
    });
    expect(listExpiring(adapter, 30, now)).toEqual([]);
  });
});
