import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const moduleRoot = join(root, '..', '..', 'modules', 'mynews');

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe('mynews-web shell', () => {
  it('ships the public route skeletons', () => {
    for (const route of ['app/page.tsx', 'app/a/[slug]/page.tsx', 'app/j/[handle]/page.tsx']) {
      expect(existsSync(join(root, route)), route).toBe(true);
    }
  });

  it('ships the syndication routes', () => {
    for (const route of ['app/feed.xml/route.ts', 'app/sitemap.ts']) {
      expect(existsSync(join(root, route)), route).toBe(true);
    }
  });

  it('never imports the react-native ui barrel (documented web hazard)', () => {
    const files = [
      'app/layout.tsx',
      'app/page.tsx',
      'app/a/[slug]/page.tsx',
      'app/j/[handle]/page.tsx',
      'lib/cloud.ts',
    ];
    for (const file of files) {
      const src = readFileSync(join(root, file), 'utf8');
      expect(src.includes('@mylife/ui'), `${file} must not import @mylife/ui`).toBe(false);
    }
  });

  it('keeps honest empty-state copy on the home page', () => {
    const src = readFileSync(join(root, 'app/page.tsx'), 'utf8');
    expect(src).toContain('No demo content is shown as live');
  });

  it('routes to notFound when a record is missing (no placeholder articles)', () => {
    for (const route of [
      'app/a/[slug]/page.tsx',
      'app/j/[handle]/page.tsx',
      'app/a/[slug]/suggestions/page.tsx',
      'app/e/[handle]/page.tsx',
    ]) {
      const src = readFileSync(join(root, route), 'utf8');
      expect(src.includes('notFound()'), `${route} must call notFound()`).toBe(true);
    }
  });

  it('ships the editing surfaces', () => {
    for (const file of [
      'app/a/[slug]/suggestions/page.tsx',
      'app/e/[handle]/page.tsx',
      'app/about/editing/page.tsx',
      'lib/editing.ts',
    ]) {
      expect(existsSync(join(root, file)), file).toBe(true);
    }
  });

  it('never imports supabase-js or the ui barrel anywhere in the app', () => {
    const files = [...sourceFiles('app'), ...sourceFiles('lib')];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      expect(src.includes('@supabase/supabase-js'), `${file} must not import supabase-js`).toBe(
        false,
      );
      expect(src.includes('@mylife/ui'), `${file} must not import @mylife/ui`).toBe(false);
    }
  });

  /**
   * Plan 48 WP10 added `@supabase/ssr` for reader sign-in. The original rule was
   * "no Supabase SDK at all", which existed to keep the SDK out of the reader's
   * bundle and to keep data reads on the fetch-based PostgREST path. Both of those
   * still hold: the SDK is used ONLY for the auth session, only server-side, and
   * only from modules that cannot be imported by a client component.
   */
  it('confines the supabase auth SDK to server-only modules and middleware', () => {
    const allowed = new Set(['lib/reader-auth.ts']);
    const files = [...sourceFiles('app'), ...sourceFiles('lib')];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('@supabase/ssr')) continue;
      const relative = file.slice(root.length + 1);
      expect(allowed.has(relative), `${relative} must not import @supabase/ssr`).toBe(true);
      expect(src.includes("import 'server-only'"), `${relative} must be server-only`).toBe(true);
    }

    // Middleware runs before any component and cannot be imported by one, so it
    // is allowed the SDK without the server-only marker (which would break it).
    const middleware = readFileSync(join(root, 'middleware.ts'), 'utf8');
    expect(middleware).toContain('@supabase/ssr');

    // The guard must not pass by finding nothing.
    expect(readFileSync(join(root, 'lib/reader-auth.ts'), 'utf8')).toContain('@supabase/ssr');
  });

  it('marks every module that reads the cloud or a session as server-only', () => {
    for (const file of ['lib/cloud.ts', 'lib/reader-auth.ts', 'lib/report-context.ts']) {
      const src = readFileSync(join(root, file), 'utf8');
      expect(src.includes("import 'server-only'"), `${file} must import server-only`).toBe(true);
    }
  });

  /**
   * The CSP carries a per-response nonce, and Next can only stamp that nonce onto
   * script tags while rendering. A prerendered route's scripts were emitted at
   * build time without one, so under this CSP the browser blocks them and the
   * page never hydrates: on `/legal/dmca` that would silently break the notice
   * form. Every page therefore renders per request, and this test is what stops a
   * new page from being added without it.
   */
  it('renders every page dynamically, because the CSP nonce requires it', () => {
    const pages = sourceFiles('app').filter(
      (file) => file.endsWith('/page.tsx') || file.endsWith('/not-found.tsx'),
    );
    expect(pages.length).toBeGreaterThanOrEqual(12);
    for (const file of pages) {
      const src = readFileSync(file, 'utf8');
      const relative = file.slice(root.length + 1);
      const isDynamic =
        src.includes("export const dynamic = 'force-dynamic'") ||
        // not-found.tsx opts out of prerendering with connection() instead,
        // because a route-segment config export is not honoured there.
        src.includes('await connection()');
      expect(isDynamic, `${relative} must opt out of prerendering`).toBe(true);
    }
  });

  it('ships a favicon and site-wide navigation to the legal surfaces', () => {
    expect(existsSync(join(root, 'app/icon.svg'))).toBe(true);
    const chrome = readFileSync(join(root, 'app/components/SiteChrome.tsx'), 'utf8');
    for (const href of [
      '/legal',
      '/legal/terms',
      '/legal/privacy',
      '/legal/guidelines',
      '/legal/dmca',
      '/legal/appeals',
      '/account/delete',
      '/about/editing',
      '/feed.xml',
    ]) {
      expect(chrome.includes(`"${href}"`), `site nav must link ${href}`).toBe(true);
    }
    const layout = readFileSync(join(root, 'app/layout.tsx'), 'utf8');
    expect(layout).toContain('skip-link');
    // The full element, not just the attribute: this file's doc comment mentions
    // `lang="en"` when explaining the locale decision, so a looser assertion
    // would keep passing after the attribute was removed from the markup.
    expect(layout).toContain('<html lang="en">');
  });

  it('exposes the engines subpath from the module package', () => {
    const pkg = JSON.parse(readFileSync(join(moduleRoot, 'package.json'), 'utf8')) as {
      exports: Record<string, string>;
    };
    expect(pkg.exports['./engines']).toBe('./src/engines-public.ts');
  });

  it('keeps the engines subpath import graph pure (RSC-safe)', () => {
    const src = readFileSync(join(moduleRoot, 'src', 'engines-public.ts'), 'utf8');
    // The allow-list is the point of this test: the engines subpath must stay
    // free of data/, signing/, react, and @mylife/sync. Plan 48 WP8 adds three
    // pure modules to it (the ring detector, the report taxonomy, and the
    // screening engine); screening/index.ts re-exports only its own directory,
    // which this test walks transitively below.
    const allowed = new Set([
      './engines/diff',
      './engines/credibility',
      './engines/dupes',
      './engines/rings',
      './taxonomy',
      './screening',
      './models',
    ]);
    const specifiers = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(allowed.has(specifier), `unexpected import: ${specifier}`).toBe(true);
    }
    // The models re-export must be type-only (zod stays out of the RSC graph).
    const modelsUses = specifiers.filter((s) => s === './models');
    expect(modelsUses).toHaveLength(1);
    expect(/export\s+type\s*\{[\s\S]*?\}\s*from\s+['"]\.\/models['"]/.test(src)).toBe(true);
  });

  it('keeps the whole transitive engines closure free of the react-native graph', () => {
    // The direct allow-list above only guards one file. Anything that file pulls
    // in can still drag data/, signing/, react, or @mylife/sync into a Server
    // Component, so the closure is walked here. `./models` is excluded because
    // the re-export above is asserted to be type-only.
    const forbidden = [
      'react',
      'react-native',
      '@mylife/sync',
      '@mylife/db',
      '@noble/hashes',
      'zod',
      './data/',
      './signing/',
      '../data/',
      '../signing/',
    ];
    const seen = new Set<string>();
    const queue = ['src/engines-public.ts'];

    const resolveRelative = (fromFile: string, specifier: string): string | null => {
      if (!specifier.startsWith('.')) return null;
      const parts = fromFile.split('/');
      parts.pop();
      for (const segment of specifier.split('/')) {
        if (segment === '.') continue;
        if (segment === '..') parts.pop();
        else parts.push(segment);
      }
      const base = parts.join('/');
      for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
        if (existsSync(join(moduleRoot, candidate))) return candidate;
      }
      return null;
    };

    while (queue.length > 0) {
      const file = queue.shift()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const contents = readFileSync(join(moduleRoot, file), 'utf8');
      // Value imports only. `import type` / `export type` are erased by the
      // compiler, so they cannot drag anything into the runtime graph, and
      // following them would report false positives (taxonomy.ts type-imports a
      // union from models.ts, which does use zod at runtime).
      const imports = [
        ...contents.matchAll(/^(?:import|export)\s+(type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]/gm),
      ]
        .filter((match) => match[1] === undefined)
        .map((match) => match[2]!);
      for (const specifier of imports) {
        if (file === 'src/engines-public.ts' && specifier === './models') continue;
        for (const bad of forbidden) {
          const hit = bad.startsWith('.') ? specifier.startsWith(bad) : specifier === bad;
          expect(hit, `${file} must not import ${specifier}`).toBe(false);
        }
        const resolved = resolveRelative(file, specifier);
        if (resolved) queue.push(resolved);
      }
    }

    // The closure must actually contain the WP8 additions, so this test cannot
    // pass by walking nothing.
    expect(seen.has('src/screening/engine.ts')).toBe(true);
    expect(seen.has('src/engines/rings.ts')).toBe(true);
    expect(seen.has('src/taxonomy.ts')).toBe(true);
  });
});
