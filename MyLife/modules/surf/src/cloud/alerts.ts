import type { SupabaseClient } from '@supabase/supabase-js';
import type { SpotAlert, AlertRule, AlertParameter, AlertOperator, AlertJoin } from '../types';

interface CreateAlertRuleInput {
  parameter: AlertParameter;
  operator: AlertOperator;
  value: number;
  joinWith?: AlertJoin;
  sortOrder?: number;
}

export interface CreateCloudAlertInput {
  userId: string;
  spotId: string;
  name: string;
  rules: CreateAlertRuleInput[];
  cooldownMinutes?: number;
}

interface AlertRuleRow {
  id: string;
  parameter: string;
  operator: string;
  value: number;
  join_operator: string;
  sort_order: number;
}

interface SpotAlertRow {
  id: string;
  user_id: string;
  spot_id: string;
  name: string;
  is_active: boolean;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
  alert_rules?: AlertRuleRow[];
}

function mapRule(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    parameter: row.parameter as AlertParameter,
    operator: row.operator as AlertOperator,
    value: row.value,
    joinWith: row.join_operator as AlertJoin,
    sortOrder: row.sort_order,
  };
}

function mapAlert(row: SpotAlertRow): SpotAlert {
  return {
    id: row.id,
    userId: row.user_id,
    spotId: row.spot_id,
    name: row.name,
    isActive: row.is_active,
    cooldownMinutes: row.cooldown_minutes,
    lastTriggeredAt: row.last_triggered_at ?? undefined,
    rules: (row.alert_rules ?? []).map(mapRule),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function cloudCreateSpotAlert(
  client: SupabaseClient,
  input: CreateCloudAlertInput,
): Promise<{ id: string }> {
  const { data: alertRow, error: alertError } = await client
    .from('spot_alerts')
    .insert({
      user_id: input.userId,
      spot_id: input.spotId,
      name: input.name,
      cooldown_minutes: input.cooldownMinutes ?? 30,
    })
    .select('id')
    .single();

  if (alertError) throw alertError;

  const rulesPayload = input.rules.map((rule, idx) => ({
    alert_id: alertRow.id,
    parameter: rule.parameter,
    operator: rule.operator,
    value: rule.value,
    join_operator: rule.joinWith ?? 'and',
    sort_order: rule.sortOrder ?? idx,
  }));

  const { error: rulesError } = await client
    .from('alert_rules')
    .insert(rulesPayload);

  if (rulesError) throw rulesError;

  return { id: alertRow.id as string };
}

export async function cloudGetSpotAlerts(
  client: SupabaseClient,
  userId: string,
  spotId?: string,
): Promise<SpotAlert[]> {
  let query = client
    .from('spot_alerts')
    .select('*, alert_rules(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (spotId) {
    query = query.eq('spot_id', spotId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as SpotAlertRow[]).map(mapAlert);
}

export async function cloudSetSpotAlertActive(
  client: SupabaseClient,
  alertId: string,
  userId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await client
    .from('spot_alerts')
    .update({ is_active: isActive })
    .eq('id', alertId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function cloudDeleteSpotAlert(
  client: SupabaseClient,
  alertId: string,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from('spot_alerts')
    .delete()
    .eq('id', alertId)
    .eq('user_id', userId);

  if (error) throw error;
}
