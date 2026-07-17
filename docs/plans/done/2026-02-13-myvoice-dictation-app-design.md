# MyVoice — macOS Dictation App Design

**Date:** 2026-02-13
**Status:** Approved
**Author:** Trey + Claude Code

---

## 1. Product Overview

**MyVoice** is a free, privacy-first macOS dictation application. It lets you dictate text into any text field in any application on your Mac by double-tapping the `fn` key. A floating pill-shaped overlay appears with a real-time audio waveform visualization, and your spoken words are transcribed and typed into the focused text field.

### Why MyVoice Exists

Existing dictation tools have problems:

| Tool | Problem |
|------|---------|
| **Wispr** | Subscription-based ($10/mo+), sends voice data to cloud servers |
| **Superwhisper** | Subscription-based, requires Whisper model download, cloud processing option |
| **macOS Built-in Dictation** | Unreliable, clunky UI, sends data to Apple by default |
| **Google Voice Typing** | Browser-only, requires Google account, cloud-dependent |

**MyVoice solves all of these:** Free, on-device processing via Apple's Speech framework, no cloud services, no subscriptions, no data collection. Your voice never leaves your Mac.

### Target Users

- **Primary:** Trey (personal productivity tool for fast text input across all apps)
- **Secondary:** Mac users who want free, private dictation (potential Mac App Store distribution)

---

## 2. Core Requirements

### 2.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Double-tap `fn` key activates/deactivates dictation globally | P0 |
| FR-02 | Floating pill overlay appears when dictation is active | P0 |
| FR-03 | Real-time audio waveform visualization in the overlay | P0 |
| FR-04 | Speech-to-text transcription using Apple Speech framework (on-device) | P0 |
| FR-05 | Transcribed text is typed into the previously-focused text field via simulated keystrokes | P0 |
| FR-06 | Auto-stop after 1.5 seconds of silence | P0 |
| FR-07 | Manual stop via second double-tap of `fn` | P0 |
| FR-08 | Menu bar (tray) icon for settings and quit | P0 |
| FR-09 | First-launch permission guide (Microphone, Accessibility, Speech Recognition) | P1 |
| FR-10 | Live partial transcription preview in the overlay as user speaks | P1 |
| FR-11 | Configurable silence timeout (default 1.5s) | P2 |
| FR-12 | Configurable hotkey (alternative to fn double-tap) | P2 |
| FR-13 | History of recent dictations (viewable from tray menu) | P3 |

### 2.2 Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | **Privacy:** Zero network calls for speech processing. All transcription on-device. No analytics, no telemetry, no cloud. |
| NFR-02 | **Performance:** Overlay appears within 200ms of hotkey activation. Audio capture starts within 100ms of overlay appearing. |
| NFR-03 | **Reliability:** Works in all standard macOS text fields (Safari, Chrome, VS Code, Slack, iMessage, Notes, Terminal, etc.) |
| NFR-04 | **Resource usage:** Idle CPU < 1%, active CPU < 15%, RAM < 100MB idle / < 200MB active |
| NFR-05 | **Compatibility:** macOS 13 (Ventura) and later. Apple Silicon and Intel. |
| NFR-06 | **Installation:** Standard `.dmg` drag-to-Applications install. No Homebrew or CLI required. |

---

## 3. Architecture

### 3.1 Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Runtime** | Electron 33+ | Cross-platform desktop framework, TypeScript-native, matches workspace conventions |
| **Language** | TypeScript 5.9 | Consistent with macos-hub and automation-hub projects |
| **Native Addon** | Swift via node-addon-api | Required for SFSpeechRecognizer, AVAudioEngine, CGEvent, NSEvent |
| **UI Framework** | Vanilla HTML/CSS/TS | The overlay is tiny (~50px tall pill). No framework needed. |
| **Build Tool** | electron-builder | Standard Electron packaging for `.dmg` distribution |
| **Package Manager** | npm | Consistent with workspace projects |

### 3.2 Directory Structure

