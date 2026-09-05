/**
 * OPERATOR MODERATION CONSOLE core (Plan 39, P12). The first-party Trust & Safety
 * service the ops web console drives: report-queue triage over the REAL host
 * abuse-intake rows (Plan 19 P8a), post removal via the REAL signed tombstone
 * path (Track B), persona suspend/unsuspend via the persona registry's revocation
 * seam (Track A), the one-action posting freeze, the Plan 19 descriptor kill, and
 * an APPEND-ONLY durable audit log.
 *
 * HONESTY RULES (binding):
 *  - NC-P4: every "ok" this service returns follows a REAL store/route verdict;
 *    an action that the node refused is reported refused, never smoothed over.
 *  - NC-P6: every count is computed from real store contents.
 *  - NC-P1: nothing here touches a private mesh route; the seams below are the
 *    public publication/report/post stores and the public moderation actions.
 *  - Audit rows are append-only: the store contract has no update/delete, and
 *    every action appends its row with the REAL outcome (including refusals).
 *
 * AUTHORITY MODEL: the console holds ONE operator Ed25519 keypair (derived from a
 * 32-byte seed exactly like the node receipt key). Its PUBLIC half must be the
 * node's `trustedKillAuthorityDeviceId`, which the community-node core already
 * honors for posting freezes, post tombstones, and descriptor kills, so every
 * console action is a SIGNED record the node verifies fail-closed. No new crypto.
 */

import { createHash } from 'node:crypto';
import {
  createDescriptorKill,
  createPublicPostTombstone,
  createPublicPostingFreeze,
  type AcceptedPublicPost,
  type DeviceIdentity,
  type PublicReportReason,
  type SignedPublicAbuseReport,
} from '@mylife/sync';
import type {
  CommunityNode,
  PublicPostModerationVerdict,
  PublicPostStore,
  PublicationStore,
  ReportStore,
} from './community-node';
import type { PersonaAdminStatus, SuspendPersonaResult, UnsuspendPersonaResult } from './persona-registry';
import type { NcmecReportQueue, NcmecQueueCounts } from './ncmec-queue';
import type { DmcaIntakeService, DmcaClaimRecord, DmcaClaimStatus } from './dmca-intake';
import type { CredentialRevocationSink } from './credential-evidence';

// ---------------------------------------------------------------------------
// Seams.
// ---------------------------------------------------------------------------

/** The moderation ACTIONS the console drives on the community node core. */
export type OperatorModerationNode = Pick<
  CommunityNode,
  'recordPublicPostTombstone' | 'recordPostingFreeze' | 'recordPublicationKill'
>;

/**
 * The persona-admin seam. Wired either in-process (createPersonaAdminFromService)
 * or over HTTP to the persona service's operator admin routes
 * (createPersonaAdminHttpClient). ABSENT => suspend/unsuspend honestly refuse
 * with persona_admin_not_configured; nothing is faked.
 */
export interface PersonaAdminClient {
  suspend(target: { personaPubkey?: string; alias?: string }): Promise<
    | { ok: true; personaPubkey: string; alias: string | null; alreadySuspended: boolean }
    | { ok: false; reason: string }
  >;
  unsuspend(target: { personaPubkey?: string; alias?: string }): Promise<
    | { ok: true; personaPubkey: string; alias: string; wasSuspended: boolean }
    | { ok: false; reason: string }
  >;
  status(target: { personaPubkey?: string; alias?: string }): Promise<
    | { ok: true; status: PersonaAdminStatus }
    | { ok: false; reason: string }
  >;
}

/** In-process persona-admin wiring (co-located registry; also the test seam). */
export function createPersonaAdminFromService(service: {
  suspendPersona(pubkey: string): Promise<SuspendPersonaResult>;
  unsuspendPersona(pubkey: string): Promise<UnsuspendPersonaResult>;
  personaAdminStatus(pubkey: string): Promise<PersonaAdminStatus | null>;
  personaAdminStatusByAlias(alias: string): Promise<PersonaAdminStatus | null>;
  resolve(alias: string): Promise<{ alias: string; personaPubkey: string } | null>;
}): PersonaAdminClient {
  async function resolveTarget(target: { personaPubkey?: string; alias?: string }): Promise<string | null> {
    if (target.personaPubkey) return target.personaPubkey;
    if (target.alias) return (await service.resolve(target.alias))?.personaPubkey ?? null;
    return null;
  }
  return {
    async suspend(target) {
      const pubkey = await resolveTarget(target);
      if (!pubkey) return { ok: false, reason: 'not_found' };
      const result = await service.suspendPersona(pubkey);
      return result.ok ? result : { ok: false, reason: result.reason };
    },
    async unsuspend(target) {
      const pubkey = await resolveTarget(target);
      if (!pubkey) return { ok: false, reason: 'not_found' };
      const result = await service.unsuspendPersona(pubkey);
      return result.ok ? result : { ok: false, reason: result.reason };
    },
    async status(target) {
      const status = target.personaPubkey
        ? await service.personaAdminStatus(target.personaPubkey)
        : target.alias
          ? await service.personaAdminStatusByAlias(target.alias)
          : null;
      return status ? { ok: true, status } : { ok: false, reason: 'not_found' };
    },
  };
}

/**
 * HTTP persona-admin client for the split deploy (persona service on its own
 * port). Calls the operator admin routes with the shared admin secret. Every
 * network/parse failure fails CLOSED to `{ ok:false, reason:'unreachable' }` --
 * the console then reports the suspend as NOT done (NC-P4), never as done.
 */
