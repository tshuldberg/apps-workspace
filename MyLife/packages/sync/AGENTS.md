# Sync substrate

- Keep the native-facing import surface free of Node-only module-load dependencies.
- Encryption-required flows fail closed. Verify signed frames, recipients, scope caps, and key epochs; never widen policy during transport negotiation.
- Sensitive shared workspaces require verified pairing. An open-join membership grant is not a grant to an epoch key.
- Preserve canonical signed bytes and backward compatibility, including owner descriptors and public snapshots. Verify public snapshots independently before trusting their content.
- Keep crypto, scope policy, and transport contracts in this package rather than parallel implementations in clients.
- Preserve the tweetnacl-util default-import/destructure interop where required by the native bundle.
- Run affected package tests and cross-client integration tests for protocol changes. Mock transport success alone does not establish interoperability.

- Detailed signed-descriptor, public-snapshot, and layering contracts: `docs/protocol-contracts.md`. Consult the relevant section for protocol changes.