```
MyVoice/
├── package.json                 # Project manifest, scripts
├── tsconfig.json                # TypeScript configuration
├── electron-builder.json        # Packaging/distribution config
├── CLAUDE.md                    # Project instructions for Claude Code
├── timeline.md                  # Change tracking
├── README.md                    # User-facing documentation
│
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry point, tray setup, lifecycle
│   │   ├── hotkey.ts            # Global fn double-tap detection (wraps native)
│   │   ├── overlay-window.ts    # Floating pill BrowserWindow management
│   │   ├── text-injector.ts     # Keystroke simulation (wraps native CGEvent)
│   │   ├── speech-engine.ts     # Speech recognition orchestration (wraps native)
│   │   └── ipc-handlers.ts      # IPC channel registration and handlers
│   │
│   ├── renderer/                # Overlay UI (floating pill)
│   │   ├── index.html           # Overlay HTML shell
│   │   ├── overlay.ts           # Waveform rendering, state display, animations
│   │   └── overlay.css          # Pill styling, vibrancy, animations
│   │
│   ├── native/                  # Swift native addon
│   │   ├── Package.swift        # Swift package manifest
│   │   ├── Sources/
│   │   │   ├── SpeechBridge.swift    # SFSpeechRecognizer + AVAudioEngine wrapper
│   │   │   ├── KeyboardBridge.swift  # CGEvent keystroke simulation
│   │   │   ├── HotkeyBridge.swift    # NSEvent global monitor for fn key
│   │   │   └── NodeBinding.swift     # node-addon-api bindings (exports to JS)
│   │   └── binding.gyp          # node-gyp build config for native addon
│   │
│   └── shared/
│       ├── types.ts             # IPC message types, shared interfaces
│       └── constants.ts         # App-wide constants (timeouts, dimensions, etc.)
│
├── assets/
│   ├── tray-icon.png            # Menu bar icon (16x16, 32x32 @2x)
│   ├── tray-icon-active.png     # Menu bar icon when recording
│   └── dmg-background.png       # Background for .dmg installer
│
└── tests/
    ├── speech-engine.test.ts    # Speech engine unit tests
    ├── hotkey.test.ts           # Hotkey detection tests
    └── text-injector.test.ts    # Text injection tests
```

### 3.3 Process Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                  │
│                                                           │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ hotkey.ts │→│speech-engine │→│  text-injector.ts   │ │
│  │(fn detect)│  │   .ts        │  │  (CGEvent typing)  │ │
│  └──────────┘  └──────┬───────┘  └────────────────────┘ │
│       ↑               │                                   │
│  ┌────┴────┐    IPC ↓↑ channels                          │
│  │ Native  │         │                                    │
│  │ Addon   │         │                                    │
│  │ (Swift) │         │                                    │
│  └─────────┘         │                                    │
└──────────────────────┼────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │  Electron Renderer       │
          │  (Overlay BrowserWindow) │
          │                          │
          │  ┌──────────────────┐    │
          │  │   overlay.ts     │    │
          │  │  - Waveform bars │    │
          │  │  - Live text     │    │
          │  │  - State label   │    │
          │  └──────────────────┘    │
          └──────────────────────────┘
```

### 3.4 IPC Channels

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `dictation:start` | Main → Renderer | `{}` | Show overlay, start waveform |
| `dictation:stop` | Main → Renderer | `{ transcript: string }` | Fade out overlay |
| `dictation:audio-level` | Main → Renderer | `{ level: number }` (0.0-1.0) | Update waveform bars |
| `dictation:partial-text` | Main → Renderer | `{ text: string }` | Show live partial transcript |
| `dictation:cancel` | Main → Renderer | `{}` | User cancelled, dismiss without typing |

---

## 4. Core Flow (Detailed)

### 4.1 Activation Flow

```
1. User double-taps fn key (within 400ms window)
2. HotkeyBridge.swift detects via NSEvent.addGlobalMonitorForEvents(matching: .flagsChanged)
   - Tracks fn key up/down transitions
   - Measures time between two consecutive fn-down events
   - If < 400ms apart → trigger activation callback
