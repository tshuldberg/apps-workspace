import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = path.resolve(process.cwd(), 'app');

describe('native launch routes', () => {
  it('pins the root scheme URL to the BestChef tabs route', () => {
    const source = readFileSync(path.join(APP_DIR, 'index.tsx'), 'utf8');

    expect(source).toContain('<Redirect href="/(root)/(tabs)" />');
  });

  it('keeps auth callback URLs inside the cloud provider tree', () => {
    const layout = readFileSync(path.join(APP_DIR, '(root)', '_layout.tsx'), 'utf8');
    const callback = readFileSync(path.join(APP_DIR, '(root)', 'auth-callback.tsx'), 'utf8');

    expect(layout).toContain('<Stack.Screen name="auth-callback" />');
    expect(callback).toContain("router.replace('/(tabs)')");
  });
});
