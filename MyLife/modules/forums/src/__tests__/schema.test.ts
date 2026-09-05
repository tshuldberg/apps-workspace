import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('forums schema triggers', () => {
  it('keeps delete-aware counter and vote triggers in the schema', () => {
    const schema = readFileSync(
      new URL('../cloud/schema.sql', import.meta.url),
      'utf8',
    );

    expect(schema).toContain('AFTER INSERT OR DELETE ON fr_threads');
    expect(schema).toContain('AFTER INSERT OR DELETE ON fr_replies');
    expect(schema).toContain('AFTER INSERT OR UPDATE OR DELETE ON fr_votes');
    expect(schema).toContain('greatest(0, member_count - 1)');
  });
});
