import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  decodeCursor,
  encodeCursor,
  isUuidSearch,
  keysetBeforeFilter,
  sanitizeSearchTerm,
} from './pagination';
import type { DmcaEvent, DmcaQueueFilters, DmcaQueueItem } from './dmca-workflow';

const TAKEDOWN_SELECT = [
  'id',
  'kind',
  'report_id',
  'complainant_name',
  'complainant_email',
  'complainant_address',
  'copyrighted_work',
  'infringing_url',
  'target_kind',
  'target_id',
  'good_faith',
  'good_faith_attestation_text',
  'good_faith_attestation_version',
  'accuracy_under_penalty',
  'accuracy_attestation_text',
  'accuracy_attestation_version',
  'signature',
  'status',
  'assigned_moderator_ref',
  'acknowledgment_due_at',
  'acknowledged_at',
  'forwarded_at',
  'forwarded_to_email',
  'restored_at',
  'closed_at',
  'disposition',
  'strike_profile_id',
  'strike_action_id',
  'created_at',
  'updated_at',
  'console_version',
].join(',');

const COUNTER_SELECT = [
  'id',
  'original_notice_id',
  'original_notice_reference',
  'counter_notifier_name',
  'counter_notifier_address',
  'counter_notifier_phone',
  'counter_notifier_email',
  'removed_material',
  'material_location_before_removal',
  'target_kind',
  'target_id',
  'good_faith_mistake_or_misidentification',
  'statement_under_penalty_of_perjury',
  'mistake_attestation_text',
  'mistake_attestation_version',
  'consent_to_federal_jurisdiction',
  'jurisdiction_attestation_text',
  'jurisdiction_attestation_version',
  'acceptance_of_service_of_process',
  'service_attestation_text',
  'service_attestation_version',
  'signature',
  'status',
  'assigned_moderator_ref',
  'acknowledgment_due_at',
  'acknowledged_at',
  'forwarded_to_claimant_at',
  'forwarded_to_email',
  'waiting_period_started_at',
  'restoration_eligible_at',
  'restoration_deadline_at',
  'restored_at',
  'litigation_hold_at',
  'closed_at',
  'disposition',
  'created_at',
  'updated_at',
  'console_version',
].join(',');

interface TakedownRow {
  id: string;
  kind: 'takedown' | 'counter';
  report_id: string | null;
  complainant_name: string;
  complainant_email: string;
  complainant_address: string;
  copyrighted_work: string;
  infringing_url: string;
  target_kind: string | null;
  target_id: string | null;
  good_faith: boolean;
  good_faith_attestation_text: string;
  good_faith_attestation_version: string;
  accuracy_under_penalty: boolean;
  accuracy_attestation_text: string;
  accuracy_attestation_version: string;
  signature: string;
  status: string;
  assigned_moderator_ref: string | null;
  acknowledgment_due_at: string;
  acknowledged_at: string | null;
  forwarded_at: string | null;
  forwarded_to_email: string | null;
  restored_at: string | null;
  closed_at: string | null;
  disposition: string | null;
  strike_profile_id: string | null;
  strike_action_id: string | null;
  created_at: string;
  updated_at: string;
  console_version: number;
}

interface CounterRow {
  id: string;
  original_notice_id: string | null;
  original_notice_reference: string | null;
  counter_notifier_name: string;
  counter_notifier_address: string;
  counter_notifier_phone: string;
  counter_notifier_email: string;
  removed_material: string;
  material_location_before_removal: string;
  target_kind: string | null;
  target_id: string | null;
  good_faith_mistake_or_misidentification: boolean;
  statement_under_penalty_of_perjury: boolean;
  mistake_attestation_text: string;
  mistake_attestation_version: string;
  consent_to_federal_jurisdiction: boolean;
  jurisdiction_attestation_text: string;
  jurisdiction_attestation_version: string;
  acceptance_of_service_of_process: boolean;
  service_attestation_text: string;
  service_attestation_version: string;
  signature: string;
  status: string;
  assigned_moderator_ref: string | null;
  acknowledgment_due_at: string;
  acknowledged_at: string | null;
  forwarded_to_claimant_at: string | null;
  forwarded_to_email: string | null;
  waiting_period_started_at: string | null;
  restoration_eligible_at: string | null;
  restoration_deadline_at: string | null;
  restored_at: string | null;
  litigation_hold_at: string | null;
  closed_at: string | null;
  disposition: string | null;
  created_at: string;
  updated_at: string;
  console_version: number;
}

