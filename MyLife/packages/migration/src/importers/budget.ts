import type { DatabaseAdapter } from '@mylife/db';

export interface BudgetImportResult {
  accountsImported: number;
  categoryGroupsImported: number;
  categoriesImported: number;
  allocationsImported: number;
  transactionsImported: number;
  splitsImported: number;
  recurringTemplatesImported: number;
  subscriptionsImported: number;
  goalsImported: number;
  preferencesImported: number;
  bankConnectionsImported: number;
  errors: string[];
  warnings: string[];
}

/**
 * Import data from a standalone MyBudget SQLite database into the hub database.
 * Reads from unprefixed tables in sourceDb, writes to bg_-prefixed tables in hubDb.
 *
 * Standalone MyBudget uses YNAB-style categories/category_groups while the hub
 * module uses envelopes/accounts. The mapping is:
 *   - standalone accounts -> bg_accounts (mapped field names)
 *   - standalone category_groups + categories -> bg_envelopes (flattened)
 *   - standalone transactions -> bg_transactions (mapped field names)
 *   - standalone subscriptions -> bg_subscriptions (direct)
 *   - standalone goals -> bg_goals (mapped field names)
 *   - standalone bank_* tables -> bg_bank_* tables (prefixed)
 *   - standalone preferences -> bg_settings
 */
