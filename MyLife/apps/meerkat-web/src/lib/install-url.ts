// install-url.ts (web mirror of apps/meerkat/app/(root)/data/install-url.ts):
// build-time install/download URL for share envelopes
// (invite-envelope-core.ts), read from VITE_MEERKAT_INSTALL_URL. An
// unconfigured build simply omits the install step from envelopes instead of
// shipping a placeholder link.

export const INSTALL_URL: string = (
  import.meta.env.VITE_MEERKAT_INSTALL_URL ?? ''
).trim();
