import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DMCA_URL_RESOLUTION_FIXTURES,
  classifyDmcaPublicUrl,
} from '@mylife/mynews/cloud-fetch';

// Route-drift net for the DMCA URL resolver (Plan 48 WP2). The resolver's
// vocabulary is defined once in @mylife/mynews (mirrored by the SQL function
// and the store twin); this test walks the REAL Next.js app directory so a
// new or renamed public content route cannot ship without either joining the
// resolver vocabulary or being explicitly listed as non-content below.

const APP_DIR = join(__dirname, '..', 'app');

function collectRoutes(dir: string, prefix = ''): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) {
      if (entry === 'page.tsx') routes.push(prefix === '' ? '/' : prefix);
      continue;
    }
    if (entry.startsWith('_') || entry === 'api' || entry === 'components') continue;
    routes.push(...collectRoutes(full, `${prefix}/${entry}`));
  }
  return routes;
}

// Routes that are deliberately NOT DMCA-resolvable content (site chrome,
// legal pages, static explainers). Adding a content route here instead of the
// resolver vocabulary is a review-visible decision.
const NON_CONTENT_ROUTES = new Set([
  '/',
  '/legal',
  '/legal/appeals',
  '/legal/dmca',
  '/legal/guidelines',
  '/legal/privacy',
  '/legal/terms',
  '/about/editing',
  '/account/delete',
]);

function sampleUrlFor(route: string): string {
  const concrete = route
    .replaceAll('[slug]', 'sample-article-slug')
    .replaceAll('[handle]', 'sample_handle')
    .replaceAll('[id]', '123e4567-e89b-42d3-a456-426614174000');
  return `https://mynews.app${concrete}`;
}

describe('DMCA resolver route drift', () => {
  const routes = collectRoutes(APP_DIR);

  it('finds the expected live route surface (sanity)', () => {
    expect(routes).toContain('/a/[slug]');
    expect(routes).toContain('/a/[slug]/suggestions');
    expect(routes).toContain('/j/[handle]');
    expect(routes).toContain('/e/[handle]');
  });

  it('every live route is either resolver-covered content or an explicit non-content route', () => {
    for (const route of routes) {
      if (NON_CONTENT_ROUTES.has(route)) continue;
      const kind = classifyDmcaPublicUrl(sampleUrlFor(route));
      expect(kind, `route ${route} must resolve or be listed in NON_CONTENT_ROUTES`).not.toBeNull();
    }
  });

  it('the shared fixtures agree with the classifier for every entry', () => {
    for (const fixture of DMCA_URL_RESOLUTION_FIXTURES) {
      expect(
        classifyDmcaPublicUrl(`https://mynews.app${fixture.path}`),
        fixture.path,
      ).toBe(fixture.kind);
    }
  });

  it('relative walk stays inside the app dir (no accidental monorepo scan)', () => {
    for (const route of routes) {
      expect(relative(APP_DIR, join(APP_DIR, `.${route}`)).startsWith('..')).toBe(false);
    }
  });
});
