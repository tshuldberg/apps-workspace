import type { DatabaseAdapter } from '@mylife/db';
import type {
  MailAccount,
  MailMessage,
  MailDraft,
  MailFolder,
  MailStats,
  CreateMailAccountInput,
  UpdateMailAccountInput,
  CreateMailMessageInput,
  CreateMailDraftInput,
  UpdateMailDraftInput,
  CreateMailFolderInput,
  MessageFilterInput,
} from '../types';
import { MessageFilterSchema } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function rowToAccount(row: Record<string, unknown>): MailAccount {
  return {
    id: row.id as string,
    email: row.email as string,
    displayName: row.display_name as string,
    serverHost: row.server_host as string,
    serverPort: row.server_port as number,
    isActive: (row.is_active as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToMessage(row: Record<string, unknown>): MailMessage {
  let to: string[];
  try {
    to = JSON.parse(row.to as string);
  } catch {
    to = [];
  }
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    subject: row.subject as string,
    from: row.from as string,
    to,
    body: row.body as string,
    isRead: (row.is_read as number) === 1,
    isStarred: (row.is_starred as number) === 1,
    folder: row.folder as string,
    receivedAt: row.received_at as string,
    createdAt: row.created_at as string,
  };
}

function rowToDraft(row: Record<string, unknown>): MailDraft {
  let to: string[];
  try {
    to = JSON.parse(row.to as string);
  } catch {
    to = [];
  }
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    subject: row.subject as string,
    to,
    body: row.body as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToFolder(row: Record<string, unknown>): MailFolder {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    name: row.name as string,
    icon: (row.icon as string) ?? null,
    sortOrder: row.sort_order as number,
    isSystem: (row.is_system as number) === 1,
    createdAt: row.created_at as string,
  };
}

// ── Accounts ──────────────────────────────────────────────────────────

export function createAccount(
  db: DatabaseAdapter,
  id: string,
  input: CreateMailAccountInput,
): MailAccount {
  const now = nowIso();
  const isActive = input.isActive !== false ? 1 : 0;
  db.execute(
    `INSERT INTO ml_accounts (id, email, display_name, server_host, server_port, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.email, input.displayName, input.serverHost, input.serverPort, isActive, now, now],
  );
  return {
    id,
    email: input.email,
    displayName: input.displayName,
    serverHost: input.serverHost,
    serverPort: input.serverPort,
    isActive: isActive === 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function getAccount(db: DatabaseAdapter, id: string): MailAccount | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_accounts WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToAccount(rows[0]) : null;
}

export function getAccounts(db: DatabaseAdapter): MailAccount[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_accounts ORDER BY created_at ASC`,
  );
  return rows.map(rowToAccount);
}

export function updateAccount(
  db: DatabaseAdapter,
  id: string,
  input: UpdateMailAccountInput,
): MailAccount | null {
  const existing = getAccount(db, id);
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.email !== undefined) { updates.push('email = ?'); params.push(input.email); }
  if (input.displayName !== undefined) { updates.push('display_name = ?'); params.push(input.displayName); }
  if (input.serverHost !== undefined) { updates.push('server_host = ?'); params.push(input.serverHost); }
  if (input.serverPort !== undefined) { updates.push('server_port = ?'); params.push(input.serverPort); }
  if (input.isActive !== undefined) { updates.push('is_active = ?'); params.push(input.isActive ? 1 : 0); }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);

  db.execute(`UPDATE ml_accounts SET ${updates.join(', ')} WHERE id = ?`, params);
  return getAccount(db, id);
}

export function deleteAccount(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM ml_accounts WHERE id = ?`, [id]);
  return true;
}

// ── Messages ──────────────────────────────────────────────────────────

export function createMessage(
  db: DatabaseAdapter,
  id: string,
  input: CreateMailMessageInput,
): MailMessage {
  const now = nowIso();
  const receivedAt = input.receivedAt ?? now;
  const folder = input.folder ?? 'Inbox';
  const toJson = JSON.stringify(input.to);
  db.execute(
    `INSERT INTO ml_messages (id, account_id, subject, "from", "to", body, is_read, is_starred, folder, received_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    [id, input.accountId, input.subject, input.from, toJson, input.body, folder, receivedAt, now],
  );
  return {
    id,
    accountId: input.accountId,
    subject: input.subject,
    from: input.from,
    to: input.to,
    body: input.body,
    isRead: false,
    isStarred: false,
    folder,
    receivedAt,
    createdAt: now,
  };
}

export function getMessage(db: DatabaseAdapter, id: string): MailMessage | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_messages WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToMessage(rows[0]) : null;
}

export function getMessages(
  db: DatabaseAdapter,
  rawFilter?: MessageFilterInput,
): MailMessage[] {
  const filter = MessageFilterSchema.parse(rawFilter ?? {});
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.folder) {
    conditions.push('folder = ?');
    params.push(filter.folder);
  }
  if (filter.accountId) {
    conditions.push('account_id = ?');
    params.push(filter.accountId);
  }
  if (filter.isRead !== undefined) {
    conditions.push('is_read = ?');
    params.push(filter.isRead ? 1 : 0);
  }
  if (filter.isStarred !== undefined) {
    conditions.push('is_starred = ?');
    params.push(filter.isStarred ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_messages ${where} ORDER BY received_at DESC LIMIT ? OFFSET ?`,
    [...params, filter.limit, filter.offset],
  );
  return rows.map(rowToMessage);
}

export function getMessagesByAccount(
  db: DatabaseAdapter,
  accountId: string,
): MailMessage[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_messages WHERE account_id = ? ORDER BY received_at DESC`,
    [accountId],
  );
  return rows.map(rowToMessage);
}

