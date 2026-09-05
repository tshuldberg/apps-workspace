import { v4 as uuidv4 } from 'uuid';
import type { DatabaseAdapter } from '@mylife/db';
import { PlanMemberInputSchema, type PlanMemberInput, type PlanMemberRow } from '../../types';

export function addPlanMember(db: DatabaseAdapter, input: PlanMemberInput): string {
  const data = PlanMemberInputSchema.parse(input);
  const id = data.id ?? uuidv4();
  db.execute(`INSERT INTO mh_plan_members (id, plan_id, person_ref, role) VALUES (?,?,?,?)`,
    [id, data.planId, data.personRef, data.role]);
  return id;
}

export function getPlanMembers(db: DatabaseAdapter, planId: string): PlanMemberRow[] {
  return db.query<PlanMemberRow>(`SELECT * FROM mh_plan_members WHERE plan_id = ? ORDER BY created_at ASC`, [planId]);
}

export function removePlanMember(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM mh_plan_members WHERE id = ?`, [id]);
}