export function importFromMyBudget(
  sourceDb: DatabaseAdapter,
  hubDb: DatabaseAdapter,
): BudgetImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let accountsImported = 0;
  let categoryGroupsImported = 0;
  let categoriesImported = 0;
  let allocationsImported = 0;
  let transactionsImported = 0;
  let splitsImported = 0;
  let recurringTemplatesImported = 0;
  let subscriptionsImported = 0;
  let goalsImported = 0;
  let preferencesImported = 0;
  let bankConnectionsImported = 0;

  hubDb.transaction(() => {
    // 1. Import accounts
    // Standalone: accounts(id, name, type, balance, sort_order, is_active, created_at, updated_at)
    // Hub: bg_accounts(id, name, type, current_balance, currency, archived, sort_order, created_at, updated_at)
    const accounts = sourceDb.query<Record<string, unknown>>('SELECT * FROM accounts');
    for (const a of accounts) {
      try {
        // Map standalone type values to hub type values
        const typeMap: Record<string, string> = {
          checking: 'checking',
          savings: 'savings',
          credit_card: 'credit',
          cash: 'cash',
        };
        const hubType = typeMap[a.type as string] ?? 'other';
        const archived = (a.is_active as number) === 0 ? 1 : 0;

        hubDb.execute(
          `INSERT OR IGNORE INTO bg_accounts (id, name, type, current_balance, currency, archived, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'USD', ?, ?, ?, ?)`,
          [a.id, a.name, hubType, a.balance, archived, a.sort_order, a.created_at, a.updated_at],
        );
        accountsImported++;
      } catch (e) {
        errors.push(`Account ${a.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 2. Import category groups as logical groupings (tracked for warnings only)
    // The hub uses a flat envelope model; we import categories as envelopes directly.
    const categoryGroups = sourceDb.query<Record<string, unknown>>('SELECT * FROM category_groups');
    for (const cg of categoryGroups) {
      categoryGroupsImported++;
    }
    if (categoryGroupsImported > 0) {
      warnings.push(
        `${categoryGroupsImported} category group(s) noted. Hub uses flat envelopes; group hierarchy is not preserved.`,
      );
    }

    // 3. Import categories as envelopes
    // Standalone: categories(id, group_id, name, emoji, target_amount, target_type, sort_order, is_hidden, ...)
    // Hub: bg_envelopes(id, name, icon, color, monthly_budget, rollover_enabled, archived, sort_order, ...)
    const categories = sourceDb.query<Record<string, unknown>>('SELECT * FROM categories');
    for (const c of categories) {
      try {
        const monthlyBudget = (c.target_amount as number | null) ?? 0;
        const archived = (c.is_hidden as number) === 1 ? 1 : 0;
        const rolloverEnabled = (c.target_type as string) === 'savings_goal' ? 1 : 1;

        hubDb.execute(
          `INSERT OR IGNORE INTO bg_envelopes (id, name, icon, monthly_budget, rollover_enabled, archived, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, c.name, c.emoji, monthlyBudget, rolloverEnabled, archived, c.sort_order, c.created_at, c.updated_at],
        );
        categoriesImported++;
      } catch (e) {
        errors.push(`Category/Envelope ${c.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 4. Import budget allocations (warnings only -- hub does not have a direct equivalent table)
    try {
      const allocations = sourceDb.query<Record<string, unknown>>('SELECT * FROM budget_allocations');
      allocationsImported = allocations.length;
      if (allocationsImported > 0) {
        warnings.push(
          `${allocationsImported} budget allocation(s) skipped. Hub envelopes use monthly_budget field instead of per-month allocations.`,
        );
      }
    } catch {
      // Table may not exist in older standalone versions
    }

    // 5. Import transactions
    // Standalone: transactions(id, account_id, date, payee, memo, amount, is_cleared, is_transfer, transfer_id, ...)
    // Hub: bg_transactions(id, envelope_id, account_id, amount, direction, merchant, note, occurred_on, ...)
    const transactions = sourceDb.query<Record<string, unknown>>('SELECT * FROM transactions');

    // Build a map of transaction -> first split category for envelope assignment
    let splitMap = new Map<string, string | null>();
    try {
      const splits = sourceDb.query<Record<string, unknown>>('SELECT * FROM transaction_splits');
      for (const s of splits) {
        // Use the first split's category as the envelope for the transaction
        if (!splitMap.has(s.transaction_id as string)) {
          splitMap.set(s.transaction_id as string, (s.category_id as string | null));
        }
        try {
          // We don't have a direct hub equivalent for splits, but record the count
          splitsImported++;
        } catch {
          // ignore
        }
      }
    } catch {
      // Table may not exist
    }

    for (const t of transactions) {
      try {
        const amount = t.amount as number;
        const direction = (t.is_transfer as number) === 1
          ? 'transfer'
          : amount < 0
            ? 'outflow'
            : 'inflow';
        const absAmount = Math.abs(amount);
        const envelopeId = splitMap.get(t.id as string) ?? null;

        hubDb.execute(
          `INSERT OR IGNORE INTO bg_transactions (id, envelope_id, account_id, amount, direction, merchant, note, occurred_on, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id, envelopeId, t.account_id, absAmount, direction, t.payee, t.memo, t.date, t.created_at, t.updated_at],
        );
        transactionsImported++;
      } catch (e) {
        errors.push(`Transaction ${t.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (splitsImported > 0) {
      warnings.push(
        `${splitsImported} transaction split(s) noted. Hub uses single-envelope transactions; only the first split category was used.`,
      );
    }

    // 6. Import subscriptions
    // Standalone and hub share nearly identical subscription schemas
    try {
      const subscriptions = sourceDb.query<Record<string, unknown>>('SELECT * FROM subscriptions');
      for (const s of subscriptions) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO bg_subscriptions (id, name, price, currency, billing_cycle, custom_days, status, start_date, next_renewal, trial_end_date, cancelled_date, notes, url, icon, color, notify_days, catalog_id, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [s.id, s.name, s.price, s.currency, s.billing_cycle, s.custom_days, s.status, s.start_date, s.next_renewal, s.trial_end_date, s.cancelled_date, s.notes, s.url, s.icon, s.color, s.notify_days, s.catalog_id, s.sort_order, s.created_at, s.updated_at],
          );
          subscriptionsImported++;
        } catch (e) {
          errors.push(`Subscription ${s.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist in older versions
    }

    // 7. Import recurring templates (warnings only -- hub does not have direct equivalent)
    try {
      const templates = sourceDb.query<Record<string, unknown>>('SELECT * FROM recurring_templates');
      recurringTemplatesImported = templates.length;
      if (recurringTemplatesImported > 0) {
        warnings.push(
          `${recurringTemplatesImported} recurring template(s) skipped. Hub does not have a direct recurring templates table.`,
        );
      }
    } catch {
      // Table may not exist
    }

    // 8. Import goals
    // Standalone: goals(id, name, target_amount_cents, current_amount_cents, target_date, category_id, ...)
    // Hub: bg_goals(id, envelope_id, name, target_amount, target_date, completed_amount, is_completed, ...)
    try {
      const goals = sourceDb.query<Record<string, unknown>>('SELECT * FROM goals');
      for (const g of goals) {
        try {
          const targetAmount = (g.target_amount_cents as number) ?? 0;
          const currentAmount = (g.current_amount_cents as number) ?? 0;
          const isCompleted = currentAmount >= targetAmount ? 1 : 0;
          const envelopeId = (g.category_id as string | null) ?? '';

          if (!envelopeId) {
            warnings.push(`Goal ${g.id}: no category_id, using empty envelope_id.`);
          }

          hubDb.execute(
            `INSERT OR IGNORE INTO bg_goals (id, envelope_id, name, target_amount, target_date, completed_amount, is_completed, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [g.id, envelopeId, g.name, targetAmount, g.target_date, currentAmount, isCompleted, g.created_at, g.updated_at],
          );
          goalsImported++;
        } catch (e) {
          errors.push(`Goal ${g.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 9. Import preferences as settings
    // Standalone: preferences(key, value)
    // Hub: bg_settings(key, value)
    try {
      const prefs = sourceDb.query<Record<string, unknown>>('SELECT * FROM preferences');
      for (const p of prefs) {
        try {
          hubDb.execute(
            'INSERT OR IGNORE INTO bg_settings (key, value) VALUES (?, ?)',
            [p.key, p.value],
          );
          preferencesImported++;
        } catch (e) {
          errors.push(`Preference ${p.key}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 10. Import bank connections
    // Standalone: bank_connections -> Hub: bg_bank_connections (same schema, just prefixed)
    try {
      const bankConns = sourceDb.query<Record<string, unknown>>('SELECT * FROM bank_connections');
      for (const bc of bankConns) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO bg_bank_connections (id, provider, provider_item_id, display_name, institution_id, institution_name, status, last_successful_sync, last_attempted_sync, error_code, error_message, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [bc.id, bc.provider, bc.provider_item_id, bc.display_name, bc.institution_id, bc.institution_name, bc.status, bc.last_successful_sync, bc.last_attempted_sync, bc.error_code, bc.error_message, bc.created_at, bc.updated_at],
          );
          bankConnectionsImported++;
        } catch (e) {
          errors.push(`BankConnection ${bc.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 11. Import bank accounts
    try {
      const bankAccounts = sourceDb.query<Record<string, unknown>>('SELECT * FROM bank_accounts');
      for (const ba of bankAccounts) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO bg_bank_accounts (id, connection_id, provider_account_id, mask, name, official_name, type, subtype, currency, current_balance, available_balance, local_account_id, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ba.id, ba.connection_id, ba.provider_account_id, ba.mask, ba.name, ba.official_name, ba.type, ba.subtype, ba.currency, ba.current_balance, ba.available_balance, ba.local_account_id, ba.is_active, ba.created_at, ba.updated_at],
          );
        } catch (e) {
          errors.push(`BankAccount ${ba.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 12. Import bank transactions raw
    try {
      const bankTxns = sourceDb.query<Record<string, unknown>>('SELECT * FROM bank_transactions_raw');
      for (const bt of bankTxns) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO bg_bank_transactions_raw (id, connection_id, bank_account_id, provider_transaction_id, pending_transaction_id, date_posted, date_authorized, payee, memo, amount, currency, raw_category, raw_json, is_pending, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [bt.id, bt.connection_id, bt.bank_account_id, bt.provider_transaction_id, bt.pending_transaction_id, bt.date_posted, bt.date_authorized, bt.payee, bt.memo, bt.amount, bt.currency, bt.raw_category, bt.raw_json, bt.is_pending, bt.synced_at],
          );
        } catch (e) {
          errors.push(`BankTransaction ${bt.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 13. Import bank sync state
    try {
      const bankSync = sourceDb.query<Record<string, unknown>>('SELECT * FROM bank_sync_state');
      for (const bs of bankSync) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO bg_bank_sync_state (connection_id, cursor, last_webhook_cursor, sync_status, last_successful_sync, last_attempted_sync, last_error, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [bs.connection_id, bs.cursor, bs.last_webhook_cursor, bs.sync_status, bs.last_successful_sync, bs.last_attempted_sync, bs.last_error, bs.updated_at],
          );
        } catch (e) {
          errors.push(`BankSyncState ${bs.connection_id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }

    // 14. Import bank webhook events
    try {
      const webhookEvents = sourceDb.query<Record<string, unknown>>('SELECT * FROM bank_webhook_events');
      for (const we of webhookEvents) {
        try {
          hubDb.execute(
            `INSERT OR IGNORE INTO bg_bank_webhook_events (id, provider, event_id, event_type, connection_id, payload, received_at, processed_at, status, error_message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [we.id, we.provider, we.event_id, we.event_type, we.connection_id, we.payload, we.received_at, we.processed_at, we.status, we.error_message],
          );
        } catch (e) {
          errors.push(`WebhookEvent ${we.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch {
      // Table may not exist
    }
  });

  return {
    accountsImported,
    categoryGroupsImported,
    categoriesImported,
    allocationsImported,
    transactionsImported,
    splitsImported,
    recurringTemplatesImported,
    subscriptionsImported,
    goalsImported,
    preferencesImported,
    bankConnectionsImported,
    errors,
    warnings,
  };
}
