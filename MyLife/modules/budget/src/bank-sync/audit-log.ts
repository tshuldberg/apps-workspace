import type { BankSyncProvider } from './types';

type MaybePromise<T> = T | Promise<T>;

export type BankSyncAuditLevel = 'info' | 'warning' | 'error';

export type BankSyncAuditAction =
  | 'link_token.created'
  | 'link_token.failed'
  | 'connection.exchanged'
  | 'connection.exchange_failed'
  | 'sync.started'
  | 'sync.completed'
  | 'sync.failed'
  | 'connection.disconnected'
  | 'connection.disconnect_failed'
  | 'webhook.accepted'
  | 'webhook.rejected';

export type BankSyncAuditMetadata = Record<
  string,
  string | number | boolean | null
>;

export interface BankSyncAuditEntry {
  id: string;
  occurredAtIso: string;
  level: BankSyncAuditLevel;
  action: BankSyncAuditAction;
  provider: BankSyncProvider | null;
  connectionExternalId: string | null;
  message: string;
  metadata: BankSyncAuditMetadata;
}

export interface BankSyncAuditSink {
  append(entry: BankSyncAuditEntry): MaybePromise<void>;
}

export interface BankSyncAuditLogInput {
  level: BankSyncAuditLevel;
  action: BankSyncAuditAction;
  message: string;
  provider?: BankSyncProvider | null;
  connectionExternalId?: string | null;
  metadata?: BankSyncAuditMetadata;
}

export interface BankSyncAuditLogger {
  log(input: BankSyncAuditLogInput): Promise<BankSyncAuditEntry>;
}

export function createBankSyncAuditLogger(input: {
  sink: BankSyncAuditSink;
  nowIso?: () => string;
  createId?: () => string;
}): BankSyncAuditLogger {
  const {
    sink,
    nowIso = () => new Date().toISOString(),
    createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  } = input;

  return {
    async log(payload): Promise<BankSyncAuditEntry> {
      const entry: BankSyncAuditEntry = {
        id: createId(),
        occurredAtIso: nowIso(),
        level: payload.level,
        action: payload.action,
        provider: payload.provider ?? null,
        connectionExternalId: payload.connectionExternalId ?? null,
        message: payload.message,
        metadata: payload.metadata ?? {},
      };
      await Promise.resolve(sink.append(entry));
      return entry;
    },
  };
}

export function createInMemoryBankSyncAuditSink(): BankSyncAuditSink & {
  getEntries(): BankSyncAuditEntry[];
} {
  const entries: BankSyncAuditEntry[] = [];
  return {
    append(entry): void {
      entries.push(entry);
    },
    getEntries(): BankSyncAuditEntry[] {
      return [...entries];
    },
  };
}