function mapTakedown(row: TakedownRow): DmcaQueueItem {
  const legacyCounter = row.kind === 'counter';
  return {
    id: row.id,
    kind: legacyCounter ? 'counter' : 'takedown',
    workflowKind: 'takedown',
    legacy: legacyCounter,
    status: row.status,
    submitterName: row.complainant_name,
    submitterEmail: row.complainant_email,
    submitterAddress: row.complainant_address,
    submitterPhone: null,
    material: row.copyrighted_work,
    publicUrl: row.infringing_url,
    targetKind: row.target_kind,
    targetId: row.target_id,
    signature: row.signature,
    assignedModeratorRef: row.assigned_moderator_ref,
    acknowledgmentDueAt: row.acknowledgment_due_at,
    acknowledgedAt: row.acknowledged_at,
    forwardedAt: row.forwarded_at,
    forwardedToEmail: row.forwarded_to_email,
    waitingPeriodStartedAt: null,
    restorationEligibleAt: null,
    restorationDeadlineAt: null,
    restoredAt: row.restored_at,
    litigationHoldAt: null,
    closedAt: row.closed_at,
    disposition: row.disposition,
    reportId: row.report_id,
    originalNoticeId: null,
    originalNoticeReference: null,
    strikeProfileId: row.strike_profile_id,
    strikeActionId: row.strike_action_id,
    attestations: [
      {
        label: 'Good-faith authorization statement',
        accepted: row.good_faith,
        text: row.good_faith_attestation_text,
        version: row.good_faith_attestation_version,
      },
      {
        label: 'Accuracy and authority under penalty of perjury',
        accepted: row.accuracy_under_penalty,
        text: row.accuracy_attestation_text,
        version: row.accuracy_attestation_version,
      },
    ],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    consoleVersion: row.console_version,
  };
}

function mapCounter(row: CounterRow): DmcaQueueItem {
  return {
    id: row.id,
    kind: 'counter',
    workflowKind: 'counter',
    legacy: false,
    status: row.status,
    submitterName: row.counter_notifier_name,
    submitterEmail: row.counter_notifier_email,
    submitterAddress: row.counter_notifier_address,
    submitterPhone: row.counter_notifier_phone,
    material: row.removed_material,
    publicUrl: row.material_location_before_removal,
    targetKind: row.target_kind,
    targetId: row.target_id,
    signature: row.signature,
    assignedModeratorRef: row.assigned_moderator_ref,
    acknowledgmentDueAt: row.acknowledgment_due_at,
    acknowledgedAt: row.acknowledged_at,
    forwardedAt: row.forwarded_to_claimant_at,
    forwardedToEmail: row.forwarded_to_email,
    waitingPeriodStartedAt: row.waiting_period_started_at,
    restorationEligibleAt: row.restoration_eligible_at,
    restorationDeadlineAt: row.restoration_deadline_at,
    restoredAt: row.restored_at,
    litigationHoldAt: row.litigation_hold_at,
    closedAt: row.closed_at,
    disposition: row.disposition,
    reportId: null,
    originalNoticeId: row.original_notice_id,
    originalNoticeReference: row.original_notice_reference,
    strikeProfileId: null,
    strikeActionId: null,
    attestations: [
      {
        label: 'Mistake or misidentification',
        accepted:
          row.good_faith_mistake_or_misidentification &&
          row.statement_under_penalty_of_perjury,
        text: row.mistake_attestation_text,
        version: row.mistake_attestation_version,
      },
      {
        label: 'Federal district court jurisdiction',
        accepted: row.consent_to_federal_jurisdiction,
        text: row.jurisdiction_attestation_text,
        version: row.jurisdiction_attestation_version,
      },
      {
        label: 'Acceptance of service of process',
        accepted: row.acceptance_of_service_of_process,
        text: row.service_attestation_text,
        version: row.service_attestation_version,
      },
    ],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    consoleVersion: row.console_version,
  };
}

export interface DmcaQueuePage {
  items: DmcaQueueItem[];
  nextCursor: string | null;
  searched: boolean;
}

/**
 * One page of the merged DMCA queue (plan 48 WP9 pagination).
 *
 * Takedowns and counter-notices are separate tables, so the page is a merge of
 * two keyset reads. Both sides are ordered by (created_at, id) descending and each
 * side is asked for pageSize + 1 rows strictly before the cursor; merging two
 * sorted streams and truncating keeps the combined order correct, and the cursor
 * for the next page comes from the last row actually shown.
 *
 * This replaced a flat 500-row cap. On a legal queue, a cap silently hides the
 * oldest notices with no way to reach them, which is the opposite of what a DMCA
 * file needs.
 */
