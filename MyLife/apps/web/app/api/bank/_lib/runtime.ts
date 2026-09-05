import { getBankSyncServerRuntime } from '@mylife/budget';

export async function getBankApiRuntime() {
  return getBankSyncServerRuntime({
    env: process.env as Record<string, string | undefined>,
  });
}