3. Native addon fires callback to hotkey.ts
4. hotkey.ts checks state:
   - If IDLE → transition to RECORDING, emit dictation:start
   - If RECORDING → transition to STOPPING, emit dictation:stop
5. speech-engine.ts starts recording:
   a. AVAudioEngine installs tap on input node (microphone)
   b. SFSpeechRecognizer creates recognition task
   c. Audio buffer flows to both:
      - SFSpeechRecognizer for transcription
      - IPC channel for waveform levels (RMS calculation → 0.0-1.0)
6. overlay-window.ts creates/shows BrowserWindow:
   - Frameless, transparent, always-on-top
   - Position: centered horizontally, 200px from top
   - Size: 320x56px (pill shape)
   - Level: NSWindow.Level.floating (above all apps)
   - Ignores mouse events outside pill bounds
```

### 4.2 During Dictation

```
1. Audio samples arrive at ~100Hz from AVAudioEngine tap
2. Every 50ms: RMS level calculated, sent via dictation:audio-level
3. Renderer updates 10 waveform bars with smoothed amplitude values
4. SFSpeechRecognizer fires partial results as words are recognized
5. Partial text sent via dictation:partial-text
6. Renderer shows partial text below waveform (truncated to fit pill width)
7. Silence detection timer runs:
   - Reset on every audio frame above threshold (RMS > 0.02)
   - After 1.5s continuous silence → auto-stop
```

### 4.3 Completion Flow

```
1. Dictation stops (silence timeout OR second fn double-tap)
2. SFSpeechRecognizer returns final transcript
3. speech-engine.ts sends final transcript to text-injector.ts
4. text-injector.ts:
   a. Waits 100ms for overlay to start dismissing
   b. Uses CGEvent to simulate keystrokes for each character
   c. Characters typed at ~50 chars/sec (20ms between keystrokes)
   d. Handles special characters, newlines, Unicode
5. overlay-window.ts fades out overlay (200ms animation)
6. State returns to IDLE
```

### 4.4 Cancellation Flow

```
1. User presses Escape during dictation
2. OR user clicks the X button on the pill overlay
3. dictation:cancel sent to renderer
4. Speech recognition stopped, transcript discarded
5. No text injected
6. Overlay fades out
```

---

## 5. Native Addon Specification

The native addon is the most critical component. It bridges three macOS APIs that JavaScript cannot access directly.

### 5.1 SpeechBridge (SFSpeechRecognizer)

```swift
// Exports to Node.js:
class SpeechBridge {
    func startRecognition(locale: String, onPartialResult: (String) -> Void, onFinalResult: (String) -> Void, onAudioLevel: (Float) -> Void, onError: (String) -> Void)
    func stopRecognition()
    func isAvailable() -> Bool
    func requestAuthorization(callback: (Bool) -> Void)
}
```

**Key constraints:**
- Uses `.onDeviceRecognition` to ensure no network calls
- Locale defaults to `en-US` but configurable
- Audio format: 16kHz, mono, Float32 (what SFSpeechRecognizer expects)

### 5.2 KeyboardBridge (CGEvent)

```swift
// Exports to Node.js:
class KeyboardBridge {
    func typeText(text: String, delayMs: Int)  // Simulate keystrokes
    func typeKey(keyCode: Int, flags: Int)      // Single key with modifiers
    func checkAccessibilityPermission() -> Bool
    func requestAccessibilityPermission()       // Opens System Preferences
}
```

**Key constraints:**
- Requires Accessibility permission in System Preferences
- Uses `CGEvent(keyboardEventSource:virtualKey:keyDown:)` for each character
- Handles Unicode by using `CGEvent.keyboardSetUnicodeString()`
- 20ms delay between keystrokes to avoid dropped characters

### 5.3 HotkeyBridge (NSEvent)

```swift
// Exports to Node.js:
class HotkeyBridge {
    func startMonitoring(onDoubleTapFn: () -> Void)
    func stopMonitoring()
}
```

**Key constraints:**
- Uses `NSEvent.addGlobalMonitorForEvents(matching: .flagsChanged)`
- Detects fn key specifically via `event.modifierFlags.contains(.function)`
- Double-tap window: 400ms between two fn key-down events
- Must debounce to avoid triple-tap false positives

---

## 6. Overlay UI Specification

### 6.1 Visual Design

```
┌──────────────────────────────────────────────┐
│  ▎▎▎▎▎▎▎▎▎▎  Listening...                   │
│  ████████████                                 │
│  (waveform)   Hello this is what I'm saying   │
└──────────────────────────────────────────────┘
```

**Dimensions:** 320px wide x 56px tall (expands to 72px when showing live text)
**Border radius:** 24px (pill shape)
**Background:** `rgba(30, 30, 30, 0.85)` with `backdrop-filter: blur(20px)` (vibrancy)
**Border:** 1px solid `rgba(255, 255, 255, 0.1)`
**Shadow:** `0 8px 32px rgba(0, 0, 0, 0.4)`

### 6.2 Waveform Bars

- **Count:** 10 vertical bars
- **Width:** 3px each, 4px gap
- **Height:** Varies from 4px (silence) to 28px (max volume)
- **Color:** Gradient from `#4A9EFF` (blue) to `#7B61FF` (purple)
- **Animation:** CSS transition `height 80ms ease-out` for smooth modulation
- **Update rate:** 20 FPS (every 50ms via IPC)

