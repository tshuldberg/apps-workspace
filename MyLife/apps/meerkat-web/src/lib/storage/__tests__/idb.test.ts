import { beforeEach, describe, expect, it } from 'vitest';
import { openMeerkatIdb } from '../idb';
import { resetDurableLayer } from './helpers';

describe('Meerkat IndexedDB connection lifecycle', () => {
  beforeEach(resetDurableLayer);

  it('closes and evicts the cached connection when another context requests an upgrade', async () => {
    const first = await openMeerkatIdb();
    first.onversionchange?.({} as IDBVersionChangeEvent);

    const reopened = await openMeerkatIdb();
    expect(reopened).not.toBe(first);
    expect(reopened.name).toBe('meerkat-web');
  });
});
