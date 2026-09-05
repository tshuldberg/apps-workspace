# mynews-web

- Public-reader server code uses server-safe deep imports from @mylife/mynews/cloud-fetch or engines, not native/client barrels.
- Secrets/JWTs remain server-only; preserve cookie/session boundaries and nonce CSP. Outages are not empty results or 404s.
- Copy and recovery/auth options reflect real configured capabilities. Preserve author-signature and reporting safety contracts.
- Follow docs/runtime-contracts.md for account, cache, data-access, and security-header changes; run relevant web/parity checks.