### 6.3 Text Elements

- **"Listening..." label:** 12px, `rgba(255, 255, 255, 0.6)`, appears on activation
- **Live transcript:** 13px, `rgba(255, 255, 255, 0.9)`, appears as words are recognized
- **Font:** System font (SF Pro via `-apple-system`)

### 6.4 Animations

- **Appear:** Fade in + scale from 0.95 to 1.0, 150ms ease-out
- **Dismiss:** Fade out + scale from 1.0 to 0.95, 200ms ease-in
- **Waveform idle:** Gentle breathing animation (bars pulse 4-8px) when listening but no speech detected

---

## 7. Permissions & First Launch

### 7.1 Required Permissions

| Permission | macOS API | When Requested | What Happens Without It |
|-----------|-----------|----------------|------------------------|
| **Microphone** | `AVCaptureDevice.requestAccess(for: .audio)` | First activation | Cannot capture audio |
| **Speech Recognition** | `SFSpeechRecognizer.requestAuthorization()` | First activation | Cannot transcribe |
| **Accessibility** | `AXIsProcessTrusted()` | First activation | Cannot type into text fields |

### 7.2 First Launch Flow

1. App starts → menu bar icon appears
2. User double-taps fn for the first time
3. App checks permissions sequentially:
   - If Microphone not granted → show macOS permission dialog
   - If Speech Recognition not granted → show macOS permission dialog
   - If Accessibility not granted → show alert with "Open System Preferences" button
4. Once all granted → dictation starts normally
5. Permissions cached — subsequent launches skip this flow

---

## 8. Menu Bar (Tray) Interface

### 8.1 Tray Icon

- **Idle:** Microphone icon, 16x16px, template image (adapts to light/dark mode)
- **Recording:** Microphone icon with pulsing red dot overlay

### 8.2 Tray Menu

```
🎤 MyVoice
─────────────
Status: Ready (or "Recording...")
─────────────
Settings
  ├── Silence timeout: 1.5s  [▾]
  ├── Launch at login: ☐
  └── Hotkey: Double-tap fn
─────────────
About MyVoice
Quit
```

---

## 9. Error Handling

| Scenario | Behavior |
|----------|----------|
| Microphone permission denied | Show notification: "MyVoice needs microphone access. Open System Preferences → Privacy → Microphone" |
| Accessibility permission denied | Show notification with "Open System Preferences" action button |
| Speech recognition unavailable (no on-device model) | Show notification: "Please download the on-device speech model in System Preferences → Keyboard → Dictation" |
| Speech recognition fails mid-dictation | Stop recording, show brief error in overlay, no text injected |
| Target app doesn't accept keystrokes | Text typed but may not appear — this is a limitation of CGEvent with some sandboxed apps |
| Audio input device disconnected | Stop recording, show notification |

