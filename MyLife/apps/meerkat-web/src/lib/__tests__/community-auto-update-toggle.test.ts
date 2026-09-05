// Community feed P4: the per-community auto-update toggle is PERSONAL, row-only,
// and never synced. It persists in mk_settings (outside the sync prefix map)
// under `auto_update:<communityId>`, defaults OFF, and round-trips on a real
// in-memory web database.

import { afterEach, describe, expect, it } from 'vitest';
import { getAutoUpdate, setAutoUpdate } from '../meerkat-data';
import { buildWebNode, destroyNode, type WebNode } from './support/web-node-harness';

const COMMUNITY_A = 'community-aaaa0000';
const COMMUNITY_B = 'community-bbbb1111';

let node: WebNode | null = null;

afterEach(async () => {
  await destroyNode(node);
  node = null;
});

describe('community feed P4: per-community auto-update toggle', () => {
  it('defaults OFF, persists ON/OFF row-only, and is scoped per community', async () => {
    node = await buildWebNode('AutoUpdate');
    const db = node.db;

    // Default: a community never toggled reads false.
    expect(getAutoUpdate(db, COMMUNITY_A)).toBe(false);

    // Turn it on for A; B is unaffected (per-community scope).
    setAutoUpdate(db, COMMUNITY_A, true);
    expect(getAutoUpdate(db, COMMUNITY_A)).toBe(true);
    expect(getAutoUpdate(db, COMMUNITY_B)).toBe(false);

    // Turn it back off; the row persists the off value (reads false, not default-missing).
    setAutoUpdate(db, COMMUNITY_A, false);
    expect(getAutoUpdate(db, COMMUNITY_A)).toBe(false);

    // The toggle wrote a real mk_settings row under the namespaced key.
    const rows = db.query<{ key: string; value: string | null }>(
      `SELECT key, value FROM mk_settings WHERE key = ?`,
      [`auto_update:${COMMUNITY_A}`],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe('0');
  });
});
