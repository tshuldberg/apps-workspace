import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { importFromMyBudget } from '../importers/budget';

// Standalone MyBudget DDL (unprefixed tables)
const STANDALONE_DDL = [
  `CREATE TABLE accounts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('checking', 'savings', 'credit_card', 'cash')),
    balance INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE category_groups (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE categories (
    id TEXT PRIMARY KEY NOT NULL,
    group_id TEXT NOT NULL REFERENCES category_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT,
    target_amount INTEGER,
    target_type TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    billing_cycle TEXT NOT NULL,
    custom_days INTEGER,
    category_id TEXT,
    status TEXT NOT NULL,
    start_date TEXT NOT NULL,
    next_renewal TEXT NOT NULL,
    trial_end_date TEXT,
    cancelled_date TEXT,
    notes TEXT,
    url TEXT,
    icon TEXT,
    color TEXT,
    notify_days INTEGER NOT NULL DEFAULT 1,
    catalog_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    payee TEXT NOT NULL,
    memo TEXT,
    amount INTEGER NOT NULL,
    is_cleared INTEGER NOT NULL DEFAULT 0,
    is_transfer INTEGER NOT NULL DEFAULT 0,
    transfer_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE transaction_splits (
    id TEXT PRIMARY KEY NOT NULL,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    category_id TEXT,
    amount INTEGER NOT NULL,
    memo TEXT
  )`,
  `CREATE TABLE goals (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    target_amount_cents INTEGER NOT NULL,
    current_amount_cents INTEGER NOT NULL DEFAULT 0,
    target_date TEXT,
    category_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE preferences (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE bank_connections (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    provider_item_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    institution_id TEXT,
    institution_name TEXT,
    status TEXT NOT NULL,
    last_successful_sync TEXT,
    last_attempted_sync TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, provider_item_id)
  )`,
  `CREATE TABLE bank_accounts (
    id TEXT PRIMARY KEY NOT NULL,
    connection_id TEXT NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
    provider_account_id TEXT NOT NULL,
    mask TEXT,
    name TEXT NOT NULL,
    official_name TEXT,
    type TEXT NOT NULL,
    subtype TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    current_balance INTEGER,
    available_balance INTEGER,
    local_account_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(connection_id, provider_account_id)
  )`,
  `CREATE TABLE bank_transactions_raw (
    id TEXT PRIMARY KEY NOT NULL,
    connection_id TEXT NOT NULL,
    bank_account_id TEXT NOT NULL,
    provider_transaction_id TEXT NOT NULL,
    pending_transaction_id TEXT,
    date_posted TEXT NOT NULL,
    date_authorized TEXT,
    payee TEXT,
    memo TEXT,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    raw_category TEXT,
    raw_json TEXT,
    is_pending INTEGER NOT NULL DEFAULT 0,
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(connection_id, provider_transaction_id)
  )`,
  `CREATE TABLE bank_sync_state (
    connection_id TEXT PRIMARY KEY NOT NULL,
    cursor TEXT,
    last_webhook_cursor TEXT,
    sync_status TEXT NOT NULL DEFAULT 'idle',
    last_successful_sync TEXT,
    last_attempted_sync TEXT,
    last_error TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE bank_webhook_events (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    connection_id TEXT,
    payload TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    UNIQUE(provider, event_id)
  )`,
];

// Hub DDL for budget tables (bg_ prefix)
const HUB_DDL = [
  `CREATE TABLE IF NOT EXISTS bg_envelopes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    color TEXT,
    monthly_budget INTEGER NOT NULL DEFAULT 0,
    rollover_enabled INTEGER NOT NULL DEFAULT 1,
    archived INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS bg_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'checking',
    current_balance INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    archived INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS bg_transactions (
    id TEXT PRIMARY KEY,
    envelope_id TEXT,
    account_id TEXT,
    amount INTEGER NOT NULL,
    direction TEXT NOT NULL,
    merchant TEXT,
    note TEXT,
    occurred_on TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS bg_goals (
    id TEXT PRIMARY KEY,
    envelope_id TEXT NOT NULL,
    name TEXT NOT NULL,
    target_amount INTEGER NOT NULL,
    target_date TEXT,
    completed_amount INTEGER NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS bg_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bg_subscriptions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    billing_cycle TEXT NOT NULL,
    custom_days INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    start_date TEXT NOT NULL,
    next_renewal TEXT NOT NULL,
    trial_end_date TEXT,
    cancelled_date TEXT,
    notes TEXT,
    url TEXT,
    icon TEXT,
    color TEXT,
    notify_days INTEGER NOT NULL DEFAULT 1,
    catalog_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS bg_bank_connections (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_item_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    institution_id TEXT,
    institution_name TEXT,
    status TEXT NOT NULL,
    last_successful_sync TEXT,
    last_attempted_sync TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, provider_item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS bg_bank_accounts (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    mask TEXT,
    name TEXT NOT NULL,
    official_name TEXT,
    type TEXT NOT NULL,
    subtype TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    current_balance INTEGER,
    available_balance INTEGER,
    local_account_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(connection_id, provider_account_id)
  )`,
  `CREATE TABLE IF NOT EXISTS bg_bank_transactions_raw (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    bank_account_id TEXT NOT NULL,
    provider_transaction_id TEXT NOT NULL,
    pending_transaction_id TEXT,
    date_posted TEXT NOT NULL,
    date_authorized TEXT,
    payee TEXT,
    memo TEXT,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    raw_category TEXT,
    raw_json TEXT,
    is_pending INTEGER NOT NULL DEFAULT 0,
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(connection_id, provider_transaction_id)
  )`,
  `CREATE TABLE IF NOT EXISTS bg_bank_sync_state (
    connection_id TEXT PRIMARY KEY,
    cursor TEXT,
    last_webhook_cursor TEXT,
    sync_status TEXT NOT NULL DEFAULT 'idle',
    last_successful_sync TEXT,
    last_attempted_sync TEXT,
    last_error TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS bg_bank_webhook_events (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    connection_id TEXT,
    payload TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    UNIQUE(provider, event_id)
  )`,
];

