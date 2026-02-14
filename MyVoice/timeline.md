# MyVoice -- Timeline

## 2026-02-14 -- Waveform Bootstrap Hardening

**What:** Hardened overlay boot/runtime diagnostics to unblock "audio levels present but no waveform rendered" reports.

**Changes:**
- Removed renderer dependencies on relative `require('../shared/...')` module paths in `overlay.ts`; IPC channel names and waveform constants are now local in the renderer script so it can boot reliably from file-based HTML.
- Added compatibility fallbacks in renderer boot:
  - auto-create missing waveform containers (`#waveform-bars`, `#mini-waveform-bars`)
  - tolerate missing optional controls (`btn-minimize`, `btn-expand`)
  - fallback hidden status/transcript/debug nodes to prevent hard crashes on markup drift.
- Added explicit overlay boot markers on `window`:
  - `__myvoice_overlay_booted`
  - `__myvoice_overlay_boot_error`
- Added main-process overlay DOM snapshots after `did-finish-load` and `overlay:ready` to verify live renderer state from terminal logs.
- Updated overlay console bridging to handle Electron v40 console-message argument shape changes, so renderer errors are consistently mirrored in main logs.
- Added throttled telemetry for outbound `dictation:audio-level` IPC sends from main to renderer.

**Validation:**
- `npm run build:ts` passed.
- `npm test` passed (4 tests).
- `npm run build` passed (native + TypeScript).

## 2026-02-14 -- Waveform Recovery + Local Formatting Pipeline

**What:** Fixed non-animating overlay waveform, added live waveform calibration controls, and introduced local transcript formatting modes (offline by default).

**Changes:**
- Fixed renderer script path so overlay waveform renderer actually loads.
- Added overlay renderer readiness handshake (`overlay:ready`) and main-process diagnostics for failed loads / renderer exits.
- Fixed overlay startup race where `overlay:ready` could be missed and `dictation:start` would not fire (causing static "Listening..." with no waveform animation).
- Changed overlay mouse-event handling to keep clicks on overlay controls instead of forwarding them to underlying windows (fixes minimize button affecting other apps).
- Added waveform render recovery path: first incoming audio level now auto-enables recording animation even if start event was missed.
- Added canvas bar-drawing fallback when `roundRect` is unavailable.
- Replaced renderer waveform loop with fixed-timer rendering plus per-audio-level redraw to avoid transparent-window `requestAnimationFrame` throttling edge cases.
- Fixed renderer crash (`exports is not defined`) by removing TypeScript `import` module emission from script-tag overlay runtime and switching to `require` + local type declarations.
- Replaced canvas waveform rendering with deterministic DOM bar rendering in both expanded and minimized overlay states (Old.mov-style behavior).
- Added waveform config IPC (`waveform:config`) and runtime broadcast from main to renderer.
- Added persisted visualization settings (`low|balanced|high` sensitivity, debug overlay toggle).
- Added tray controls for waveform sensitivity and debug overlay.
- Implemented adaptive waveform normalization in renderer:
  - sensitivity profiles
  - dynamic peak tracking + decay
  - level smoothing
  - "Listening... (no input)" hint when no signal is detected.
- Added on-overlay debug panel (optional) with live raw/mapped/peak/floor telemetry.
- Added persisted transcript formatting settings (`off|basic|structured` plus optional AI toggle flag).
- Added local transcript formatter module:
  - spacing and sentence cleanup
  - paragraph splitting heuristics
  - ordinal list inference (`first/second/third` -> numbered list).
- Wired formatter into dictation pipeline before clipboard paste.
- Added Node test coverage for formatter behavior (`tests/transcript-formatter.test.mjs`) and updated `npm test` to run the suite.

**Validation:**
- `npm run build:ts` passed.
- `npm run build` (native + TypeScript) passed.
- `npm test` passed (4 formatter tests).

**Design decisions:**
- Kept formatting fully local/offline by default to preserve privacy-first behavior.
- Added AI enhancement as an opt-in setting stub with explicit local fallback (no provider wired yet).
- Added runtime waveform calibration in tray to avoid rebuilding for quiet/loud microphone environments.

## 2026-02-13 -- Project Created

**What:** Designed and built MyVoice from scratch as a privacy-first macOS dictation app.

**Changes:**
- Created project scaffold: Electron + TypeScript + Objective-C native addon
- Implemented three native bridges: SpeechBridge (SFSpeechRecognizer + AVAudioEngine), HotkeyBridge (NSEvent fn double-tap detection), KeyboardBridge (CGEvent keystroke simulation)
- Built N-API addon wrapper (addon.mm) bridging Objective-C to Node.js
- Created TypeScript wrappers for the native addon
- Built floating pill overlay with waveform visualization (10 bars, 20 FPS, smoothed)
- Implemented dictation controller state machine (idle -> recording -> stopping)
- Created system tray with status display, launch-at-login toggle, quit
- Wired end-to-end flow: fn double-tap -> speech capture -> overlay display -> text injection
- Added project documentation: CLAUDE.md, README.md, timeline.md

**Design decisions:**
- Used Objective-C instead of Swift for native bridges (eliminates Swift-ObjC bridging complexity, same macOS APIs)
- On-device recognition only (`requiresOnDeviceRecognition = YES`) for absolute privacy
- 400ms double-tap threshold for fn key to avoid conflict with emoji picker
- 1.5s silence timeout for auto-stop, configurable in future
- Electron chosen for fast iteration; native Swift rewrite planned for v2 App Store distribution
