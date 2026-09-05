# bestchef

- The standalone owns BestChef; hub recipes surfaces intentionally adapt only the shared local kitchen. Do not claim full cloud-social parity.
- Public flows are Supabase-backed with RLS and server entitlements; mesh is not launch-critical. Preserve private submission media and signed URLs.
- Keep the moderator console isolated and service-role credentials server-only. Preserve the user-JWT versus worker-secret deployment split and production environment/fixture gates.
- Follow docs/runtime-contracts.md for cloud, upload, reporting, i18n, and build-boundary changes; use existing app and parity checks.
