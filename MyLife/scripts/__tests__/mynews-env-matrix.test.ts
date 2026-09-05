import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ANNOTATIONS,
  buildMatrix,
  checkMatrix,
  OUTPUT_REL,
  renderMarkdown,
  REPO_ROOT,
  UNANNOTATED_CELL,
} from '../gen-mynews-env-matrix.mjs';

function tableFor(markdown: string, headingFragment: string): string {
  const headings = [...markdown.matchAll(/^## .*$/gm)];
  const start = headings.findIndex((match) => match[0].includes(headingFragment));
  expect(start, `no section heading contains "${headingFragment}"`).toBeGreaterThanOrEqual(0);
  const from = headings[start].index ?? 0;
  const to = headings[start + 1]?.index ?? markdown.length;
  return markdown.slice(from, to);
}

describe('gen-mynews-env-matrix', () => {
  it('keeps the committed ENV_MATRIX.md current and fully annotated', () => {
    const result = checkMatrix();

    expect(result.missing, `${OUTPUT_REL} does not exist. Run: node scripts/gen-mynews-env-matrix.mjs`).toBe(
      false,
    );
    expect(
      result.stale,
      `${OUTPUT_REL} is stale. Run: node scripts/gen-mynews-env-matrix.mjs\n\n${result.diff}`,
    ).toBe(false);
    expect(
      result.unannotated,
      'these variables need an annotation in scripts/gen-mynews-env-matrix.mjs',
    ).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('reports an env read with no annotation as UNANNOTATED and fails the check', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mynews-env-matrix-fixture-'));
    try {
      const libDir = path.join(root, 'apps', 'mynews-web', 'lib');
      fs.mkdirSync(libDir, { recursive: true });
      fs.writeFileSync(
        path.join(libDir, 'fixture-config.ts'),
        [
          'export function readFixture(): string | undefined {',
          '  return process.env.MYNEWS_FIXTURE_NEW_UNDOCUMENTED_THING;',
          '}',
          '',
        ].join('\n'),
        'utf8',
      );

      const matrix = buildMatrix(root);

      expect(matrix.unannotated).toContain('MYNEWS_FIXTURE_NEW_UNDOCUMENTED_THING');
      expect(ANNOTATIONS.MYNEWS_FIXTURE_NEW_UNDOCUMENTED_THING).toBeUndefined();

      const markdown = renderMarkdown(matrix);
      const webTable = tableFor(markdown, 'apps/mynews-web');
      expect(webTable).toContain('MYNEWS_FIXTURE_NEW_UNDOCUMENTED_THING');
      expect(webTable).toContain(UNANNOTATED_CELL);
      expect(markdown).toContain('## Unannotated variables');

      // The reference carries the real file so an operator can find the read.
      // File only, no line number: a line number goes stale whenever anyone
      // inserts a line above the read, which would make the currency gate fire
      // on edits that changed nothing about the environment contract.
      const web = matrix.surfaces.find((surface) => surface.key === 'web');
      const variable = web?.variables.find(
        (entry) => entry.name === 'MYNEWS_FIXTURE_NEW_UNDOCUMENTED_THING',
      );
      expect(variable?.refs).toEqual(['apps/mynews-web/lib/fixture-config.ts']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('ignores env reads that only exist in test files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mynews-env-matrix-testonly-'));
    try {
      const libDir = path.join(root, 'apps', 'mynews-web', 'lib');
      fs.mkdirSync(path.join(libDir, '__tests__'), { recursive: true });
      fs.writeFileSync(
        path.join(libDir, '__tests__', 'fixture.test.ts'),
        'const value = process.env.MYNEWS_FIXTURE_TEST_ONLY_THING;\nexport default value;\n',
        'utf8',
      );
      fs.writeFileSync(
        path.join(libDir, 'fixture-also.spec.ts'),
        'const value = process.env.MYNEWS_FIXTURE_SPEC_ONLY_THING;\nexport default value;\n',
        'utf8',
      );

      const matrix = buildMatrix(root);

      expect(matrix.unannotated).toEqual([]);
      const web = matrix.surfaces.find((surface) => surface.key === 'web');
      expect(web?.variables).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('lists a variable read in two surfaces under both surfaces', () => {
    const matrix = buildMatrix(REPO_ROOT);
    const edge = matrix.surfaces.find((surface) => surface.key === 'edge');
    const web = matrix.surfaces.find((surface) => surface.key === 'web');

    const edgeSalt = edge?.variables.find((entry) => entry.name === 'MYNEWS_DMCA_RATE_SALT');
    const webSalt = web?.variables.find((entry) => entry.name === 'MYNEWS_DMCA_RATE_SALT');

    expect(edgeSalt, 'MYNEWS_DMCA_RATE_SALT should be found in the edge surface').toBeDefined();
    expect(webSalt, 'MYNEWS_DMCA_RATE_SALT should be found in the web surface').toBeDefined();
    expect(edgeSalt?.refs.some((ref) => ref.startsWith('supabase/functions/mynews-dmca/'))).toBe(true);
    expect(webSalt?.refs.some((ref) => ref.startsWith('apps/mynews-web/'))).toBe(true);

    const markdown = renderMarkdown(matrix);
    expect(tableFor(markdown, 'Supabase Edge Functions')).toContain('MYNEWS_DMCA_RATE_SALT');
    expect(tableFor(markdown, 'apps/mynews-web')).toContain('MYNEWS_DMCA_RATE_SALT');
  });

  it('resolves indirect reads through name constants in every surface', () => {
    const matrix = buildMatrix(REPO_ROOT);
    const console_ = matrix.surfaces.find((surface) => surface.key === 'console');
    const edge = matrix.surfaces.find((surface) => surface.key === 'edge');

    // apps/mynews-console never writes the literal name: it reads
    // process.env[ENV_SUPABASE_URL] from lib/env-names.ts.
    const url = console_?.variables.find((entry) => entry.name === 'MYNEWS_CONSOLE_SUPABASE_URL');
    expect(url).toBeDefined();
    expect(url?.refs.length).toBeGreaterThan(0);

    // The edge does the same through seams.ts / screening-gate.ts constants.
    const vendor = edge?.variables.find((entry) => entry.name === 'MYNEWS_SCREENING_VENDOR_URL');
    expect(vendor).toBeDefined();
    expect(
      vendor?.refs.some((ref) => ref.startsWith('supabase/functions/_shared/mynews-screening-gate.ts')),
    ).toBe(true);
  });

  it('names the platform-injected Supabase variables as not operator-set', () => {
    const markdown = renderMarkdown(buildMatrix(REPO_ROOT));
    const section = tableFor(markdown, 'Platform-injected variables');

    for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY']) {
      expect(section).toContain(name);
    }
    expect(section).toContain('injected into every edge function runtime by Supabase');
  });
});