export function createPersonaAdminHttpClient(options: {
  baseUrl: string;
  adminSecret: string;
  fetchImpl?: typeof fetch;
}): PersonaAdminClient {
  const base = options.baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetchImpl ?? fetch;
  async function call(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> {
    try {
      const res = await doFetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.adminSecret}`,
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      return { status: res.status, json };
    } catch {
      return { status: 0, json: null };
    }
  }
  function failReason(r: { status: number; json: Record<string, unknown> | null }): string {
    if (r.status === 0) return 'unreachable';
    const reason = r.json?.reason;
    return typeof reason === 'string' && reason ? reason : `status_${r.status}`;
  }
  return {
    async suspend(target) {
      const r = await call('/persona/admin/suspend', target);
      if (r.status === 200 && r.json?.ok === true && typeof r.json.personaPubkey === 'string') {
        return {
          ok: true,
          personaPubkey: r.json.personaPubkey,
          alias: typeof r.json.alias === 'string' ? r.json.alias : null,
          alreadySuspended: r.json.alreadySuspended === true,
        };
      }
      return { ok: false, reason: failReason(r) };
    },
    async unsuspend(target) {
      const r = await call('/persona/admin/unsuspend', target);
      if (r.status === 200 && r.json?.ok === true
        && typeof r.json.personaPubkey === 'string' && typeof r.json.alias === 'string') {
        return {
          ok: true,
          personaPubkey: r.json.personaPubkey,
          alias: r.json.alias,
          wasSuspended: r.json.wasSuspended === true,
        };
      }
      return { ok: false, reason: failReason(r) };
    },
    async status(target) {
      const r = await call('/persona/admin/status', target);
      if (r.status === 200 && r.json?.ok === true && typeof r.json.personaPubkey === 'string') {
        return {
          ok: true,
          status: {
            personaPubkey: r.json.personaPubkey,
            registered: r.json.registered === true,
            alias: typeof r.json.alias === 'string' ? r.json.alias : null,
            suspended: r.json.suspended === true,
          },
        };
      }
      return { ok: false, reason: failReason(r) };
    },
  };
}

// ---------------------------------------------------------------------------
// Durable console store: triage rows + APPEND-ONLY audit log.
// ---------------------------------------------------------------------------

/** Console-side triage state of one report. 'open' is the implicit default. */
export type ReportTriageStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned';

export interface ReportTriageRow {
  reportKey: string;
  status: Exclude<ReportTriageStatus, 'open'>;
  decidedAt: string;
  /** Optional operator note (bounded by the HTTP layer). */
  note?: string;
  /** Audit row seq that recorded the decision. */
  auditSeq: number;
}

/** One append-only audit row. `seq` is store-assigned, strictly increasing. */
export interface OperatorAuditRow {
  seq: number;
  at: string;
  /** The operator authority public key that performed the action. */
  actorKeyHex: string;
  action:
    | 'report_reviewed'
    | 'report_dismissed'
    | 'post_tombstoned'
    | 'posting_freeze_set'
    | 'publication_killed'
    | 'persona_suspended'
    | 'persona_unsuspended'
    | 'dmca_takedown'
    | 'dmca_counter_notice'
    | 'dmca_rejected'
    | 'credential_revoked';
  target: {
    publicationId?: string;
    communityId?: string;
    postId?: string;
    personaPubkey?: string;
    alias?: string;
    reportKey?: string;
    frozen?: boolean;
    dmcaClaimId?: string;
    /**
     * Plan 51 P4 credential-serial evidence ONLY. A serial + epoch may appear here
     * (moderation side of the wall). NO account identifier may ever be added to
     * this target shape.
     */
    credentialSerial?: string;
    credentialEpoch?: number;
  };
  reason: string;
  /** The REAL outcome: 'ok' or the exact refusal reason (NC-P4). */
  outcome: string;
  /** Hex Ed25519 signature of the signed action record, when one was minted. */
  actionSignature?: string;
}

export interface OperatorTriageDecisionInput {
  audit: Omit<OperatorAuditRow, 'seq'>;
  triage: Omit<ReportTriageRow, 'auditSeq'>;
}

export interface OperatorTriageDecisionResult {
  audit: OperatorAuditRow;
  triage: ReportTriageRow;
}

/**
 * The console's durable store. AUDIT IS APPEND-ONLY BY CONTRACT: there is no
 * update or delete on audit rows; `appendAudit` assigns the next seq and
 * persists. Triage rows are per-report decision state (idempotent overwrite).
 */
export interface OperatorConsoleStore {
  appendAudit(row: Omit<OperatorAuditRow, 'seq'>): OperatorAuditRow | Promise<OperatorAuditRow>;
  /** Persist one successful report decision and its audit row in one atomic mutation. */
  recordTriageDecision(
    input: OperatorTriageDecisionInput,
  ): OperatorTriageDecisionResult | Promise<OperatorTriageDecisionResult>;
  /** Newest-first page; `beforeSeq` excludes rows at/after it. Bounded by limit. */
  listAudit(limit: number, beforeSeq?: number): OperatorAuditRow[] | Promise<OperatorAuditRow[]>;
  auditCount(): number | Promise<number>;
  getTriage(reportKey: string): (ReportTriageRow | null) | Promise<ReportTriageRow | null>;
  putTriage(row: ReportTriageRow): void | Promise<void>;
  listTriage(): ReportTriageRow[] | Promise<ReportTriageRow[]>;
  /**
   * GDPR support (Plan 39 P13 / AC-5): delete a triage decision row. The APPEND-ONLY audit log
   * is never touched -- only the mutable per-report decision state is purged. Idempotent.
   */
  deleteTriage(reportKey: string): void | Promise<void>;
}

/** In-memory console store (tests, ephemeral runs). */
export class InMemoryOperatorConsoleStore implements OperatorConsoleStore {
  private readonly audit: OperatorAuditRow[] = [];
  private readonly triage = new Map<string, ReportTriageRow>();

  appendAudit(row: Omit<OperatorAuditRow, 'seq'>): OperatorAuditRow {
    const full: OperatorAuditRow = {
      ...row,
      target: { ...row.target },
      seq: this.audit.length + 1,
    };
    this.audit.push(full);
    return { ...full, target: { ...full.target } };
  }
  recordTriageDecision(input: OperatorTriageDecisionInput): OperatorTriageDecisionResult {
    const audit = this.appendAudit(input.audit);
    const triage: ReportTriageRow = {
      ...input.triage,
      auditSeq: audit.seq,
    };
    this.putTriage(triage);
    return {
      audit,
      triage: { ...triage },
    };
  }
  listAudit(limit: number, beforeSeq?: number): OperatorAuditRow[] {
    const bound = Math.max(1, Math.min(200, Math.floor(limit)));
    const rows = beforeSeq === undefined ? this.audit : this.audit.filter((r) => r.seq < beforeSeq);
    return rows.slice(-bound).reverse().map((row) => ({
      ...row,
      target: { ...row.target },
    }));
  }
  auditCount(): number {
    return this.audit.length;
  }
  getTriage(reportKey: string): ReportTriageRow | null {
    const row = this.triage.get(reportKey);
    return row ? { ...row } : null;
  }
  putTriage(row: ReportTriageRow): void {
    this.triage.set(row.reportKey, { ...row });
  }
  listTriage(): ReportTriageRow[] {
    return [...this.triage.values()].map((row) => ({ ...row }));
  }
  deleteTriage(reportKey: string): void {
    this.triage.delete(reportKey);
  }
}

// ---------------------------------------------------------------------------
// Service.
// ---------------------------------------------------------------------------

/** Stable, unforgeable-by-guessing key for one stored report: sha256(signature). */
export function deriveReportKey(signed: SignedPublicAbuseReport): string {
  return createHash('sha256').update(signed.signature, 'utf8').digest('hex');
}

/** One triage-joined queue row the console renders (all fields from real rows). */
export interface OperatorReportRow {
  reportKey: string;
  publicationId: string;
  publicationTitle: string | null;
  communityId: string | null;
  targetKind: string;
  targetId: string;
  reason: PublicReportReason;
  reporterDeviceId: string;
  reportedAt: string;
  /** csam || illegal (host triage priority, same flag the owner fetch uses). */
  priority: boolean;
  status: ReportTriageStatus;
  /** The reported post when it is one this node still stores (body bounded). */
  post: { postId: string; personaPubkey: string; body: string; createdAt: string } | null;
}

export interface OperatorQueueStats {
  open: number;
  reviewed: number;
  dismissed: number;
  actioned: number;
  openByReason: Record<PublicReportReason, number>;
  /** Open reports in the csam/illegal priority lane. */
  openPriority: number;
}

export interface OperatorPublicationRow {
  publicationId: string;
  communityId: string;
  title: string;
  status: string;
  postPolicy: string;
  frozen: boolean;
  /** Real stored counts (NC-P6). */
  posts: number;
  tombstones: number;
  openReports: number;
}

export type OperatorActionResult =
  | { ok: true; audit: OperatorAuditRow }
  | { ok: false; reason: string; audit: OperatorAuditRow };

const REPORT_REASONS: readonly PublicReportReason[] = ['spam', 'harassment', 'illegal', 'csam', 'violence', 'other'];
const MAX_QUEUE_LIMIT = 200;
const MAX_BODY_PREVIEW_CHARS = 500;

export interface OperatorConsoleServiceOptions {
  node: OperatorModerationNode;
  publications: Pick<PublicationStore, 'get' | 'list'>;
  reports: Pick<ReportStore, 'get'>;
  posts: Pick<PublicPostStore, 'listPosts' | 'listTombstones' | 'getFreeze'>;
  store: OperatorConsoleStore;
  /** The operator authority Ed25519 keypair (hex). Public half must be the node's
   *  trustedKillAuthorityDeviceId or the node will (correctly) refuse the actions. */
  operator: { publicKeyHex: string; privateKeyHex: string };
  personaAdmin?: PersonaAdminClient;
  /**
   * Durable NCMEC report queue (Plan 39 P13). When present, actioning or reviewing a csam-flagged
   * report enqueues a report record with the evidence references, so the CSAM lane reflects a
   * REAL queue rather than a runbook step. Absent => the lane honestly reports the queue as
   * not wired (NC-P4). Vendor filing is founder-ops; the queue exports for manual filing.
   */
  ncmecQueue?: NcmecReportQueue;
  /**
   * DMCA intake service (Plan 39 P13). When present, the console exposes a DMCA lane: list claims,
   * take down (tombstone) claimed posts, record counter-notices, reject defective notices -- each
   * writes an append-only audit row. Absent => the lane reports the pipeline as not wired.
   */
  dmcaIntake?: DmcaIntakeService;
  /**
   * Plan 51 P4 enforcement lane. When present, revokeCredentialSerial writes a
   * serial + epoch + reason through this sink (the bin backs it with the
   * meerkat_moderation role's INSERT on credential.revocations). Absent => the
   * lane honestly refuses (credential_revocation_not_configured). The sink is
   * moderation-side; it never touches an account table (the one-way wall).
   */
  credentialRevocation?: CredentialRevocationSink;
  now?: () => number;
}

export class OperatorConsoleService {
  private readonly node: OperatorModerationNode;
  private readonly publications: Pick<PublicationStore, 'get' | 'list'>;
  private readonly reports: Pick<ReportStore, 'get'>;
  private readonly posts: Pick<PublicPostStore, 'listPosts' | 'listTombstones' | 'getFreeze'>;
  private readonly store: OperatorConsoleStore;
  private readonly operator: { publicKeyHex: string; privateKeyHex: string };
  private readonly personaAdmin?: PersonaAdminClient;
  private readonly ncmecQueue?: NcmecReportQueue;
  private readonly dmcaIntake?: DmcaIntakeService;
  private readonly credentialRevocation?: CredentialRevocationSink;
  private readonly now: () => number;
  /** The operator identity shape createDescriptorKill consumes (legacy raw ref;
   *  extractSigningPrivateKeyHex resolves it; dh/display fields are unused). */
  private readonly authorityIdentity: DeviceIdentity;

  constructor(options: OperatorConsoleServiceOptions) {
    this.node = options.node;
    this.publications = options.publications;
    this.reports = options.reports;
    this.posts = options.posts;
    this.store = options.store;
    this.operator = options.operator;
    this.personaAdmin = options.personaAdmin;
    this.ncmecQueue = options.ncmecQueue;
    this.dmcaIntake = options.dmcaIntake;
    this.credentialRevocation = options.credentialRevocation;
    this.now = options.now ?? (() => Date.now());
    this.authorityIdentity = {
      publicKey: this.operator.publicKeyHex,
      privateKeyRef: `local:ed25519:${this.operator.privateKeyHex}`,
      dhPublicKey: this.operator.publicKeyHex,
      displayName: 'Meerkat Trust & Safety operator',
      createdAt: new Date(0).toISOString(),
    };
  }

  operatorPublicKey(): string {
    return this.operator.publicKeyHex;
  }

  hasPersonaAdmin(): boolean {
    return this.personaAdmin !== undefined;
  }

  hasCredentialRevocation(): boolean {
    return this.credentialRevocation !== undefined;
  }

  private nowIso(): string {
    return new Date(this.now()).toISOString();
  }

  /**
   * Plan 51 P4 (AC-3) enforcement lane: revoke one credential serial. Writes an
   * operator-signed-style append-only audit row (serial + epoch evidence ONLY,
   * never an account) and inserts the serial into the revocation list through the
   * injected sink. Fail-closed: no sink wired => refused honestly. Idempotent at
   * the sink (a re-revoked serial is a no-op there). A subsequent presentation of
   * that credential on any verifier surface is refused 'revoked' -- and, because
   * the flagged account's renewal presents this same serial, renewal is refused,
   * all without any persona-to-account row (the linkage dies with the credential).
   */
  async revokeCredentialSerial(input: {
    serial: string;
    epoch: number;
    reasonCode: string;
  }): Promise<OperatorActionResult> {
    if (!this.credentialRevocation) {
      const audit = await this.store.appendAudit({
        at: this.nowIso(),
        actorKeyHex: this.operator.publicKeyHex,
        action: 'credential_revoked',
        target: { credentialSerial: input.serial, credentialEpoch: input.epoch },
        reason: input.reasonCode,
        outcome: 'credential_revocation_not_configured',
      });
      return { ok: false, reason: 'credential_revocation_not_configured', audit };
    }
    let outcome = 'ok';
    try {
      await this.credentialRevocation.revokeSerial(input.serial, input.epoch, input.reasonCode);
    } catch {
      outcome = 'credential_revocation_unavailable';
    }
    const audit = await this.store.appendAudit({
      at: this.nowIso(),
      actorKeyHex: this.operator.publicKeyHex,
      action: 'credential_revoked',
      target: { credentialSerial: input.serial, credentialEpoch: input.epoch },
      reason: input.reasonCode,
      outcome,
    });
    return outcome === 'ok' ? { ok: true, audit } : { ok: false, reason: outcome, audit };
  }

  // -------------------------------------------------------------------------
  // Report queue.
  // -------------------------------------------------------------------------

  /** All stored reports joined with triage + publication + post context. */
  private async collectReports(): Promise<OperatorReportRow[]> {
    const triage = new Map((await this.store.listTriage()).map((t) => [t.reportKey, t]));
    const rows: OperatorReportRow[] = [];
    for (const publication of await this.publications.list()) {
      const d = publication.signed.descriptor;
      const stored = (await this.reports.get(d.publicationId)) ?? [];
      if (stored.length === 0) continue;
      const posts = await this.posts.listPosts(d.publicationId);
      const postsById = new Map(posts.map((p) => [p.post.postId, p]));
      for (const signed of stored) {
        const reportKey = deriveReportKey(signed);
        const target = postsById.get(signed.report.targetId) ?? null;
        rows.push({
          reportKey,
          publicationId: d.publicationId,
          publicationTitle: typeof d.title === 'string' ? d.title : null,
          communityId: d.communityId ?? null,
          targetKind: signed.report.targetKind,
          targetId: signed.report.targetId,
          reason: signed.report.reason,
          reporterDeviceId: signed.report.reporterDeviceId,
          reportedAt: signed.report.reportedAt,
          priority: signed.report.reason === 'csam' || signed.report.reason === 'illegal',
          status: triage.get(reportKey)?.status ?? 'open',
          post: target
            ? {
              postId: target.post.postId,
              personaPubkey: target.post.personaPubkey,
              body: target.post.body.slice(0, MAX_BODY_PREVIEW_CHARS),
              createdAt: target.post.createdAt,
            }
            : null,
        });
      }
    }
    // Priority lane first, then newest reports first (matches the owner fetch sort).
    rows.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      if (a.reportedAt !== b.reportedAt) return a.reportedAt < b.reportedAt ? 1 : -1;
      return a.reportKey < b.reportKey ? -1 : 1;
    });
    return rows;
  }

  async listReports(filter: {
    status?: ReportTriageStatus;
    reason?: PublicReportReason;
    priorityOnly?: boolean;
    limit?: number;
  } = {}): Promise<{ reports: OperatorReportRow[]; total: number }> {
    const limit = Math.max(1, Math.min(MAX_QUEUE_LIMIT, Math.floor(filter.limit ?? 50)));
    let rows = await this.collectReports();
    if (filter.status) rows = rows.filter((r) => r.status === filter.status);
    if (filter.reason) rows = rows.filter((r) => r.reason === filter.reason);
    if (filter.priorityOnly) rows = rows.filter((r) => r.priority);
    return { reports: rows.slice(0, limit), total: rows.length };
  }

  /** Real store counts only (NC-P6). */
  async queueStats(): Promise<OperatorQueueStats> {
    const rows = await this.collectReports();
    const openByReason = Object.fromEntries(REPORT_REASONS.map((r) => [r, 0])) as Record<PublicReportReason, number>;
    const stats: OperatorQueueStats = {
      open: 0, reviewed: 0, dismissed: 0, actioned: 0, openByReason, openPriority: 0,
    };
    for (const row of rows) {
      stats[row.status] += 1;
      if (row.status === 'open') {
        openByReason[row.reason] += 1;
        if (row.priority) stats.openPriority += 1;
      }
    }
    return stats;
  }

  /**
   * Mark a report reviewed or dismissed. The reportKey must resolve to a report
   * that is REALLY in the store right now (IDOR guard: a fabricated key can never
   * create triage/audit rows for content that does not exist).
   */
  async reviewReport(input: {
    reportKey: string;
    status: 'reviewed' | 'dismissed';
    note?: string;
  }): Promise<OperatorActionResult> {
    const rows = await this.collectReports();
    const row = rows.find((r) => r.reportKey === input.reportKey);
    if (!row) {
      const audit = await this.store.appendAudit({
        at: this.nowIso(),
        actorKeyHex: this.operator.publicKeyHex,
        action: input.status === 'dismissed' ? 'report_dismissed' : 'report_reviewed',
        target: { reportKey: input.reportKey },
        reason: input.note ?? '',
        outcome: 'unknown_report',
      });
      return { ok: false, reason: 'unknown_report', audit };
    }
    const decidedAt = this.nowIso();
    const { audit } = await this.store.recordTriageDecision({
      audit: {
        at: decidedAt,
        actorKeyHex: this.operator.publicKeyHex,
        action: input.status === 'dismissed' ? 'report_dismissed' : 'report_reviewed',
        target: {
          reportKey: input.reportKey,
          publicationId: row.publicationId,
          postId: row.targetId,
        },
        reason: input.note ?? '',
        outcome: 'ok',
      },
      triage: {
        reportKey: input.reportKey,
        status: input.status,
        decidedAt,
        ...(input.note ? { note: input.note } : {}),
      },
    });
    // CSAM lane: CONFIRMING (reviewed) a csam report files evidence references into the durable
    // NCMEC queue (idempotent). A DISMISSED csam report is the operator judging it NOT csam, so it
    // is never queued (no false filing work). Never a real NCMEC API call -- founder files (P15).
    if (row.reason === 'csam' && input.status === 'reviewed' && this.ncmecQueue) {
      await this.ncmecQueue.enqueueOperatorReport({
        reportKey: input.reportKey,
        publicationId: row.publicationId,
        postId: row.targetId,
        ...(row.post ? { personaPubkey: row.post.personaPubkey } : {}),
      });
    }
    return { ok: true, audit };
  }

  // -------------------------------------------------------------------------
  // Actions. Each signs a real record, drives the real node path, and appends
  // the REAL outcome to the audit log (NC-P4).
  // -------------------------------------------------------------------------

  /** Remove a post: operator-signed tombstone through the Track B path. The
   *  effect is immediate (dropped from the very next page fetch, AC-4). */
  async tombstonePost(input: {
    publicationId: string;
    postId: string;
    reason: string;
  }): Promise<OperatorActionResult> {
    const tombstone = createPublicPostTombstone(this.operator, {
      publicationId: input.publicationId,
      postId: input.postId,
      now: this.nowIso(),
    });
    const verdict = await this.node.recordPublicPostTombstone(input.publicationId, tombstone);
    const outcome = verdict.ok ? 'ok' : verdict.reason;
    const audit = await this.store.appendAudit({
      at: this.nowIso(),
      actorKeyHex: this.operator.publicKeyHex,
      action: 'post_tombstoned',
      target: { publicationId: input.publicationId, postId: input.postId },
      reason: input.reason,
      outcome,
      actionSignature: tombstone.signature,
    });
    if (!verdict.ok) return { ok: false, reason: verdict.reason, audit };
    await this.markReportsActioned(input.publicationId, input.postId, audit.seq);
    return { ok: true, audit };
  }

  /** Flip a publication's effective posting to view_only (or lift it). */
  async setPostingFreeze(input: {
    publicationId: string;
    frozen: boolean;
    reason: string;
  }): Promise<OperatorActionResult> {
    const freeze = createPublicPostingFreeze(this.operator, {
      publicationId: input.publicationId,
      frozen: input.frozen,
      now: this.nowIso(),
    });
    const verdict: PublicPostModerationVerdict = await this.node.recordPostingFreeze(input.publicationId, freeze);
    const audit = await this.store.appendAudit({
      at: this.nowIso(),
      actorKeyHex: this.operator.publicKeyHex,
      action: 'posting_freeze_set',
      target: { publicationId: input.publicationId, frozen: input.frozen },
      reason: input.reason,
      outcome: verdict.ok ? 'ok' : verdict.reason,
      actionSignature: freeze.signature,
    });
    return verdict.ok ? { ok: true, audit } : { ok: false, reason: verdict.reason, audit };
  }

  /**
   * FULL kill (Plan 19): a signed DescriptorKill for the publication's community,
   * dropping every publication that points at it from all public routes,
   * durably. The console pairs this with a freeze so the submit path reports
   * `posting_frozen` rather than accepting into a dead publication.
   */
  async killPublication(input: {
    publicationId: string;
    reason: string;
  }): Promise<OperatorActionResult> {
    const record = await this.publications.get(input.publicationId);
    if (!record) {
      const audit = await this.store.appendAudit({
        at: this.nowIso(),
        actorKeyHex: this.operator.publicKeyHex,
        action: 'publication_killed',
        target: { publicationId: input.publicationId },
        reason: input.reason,
        outcome: 'unknown_publication',
      });
      return { ok: false, reason: 'unknown_publication', audit };
    }
    const communityId = record.signed.descriptor.communityId;
    const kill = createDescriptorKill(this.authorityIdentity, communityId, input.reason, this.nowIso());
    const honored = await this.node.recordPublicationKill(kill);
    const audit = await this.store.appendAudit({
      at: this.nowIso(),
      actorKeyHex: this.operator.publicKeyHex,
      action: 'publication_killed',
      target: { publicationId: input.publicationId, communityId },
      reason: input.reason,
      outcome: honored ? 'ok' : 'kill_not_honored',
      actionSignature: kill.signature,
    });
    if (!honored) return { ok: false, reason: 'kill_not_honored', audit };
    // Belt + suspenders: freeze the publication too (kill already 404s all reads
    // and submits; the freeze keeps posting refused even if the descriptor is
    // ever legitimately re-registered). A freeze refusal does not undo the kill.
    const freeze = createPublicPostingFreeze(this.operator, {
      publicationId: input.publicationId,
      frozen: true,
      now: this.nowIso(),
    });
    await this.node.recordPostingFreeze(input.publicationId, freeze);
    return { ok: true, audit };
  }

  /** Suspend a persona: revoke live sessions + deny future issuance/submits. */
  async suspendPersona(input: {
    personaPubkey?: string;
    alias?: string;
    reason: string;
  }): Promise<OperatorActionResult> {
    return this.personaAction('persona_suspended', input, async (admin, target) => {
      const result = await admin.suspend(target);
      return result.ok
        ? { outcome: 'ok', personaPubkey: result.personaPubkey, alias: result.alias }
        : { outcome: result.reason };
    });
  }

  /** Lift a suspension (refused for GDPR-deleted personas, see the registry). */
  async unsuspendPersona(input: {
    personaPubkey?: string;
    alias?: string;
    reason: string;
  }): Promise<OperatorActionResult> {
    return this.personaAction('persona_unsuspended', input, async (admin, target) => {
      const result = await admin.unsuspend(target);
      return result.ok
        ? { outcome: 'ok', personaPubkey: result.personaPubkey, alias: result.alias }
        : { outcome: result.reason };
    });
  }

  private async personaAction(
    action: 'persona_suspended' | 'persona_unsuspended',
    input: { personaPubkey?: string; alias?: string; reason: string },
    run: (
      admin: PersonaAdminClient,
      target: { personaPubkey?: string; alias?: string },
    ) => Promise<{ outcome: string; personaPubkey?: string; alias?: string | null }>,
  ): Promise<OperatorActionResult> {
    const target = {
      ...(input.personaPubkey ? { personaPubkey: input.personaPubkey } : {}),
      ...(input.alias ? { alias: input.alias } : {}),
    };
    if (!target.personaPubkey && !target.alias) {
      return { ok: false, reason: 'target_required', audit: await this.store.appendAudit({
        at: this.nowIso(), actorKeyHex: this.operator.publicKeyHex, action,
        target: {}, reason: input.reason, outcome: 'target_required',
      }) };
    }
    if (!this.personaAdmin) {
      const audit = await this.store.appendAudit({
        at: this.nowIso(),
        actorKeyHex: this.operator.publicKeyHex,
        action,
        target,
        reason: input.reason,
        outcome: 'persona_admin_not_configured',
      });
      return { ok: false, reason: 'persona_admin_not_configured', audit };
    }
    const result = await run(this.personaAdmin, target);
    const audit = await this.store.appendAudit({
      at: this.nowIso(),
      actorKeyHex: this.operator.publicKeyHex,
      action,
      target: {
        ...target,
        ...(result.personaPubkey ? { personaPubkey: result.personaPubkey } : {}),
        ...(result.alias ? { alias: result.alias } : {}),
      },
      reason: input.reason,
      outcome: result.outcome,
    });
    return result.outcome === 'ok' ? { ok: true, audit } : { ok: false, reason: result.outcome, audit };
  }

  /** Persona status lookup for the console's Personas lane. */
  async personaStatus(target: { personaPubkey?: string; alias?: string }): Promise<
    | { ok: true; status: PersonaAdminStatus; posts: number }
    | { ok: false; reason: string }
  > {
    if (!this.personaAdmin) return { ok: false, reason: 'persona_admin_not_configured' };
    const result = await this.personaAdmin.status(target);
    if (!result.ok) return result;
    let posts = 0;
    const wanted = result.status.personaPubkey.toLowerCase();
    for (const publication of await this.publications.list()) {
      const stored = await this.posts.listPosts(publication.signed.descriptor.publicationId);
      posts += stored.filter((p) => p.post.personaPubkey.toLowerCase() === wanted).length;
    }
    return { ok: true, status: result.status, posts };
  }

  /** A persona's stored posts (the View history surface). Real rows only. */
  async listPosts(filter: {
    publicationId?: string;
    personaPubkey?: string;
    limit?: number;
  }): Promise<{ posts: Array<{ publicationId: string; post: AcceptedPublicPost['post'] }>; total: number }> {
    const limit = Math.max(1, Math.min(MAX_QUEUE_LIMIT, Math.floor(filter.limit ?? 50)));
    const wanted = filter.personaPubkey?.toLowerCase();
    const out: Array<{ publicationId: string; post: AcceptedPublicPost['post'] }> = [];
    for (const publication of await this.publications.list()) {
      const publicationId = publication.signed.descriptor.publicationId;
      if (filter.publicationId && filter.publicationId !== publicationId) continue;
      for (const stored of await this.posts.listPosts(publicationId)) {
        if (wanted && stored.post.personaPubkey.toLowerCase() !== wanted) continue;
        out.push({ publicationId, post: { ...stored.post, body: stored.post.body.slice(0, MAX_BODY_PREVIEW_CHARS) } });
      }
    }
    out.sort((a, b) => (a.post.createdAt < b.post.createdAt ? 1 : -1));
    return { posts: out.slice(0, limit), total: out.length };
  }

  /** Publications overview with REAL per-publication counts (NC-P6). */
  async listPublications(): Promise<OperatorPublicationRow[]> {
    const triage = new Map((await this.store.listTriage()).map((t) => [t.reportKey, t]));
    const out: OperatorPublicationRow[] = [];
    for (const publication of await this.publications.list()) {
      const d = publication.signed.descriptor;
      const posts = await this.posts.listPosts(d.publicationId);
      const tombstones = await this.posts.listTombstones(d.publicationId);
      const freeze = await this.posts.getFreeze(d.publicationId);
      const stored = (await this.reports.get(d.publicationId)) ?? [];
      const openReports = stored.filter((s) => (triage.get(deriveReportKey(s))?.status ?? 'open') === 'open').length;
      out.push({
        publicationId: d.publicationId,
        communityId: d.communityId,
        title: typeof d.title === 'string' ? d.title : d.publicationId,
        status: d.status,
        postPolicy: typeof (d as { postPolicy?: unknown }).postPolicy === 'string'
          ? (d as { postPolicy: string }).postPolicy
          : 'view_only',
        frozen: freeze?.frozen === true,
        posts: posts.length,
        tombstones: tombstones.length,
        openReports,
      });
    }
    out.sort((a, b) => (a.title < b.title ? -1 : 1));
    return out;
  }

  /** Bounded audit page, newest first. */
  async listAudit(limit: number, beforeSeq?: number): Promise<{ rows: OperatorAuditRow[]; total: number }> {
    const rows = await this.store.listAudit(limit, beforeSeq);
    return { rows, total: await this.store.auditCount() };
  }

  /** After a successful tombstone, flip that post's OPEN reports to actioned. */
  // -------------------------------------------------------------------------
  // DMCA lane (Plan 39 P13).
  // -------------------------------------------------------------------------

  /** Whether a DMCA intake pipeline is wired (the lane reports this honestly). */
  hasDmcaIntake(): boolean {
    return this.dmcaIntake !== undefined;
  }

  /** List received DMCA claims for the lane (real stored rows only). */
  async listDmcaClaims(filter: { status?: DmcaClaimStatus; limit?: number } = {}): Promise<DmcaClaimRecord[]> {
    return this.dmcaIntake ? this.dmcaIntake.listClaims(filter) : [];
  }

  /** Resolve which publication currently stores a given postId (null if none does). */
  private async resolvePublicationForPost(postId: string): Promise<string | null> {
    for (const publication of await this.publications.list()) {
      const publicationId = publication.signed.descriptor.publicationId;
      const posts = await this.posts.listPosts(publicationId);
      if (posts.some((p) => p.post.postId === postId)) return publicationId;
    }
    return null;
  }

  /**
   * DMCA takedown: tombstone every claimed postId this node still stores (operator-signed, the
   * Track B path), mark the claim actioned with the tombstoned ids, and append an audit row.
   * Post ids that resolve to no publication (or are URLs, not ids) are surfaced as `unresolved`
   * for manual handling -- never silently dropped. Fail-closed: an unknown claim is refused.
   */
  async dmcaTakedown(input: { claimId: string; reason: string }): Promise<
    | { ok: true; audit: OperatorAuditRow; tombstonedPostIds: string[]; unresolved: string[] }
    | { ok: false; reason: string; audit: OperatorAuditRow }
  > {
    if (!this.dmcaIntake) {
      const audit = await this.store.appendAudit({
        at: this.nowIso(), actorKeyHex: this.operator.publicKeyHex, action: 'dmca_takedown',
        target: { dmcaClaimId: input.claimId }, reason: input.reason, outcome: 'dmca_not_configured',
      });
      return { ok: false, reason: 'dmca_not_configured', audit };
    }
    const claim = await this.dmcaIntake.getClaim(input.claimId);
    if (!claim) {
      const audit = await this.store.appendAudit({
        at: this.nowIso(), actorKeyHex: this.operator.publicKeyHex, action: 'dmca_takedown',
        target: { dmcaClaimId: input.claimId }, reason: input.reason, outcome: 'unknown_claim',
      });
      return { ok: false, reason: 'unknown_claim', audit };
    }
    const tombstoned: string[] = [];
    const unresolved: string[] = [...claim.claimedUrls]; // URLs are always operator-manual
    for (const postId of claim.claimedPostIds) {
      const publicationId = await this.resolvePublicationForPost(postId);
      if (!publicationId) { unresolved.push(postId); continue; }
      const verdict = await this.tombstonePost({ publicationId, postId, reason: `dmca:${input.claimId}` });
      if (verdict.ok) tombstoned.push(postId);
      else unresolved.push(postId);
    }
    // The claim is only CLOSED when nothing is left unresolved; unresolved items (URLs, unknown
    // ids) keep it in the received queue with actions available + durably tracked.
    await this.dmcaIntake.recordTakedown(input.claimId, tombstoned, unresolved);
    const audit = await this.store.appendAudit({
      at: this.nowIso(), actorKeyHex: this.operator.publicKeyHex, action: 'dmca_takedown',
      target: { dmcaClaimId: input.claimId }, reason: input.reason,
      outcome: `tombstoned:${tombstoned.length};unresolved:${unresolved.length}`,
    });
    return { ok: true, audit, tombstonedPostIds: tombstoned, unresolved };
  }

  /** Record a counter-notice against a claim (17 U.S.C. 512(g)) + audit row. */
  async dmcaCounterNotice(input: { claimId: string; statement: string; signature: string }): Promise<OperatorActionResult> {
    if (!this.dmcaIntake) {
      const audit = await this.store.appendAudit({
        at: this.nowIso(), actorKeyHex: this.operator.publicKeyHex, action: 'dmca_counter_notice',
        target: { dmcaClaimId: input.claimId }, reason: '', outcome: 'dmca_not_configured',
      });
      return { ok: false, reason: 'dmca_not_configured', audit };
    }
    const updated = await this.dmcaIntake.recordCounterNotice(input.claimId, { statement: input.statement, signature: input.signature });
    const audit = await this.store.appendAudit({
      at: this.nowIso(), actorKeyHex: this.operator.publicKeyHex, action: 'dmca_counter_notice',
      target: { dmcaClaimId: input.claimId }, reason: input.statement.slice(0, MAX_BODY_PREVIEW_CHARS),
      outcome: updated ? 'ok' : 'unknown_claim',
    });
    return updated ? { ok: true, audit } : { ok: false, reason: 'unknown_claim', audit };
  }

  /** Reject a defective/abusive DMCA notice + audit row. */
  async dmcaRejectClaim(input: { claimId: string; reason: string }): Promise<OperatorActionResult> {
    if (!this.dmcaIntake) {
      const audit = await this.store.appendAudit({
        at: this.nowIso(), actorKeyHex: this.operator.publicKeyHex, action: 'dmca_rejected',
        target: { dmcaClaimId: input.claimId }, reason: input.reason, outcome: 'dmca_not_configured',
      });
      return { ok: false, reason: 'dmca_not_configured', audit };
    }
    const updated = await this.dmcaIntake.recordRejection(input.claimId);
    const audit = await this.store.appendAudit({
      at: this.nowIso(), actorKeyHex: this.operator.publicKeyHex, action: 'dmca_rejected',
      target: { dmcaClaimId: input.claimId }, reason: input.reason, outcome: updated ? 'ok' : 'unknown_claim',
    });
    return updated ? { ok: true, audit } : { ok: false, reason: 'unknown_claim', audit };
  }

  private async markReportsActioned(publicationId: string, postId: string, auditSeq: number): Promise<void> {
    const stored = (await this.reports.get(publicationId)) ?? [];
    for (const signed of stored) {
      if (signed.report.targetId !== postId) continue;
      const reportKey = deriveReportKey(signed);
      const existing = await this.store.getTriage(reportKey);
      if (existing?.status === 'actioned') continue;
      await this.store.putTriage({
        reportKey,
        status: 'actioned',
        decidedAt: this.nowIso(),
        auditSeq,
      });
      // A csam report resolved by a takedown files its evidence references into the NCMEC queue.
      if (signed.report.reason === 'csam' && this.ncmecQueue) {
        await this.ncmecQueue.enqueueOperatorReport({ reportKey, publicationId, postId });
      }
    }
  }

  // -------------------------------------------------------------------------
  // NCMEC queue + GDPR triage purge (Plan 39 P13).
  // -------------------------------------------------------------------------

  /** Whether a durable NCMEC report queue is wired (the CSAM lane reports this honestly). */
  hasNcmecQueue(): boolean {
    return this.ncmecQueue !== undefined;
  }

  /** Real NCMEC queue counts for the CSAM lane (null when no queue is wired). */
  async ncmecQueueCounts(): Promise<NcmecQueueCounts | null> {
    return this.ncmecQueue ? this.ncmecQueue.counts() : null;
  }

  /** Export queued NCMEC records as NDJSON for the founder's manual filing (P15). */
  async exportNcmecQueue(options: { markExported?: boolean; limit?: number } = {}): Promise<{ ndjson: string; count: number } | null> {
    if (!this.ncmecQueue) return null;
    const { ndjson, records } = await this.ncmecQueue.exportQueued(options);
    return { ndjson, count: records.length };
  }

  /**
   * GDPR support (Plan 39 P13 / AC-5): purge the console TRIAGE decision rows for a set of the
   * deleted persona's post ids. A report's targetId survives the post tombstone, so this resolves
   * even after the posts were removed. The append-only AUDIT log is never touched (legal record).
   */
  async purgeTriageForPosts(postIds: readonly string[]): Promise<{ purged: number }> {
    if (postIds.length === 0) return { purged: 0 };
    const wanted = new Set(postIds);
    const rows = await this.collectReports();
    let purged = 0;
    const seen = new Set<string>();
    for (const row of rows) {
      if (!wanted.has(row.targetId)) continue;
      if (seen.has(row.reportKey)) continue;
      seen.add(row.reportKey);
      const existing = await this.store.getTriage(row.reportKey);
      if (!existing) continue;
      await this.store.deleteTriage(row.reportKey);
      purged += 1;
    }
    return { purged };
  }
}