describe('importFromMyBudget', () => {
  let sourceDb: InMemoryTestDatabase;
  let hubDb: InMemoryTestDatabase;

  beforeEach(() => {
    sourceDb = createInMemoryTestDatabase();
    hubDb = createInMemoryTestDatabase();
    for (const ddl of STANDALONE_DDL) {
      sourceDb.adapter.execute(ddl);
    }
    for (const ddl of HUB_DDL) {
      hubDb.adapter.execute(ddl);
    }
  });

  afterEach(() => {
    sourceDb.close();
    hubDb.close();
  });

  it('imports accounts with type mapping', () => {
    sourceDb.adapter.execute(
      `INSERT INTO accounts (id, name, type, balance, sort_order, is_active) VALUES ('a1', 'Checking', 'checking', 50000, 0, 1)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO accounts (id, name, type, balance, sort_order, is_active) VALUES ('a2', 'Visa', 'credit_card', -20000, 1, 0)`,
    );

    const result = importFromMyBudget(sourceDb.adapter, hubDb.adapter);

    expect(result.accountsImported).toBe(2);
    expect(result.errors).toHaveLength(0);

    const hubAccounts = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM bg_accounts ORDER BY sort_order');
    expect(hubAccounts).toHaveLength(2);
    expect(hubAccounts[0]!.type).toBe('checking');
    expect(hubAccounts[0]!.current_balance).toBe(50000);
    expect(hubAccounts[0]!.archived).toBe(0);
    expect(hubAccounts[1]!.type).toBe('credit');
    expect(hubAccounts[1]!.archived).toBe(1);
  });

  it('imports categories as envelopes', () => {
    sourceDb.adapter.execute(
      `INSERT INTO category_groups (id, name, sort_order) VALUES ('g1', 'Bills', 0)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO categories (id, group_id, name, emoji, target_amount, sort_order, is_hidden)
       VALUES ('c1', 'g1', 'Rent', '🏠', 150000, 0, 0)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO categories (id, group_id, name, emoji, target_amount, sort_order, is_hidden)
       VALUES ('c2', 'g1', 'Old Category', '🗑️', 0, 1, 1)`,
    );

    const result = importFromMyBudget(sourceDb.adapter, hubDb.adapter);

    expect(result.categoriesImported).toBe(2);
    expect(result.categoryGroupsImported).toBe(1);
    expect(result.warnings.length).toBeGreaterThan(0);

    const envelopes = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM bg_envelopes ORDER BY sort_order');
    expect(envelopes).toHaveLength(2);
    expect(envelopes[0]!.name).toBe('Rent');
    expect(envelopes[0]!.monthly_budget).toBe(150000);
    expect(envelopes[0]!.archived).toBe(0);
    expect(envelopes[1]!.archived).toBe(1);
  });

  it('imports transactions with direction mapping', () => {
    sourceDb.adapter.execute(
      `INSERT INTO accounts (id, name, type, balance) VALUES ('a1', 'Checking', 'checking', 0)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO category_groups (id, name) VALUES ('g1', 'Bills')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO categories (id, group_id, name) VALUES ('c1', 'g1', 'Rent')`,
    );
    // Outflow (negative amount)
    sourceDb.adapter.execute(
      `INSERT INTO transactions (id, account_id, date, payee, amount, is_transfer)
       VALUES ('t1', 'a1', '2025-01-15', 'Landlord', -150000, 0)`,
    );
    // Inflow (positive amount)
    sourceDb.adapter.execute(
      `INSERT INTO transactions (id, account_id, date, payee, amount, is_transfer)
       VALUES ('t2', 'a1', '2025-01-01', 'Employer', 300000, 0)`,
    );
    // Transfer
    sourceDb.adapter.execute(
      `INSERT INTO transactions (id, account_id, date, payee, amount, is_transfer)
       VALUES ('t3', 'a1', '2025-01-10', 'Transfer', -5000, 1)`,
    );
    // Split for t1
    sourceDb.adapter.execute(
      `INSERT INTO transaction_splits (id, transaction_id, category_id, amount) VALUES ('s1', 't1', 'c1', -150000)`,
    );

    const result = importFromMyBudget(sourceDb.adapter, hubDb.adapter);

    expect(result.transactionsImported).toBe(3);

    const txns = hubDb.adapter.query<Record<string, unknown>>(
      'SELECT * FROM bg_transactions ORDER BY occurred_on',
    );
    expect(txns).toHaveLength(3);

    // Inflow
    const inflow = txns.find(t => t.id === 't2');
    expect(inflow!.direction).toBe('inflow');
    expect(inflow!.amount).toBe(300000);

    // Outflow
    const outflow = txns.find(t => t.id === 't1');
    expect(outflow!.direction).toBe('outflow');
    expect(outflow!.amount).toBe(150000);
    expect(outflow!.envelope_id).toBe('c1');

    // Transfer
    const transfer = txns.find(t => t.id === 't3');
    expect(transfer!.direction).toBe('transfer');
  });

  it('imports subscriptions', () => {
    sourceDb.adapter.execute(
      `INSERT INTO subscriptions (id, name, price, billing_cycle, status, start_date, next_renewal)
       VALUES ('sub1', 'Netflix', 1599, 'monthly', 'active', '2025-01-01', '2025-02-01')`,
    );

    const result = importFromMyBudget(sourceDb.adapter, hubDb.adapter);

    expect(result.subscriptionsImported).toBe(1);
    const subs = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM bg_subscriptions');
    expect(subs).toHaveLength(1);
    expect(subs[0]!.name).toBe('Netflix');
    expect(subs[0]!.price).toBe(1599);
  });

  it('imports goals with amount mapping', () => {
    sourceDb.adapter.execute(
      `INSERT INTO category_groups (id, name) VALUES ('g1', 'Savings')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO categories (id, group_id, name) VALUES ('c1', 'g1', 'Vacation')`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO goals (id, name, target_amount_cents, current_amount_cents, target_date, category_id)
       VALUES ('goal1', 'Beach Trip', 500000, 200000, '2025-07-01', 'c1')`,
    );

    const result = importFromMyBudget(sourceDb.adapter, hubDb.adapter);

    expect(result.goalsImported).toBe(1);
    const goals = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM bg_goals');
    expect(goals).toHaveLength(1);
    expect(goals[0]!.target_amount).toBe(500000);
    expect(goals[0]!.completed_amount).toBe(200000);
    expect(goals[0]!.is_completed).toBe(0);
  });

  it('imports preferences as settings', () => {
    sourceDb.adapter.execute(
      `INSERT INTO preferences (key, value) VALUES ('currency', 'EUR')`,
    );

    const result = importFromMyBudget(sourceDb.adapter, hubDb.adapter);

    expect(result.preferencesImported).toBe(1);
    const settings = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM bg_settings');
    expect(settings).toHaveLength(1);
    expect(settings[0]!.key).toBe('currency');
    expect(settings[0]!.value).toBe('EUR');
  });

  it('imports bank connections', () => {
    sourceDb.adapter.execute(
      `INSERT INTO bank_connections (id, provider, provider_item_id, display_name, status)
       VALUES ('bc1', 'plaid', 'item-123', 'Chase', 'active')`,
    );

    const result = importFromMyBudget(sourceDb.adapter, hubDb.adapter);

    expect(result.bankConnectionsImported).toBe(1);
    const conns = hubDb.adapter.query<Record<string, unknown>>('SELECT * FROM bg_bank_connections');
    expect(conns).toHaveLength(1);
    expect(conns[0]!.display_name).toBe('Chase');
  });

  it('handles empty source database gracefully', () => {
    const result = importFromMyBudget(sourceDb.adapter, hubDb.adapter);

    expect(result.accountsImported).toBe(0);
    expect(result.categoriesImported).toBe(0);
    expect(result.transactionsImported).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('continues importing after individual record errors', () => {
    sourceDb.adapter.execute(
      `INSERT INTO accounts (id, name, type, balance) VALUES ('a1', 'Checking', 'checking', 1000)`,
    );
    sourceDb.adapter.execute(
      `INSERT INTO accounts (id, name, type, balance) VALUES ('a2', 'Savings', 'savings', 2000)`,
    );

    // Pre-insert one account to cause a UNIQUE constraint on name
    hubDb.adapter.execute(
      `INSERT INTO bg_accounts (id, name, type, current_balance) VALUES ('existing', 'Checking', 'checking', 0)`,
    );

    const result = importFromMyBudget(sourceDb.adapter, hubDb.adapter);

    // a1 should be skipped due to INSERT OR IGNORE (name conflict), a2 should succeed
    expect(result.accountsImported).toBe(2);
    expect(result.errors).toHaveLength(0);
  });
});
