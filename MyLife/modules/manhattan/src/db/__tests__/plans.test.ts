import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';
import {
  createPlan,
  getPlans,
  getPlanById,
  getPlansOnDay,
  updatePlan,
  softDeletePlan,
  updatePlanCalendarEventId,
  getPlanByCalendarEventId,
} from '../crud/plans';
import { addPlanMember, getPlanMembers, removePlanMember } from '../crud/plan-members';

describe('manhattan plans CRUD', () => {
  it('creates, lists, reads', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createPlan(adapter, { title: 'Dinner at Lilia', startAt: '2026-07-04T20:00:00' });
    expect(getPlans(adapter)).toHaveLength(1);
    expect(getPlanById(adapter, id)?.title).toBe('Dinner at Lilia');
    close();
  });

  it('returns plans on a specific day', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    createPlan(adapter, { title: 'Brunch', startAt: '2026-07-04T11:00:00' });
    createPlan(adapter, { title: 'Dinner', startAt: '2026-07-04T20:00:00' });
    createPlan(adapter, { title: 'Other Day', startAt: '2026-07-05T18:00:00' });
    const onDay = getPlansOnDay(adapter, '2026-07-04');
    expect(onDay).toHaveLength(2);
    expect(onDay[0]?.title).toBe('Brunch');
    close();
  });

  it('updates a plan', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createPlan(adapter, { title: 'Original', startAt: '2026-07-04T20:00:00' });
    updatePlan(adapter, id, { title: 'Updated', startAt: '2026-07-04T21:00:00' });
    expect(getPlanById(adapter, id)?.title).toBe('Updated');
    close();
  });

  it('soft-deletes a plan', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createPlan(adapter, { title: 'To Delete', startAt: '2026-07-04T20:00:00' });
    softDeletePlan(adapter, id);
    expect(getPlanById(adapter, id)).toBeNull();
    expect(getPlans(adapter)).toHaveLength(0);
    close();
  });

  it('links and looks up a plan by calendar event id', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createPlan(adapter, { title: 'Calendar Plan', startAt: '2026-07-04T20:00:00' });
    expect(getPlanById(adapter, id)?.calendar_event_id).toBeNull();
    updatePlanCalendarEventId(adapter, id, 'cal-evt-123');
    expect(getPlanById(adapter, id)?.calendar_event_id).toBe('cal-evt-123');
    expect(getPlanByCalendarEventId(adapter, 'cal-evt-123')?.id).toBe(id);
    expect(getPlanByCalendarEventId(adapter, 'missing')).toBeNull();
    updatePlanCalendarEventId(adapter, id, null);
    expect(getPlanById(adapter, id)?.calendar_event_id).toBeNull();
    close();
  });
});

describe('manhattan plan-members CRUD', () => {
  it('adds, lists, and removes members', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const planId = createPlan(adapter, { title: 'Group Dinner', startAt: '2026-07-04T20:00:00' });
    const memberId = addPlanMember(adapter, { planId, personRef: 'contact:abc123' });
    const members = getPlanMembers(adapter, planId);
    expect(members).toHaveLength(1);
    expect(members[0]?.person_ref).toBe('contact:abc123');
    removePlanMember(adapter, memberId);
    expect(getPlanMembers(adapter, planId)).toHaveLength(0);
    close();
  });
});
