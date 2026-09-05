import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');

describe('mynews-web report surface', () => {
  it('ships the report route handler and client component', () => {
    for (const file of ['app/api/report/route.ts', 'app/components/ReportButton.tsx']) {
      expect(existsSync(join(root, file)), file).toBe(true);
    }
  });

  it('the report button is a client component', () => {
    const src = readFileSync(join(root, 'app/components/ReportButton.tsx'), 'utf8');
    expect(src.startsWith("'use client'")).toBe(true);
  });

  it('imports runtime report values only from the cloud-fetch subpath', () => {
    const button = readFileSync(join(root, 'app/components/ReportButton.tsx'), 'utf8');
    const route = readFileSync(join(root, 'app/api/report/route.ts'), 'utf8');
    for (const src of [button, route]) {
      // No package barrel import (react-native hazard); subpath only.
      expect(/from\s+['"]@mylife\/mynews['"]/.test(src)).toBe(false);
      expect(src.includes('@mylife/mynews/cloud-fetch')).toBe(true);
    }
  });

  it('wires a Report affordance onto the article, suggestions, and journalist pages', () => {
    for (const route of [
      'app/a/[slug]/page.tsx',
      'app/a/[slug]/suggestions/page.tsx',
      'app/j/[handle]/page.tsx',
    ]) {
      const src = readFileSync(join(root, route), 'utf8');
      expect(src.includes('ReportButton'), `${route} must render ReportButton`).toBe(true);
    }
  });

  it('the route handler forwards to the mynews-report function and never fakes success', () => {
    const src = readFileSync(join(root, 'app/api/report/route.ts'), 'utf8');
    expect(src.includes('functions/v1/mynews-report')).toBe(true);
    // Unconfigured is an honest error, not a fabricated ok.
    expect(src.includes("error: 'not-configured'")).toBe(true);
  });
});
