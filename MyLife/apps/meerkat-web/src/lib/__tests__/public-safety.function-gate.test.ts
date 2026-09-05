import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import type { AcceptedPublicPost } from '@mylife/sync';
import {
  acceptPublicTerms,
  blockPublicPersona,
  filterBlockedPublicPosts,
  hasAcceptedPublicTerms,
} from '../public-safety';

function db(): DatabaseAdapter {
  const values = new Map<string, string>();
  return {
    execute(sql, params = []) {
      if (sql.includes('INSERT OR REPLACE INTO mk_settings')) values.set(String(params[0]), String(params[1]));
    },
    query<T>(sql: string, params = []): T[] {
      const value = values.get(String(params[0]));
      return sql.includes('SELECT value FROM mk_settings') && value !== undefined
        ? ([{ value }] as T[])
        : [];
    },
    transaction(fn) { fn(); },
  };
}

describe('web public safety function gate', () => {
  it('requires explicit terms acceptance and filters a blocked author', () => {
    const adapter = db();
    expect(hasAcceptedPublicTerms(adapter)).toBe(false);
    acceptPublicTerms(adapter);
    expect(hasAcceptedPublicTerms(adapter)).toBe(true);
    blockPublicPersona(adapter, 'ABCD');
    const blocked = { post: { personaPubkey: 'abcd' } } as AcceptedPublicPost;
    const visible = { post: { personaPubkey: 'ef01' } } as AcceptedPublicPost;
    expect(filterBlockedPublicPosts(adapter, [blocked, visible])).toEqual([visible]);
  });
});
