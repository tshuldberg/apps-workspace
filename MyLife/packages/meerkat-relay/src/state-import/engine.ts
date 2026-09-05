import type { PostgresStoreContext } from '../postgres/store-context';
import {
  STATE_STORE_IDS,
  type StateEnumerator,
  type StateStoreId,
} from './model';
import { fileEnumerator, type StateServiceRoots } from './enumerate-file';
import { postgresEnumerator } from './enumerate-postgres';
import { compareDigests, computeStoreDigest, type StoreCompareResult, type StoreDigest } from './digest';
import { importStore, isNonImportable, type ImportStoreResult } from './importers';

/**
 * High-level engine: dry-run (enumerate + validate + digest source, zero
 * writes), import (source file -> PostgreSQL), and digest-compare (both
 * backends through the same enumerator interface, typed verdict).
 */

export interface EngineTarget {
  database: PostgresStoreContext;
}

export interface DryRunStoreReport {
  storeId: StateStoreId;
  guarantee: string;
  count: number;
  rollupHex: string;
  highestRevision: number | null;
  distinctPrimaryParts: number;
  nonImportable: boolean;
}

/** Enumerate + validate + digest the SOURCE (file) with zero writes. */
export async function dryRun(
  roots: StateServiceRoots,
  storeIds: readonly StateStoreId[] = STATE_STORE_IDS,
): Promise<DryRunStoreReport[]> {
  const reports: DryRunStoreReport[] = [];
  for (const storeId of storeIds) {
    const enumerator = fileEnumerator(storeId, roots);
    const build = await computeStoreDigest(enumerator, 'file');
    reports.push({
      storeId,
      guarantee: enumerator.guarantee,
      count: build.digest.count,
      rollupHex: build.digest.rollupHex,
      highestRevision: build.digest.salient.highestRevision,
      distinctPrimaryParts: build.digest.salient.distinctPrimaryParts,
      nonImportable: isNonImportable(storeId),
    });
  }
  return reports;
}

/** Import the SOURCE file records for the selected stores into PostgreSQL. */
export async function importAll(
  target: EngineTarget,
  roots: StateServiceRoots,
  owner: string,
  storeIds: readonly StateStoreId[] = STATE_STORE_IDS,
): Promise<ImportStoreResult[]> {
  const results: ImportStoreResult[] = [];
  // Reference keys must land before their edges (FK). Sort keys ahead of edges.
  const ordered = orderForImport(storeIds);
  for (const storeId of ordered) {
    const enumerator = fileEnumerator(storeId, roots);
    results.push(await importStore(target.database, enumerator, { owner }));
  }
  return results;
}

/** Digest both backends through the same enumerator interface and compare. */
export async function digestCompare(
  target: EngineTarget,
  roots: StateServiceRoots,
  storeIds: readonly StateStoreId[] = STATE_STORE_IDS,
): Promise<StoreCompareResult[]> {
  const results: StoreCompareResult[] = [];
  for (const storeId of storeIds) {
    const source = await computeStoreDigest(fileEnumerator(storeId, roots), 'file');
    const targetBuild = await computeStoreDigest(
      postgresEnumerator(storeId, target.database),
      'postgres',
    );
    results.push(compareDigests(storeId, source, targetBuild));
  }
  return results;
}

/** Digest one backend directly (used by shadow/cutover callers and tests). */
export async function digestBackend(
  enumerator: StateEnumerator,
  backend: 'file' | 'postgres',
): Promise<StoreDigest> {
  return (await computeStoreDigest(enumerator, backend)).digest;
}

function orderForImport(storeIds: readonly StateStoreId[]): StateStoreId[] {
  const weight = (id: StateStoreId): number => {
    if (id === 'ops.object-reference-keys') return 0;
    if (id === 'ops.object-reference-edges') return 1;
    return 0;
  };
  return [...storeIds].sort((a, b) => weight(a) - weight(b));
}
