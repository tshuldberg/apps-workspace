/**
 * Pure unwrap logic for supabase-js .rpc() results against TABLE-returning
 * Postgres functions (they come back as a one-row array). Extracted so the
 * shape handling is unit-tested instead of hand-rolled at each call site.
 */

export interface RpcErrorRow {
  error_code: string | null;
}

export interface UnwrappedRpc<T extends RpcErrorRow> {
  row: T | null;
  errorCode: string | null;
}

export function unwrapRpcRow<T extends RpcErrorRow>(
  data: unknown,
  error: { message: string } | null,
): UnwrappedRpc<T> {
  if (error) return { row: null, errorCode: 'rpc_failed' };
  const row = (Array.isArray(data) ? data[0] : data) as T | null | undefined;
  if (!row) return { row: null, errorCode: 'rpc_empty' };
  return { row, errorCode: row.error_code };
}
