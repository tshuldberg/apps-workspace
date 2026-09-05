# The Marlin Traders

- External services, including market data, auth, billing, and brokers, stay behind provider adapters.
- Indicator calculations, parsing, and aggregation run in workers rather than blocking the UI thread. Preserve push-based live data where supported.
- Validate the affected surface with its existing type/lint/unit/browser checks; use package manifests and architecture docs for commands and integration details.
