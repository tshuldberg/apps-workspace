# bestchef-console

- This is a separate internal console. Service-role credentials stay server-only; requireModerator runs for every page and action, not only middleware.
- Moderation uses the audited shared decision/RPC seams, not direct content-status writes. Preserve fail-closed moderator allowlisting.
- Aggregate counters are metadata-only; no individual event trails or client tracking SDK. The console stays English-only and separate from public-app i18n.
- Follow docs/runtime-contracts.md for authorization, moderation, and aggregate-metric changes.