export async function fetchDmcaQueuePage(
  admin: SupabaseClient,
  options: {
    limit?: number;
    cursor?: string | null;
    search?: string | null;
    filters?: DmcaQueueFilters;
    nowMs?: number;
  } = {},
): Promise<DmcaQueuePage> {
  const pageSize = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const cursor = decodeCursor(options.cursor);
  const search = sanitizeSearchTerm(options.search);
  const filters = options.filters ?? { kind: 'all', status: 'open', age: 'all' };
  const nowMs = options.nowMs ?? Date.now();
  // The filters run in SQL rather than over a fetched page. Filtering a page in
  // memory would show an empty screen while matching rows sat on later pages,
  // which on a legal queue reads as "no such notice".
  const iso = (offsetHours: number) => new Date(nowMs - offsetHours * 3600_000).toISOString();

  const build = (table: string, select: string) => {
    let query = admin.from(table).select(select);
    if (cursor) query = query.or(keysetBeforeFilter(cursor));
    if (filters.status === 'open') {
      query = query.not('status', 'in', '("closed","restored")');
    } else if (filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters.age === 'under_24h') query = query.gte('created_at', iso(24));
    if (filters.age === '24_to_72h') {
      query = query.lt('created_at', iso(24)).gte('created_at', iso(72));
    }
    if (filters.age === 'over_72h') query = query.lt('created_at', iso(72));
    if (search) {
      query = isUuidSearch(search)
        ? query.or(`id.eq.${search}`)
        : table === 'nw_dmca_notices'
          ? query.or(
              `complainant_email.ilike.*${search}*,complainant_name.ilike.*${search}*,` +
                `infringing_url.ilike.*${search}*`,
            )
          : query.or(
              `counter_notifier_email.ilike.*${search}*,counter_notifier_name.ilike.*${search}*`,
            );
    }
    return query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1);
  };

  const empty = { data: [] as unknown[], error: null };
  const [takedowns, counters] = await Promise.all([
    filters.kind === 'counter' ? empty : build('nw_dmca_notices', TAKEDOWN_SELECT),
    filters.kind === 'takedown' ? empty : build('nw_dmca_counter_notices', COUNTER_SELECT),
  ]);
  if (takedowns.error) {
    throw new Error(`mynews-console: DMCA notice queue failed: ${takedowns.error.message}`);
  }
  if (counters.error) {
    throw new Error(`mynews-console: DMCA counter queue failed: ${counters.error.message}`);
  }

  const merged = [
    ...((takedowns.data ?? []) as unknown as TakedownRow[]).map(mapTakedown),
    ...((counters.data ?? []) as unknown as CounterRow[]).map(mapCounter),
  ].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
  );

  const hasMore = merged.length > pageSize;
  const items = hasMore ? merged.slice(0, pageSize) : merged;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    searched: search !== null,
  };
}

/** The unpaginated merge. Kept for callers that need a bounded whole-queue view. */
export async function fetchDmcaQueue(
  admin: SupabaseClient,
  limit = 500,
): Promise<DmcaQueueItem[]> {
  const [takedowns, counters] = await Promise.all([
    admin
      .from('nw_dmca_notices')
      .select(TAKEDOWN_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit),
    admin
      .from('nw_dmca_counter_notices')
      .select(COUNTER_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);
  if (takedowns.error) {
    throw new Error(`mynews-console: DMCA notice queue failed: ${takedowns.error.message}`);
  }
  if (counters.error) {
    throw new Error(`mynews-console: DMCA counter queue failed: ${counters.error.message}`);
  }
  return [
    ...((takedowns.data ?? []) as unknown as TakedownRow[]).map(mapTakedown),
    ...((counters.data ?? []) as unknown as CounterRow[]).map(mapCounter),
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function fetchDmcaItemById(
  admin: SupabaseClient,
  id: string,
): Promise<DmcaQueueItem | null> {
  const [takedown, counter] = await Promise.all([
    admin.from('nw_dmca_notices').select(TAKEDOWN_SELECT).eq('id', id).limit(1),
    admin.from('nw_dmca_counter_notices').select(COUNTER_SELECT).eq('id', id).limit(1),
  ]);
  if (takedown.error) throw new Error(`mynews-console: DMCA notice read failed: ${takedown.error.message}`);
  if (counter.error) throw new Error(`mynews-console: DMCA counter read failed: ${counter.error.message}`);
  const candidates = [
    ...((takedown.data ?? []) as unknown as TakedownRow[]).map(mapTakedown),
    ...((counter.data ?? []) as unknown as CounterRow[]).map(mapCounter),
  ];
  if (candidates.length > 1) throw new Error('mynews-console: ambiguous DMCA notice id');
  return candidates[0] ?? null;
}

export async function fetchDmcaEvents(
  admin: SupabaseClient,
  item: Pick<DmcaQueueItem, 'id' | 'workflowKind'>,
): Promise<DmcaEvent[]> {
  const idColumn = item.workflowKind === 'takedown' ? 'takedown_notice_id' : 'counter_notice_id';
  const { data, error } = await admin
    .from('nw_dmca_events')
    .select('id,event,actor_ref,note,metadata,created_at')
    .eq(idColumn, item.id)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`mynews-console: DMCA event read failed: ${error.message}`);
  return ((data ?? []) as Array<{
    id: string;
    event: string;
    actor_ref: string;
    note: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    event: row.event,
    actorRef: row.actor_ref,
    note: row.note,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }));
}

export async function applyDmcaWorkflowAction(
  admin: SupabaseClient,
  input: {
    noticeId: string;
    workflowKind: 'takedown' | 'counter';
    action: string;
    moderatorRef: string;
    note: string;
    value?: string | null;
  },
): Promise<string> {
  const { data, error } = await admin.rpc('nw_dmca_apply_action', {
    p_notice_id: input.noticeId,
    p_notice_kind: input.workflowKind,
    p_action: input.action,
    p_moderator_ref: input.moderatorRef,
    p_note: input.note,
    p_value: input.value ?? null,
  });
  if (error) throw new Error(`mynews-console: DMCA workflow action failed: ${error.message}`);
  return typeof data === 'string' ? data : 'rpc-failed';
}
