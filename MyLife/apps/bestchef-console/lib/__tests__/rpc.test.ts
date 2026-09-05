import { describe, expect, it } from 'vitest';

import { unwrapRpcRow } from '../rpc';

describe('unwrapRpcRow', () => {
  it('takes the first row of an array result', () => {
    expect(unwrapRpcRow([{ error_code: null }], null)).toEqual({
      row: { error_code: null },
      errorCode: null,
    });
  });

  it('accepts a bare object result', () => {
    expect(unwrapRpcRow({ error_code: 'nope' }, null)).toEqual({
      row: { error_code: 'nope' },
      errorCode: 'nope',
    });
  });

  it('surfaces the row error_code', () => {
    expect(unwrapRpcRow([{ error_code: 'not_authorized' }], null).errorCode).toBe(
      'not_authorized',
    );
  });

  it('maps a transport error to rpc_failed regardless of data', () => {
    expect(unwrapRpcRow([{ error_code: null }], { message: 'boom' })).toEqual({
      row: null,
      errorCode: 'rpc_failed',
    });
  });

  it('maps null/undefined/empty-array data to rpc_empty', () => {
    expect(unwrapRpcRow(null, null).errorCode).toBe('rpc_empty');
    expect(unwrapRpcRow(undefined, null).errorCode).toBe('rpc_empty');
    expect(unwrapRpcRow([], null).errorCode).toBe('rpc_empty');
  });
});
