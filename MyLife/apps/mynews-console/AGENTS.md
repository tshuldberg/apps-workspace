# mynews-console

- Service-role secrets stay server-only. Each page/action requires the moderator allowlist, active role, and MFA; middleware alone is insufficient.
- Use audited moderation RPCs and database-derived report targets. Preserve two-person approval for high-risk actions, append-only audit-chain integrity, and keyset pagination.
- Keep the single-nonce CSP and honest health/support failure states. Follow docs/runtime-contracts.md for every affected security boundary.
