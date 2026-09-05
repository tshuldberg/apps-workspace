# MyTalk

- Independent local developer tool, not a MyLife module; no hub parity obligation. Runtime uses Node built-ins only.
- Speech uses macOS-native on-device recognition and say. No cloud speech or bundled speech models.
- If the brain transport is unavailable, announce the verbatim fallback honestly.
- Tests use injected effects and never touch the real mic, network, osascript, tmux, codex, or ~/.claude paths.
- Preserve transcript turn boundaries and ignore sidechain records; contract is in docs/spec.md.
- Validate with `pnpm build`, `pnpm test`, and `pnpm typecheck` as applicable.
