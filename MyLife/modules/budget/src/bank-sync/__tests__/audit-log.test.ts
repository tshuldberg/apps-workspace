import { describe, expect, it } from 'vitest';

import {
  createBankSyncAuditLogger,
  createInMemoryBankSyncAuditSink,
} from '../audit-log';

describe('Bank sync audit logging', () => {
  it('writes structured audit records to the sink', async () => {
    const sink = createInMemoryBankSyncAuditSink();
    const logger = createBankSyncAuditLogger({
      sink,
      nowIso: () => '2026-02-26T12:00:00.000Z',
      createId: () => 'audit-1',
    });

    const entry = await logger.log({
      level: 'info',
      action: 'sync.completed',
      provider: 'plaid',
      connectionExternalId: 'item-123',
      message: 'Completed sync.',
      metadata: {
        added: 2,
      },
    });

    expect(entry.id).toBe('audit-1');
    expect(entry.occurredAtIso).toBe('2026-02-26T12:00:00.000Z');
    expect(sink.getEntries()).toHaveLength(1);
    expect(sink.getEntries()[0].metadata.added).toBe(2);
  });
});
