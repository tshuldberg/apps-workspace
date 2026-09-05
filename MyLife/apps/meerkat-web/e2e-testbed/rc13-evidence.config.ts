import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: fileURLToPath(new URL('.', import.meta.url)),
  testMatch: 'rc13-evidence.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  use: {
    trace: 'retain-on-failure',
    // The LAN testbed serves plain HTTP; SubtleCrypto (identity keygen) needs a
    // secure context, so tell Chromium to treat the testbed origin as secure --
    // exactly what a phone tester does via chrome://flags in the tester guide.
    launchOptions: {
      args: [
        `--unsafely-treat-insecure-origin-as-secure=${process.env.TESTBED_ORIGIN ?? 'http://127.0.0.1:8899'}`,
      ],
    },
  },
});
