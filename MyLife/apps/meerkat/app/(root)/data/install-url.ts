// install-url.ts: build-time install/download URL for share envelopes
// (invite-envelope-core.ts). Read from app.config.ts `extra.installUrl`
// (env MEERKAT_INSTALL_URL), mirroring the DEFAULT_RELAY_URL pattern in
// sync-core.ts: expo-constants is RN-only, so under node/vitest the require
// throws and we fall back to '' -- an unconfigured build simply omits the
// install step from envelopes instead of shipping a placeholder link.
// Web mirror: apps/meerkat-web/src/lib/install-url.ts (VITE_MEERKAT_INSTALL_URL).

function readInstallUrl(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const extra = (require('expo-constants').default?.expoConfig?.extra ?? {}) as {
      installUrl?: unknown;
    };
    return typeof extra.installUrl === 'string' ? extra.installUrl.trim() : '';
  } catch {
    return '';
  }
}

export const INSTALL_URL: string = readInstallUrl();
