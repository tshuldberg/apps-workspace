# Meerkat Host — packaging (Plan 20, Phase 4.4)

Goal: turn the desktop host companion (`bin/meerkat-host.mjs` + `host/` + the real
`bin/*` service entrypoints) into ONE double-clickable per-OS executable, so a
non-technical user runs their own relay + community node without a terminal or a
Node install.

The bundle uses Node's built-in **Single Executable Application (SEA)** feature
(`node --experimental-sea-config`), so there is no third-party packer in the
supply chain. `sea-config.json` in this folder is the SEA input; `build.mjs` (the
stub below) is the build driver.

## What the build does (source path, reproducible)

1. Bundle `bin/meerkat-host.mjs` + `host/server.ts` + the three service bins
   (`meerkat-relay-server.mjs`, `meerkat-community-node.mjs`, `meerkat-node.mjs`)
   and their `../src` graph into a single CommonJS file
   (`dist/meerkat-host.cjs`) — e.g. with `esbuild --bundle --platform=node`.
   The bins are carried UNCHANGED; only the module graph is inlined.
2. Carry `host/ui/*` as SEA assets (the control panel serves them from the blob).
3. `node --experimental-sea-config host/build/sea-config.json` → `dist/meerkat-host.blob`.
4. Copy the running `node` binary and inject the blob with `postject`.

The result runs the SAME 127.0.0.1-only control panel and spawns the SAME real
bins; packaging changes only HOW the code is delivered, never what it does.

```bash
# from packages/meerkat-relay
node host/build/build.mjs            # produces host/build/dist/meerkat-host(.exe)
```

## FOUNDER-OPS (not done here, and not claimed)

This repo builds the config + driver only. The following are per-machine,
per-OS, credential-bearing steps that must run on each target OS by the founder:

- **Per-OS executables.** A SEA build produces a binary for the OS it runs on.
  macOS (arm64 + x64), Windows (x64), and Linux (x64) each need their own build
  host or cross-CI matrix. This repo does NOT cross-compile and does not claim
  cross-OS output from one machine.
- **Code signing + notarization.** macOS requires an Apple Developer ID signature
  + notarization (`codesign` + `notarytool`); Windows requires an Authenticode
  signature. Unsigned binaries are gatekept/SmartScreen-blocked. Signing keys are
  founder-held secrets and are never committed.
- **Auto-update + installer packaging** (`.dmg` / `.msi` / `.AppImage`).

Until those run, this produces an unsigned local binary for development only.
`bin/meerkat-host.mjs` remains the honest way to run the companion from source
(`tsx bin/meerkat-host.mjs`).
