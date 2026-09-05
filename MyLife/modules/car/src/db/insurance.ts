import type { DatabaseAdapter } from '@mylife/db';
import type { InsurancePolicy, InsuranceDocument } from '../types';

// ---------------------------------------------------------------------------
// Row mappers (snake_case SQL -> camelCase TS)
// ---------------------------------------------------------------------------

function rowToPolicy(row: Record<string, unknown>): InsurancePolicy {
  return {
    id: row.id as string,
    vehicleId: row.vehicle_id as string,
    provider: row.provider as string,
    policyNumber: (row.policy_number as string) ?? null,
    coverageType: row.coverage_type as InsurancePolicy['coverageType'],
    premiumCents: (row.premium_cents as number) ?? null,
    premiumFrequency: (row.premium_frequency as InsurancePolicy['premiumFrequency']) ?? null,
    deductibleCents: (row.deductible_cents as number) ?? null,
    startDate: (row.start_date as string) ?? null,
    endDate: (row.end_date as string) ?? null,
    agentName: (row.agent_name as string) ?? null,
    agentPhone: (row.agent_phone as string) ?? null,
    agentEmail: (row.agent_email as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToDocument(row: Record<string, unknown>): InsuranceDocument {
  return {
    id: row.id as string,
    policyId: row.policy_id as string,
    documentType: row.document_type as InsuranceDocument['documentType'],
    imageUri: row.image_uri as string,
    label: (row.label as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Insurance Policies
// ---------------------------------------------------------------------------

export function createPolicy(
  db: DatabaseAdapter,
  id: string,
  input: {
    vehicleId: string;
    provider: string;
    policyNumber?: string;
    coverageType?: string;
    premiumCents?: number;
    premiumFrequency?: string;
    deductibleCents?: number;
    startDate?: string;
    endDate?: string;
    agentName?: string;
    agentPhone?: string;
    agentEmail?: string;
    notes?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_insurance_policies
     (id, vehicle_id, provider, policy_number, coverage_type, premium_cents, premium_frequency,
      deductible_cents, start_date, end_date, agent_name, agent_phone, agent_email, notes,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.vehicleId,
      input.provider,
      input.policyNumber ?? null,
      input.coverageType ?? 'liability',
      input.premiumCents ?? null,
      input.premiumFrequency ?? null,
      input.deductibleCents ?? null,
      input.startDate ?? null,
      input.endDate ?? null,
      input.agentName ?? null,
      input.agentPhone ?? null,
      input.agentEmail ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );
}

export function getPoliciesByVehicle(db: DatabaseAdapter, vehicleId: string): InsurancePolicy[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM cr_insurance_policies WHERE vehicle_id = ? ORDER BY end_date DESC',
      [vehicleId],
    )
    .map(rowToPolicy);
}

export function getPolicyById(db: DatabaseAdapter, id: string): InsurancePolicy | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM cr_insurance_policies WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToPolicy(rows[0]) : null;
}

export function updatePolicy(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{
    provider: string;
    policyNumber: string | null;
    coverageType: string;
    premiumCents: number | null;
    premiumFrequency: string | null;
    deductibleCents: number | null;
    startDate: string | null;
    endDate: string | null;
    agentName: string | null;
    agentPhone: string | null;
    agentEmail: string | null;
    notes: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.provider !== undefined) { sets.push('provider = ?'); params.push(updates.provider); }
  if (updates.policyNumber !== undefined) { sets.push('policy_number = ?'); params.push(updates.policyNumber); }
  if (updates.coverageType !== undefined) { sets.push('coverage_type = ?'); params.push(updates.coverageType); }
  if (updates.premiumCents !== undefined) { sets.push('premium_cents = ?'); params.push(updates.premiumCents); }
  if (updates.premiumFrequency !== undefined) { sets.push('premium_frequency = ?'); params.push(updates.premiumFrequency); }
  if (updates.deductibleCents !== undefined) { sets.push('deductible_cents = ?'); params.push(updates.deductibleCents); }
  if (updates.startDate !== undefined) { sets.push('start_date = ?'); params.push(updates.startDate); }
  if (updates.endDate !== undefined) { sets.push('end_date = ?'); params.push(updates.endDate); }
  if (updates.agentName !== undefined) { sets.push('agent_name = ?'); params.push(updates.agentName); }
  if (updates.agentPhone !== undefined) { sets.push('agent_phone = ?'); params.push(updates.agentPhone); }
  if (updates.agentEmail !== undefined) { sets.push('agent_email = ?'); params.push(updates.agentEmail); }
  if (updates.notes !== undefined) { sets.push('notes = ?'); params.push(updates.notes); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  db.execute(`UPDATE cr_insurance_policies SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deletePolicy(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_insurance_policies WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Insurance Documents
// ---------------------------------------------------------------------------

export function createInsuranceDocument(
  db: DatabaseAdapter,
  id: string,
  input: {
    policyId: string;
    documentType?: string;
    imageUri: string;
    label?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO cr_insurance_documents (id, policy_id, document_type, image_uri, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.policyId, input.documentType ?? 'other', input.imageUri, input.label ?? null, now],
  );
}

export function getDocumentsByPolicy(db: DatabaseAdapter, policyId: string): InsuranceDocument[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM cr_insurance_documents WHERE policy_id = ? ORDER BY created_at DESC',
      [policyId],
    )
    .map(rowToDocument);
}

export function deleteInsuranceDocument(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM cr_insurance_documents WHERE id = ?', [id]);
}
