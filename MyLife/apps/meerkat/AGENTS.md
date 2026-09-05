# Meerkat app

- Use `@mylife/sync` for crypto and node behavior. Configure secure persistent secrets and the native PRNG before database/identity startup through the shared boot path; foreground and background use the same database contract.
- Internal files and SQLite use `data/private-storage.ts`: standalone iOS stores private work in `Library/Application Support/MeerkatPrivate/`. Foreground/headless boot migrates and recovers before SQLite opens; conflicts fail closed. Only explicit exports use `Documents/Meerkat Exports/`. Never add a standalone iOS Documents fallback.
- Keep native architecture and transport compatibility pinned to the validated app configuration. Expo Go or an unsupported transport must fail honestly; UI states require real connection/transfer evidence.
- Required encryption and signature verification fail closed. Never downgrade negotiation or accept invalid recipient/signature/key material to make a flow succeed.
- Keep verification accounts, public identity, private persona/device identity, and their key stores separated. Do not create joinable identifiers or leak account material into private mesh flows.
- Local settings, DM/intake bookkeeping, and declared device-local tables do not replicate. Preserve sync scopes, signed-byte compatibility, membership/key-epoch checks, and metadata privacy.
- Keep the public/private identity distinction in user copy. Follow the verified copy contract when present; do not weaken its regression checks.
- Protocol and native-boundary details: `docs/meerkat-contracts.md`. Preserve its constraints when editing the corresponding code.
- From the MyLife root, run the Meerkat app typecheck/tests and relevant sync/relay tests; run `pnpm check:meerkat-parity` for paired behavior. Native transport claims need native-device evidence, not only mocks or Expo Go.
