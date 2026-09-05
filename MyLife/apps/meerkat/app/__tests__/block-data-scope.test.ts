/**
 * Composition plan 2.1 sandbox rule (block-data-scope, mobile): block
 * renderers reach data ONLY through the BlockQueries seam, and the seam
 * touches only tables the block contracts declare. Grep-style source guards
 * in the style of chat-kit-no-providers.test.ts:
 *   - the renderer map imports NO data-layer module except the query seam and
 *     the pure registry core, and never names the db, the network, or a
 *     cm_/mk_ table directly;
 *   - BlockStack imports only the pure cores (resolution + placeholder);
 *   - block-queries.ts names no cm_/mk_ table outside the union of the block
 *     contracts' declared dataSources.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_REGISTRY } from '../(root)/data/block-registry-core';

const ROOT = resolve(__dirname, '..', '(root)');
const rendererSource = readFileSync(resolve(ROOT, 'components/blocks/registry.tsx'), 'utf8');
const stackSource = readFileSync(resolve(ROOT, 'components/blocks/BlockStack.tsx'), 'utf8');
const queriesSource = readFileSync(resolve(ROOT, 'data/block-queries.ts'), 'utf8');

function importPaths(source: string): string[] {
  return [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
}

/** Comment lines describe the rules; only CODE lines are held to them. */
function codeLines(source: string): string {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))
    .join('\n');
}

describe('renderer map import hygiene', () => {
  it('imports no data-layer module except the query seam and the registry core', () => {
    const dataImports = importPaths(rendererSource).filter((p) => p.includes('/data/'));
    expect(dataImports.sort()).toEqual(['../../data/block-queries', '../../data/block-registry-core']);
  });

  it('never touches the db, the network, or a table name directly', () => {
    const code = codeLines(rendererSource);
    for (const forbidden of ['@mylife/db', 'DatabaseAdapter', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'db.query', 'db.execute']) {
      expect(code.includes(forbidden), forbidden).toBe(false);
    }
    expect(/\b(cm|mk)_[a-z_]+\b/.test(code)).toBe(false);
  });
});

describe('BlockStack import hygiene', () => {
  it('imports only the pure cores and the renderer map', () => {
    const dataImports = importPaths(stackSource).filter((p) => p.includes('/data/'));
    expect(dataImports.every((p) =>
      p.endsWith('block-registry-core') || p.endsWith('community-layout-core'))).toBe(true);
    expect(stackSource.includes('@mylife/db')).toBe(false);
  });
});

describe('block-queries table scope', () => {
  it('names no cm_/mk_ table outside the declared dataSources union', () => {
    const declared = new Set<string>();
    for (const contract of Object.values(BLOCK_REGISTRY)) {
      for (const table of contract.dataSources) declared.add(table);
    }
    const named = new Set([...queriesSource.matchAll(/\b(cm|mk)_[a-z_]+\b/g)].map((m) => m[0]));
    for (const table of named) {
      expect(declared.has(table), `block-queries names undeclared table ${table}`).toBe(true);
    }
  });

  it('never fetches the network', () => {
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket']) {
      expect(queriesSource.includes(forbidden), forbidden).toBe(false);
    }
  });
});
