import type { DatabaseAdapter } from '@mylife/db';
import type { InsurancePolicy, PolicyType } from '../types';

function rowToPolicy(row: Record<string, unknown>): InsurancePolicy {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    provider: row.provider as string,
    policyNumber: row.policy_number as string,
    policyType: row.policy_type as PolicyType,
    coverageAmountCents: row.coverage_amount_cents as number,
    deductibleCents: row.deductible_cents as number,
    annualPremiumCents: row.annual_premium_cents as number,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    autoRenew: Boolean(row.auto_renew),
    documentId: (row.document_id as string) ?? null,
    agentName: (row.agent_name as string) ?? null,
    agentPhone: (row.agent_phone as string) ?? null,
    agentEmail: (row.agent_email as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createPolicy(
  db: DatabaseAdapter,
  id: string,
  input: {
    propertyId: string;
    provider: string;
    policyNumber: string;
    policyType: PolicyType;
    coverageAmountCents: number;
    deductibleCents: number;
    annualPremiumCents: number;
    startDate: string;
    endDate: string;
    autoRenew?: boolean;
    documentId?: string;
    agentName?: string;
    agentPhone?: string;
    agentEmail?: string;
    notes?: string;
  },
): InsurancePolicy {
  const now = new Date().toISOString();
  const autoRenew = input.autoRenew ?? false;

  db.execute(
    `INSERT INTO hm_insurance_policies (
      id, property_id, provider, policy_number, policy_type,
      coverage_amount_cents, deductible_cents, annual_premium_cents,
      start_date, end_date, auto_renew, document_id,
      agent_name, agent_phone, agent_email, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.propertyId,
      input.provider,
      input.policyNumber,
      input.policyType,
      input.coverageAmountCents,
      input.deductibleCents,
      input.annualPremiumCents,
      input.startDate,
      input.endDate,
      autoRenew ? 1 : 0,
      input.documentId ?? null,
      input.agentName ?? null,
      input.agentPhone ?? null,
      input.agentEmail ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    propertyId: input.propertyId,
    provider: input.provider,
    policyNumber: input.policyNumber,
    policyType: input.policyType,
    coverageAmountCents: input.coverageAmountCents,
    deductibleCents: input.deductibleCents,
    annualPremiumCents: input.annualPremiumCents,
    startDate: input.startDate,
    endDate: input.endDate,
    autoRenew,
    documentId: input.documentId ?? null,
    agentName: input.agentName ?? null,
    agentPhone: input.agentPhone ?? null,
    agentEmail: input.agentEmail ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getPolicy(
  db: DatabaseAdapter,
  id: string,
): InsurancePolicy | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hm_insurance_policies WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToPolicy(rows[0]) : null;
}

export function getPoliciesForProperty(
  db: DatabaseAdapter,
  propertyId: string,
): InsurancePolicy[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_insurance_policies WHERE property_id = ? ORDER BY end_date ASC LIMIT 100',
      [propertyId],
    )
    .map(rowToPolicy);
}

export function updatePolicy(
  db: DatabaseAdapter,
  id: string,
  input: Partial<{
    provider: string;
    policyNumber: string;
    policyType: PolicyType;
    coverageAmountCents: number;
    deductibleCents: number;
    annualPremiumCents: number;
    startDate: string;
    endDate: string;
    autoRenew: boolean;
    documentId: string | null;
    agentName: string | null;
    agentPhone: string | null;
    agentEmail: string | null;
    notes: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.provider !== undefined) { sets.push('provider = ?'); params.push(input.provider); }
  if (input.policyNumber !== undefined) { sets.push('policy_number = ?'); params.push(input.policyNumber); }
  if (input.policyType !== undefined) { sets.push('policy_type = ?'); params.push(input.policyType); }
  if (input.coverageAmountCents !== undefined) { sets.push('coverage_amount_cents = ?'); params.push(input.coverageAmountCents); }
  if (input.deductibleCents !== undefined) { sets.push('deductible_cents = ?'); params.push(input.deductibleCents); }
  if (input.annualPremiumCents !== undefined) { sets.push('annual_premium_cents = ?'); params.push(input.annualPremiumCents); }
  if (input.startDate !== undefined) { sets.push('start_date = ?'); params.push(input.startDate); }
  if (input.endDate !== undefined) { sets.push('end_date = ?'); params.push(input.endDate); }
  if (input.autoRenew !== undefined) { sets.push('auto_renew = ?'); params.push(input.autoRenew ? 1 : 0); }
  if (input.documentId !== undefined) { sets.push('document_id = ?'); params.push(input.documentId); }
  if (input.agentName !== undefined) { sets.push('agent_name = ?'); params.push(input.agentName); }
  if (input.agentPhone !== undefined) { sets.push('agent_phone = ?'); params.push(input.agentPhone); }
  if (input.agentEmail !== undefined) { sets.push('agent_email = ?'); params.push(input.agentEmail); }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(
    `UPDATE hm_insurance_policies SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function deletePolicy(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_insurance_policies WHERE id = ?', [id]);
}
