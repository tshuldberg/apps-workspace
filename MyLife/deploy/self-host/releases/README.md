# Self-Host Release Bundles

Store versioned self-host release zip archives here.

Naming convention:
- `<bundle-id>.zip`

Example:
- `self-host-v1.zip`

Bundle download links issued by `/api/access/bundle/issue` and billing webhook provisioning
resolve files from this directory.

Security notes:
- Keep this directory server-side only.
- Do not expose it as a static public directory.
- Access should happen only via signed token route: `/api/access/bundle/download?token=...`.