---

## 10. Tech Constraints & Risks

| Risk | Mitigation |
|------|-----------|
| **fn key interception** | NSEvent global monitor can observe fn but cannot prevent system handling. Double-tap avoids conflict with single fn (emoji picker). If macOS changes fn behavior in future, the hotkey is configurable. |
| **Electron binary size (~150MB)** | Acceptable for personal use. For App Store distribution, consider native Swift rewrite as v2. |
| **Native addon compilation** | Requires Xcode Command Line Tools on build machine. Pre-built binaries can be shipped for distribution. |
| **SFSpeechRecognizer accuracy** | On-device model is less accurate than cloud. Acceptable trade-off for privacy. Can add local Whisper as future enhancement. |
| **CGEvent in sandboxed apps** | Some apps (especially Mac App Store apps with strict sandboxing) may not respond to CGEvent keystrokes. This is a macOS limitation. Clipboard-paste fallback can be added later. |
| **Electron + native addon packaging** | electron-builder supports native addons via `rebuild`. Needs testing on both Apple Silicon and Intel. |

---

## 11. Agent Team Structure

| Agent | Role | Responsibilities |
|-------|------|-----------------|
| **CTO** | Technical Lead | Architecture decisions, native addon design, build system, code review, dependency selection |
| **CPO** | Product Lead | Feature prioritization, UX flow decisions, user experience review, acceptance criteria |
| **CMO** | Marketing Lead | App Store listing copy, README messaging, privacy positioning, competitive analysis vs Wispr/Superwhisper |
| **Tech Writer** | Documentation | CLAUDE.md, README.md, user guide, App Store description, inline code documentation, timeline.md |
| **Engineer 1** | Core Engine | Native Swift addon (SpeechBridge, KeyboardBridge, HotkeyBridge), main process, IPC wiring |
| **Engineer 2** | UI/Frontend | Overlay renderer, waveform visualization, CSS animations, tray menu, first-launch flow |

### Team Workflow

1. **CTO** reviews architecture and approves technical decisions
2. **CPO** reviews UX flows and approves feature scope
3. **CMO** prepares positioning and distribution strategy
4. **Tech Writer** produces documentation alongside development
5. **Engineers** implement in parallel (core engine + UI are independent until integration)
6. **CTO** conducts code review before merging

---

## 12. Build & Development Commands

```bash
# Development
npm install                    # Install dependencies
npm run build:native           # Compile Swift native addon
npm run dev                    # Start Electron in dev mode (hot reload)

# Testing
npm test                       # Run all tests
npm run test:native            # Test native addon bridge

# Packaging
npm run build                  # Full production build
npm run package                # Create .dmg for distribution
```

---

## 13. Success Criteria

- [ ] Double-tap fn activates dictation in < 200ms
- [ ] Floating pill appears with working waveform visualization
- [ ] Speech transcribed accurately on-device (no network calls)
- [ ] Transcribed text appears in the focused text field
- [ ] Works in Safari, Chrome, VS Code, Slack, Notes, Terminal, iMessage
- [ ] Auto-stops after 1.5s silence
- [ ] Menu bar tray icon with quit and settings
- [ ] Zero cloud dependencies — works fully offline
- [ ] Clean .dmg installer for distribution

---

## 14. Future Enhancements (Out of Scope for v1)

- Local Whisper model for higher accuracy (toggle between Apple Speech and Whisper)
- Voice commands ("delete that", "new line", "select all")
- Multi-language support
- Clipboard-paste fallback for sandboxed apps
- macos-hub MCP integration (start_dictation / stop_dictation tools)
- Mac App Store distribution (requires native Swift rewrite for sandboxing compliance)
- Custom wake word instead of fn double-tap
