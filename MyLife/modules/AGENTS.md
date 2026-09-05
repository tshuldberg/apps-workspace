# Hub modules

- Keep platform-independent domain logic here; mobile/web presentation belongs in the app surfaces.
- Preserve the ModuleDefinition contract, table-prefix isolation, syncPolicy, and registry/release-state wiring. Read current source for metadata instead of copying counts or schema versions into instructions.
- Enabling applies the required migrations; disabling preserves data. Do not rewrite shipped migrations.
- Read the module's definition, schema, and relevant tests before changing its storage or sync boundary. Privacy-sensitive data must retain its declared scope and conflict-resolution requirements.
- A standalone adapter is not proof of full product parity. Preserve explicit app-specific ownership and parity exceptions.

- Preserve local-only privacy promises: reading social is opt-in and off by default; private shopping intent and GPS trails do not upload by default. Do not infer active standalone ownership from an old module inventory.
