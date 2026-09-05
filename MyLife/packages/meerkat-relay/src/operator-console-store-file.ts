/**
 * Durable, restart-safe OperatorConsoleStore (Plan 39 P12). The community-node
 * deploy points this at its DATA_DIR volume so triage decisions and the
 * APPEND-ONLY audit log survive restarts (a forgotten audit row would be silent
 * moderation; a forgotten triage row would re-open a decided report).
 *
 * Layout under baseDir:
 *   audit.log     JSONL, one audit row per line, APPEND-ONLY (O_APPEND writes;
 *                 nothing in this class or its interface rewrites or truncates it)
 *   triage.json   reportKey -> triage row map (atomic temp+rename overwrite; it
 *                 is bounded by the already-bounded per-publication report caps)
 *
 * Corrupt lines/files degrade to skipped rows / empty maps, never a torn state.
 * Everything stored is operator action metadata; no tokens, no secrets.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './community-node';
import { withExclusiveFileLock } from './file-lock';
import type {
  OperatorAuditRow,
  OperatorConsoleStore,
  OperatorTriageDecisionInput,
  OperatorTriageDecisionResult,
  ReportTriageRow,
} from './operator-console';

export class FileOperatorConsoleStore implements OperatorConsoleStore {
  private readonly auditFile: string;
  private readonly triageFile: string;
  private readonly lockFile: string;
  private readonly decisionJournalFile: string;

  constructor(baseDir: string) {
    this.auditFile = path.join(baseDir, 'audit.log');
    this.triageFile = path.join(baseDir, 'triage.json');
    this.lockFile = path.join(baseDir, '.operator-console.lock');
    this.decisionJournalFile = path.join(baseDir, 'triage-decision.pending.json');
  }

  private async readAuditRows(): Promise<OperatorAuditRow[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.auditFile, 'utf8');
    } catch {
      return [];
    }
    const rows: OperatorAuditRow[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as OperatorAuditRow;
        if (typeof parsed === 'object' && parsed !== null
          && typeof parsed.seq === 'number' && typeof parsed.action === 'string') {
          rows.push(parsed);
        }
      } catch {
        // Skip a torn/corrupt line (a crash mid-append); later rows still count.
      }
    }
    return rows;
  }

  private async appendPreparedAudit(row: OperatorAuditRow): Promise<void> {
    const existing = (await this.readAuditRows()).find((candidate) => candidate.seq === row.seq);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(row)) {
        throw new Error(`FileOperatorConsoleStore: conflicting audit sequence ${row.seq}`);
      }
      return;
    }

    let repairTailNewline = false;
    try {
      const raw = await fs.readFile(this.auditFile, 'utf8');
      repairTailNewline = raw.length > 0 && !raw.endsWith('\n');
    } catch {
      repairTailNewline = false;
    }
    await fs.mkdir(path.dirname(this.auditFile), { recursive: true });
    const prefix = repairTailNewline ? '\n' : '';
    await fs.appendFile(this.auditFile, `${prefix}${JSON.stringify(row)}\n`, {
      encoding: 'utf8',
      flag: 'a',
    });
  }

  private async prepareAudit(row: Omit<OperatorAuditRow, 'seq'>): Promise<OperatorAuditRow> {
    const rows = await this.readAuditRows();
    return {
      ...row,
      target: { ...row.target },
      seq: rows.reduce((maximum, candidate) => Math.max(maximum, candidate.seq), 0) + 1,
    };
  }

  private async readDecisionJournal(): Promise<OperatorTriageDecisionResult | null> {
    try {
      const parsed = JSON.parse(
        await fs.readFile(this.decisionJournalFile, 'utf8'),
      ) as OperatorTriageDecisionResult;
      if (!parsed || typeof parsed !== 'object'
        || !parsed.audit || !Number.isSafeInteger(parsed.audit.seq)
        || !parsed.triage || parsed.triage.auditSeq !== parsed.audit.seq) {
        throw new Error('FileOperatorConsoleStore: invalid pending triage decision');
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  private async recoverDecision(): Promise<void> {
    const pending = await this.readDecisionJournal();
    if (!pending) return;
    await this.appendPreparedAudit(pending.audit);
    const triage = await this.readTriage();
    triage[pending.triage.reportKey] = { ...pending.triage };
    await atomicWriteFile(this.triageFile, JSON.stringify(triage));
    await fs.rm(this.decisionJournalFile, { force: true });
  }

  appendAudit(row: Omit<OperatorAuditRow, 'seq'>): Promise<OperatorAuditRow> {
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverDecision();
      const full = await this.prepareAudit(row);
      await this.appendPreparedAudit(full);
      return { ...full, target: { ...full.target } };
    });
  }

  recordTriageDecision(
    input: OperatorTriageDecisionInput,
  ): Promise<OperatorTriageDecisionResult> {
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverDecision();
      const audit = await this.prepareAudit(input.audit);
      const triage: ReportTriageRow = {
        ...input.triage,
        auditSeq: audit.seq,
      };
      const pending = { audit, triage };
      await atomicWriteFile(this.decisionJournalFile, JSON.stringify(pending));
      await this.appendPreparedAudit(audit);
      const rows = await this.readTriage();
      rows[triage.reportKey] = { ...triage };
      await atomicWriteFile(this.triageFile, JSON.stringify(rows));
      await fs.rm(this.decisionJournalFile, { force: true });
      return {
        audit: { ...audit, target: { ...audit.target } },
        triage: { ...triage },
      };
    });
  }

  listAudit(limit: number, beforeSeq?: number): Promise<OperatorAuditRow[]> {
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverDecision();
      const bound = Math.max(1, Math.min(200, Math.floor(limit)));
      let rows = await this.readAuditRows();
      if (beforeSeq !== undefined) rows = rows.filter((r) => r.seq < beforeSeq);
      rows.sort((a, b) => a.seq - b.seq);
      return rows.slice(-bound).reverse().map((row) => ({
        ...row,
        target: { ...row.target },
      }));
    });
  }

  auditCount(): Promise<number> {
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverDecision();
      return (await this.readAuditRows()).length;
    });
  }

  private async readTriage(): Promise<Record<string, ReportTriageRow>> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.triageFile, 'utf8')) as Record<string, ReportTriageRow>;
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  getTriage(reportKey: string): Promise<ReportTriageRow | null> {
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverDecision();
      const row = (await this.readTriage())[reportKey];
      return row ? { ...row } : null;
    });
  }

  putTriage(row: ReportTriageRow): Promise<void> {
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverDecision();
      const map = await this.readTriage();
      map[row.reportKey] = { ...row };
      await fs.mkdir(path.dirname(this.triageFile), { recursive: true });
      await atomicWriteFile(this.triageFile, JSON.stringify(map));
    });
  }

  listTriage(): Promise<ReportTriageRow[]> {
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverDecision();
      return Object.values(await this.readTriage()).map((row) => ({ ...row }));
    });
  }

  deleteTriage(reportKey: string): Promise<void> {
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverDecision();
      const map = await this.readTriage();
      if (!(reportKey in map)) return;
      delete map[reportKey];
      await fs.mkdir(path.dirname(this.triageFile), { recursive: true });
      await atomicWriteFile(this.triageFile, JSON.stringify(map));
    });
  }
}
