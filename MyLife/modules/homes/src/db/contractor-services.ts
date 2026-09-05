import type { DatabaseAdapter } from '@mylife/db';
import type { ContractorService } from '../types';

function rowToContractorService(row: Record<string, unknown>): ContractorService {
  return {
    id: row.id as string,
    contractorId: row.contractor_id as string,
    scheduleId: (row.schedule_id as string) ?? null,
    description: row.description as string,
    serviceDate: row.service_date as string,
    costCents: (row.cost_cents as number) ?? null,
    rating: (row.rating as number) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function createService(
  db: DatabaseAdapter,
  id: string,
  input: {
    contractorId: string;
    scheduleId?: string;
    description: string;
    serviceDate: string;
    costCents?: number;
    rating?: number;
    notes?: string;
  },
): ContractorService {
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO hm_contractor_services (
      id, contractor_id, schedule_id, description, service_date,
      cost_cents, rating, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.contractorId,
      input.scheduleId ?? null,
      input.description,
      input.serviceDate,
      input.costCents ?? null,
      input.rating ?? null,
      input.notes ?? null,
      now,
    ],
  );

  return {
    id,
    contractorId: input.contractorId,
    scheduleId: input.scheduleId ?? null,
    description: input.description,
    serviceDate: input.serviceDate,
    costCents: input.costCents ?? null,
    rating: input.rating ?? null,
    notes: input.notes ?? null,
    createdAt: now,
  };
}

export function getServicesForContractor(
  db: DatabaseAdapter,
  contractorId: string,
): ContractorService[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_contractor_services WHERE contractor_id = ? ORDER BY service_date DESC LIMIT 200',
      [contractorId],
    )
    .map(rowToContractorService);
}

export function getServicesForSchedule(
  db: DatabaseAdapter,
  scheduleId: string,
): ContractorService[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_contractor_services WHERE schedule_id = ? ORDER BY service_date DESC LIMIT 200',
      [scheduleId],
    )
    .map(rowToContractorService);
}

export function deleteService(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_contractor_services WHERE id = ?', [id]);
}