export function markAsRead(db: DatabaseAdapter, id: string): boolean {
  db.execute(`UPDATE ml_messages SET is_read = 1 WHERE id = ?`, [id]);
  return true;
}

export function toggleStar(db: DatabaseAdapter, id: string): MailMessage | null {
  const msg = getMessage(db, id);
  if (!msg) return null;
  const newVal = msg.isStarred ? 0 : 1;
  db.execute(`UPDATE ml_messages SET is_starred = ? WHERE id = ?`, [newVal, id]);
  return getMessage(db, id);
}

export function moveToFolder(db: DatabaseAdapter, id: string, folder: string): boolean {
  db.execute(`UPDATE ml_messages SET folder = ? WHERE id = ?`, [folder, id]);
  return true;
}

export function deleteMessage(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM ml_messages WHERE id = ?`, [id]);
  return true;
}

// ── Drafts ────────────────────────────────────────────────────────────

export function createDraft(
  db: DatabaseAdapter,
  id: string,
  input: CreateMailDraftInput,
): MailDraft {
  const now = nowIso();
  const toJson = JSON.stringify(input.to ?? []);
  db.execute(
    `INSERT INTO ml_drafts (id, account_id, subject, "to", body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.accountId, input.subject ?? '', toJson, input.body ?? '', now, now],
  );
  return {
    id,
    accountId: input.accountId,
    subject: input.subject ?? '',
    to: input.to ?? [],
    body: input.body ?? '',
    createdAt: now,
    updatedAt: now,
  };
}

export function getDrafts(db: DatabaseAdapter, accountId?: string): MailDraft[] {
  if (accountId) {
    const rows = db.query<Record<string, unknown>>(
      `SELECT * FROM ml_drafts WHERE account_id = ? ORDER BY updated_at DESC`,
      [accountId],
    );
    return rows.map(rowToDraft);
  }
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_drafts ORDER BY updated_at DESC`,
  );
  return rows.map(rowToDraft);
}

export function updateDraft(
  db: DatabaseAdapter,
  id: string,
  input: UpdateMailDraftInput,
): MailDraft | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_drafts WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.subject !== undefined) { updates.push('subject = ?'); params.push(input.subject); }
  if (input.to !== undefined) { updates.push('"to" = ?'); params.push(JSON.stringify(input.to)); }
  if (input.body !== undefined) { updates.push('body = ?'); params.push(input.body); }

  if (updates.length === 0) return rowToDraft(rows[0]);

  updates.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);

  db.execute(`UPDATE ml_drafts SET ${updates.join(', ')} WHERE id = ?`, params);

  const updated = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_drafts WHERE id = ?`,
    [id],
  );
  return updated.length > 0 ? rowToDraft(updated[0]) : null;
}

export function deleteDraft(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM ml_drafts WHERE id = ?`, [id]);
  return true;
}

// ── Folders ───────────────────────────────────────────────────────────

export function createFolder(
  db: DatabaseAdapter,
  id: string,
  input: CreateMailFolderInput,
): MailFolder {
  const now = nowIso();
  db.execute(
    `INSERT INTO ml_folders (id, account_id, name, icon, sort_order, is_system, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [id, input.accountId, input.name, input.icon ?? null, input.sortOrder ?? 0, now],
  );
  return {
    id,
    accountId: input.accountId,
    name: input.name,
    icon: input.icon ?? null,
    sortOrder: input.sortOrder ?? 0,
    isSystem: false,
    createdAt: now,
  };
}

export function getFolders(db: DatabaseAdapter, accountId?: string): MailFolder[] {
  if (accountId) {
    const rows = db.query<Record<string, unknown>>(
      `SELECT * FROM ml_folders WHERE account_id = ? ORDER BY sort_order ASC, name ASC`,
      [accountId],
    );
    return rows.map(rowToFolder);
  }
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_folders ORDER BY sort_order ASC, name ASC`,
  );
  return rows.map(rowToFolder);
}

// ── Stats ─────────────────────────────────────────────────────────────

export function getMailStats(db: DatabaseAdapter, accountId?: string): MailStats {
  const accountCondition = accountId ? 'WHERE account_id = ?' : '';
  const accountParams = accountId ? [accountId] : [];

  const totalRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM ml_messages ${accountCondition}`,
    accountParams,
  );

  const unreadRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM ml_messages ${accountCondition ? accountCondition + ' AND' : 'WHERE'} is_read = 0`,
    accountParams,
  );

  const starredRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM ml_messages ${accountCondition ? accountCondition + ' AND' : 'WHERE'} is_starred = 1`,
    accountParams,
  );

  const draftCondition = accountId ? 'WHERE account_id = ?' : '';
  const draftRows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM ml_drafts ${draftCondition}`,
    accountParams,
  );

  const folderRows = db.query<{ folder: string; total: number; unread: number }>(
    `SELECT folder, COUNT(*) as total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
     FROM ml_messages ${accountCondition}
     GROUP BY folder
     ORDER BY folder ASC`,
    accountParams,
  );

  return {
    totalMessages: totalRows[0].count,
    unreadCount: unreadRows[0].count,
    starredCount: starredRows[0].count,
    draftCount: draftRows[0].count,
    byFolder: folderRows.map((r) => ({
      folder: r.folder,
      total: r.total,
      unread: r.unread,
    })),
  };
}
