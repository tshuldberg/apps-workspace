import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { MAIL_MODULE } from '../definition';
import {
  createAccount,
  getAccount,
  getAccounts,
  updateAccount,
  deleteAccount,
  createMessage,
  getMessage,
  getMessages,
  getMessagesByAccount,
  markAsRead,
  toggleStar,
  moveToFolder,
  deleteMessage,
  createDraft,
  getDrafts,
  updateDraft,
  deleteDraft,
  createFolder,
  getFolders,
  getMailStats,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('mail', MAIL_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// Helper to create a test account
function seedAccount(id = 'acc-1') {
  return createAccount(testDb.adapter, id, {
    email: 'user@example.com',
    displayName: 'Test User',
    serverHost: 'mail.example.com',
    serverPort: 993,
  });
}

describe('Accounts', () => {
  it('creates an account with defaults', () => {
    const acct = seedAccount();
    expect(acct.id).toBe('acc-1');
    expect(acct.email).toBe('user@example.com');
    expect(acct.displayName).toBe('Test User');
    expect(acct.serverHost).toBe('mail.example.com');
    expect(acct.serverPort).toBe(993);
    expect(acct.isActive).toBe(true);
  });

  it('gets an account by id', () => {
    seedAccount();
    const found = getAccount(testDb.adapter, 'acc-1');
    expect(found).not.toBeNull();
    expect(found!.email).toBe('user@example.com');

    const missing = getAccount(testDb.adapter, 'nope');
    expect(missing).toBeNull();
  });

  it('lists all accounts', () => {
    seedAccount('a1');
    createAccount(testDb.adapter, 'a2', {
      email: 'other@example.com',
      displayName: 'Other',
      serverHost: 'mail2.example.com',
      serverPort: 587,
    });
    const list = getAccounts(testDb.adapter);
    expect(list).toHaveLength(2);
  });

  it('updates account fields', () => {
    seedAccount();
    const updated = updateAccount(testDb.adapter, 'acc-1', {
      displayName: 'Updated Name',
      isActive: false,
    });
    expect(updated).not.toBeNull();
    expect(updated!.displayName).toBe('Updated Name');
    expect(updated!.isActive).toBe(false);
  });

  it('returns null when updating non-existent account', () => {
    const result = updateAccount(testDb.adapter, 'nope', { displayName: 'X' });
    expect(result).toBeNull();
  });

  it('deletes an account', () => {
    seedAccount();
    deleteAccount(testDb.adapter, 'acc-1');
    expect(getAccount(testDb.adapter, 'acc-1')).toBeNull();
  });

  it('cascades account deletion to messages', () => {
    seedAccount();
    createMessage(testDb.adapter, 'm1', {
      accountId: 'acc-1',
      subject: 'Hello',
      from: 'sender@test.com',
      to: ['user@example.com'],
      body: 'Test body',
    });
    expect(getMessage(testDb.adapter, 'm1')).not.toBeNull();
    deleteAccount(testDb.adapter, 'acc-1');
    expect(getMessage(testDb.adapter, 'm1')).toBeNull();
  });
});

describe('Messages', () => {
  it('creates a message with defaults', () => {
    seedAccount();
    const msg = createMessage(testDb.adapter, 'm1', {
      accountId: 'acc-1',
      subject: 'Welcome',
      from: 'sender@test.com',
      to: ['user@example.com'],
      body: 'Hello world',
    });
    expect(msg.id).toBe('m1');
    expect(msg.subject).toBe('Welcome');
    expect(msg.to).toEqual(['user@example.com']);
    expect(msg.isRead).toBe(false);
    expect(msg.isStarred).toBe(false);
    expect(msg.folder).toBe('Inbox');
  });

  it('creates a message with custom folder and receivedAt', () => {
    seedAccount();
    const msg = createMessage(testDb.adapter, 'm2', {
      accountId: 'acc-1',
      subject: 'Archived',
      from: 'test@test.com',
      to: ['user@example.com'],
      body: 'Old message',
      folder: 'Archive',
      receivedAt: '2026-01-15T10:00:00Z',
    });
    expect(msg.folder).toBe('Archive');
    expect(msg.receivedAt).toBe('2026-01-15T10:00:00Z');
  });

  it('gets a message by id', () => {
    seedAccount();
    createMessage(testDb.adapter, 'm3', {
      accountId: 'acc-1',
      subject: 'Test',
      from: 'a@b.com',
      to: ['c@d.com', 'e@f.com'],
      body: 'Multiple recipients',
    });
    const found = getMessage(testDb.adapter, 'm3');
    expect(found).not.toBeNull();
    expect(found!.to).toEqual(['c@d.com', 'e@f.com']);

    expect(getMessage(testDb.adapter, 'missing')).toBeNull();
  });

  it('lists messages with folder filter', () => {
    seedAccount();
    createMessage(testDb.adapter, 'm4', {
      accountId: 'acc-1', subject: 'In inbox', from: 'a@b.com',
      to: ['c@d.com'], body: '', folder: 'Inbox',
    });
    createMessage(testDb.adapter, 'm5', {
      accountId: 'acc-1', subject: 'In sent', from: 'a@b.com',
      to: ['c@d.com'], body: '', folder: 'Sent',
    });
    createMessage(testDb.adapter, 'm6', {
      accountId: 'acc-1', subject: 'Also inbox', from: 'x@y.com',
      to: ['c@d.com'], body: '',
    });

    const inbox = getMessages(testDb.adapter, { folder: 'Inbox' });
    expect(inbox).toHaveLength(2);

    const sent = getMessages(testDb.adapter, { folder: 'Sent' });
    expect(sent).toHaveLength(1);

    const all = getMessages(testDb.adapter);
    expect(all).toHaveLength(3);
  });

  it('gets messages by account', () => {
    seedAccount('a1');
    createAccount(testDb.adapter, 'a2', {
      email: 'other@test.com', displayName: 'Other',
      serverHost: 'smtp.test.com', serverPort: 587,
    });
    createMessage(testDb.adapter, 'm7', {
      accountId: 'a1', subject: 'A1', from: 'x@y.com',
      to: ['z@w.com'], body: '',
    });
    createMessage(testDb.adapter, 'm8', {
      accountId: 'a2', subject: 'A2', from: 'x@y.com',
      to: ['z@w.com'], body: '',
    });

    const a1msgs = getMessagesByAccount(testDb.adapter, 'a1');
    expect(a1msgs).toHaveLength(1);
    expect(a1msgs[0].accountId).toBe('a1');
  });

  it('marks a message as read', () => {
    seedAccount();
    createMessage(testDb.adapter, 'm9', {
      accountId: 'acc-1', subject: 'Unread', from: 'a@b.com',
      to: ['c@d.com'], body: '',
    });
    expect(getMessage(testDb.adapter, 'm9')!.isRead).toBe(false);
    markAsRead(testDb.adapter, 'm9');
    expect(getMessage(testDb.adapter, 'm9')!.isRead).toBe(true);
  });

  it('toggles star on a message', () => {
    seedAccount();
    createMessage(testDb.adapter, 'm10', {
      accountId: 'acc-1', subject: 'Star me', from: 'a@b.com',
      to: ['c@d.com'], body: '',
    });
    expect(getMessage(testDb.adapter, 'm10')!.isStarred).toBe(false);

    const starred = toggleStar(testDb.adapter, 'm10');
    expect(starred!.isStarred).toBe(true);

    const unstarred = toggleStar(testDb.adapter, 'm10');
    expect(unstarred!.isStarred).toBe(false);
  });

  it('returns null when toggling star on non-existent message', () => {
    expect(toggleStar(testDb.adapter, 'nope')).toBeNull();
  });

  it('moves a message to another folder', () => {
    seedAccount();
    createMessage(testDb.adapter, 'm11', {
      accountId: 'acc-1', subject: 'Move me', from: 'a@b.com',
      to: ['c@d.com'], body: '',
    });
    moveToFolder(testDb.adapter, 'm11', 'Trash');
    expect(getMessage(testDb.adapter, 'm11')!.folder).toBe('Trash');
  });

  it('deletes a message', () => {
    seedAccount();
    createMessage(testDb.adapter, 'm12', {
      accountId: 'acc-1', subject: 'Delete me', from: 'a@b.com',
      to: ['c@d.com'], body: '',
    });
    deleteMessage(testDb.adapter, 'm12');
    expect(getMessage(testDb.adapter, 'm12')).toBeNull();
  });
});

describe('Drafts', () => {
  it('creates a draft with defaults', () => {
    seedAccount();
    const draft = createDraft(testDb.adapter, 'd1', {
      accountId: 'acc-1',
    });
    expect(draft.id).toBe('d1');
    expect(draft.subject).toBe('');
    expect(draft.to).toEqual([]);
    expect(draft.body).toBe('');
  });

  it('creates a draft with content', () => {
    seedAccount();
    const draft = createDraft(testDb.adapter, 'd2', {
      accountId: 'acc-1',
      subject: 'Draft Subject',
      to: ['recipient@test.com'],
      body: 'Draft body text',
    });
    expect(draft.subject).toBe('Draft Subject');
    expect(draft.to).toEqual(['recipient@test.com']);
    expect(draft.body).toBe('Draft body text');
  });

  it('lists drafts, optionally filtered by account', () => {
    seedAccount('a1');
    createAccount(testDb.adapter, 'a2', {
      email: 'other@test.com', displayName: 'Other',
      serverHost: 'smtp.test.com', serverPort: 587,
    });
    createDraft(testDb.adapter, 'd3', { accountId: 'a1', subject: 'D1' });
    createDraft(testDb.adapter, 'd4', { accountId: 'a2', subject: 'D2' });

    expect(getDrafts(testDb.adapter)).toHaveLength(2);
    expect(getDrafts(testDb.adapter, 'a1')).toHaveLength(1);
  });

  it('updates a draft', () => {
    seedAccount();
    createDraft(testDb.adapter, 'd5', { accountId: 'acc-1', subject: 'Old' });
    const updated = updateDraft(testDb.adapter, 'd5', {
      subject: 'New Subject',
      body: 'Updated body',
    });
    expect(updated).not.toBeNull();
    expect(updated!.subject).toBe('New Subject');
    expect(updated!.body).toBe('Updated body');
  });

  it('returns null when updating non-existent draft', () => {
    expect(updateDraft(testDb.adapter, 'nope', { subject: 'X' })).toBeNull();
  });

  it('deletes a draft', () => {
    seedAccount();
    createDraft(testDb.adapter, 'd6', { accountId: 'acc-1' });
    deleteDraft(testDb.adapter, 'd6');
    expect(getDrafts(testDb.adapter)).toHaveLength(0);
  });
});

describe('Folders', () => {
  it('creates a custom folder', () => {
    seedAccount();
    const folder = createFolder(testDb.adapter, 'f1', {
      accountId: 'acc-1',
      name: 'Projects',
      icon: 'briefcase',
    });
    expect(folder.name).toBe('Projects');
    expect(folder.icon).toBe('briefcase');
    expect(folder.isSystem).toBe(false);
  });

  it('lists folders sorted by sort_order', () => {
    seedAccount();
    createFolder(testDb.adapter, 'f2', { accountId: 'acc-1', name: 'Zzz', sortOrder: 2 });
    createFolder(testDb.adapter, 'f3', { accountId: 'acc-1', name: 'Aaa', sortOrder: 1 });
    const list = getFolders(testDb.adapter);
    expect(list[0].name).toBe('Aaa');
    expect(list[1].name).toBe('Zzz');
  });

  it('filters folders by account', () => {
    seedAccount('a1');
    createAccount(testDb.adapter, 'a2', {
      email: 'o@t.com', displayName: 'O', serverHost: 's.com', serverPort: 993,
    });
    createFolder(testDb.adapter, 'f4', { accountId: 'a1', name: 'F1' });
    createFolder(testDb.adapter, 'f5', { accountId: 'a2', name: 'F2' });

    expect(getFolders(testDb.adapter, 'a1')).toHaveLength(1);
    expect(getFolders(testDb.adapter)).toHaveLength(2);
  });
});

describe('Mail Stats', () => {
  it('returns zero stats for empty database', () => {
    const stats = getMailStats(testDb.adapter);
    expect(stats.totalMessages).toBe(0);
    expect(stats.unreadCount).toBe(0);
    expect(stats.starredCount).toBe(0);
    expect(stats.draftCount).toBe(0);
    expect(stats.byFolder).toHaveLength(0);
  });

  it('calculates stats across messages and drafts', () => {
    seedAccount();
    createMessage(testDb.adapter, 's1', {
      accountId: 'acc-1', subject: 'A', from: 'a@b.com',
      to: ['c@d.com'], body: '', folder: 'Inbox',
    });
    createMessage(testDb.adapter, 's2', {
      accountId: 'acc-1', subject: 'B', from: 'a@b.com',
      to: ['c@d.com'], body: '', folder: 'Inbox',
    });
    createMessage(testDb.adapter, 's3', {
      accountId: 'acc-1', subject: 'C', from: 'a@b.com',
      to: ['c@d.com'], body: '', folder: 'Sent',
    });
    markAsRead(testDb.adapter, 's1');
    toggleStar(testDb.adapter, 's2');
    createDraft(testDb.adapter, 'sd1', { accountId: 'acc-1' });

    const stats = getMailStats(testDb.adapter);
    expect(stats.totalMessages).toBe(3);
    expect(stats.unreadCount).toBe(2);
    expect(stats.starredCount).toBe(1);
    expect(stats.draftCount).toBe(1);
    expect(stats.byFolder).toHaveLength(2);

    const inboxStats = stats.byFolder.find((f) => f.folder === 'Inbox');
    expect(inboxStats).toBeDefined();
    expect(inboxStats!.total).toBe(2);
    expect(inboxStats!.unread).toBe(1);

    const sentStats = stats.byFolder.find((f) => f.folder === 'Sent');
    expect(sentStats).toBeDefined();
    expect(sentStats!.total).toBe(1);
    expect(sentStats!.unread).toBe(1);
  });
});
