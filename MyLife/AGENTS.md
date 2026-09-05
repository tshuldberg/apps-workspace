# MyLife

- Keep standalone app runtime code under its own `apps/<app>/` tree. Archived standalones are historical references, not active parity targets.
- Active standalone apps own their paired product behavior. Update both surfaces when the authorized change affects both; record a real parity gap instead of claiming completeness. BestChef's hub recipes surface is intentionally a scoped adapter. FlashCards permits a tracked follow-up backport; TrainWithRyan is independent and has no MyLife parity obligation.
- Module registration is defined by `packages/module-registry` and each module's `src/definition.ts`. Disabling a module must preserve its data. Preserve release visibility until an authorized release change.
- Keep private local data local by default. Preserve explicit opt-in sharing and documented server-backed product exceptions; do not introduce telemetry or widen data exposure silently.
- Use `packages/sync` for mesh behavior. Every synced entity needs a declared policy and maxScope; sensitive shared-workspace data requires fingerprint-verified pairing. See `docs/designs/mesh-sync-architecture.md` and `docs/designs/mesh-sync-module-policy-matrix.md` when changing this boundary.
- BestChef public flows use Supabase Auth, RLS, Storage, and Edge Functions. Do not make mesh transport launch-critical or treat the local cache as the public authoritative store. Preserve other apps' declared server-backed boundaries.
- Use shared UI tokens from `packages/ui/src/tokens`; keep server-side imports free of native/client-only barrels.
- Run `pnpm gate:function:changed` for function-logic changes, plus the applicable parity checks when changing paired surfaces or registration. Existing pre-commit checks remain authoritative.
- Do not enable, invoke, recommend, or depend on CodeRabbit for MyLife work.
- Treat `docs/business-plan/` as historical snapshots unless refreshed. Verify current claims against current source or evidence rather than repeating old counts, pricing, or readiness claims.
- Keep generated performance output out of tracked docs; use `artifacts/perf-audit` and the existing artifact gate.
