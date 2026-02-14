# MyVoice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a privacy-first macOS dictation app (Electron + TypeScript + Swift native addon) that activates via double-tap fn, shows a floating waveform pill, transcribes speech on-device, and types the result into the focused text field.

**Architecture:** Electron app with a Swift native addon bridged through Objective-C++ (Swift → ObjC → ObjC++ → N-API → JS). Three native bridges: SpeechBridge (SFSpeechRecognizer + AVAudioEngine), HotkeyBridge (CGEventTap for fn detection), KeyboardBridge (CGEvent keystroke simulation). Frameless transparent BrowserWindow for the floating pill overlay.

**Tech Stack:** Electron 33+, TypeScript 5.9, Swift 5, node-addon-api, node-gyp, electron-builder, electron-rebuild

**Design doc:** `docs/plans/2026-02-13-myvoice-dictation-app-design.md`

---

## Agent Team Assignments

| Task Range | Agent | Role |
|-----------|-------|------|
| Tasks 1-3 | CTO | Project scaffold, build system, native addon config |
| Tasks 4-8 | Engineer 1 | Native Swift addon (Speech, Hotkey, Keyboard bridges) |
| Tasks 9-12 | Engineer 2 | Overlay UI, waveform, animations, tray menu |
| Tasks 13-15 | Engineer 1 | Main process integration, IPC wiring, end-to-end flow |
| Task 16 | CPO | UX review, acceptance testing against success criteria |
| Task 17 | CMO | Competitive positioning, README messaging, App Store strategy |
| Task 18 | Tech Writer | CLAUDE.md, README, timeline, user guide |
| Task 19 | CTO | Code review, packaging, distribution build |

---

## Task 1: Initialize Electron + TypeScript Project

**Owner:** CTO
**Files:**
- Create: `MyVoice/package.json`
- Create: `MyVoice/tsconfig.json`
- Create: `MyVoice/.gitignore`

**Step 1: Create project directory and initialize npm**

```bash
mkdir -p /Users/trey/Desktop/Apps/MyVoice
cd /Users/trey/Desktop/Apps/MyVoice
npm init -y
```

**Step 2: Install core dependencies**

```bash
npm install --save-dev electron@latest typescript@5.9 electron-builder electron-rebuild
npm install --save-dev @types/node
npm install node-addon-api
```

**Step 3: Create package.json with scripts**

Overwrite `package.json` with:

```json
{
  "name": "myvoice",
  "version": "0.1.0",
  "description": "Privacy-first macOS dictation app. Double-tap fn to dictate anywhere.",
  "main": "dist/main/index.js",
  "scripts": {
    "build:ts": "tsc",
    "build:native": "cd src/native && node-gyp rebuild",
    "build": "npm run build:native && npm run build:ts",
    "rebuild": "electron-rebuild -f -w myvoice-native",
    "dev": "npm run build && electron .",
    "start": "electron .",
    "package": "electron-builder --mac",
    "test": "echo 'No tests yet' && exit 0"
  },
  "author": "Trey",
  "license": "MIT",
  "devDependencies": {},
  "dependencies": {}
}
```

(Dependencies will be populated by npm install steps above.)

**Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "src/native"]
}
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
build/
*.node
.DS_Store
```

**Step 6: Create directory structure**

```bash
mkdir -p src/main src/renderer src/native/Sources src/native/include src/shared assets tests
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(myvoice): initialize Electron + TypeScript project scaffold"
```

---

## Task 2: Configure Native Addon Build System (binding.gyp)

**Owner:** CTO
**Files:**
- Create: `MyVoice/src/native/binding.gyp`
- Create: `MyVoice/src/native/include/SwiftBridge.h`
- Create: `MyVoice/src/native/Sources/BridgingHeader.h`

**Step 1: Create the Objective-C header for the Swift bridge**

File: `src/native/include/SwiftBridge.h`

```objc
#import <Foundation/Foundation.h>

// Speech recognition bridge
@interface SpeechBridge : NSObject
+ (void)requestAuthorization:(void (^)(BOOL granted))callback;
+ (BOOL)isAvailable;
+ (void)startRecognitionWithLocale:(NSString *)locale
                   onPartialResult:(void (^)(NSString *text))partialCallback
                     onFinalResult:(void (^)(NSString *text))finalCallback
                      onAudioLevel:(void (^)(float level))levelCallback
                           onError:(void (^)(NSString *error))errorCallback;
+ (void)stopRecognition;
@end

// Hotkey (fn double-tap) bridge
@interface HotkeyBridge : NSObject
+ (void)startMonitoringWithCallback:(void (^)(void))doubleTapCallback;
+ (void)stopMonitoring;
@end

// Keyboard simulation bridge
@interface KeyboardBridge : NSObject
+ (void)typeText:(NSString *)text delayMs:(int)delay;
+ (BOOL)checkAccessibilityPermission;
+ (void)requestAccessibilityPermission;
@end
```

**Step 2: Create the Swift bridging header**

File: `src/native/Sources/BridgingHeader.h`

```objc
// This header is imported by Swift code to access Objective-C types
#import <Foundation/Foundation.h>
```

**Step 3: Create binding.gyp**

File: `src/native/binding.gyp`

```python
{
  "targets": [
    {
      "target_name": "myvoice_native",
      "sources": [
        "Sources/addon.mm",
        "Sources/SpeechBridgeImpl.m",
        "Sources/HotkeyBridgeImpl.m",
        "Sources/KeyboardBridgeImpl.m"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "libraries": [
        "-framework Foundation",
        "-framework AppKit",
        "-framework Speech",
        "-framework AVFoundation",
        "-framework CoreGraphics",
        "-framework ApplicationServices"
      ],
      "xcode_settings": {
        "CLANG_ENABLE_OBJC_ARC": "YES",
        "MACOSX_DEPLOYMENT_TARGET": "13.0",
        "OTHER_CFLAGS": ["-ObjC"],
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17"
      }
    }
  ]
}
```

**Note on approach change:** After research, we're using Objective-C directly (not Swift) for the native bridge implementations. This eliminates the Swift → ObjC compilation complexity while keeping the same macOS APIs (SFSpeechRecognizer, CGEvent, NSEvent are all accessible from Objective-C). The design doc specified Swift but the APIs are Objective-C-native — using ObjC directly removes an unnecessary bridging layer and simplifies the build.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(myvoice): configure native addon build system with binding.gyp"
```

---

## Task 3: Create Shared Types and Constants

**Owner:** CTO
**Files:**
- Create: `MyVoice/src/shared/types.ts`
- Create: `MyVoice/src/shared/constants.ts`

**Step 1: Create shared IPC types**

File: `src/shared/types.ts`

```typescript
// IPC channel names
export const IPC_CHANNELS = {
  DICTATION_START: 'dictation:start',
  DICTATION_STOP: 'dictation:stop',
  DICTATION_CANCEL: 'dictation:cancel',
  DICTATION_AUDIO_LEVEL: 'dictation:audio-level',
  DICTATION_PARTIAL_TEXT: 'dictation:partial-text',
  DICTATION_ERROR: 'dictation:error',
} as const;

// Dictation state machine
export type DictationState = 'idle' | 'recording' | 'stopping';

// IPC payloads
export interface AudioLevelPayload {
  level: number; // 0.0 to 1.0
}

export interface PartialTextPayload {
  text: string;
}

export interface DictationStopPayload {
  transcript: string;
}

export interface DictationErrorPayload {
  message: string;
}
```

**Step 2: Create constants**

File: `src/shared/constants.ts`

```typescript
// Hotkey
export const FN_DOUBLE_TAP_THRESHOLD_MS = 400;

// Speech
export const SILENCE_TIMEOUT_MS = 1500;
export const SPEECH_LOCALE = 'en-US';

// Audio visualization
export const AUDIO_LEVEL_UPDATE_INTERVAL_MS = 50;
export const WAVEFORM_BAR_COUNT = 10;

// Overlay window
export const OVERLAY_WIDTH = 320;
export const OVERLAY_HEIGHT_COMPACT = 56;
export const OVERLAY_HEIGHT_EXPANDED = 72;
export const OVERLAY_TOP_OFFSET = 200;
export const OVERLAY_BORDER_RADIUS = 24;

// Text injection
export const KEYSTROKE_DELAY_MS = 10;

// Animations
export const OVERLAY_FADE_IN_MS = 150;
export const OVERLAY_FADE_OUT_MS = 200;
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(myvoice): add shared IPC types and constants"
```

---

## Task 4: Implement SpeechBridge Native Addon (Objective-C)

**Owner:** Engineer 1
**Files:**
- Create: `MyVoice/src/native/Sources/SpeechBridgeImpl.m`

This is the most critical native component. It wraps Apple's SFSpeechRecognizer and AVAudioEngine.

**Step 1: Implement SpeechBridgeImpl.m**

File: `src/native/Sources/SpeechBridgeImpl.m`

```objc
#import "SwiftBridge.h"
#import <Speech/Speech.h>
#import <AVFoundation/AVFoundation.h>

@implementation SpeechBridge

static SFSpeechRecognizer *recognizer;
static SFSpeechAudioBufferRecognitionRequest *recognitionRequest;
static SFSpeechRecognitionTask *recognitionTask;
static AVAudioEngine *audioEngine;

+ (void)requestAuthorization:(void (^)(BOOL granted))callback {
    [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
        dispatch_async(dispatch_get_main_queue(), ^{
            callback(status == SFSpeechRecognizerAuthorizationStatusAuthorized);
        });
    }];
}

+ (BOOL)isAvailable {
    SFSpeechRecognizer *rec = [[SFSpeechRecognizer alloc] initWithLocale:
        [NSLocale localeWithLocaleIdentifier:@"en-US"]];
    return rec != nil && rec.isAvailable;
}

+ (void)startRecognitionWithLocale:(NSString *)locale
                   onPartialResult:(void (^)(NSString *text))partialCallback
                     onFinalResult:(void (^)(NSString *text))finalCallback
                      onAudioLevel:(void (^)(float level))levelCallback
                           onError:(void (^)(NSString *error))errorCallback {

    // Stop any existing session
    [self stopRecognition];

    // Initialize recognizer
    recognizer = [[SFSpeechRecognizer alloc] initWithLocale:
        [NSLocale localeWithLocaleIdentifier:locale]];

    if (!recognizer || !recognizer.isAvailable) {
        errorCallback(@"Speech recognizer not available for this locale");
        return;
    }

    // Create recognition request
    recognitionRequest = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
    recognitionRequest.shouldReportPartialResults = YES;

    // Prefer on-device recognition for privacy
    if (@available(macOS 13.0, *)) {
        recognitionRequest.requiresOnDeviceRecognition = YES;
    }

    // Start recognition task
    recognitionTask = [recognizer recognitionTaskWithRequest:recognitionRequest
        resultHandler:^(SFSpeechRecognitionResult * _Nullable result, NSError * _Nullable error) {

        if (error) {
            errorCallback(error.localizedDescription);
            return;
        }

        if (result) {
            NSString *text = result.bestTranscription.formattedString;
            if (result.isFinal) {
                finalCallback(text);
            } else {
                partialCallback(text);
            }
        }
    }];

    // Set up audio engine
    audioEngine = [[AVAudioEngine alloc] init];
    AVAudioInputNode *inputNode = audioEngine.inputNode;
    AVAudioFormat *recordingFormat = [inputNode outputFormatForBus:0];

    // Install tap for audio data
    [inputNode installTapOnBus:0 bufferSize:1024 format:recordingFormat
        block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {

        // Feed audio to speech recognizer
        [recognitionRequest appendAudioPCMBuffer:buffer];

        // Calculate RMS level for waveform visualization
        float *channelData = buffer.floatChannelData[0];
        UInt32 frameLength = buffer.frameLength;
        float sumSquares = 0.0f;

        for (UInt32 i = 0; i < frameLength; i++) {
            sumSquares += channelData[i] * channelData[i];
        }

        float rms = sqrtf(sumSquares / (float)frameLength);
        // Normalize to 0.0-1.0 range (typical speech RMS is 0.01-0.3)
        float normalized = fminf(1.0f, rms / 0.2f);

        levelCallback(normalized);
    }];

    // Start audio engine
    NSError *engineError;
    [audioEngine prepare];
    if (![audioEngine startAndReturnError:&engineError]) {
        errorCallback([NSString stringWithFormat:@"Audio engine failed: %@",
            engineError.localizedDescription]);
    }
}

+ (void)stopRecognition {
    if (audioEngine && audioEngine.isRunning) {
        [audioEngine stop];
        [audioEngine.inputNode removeTapOnBus:0];
    }

    if (recognitionRequest) {
        [recognitionRequest endAudio];
        recognitionRequest = nil;
    }

    if (recognitionTask) {
        [recognitionTask cancel];
        recognitionTask = nil;
    }

    audioEngine = nil;
    recognizer = nil;
}

@end
```

**Step 2: Verify file compiles conceptually** (actual build will happen after all native files are created)

Check that:
- Imports are correct (`Speech/Speech.h`, `AVFoundation/AVFoundation.h`)
- `@implementation SpeechBridge` matches `@interface SpeechBridge` in header
- All methods from header are implemented

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(myvoice): implement SpeechBridge native addon (SFSpeechRecognizer + AVAudioEngine)"
```

---

## Task 5: Implement HotkeyBridge Native Addon (Objective-C)

**Owner:** Engineer 1
**Files:**
- Create: `MyVoice/src/native/Sources/HotkeyBridgeImpl.m`

**Step 1: Implement HotkeyBridgeImpl.m**

File: `src/native/Sources/HotkeyBridgeImpl.m`

```objc
#import "SwiftBridge.h"
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>

@implementation HotkeyBridge

static id globalMonitor;
static NSDate *lastFnDownTime;
static BOOL fnCurrentlyDown;
static double doubleTapThreshold = 0.4; // 400ms

+ (void)startMonitoringWithCallback:(void (^)(void))doubleTapCallback {
    [self stopMonitoring];

    lastFnDownTime = nil;
    fnCurrentlyDown = NO;

    // Use NSEvent global monitor for flags changed events
    globalMonitor = [NSEvent addGlobalMonitorForEventsMatchingMask:NSEventMaskFlagsChanged
        handler:^(NSEvent * _Nonnull event) {

        BOOL fnDown = (event.modifierFlags & NSEventModifierFlagFunction) != 0;

        // Detect fn key transition: up → down
        if (fnDown && !fnCurrentlyDown) {
            NSDate *now = [NSDate date];

            if (lastFnDownTime) {
                NSTimeInterval interval = [now timeIntervalSinceDate:lastFnDownTime];

                if (interval < doubleTapThreshold) {
                    // Double-tap detected!
                    doubleTapCallback();
                    lastFnDownTime = nil;
                    fnCurrentlyDown = fnDown;
                    return;
                }
            }

            lastFnDownTime = now;
        }

        fnCurrentlyDown = fnDown;
    }];

    if (!globalMonitor) {
        NSLog(@"MyVoice: Failed to create global event monitor. Check Accessibility permissions.");
    }
}

+ (void)stopMonitoring {
    if (globalMonitor) {
        [NSEvent removeMonitor:globalMonitor];
        globalMonitor = nil;
    }
    lastFnDownTime = nil;
    fnCurrentlyDown = NO;
}

@end
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(myvoice): implement HotkeyBridge native addon (fn double-tap detection)"
```

---

## Task 6: Implement KeyboardBridge Native Addon (Objective-C)

**Owner:** Engineer 1
**Files:**
- Create: `MyVoice/src/native/Sources/KeyboardBridgeImpl.m`

**Step 1: Implement KeyboardBridgeImpl.m**

File: `src/native/Sources/KeyboardBridgeImpl.m`

```objc
#import "SwiftBridge.h"
#import <CoreGraphics/CoreGraphics.h>
#import <ApplicationServices/ApplicationServices.h>

@implementation KeyboardBridge

+ (void)typeText:(NSString *)text delayMs:(int)delay {
    CGEventSourceRef source = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);

    for (NSUInteger i = 0; i < text.length; i++) {
        unichar character = [text characterAtIndex:i];
        UniChar uniChar = (UniChar)character;

        // Create key down event
        CGEventRef keyDown = CGEventCreateKeyboardEvent(source, 0, true);
        CGEventKeyboardSetUnicodeString(keyDown, 1, &uniChar);
        CGEventPost(kCGHIDEventTap, keyDown);
        CFRelease(keyDown);

        // Create key up event
        CGEventRef keyUp = CGEventCreateKeyboardEvent(source, 0, false);
        CGEventKeyboardSetUnicodeString(keyUp, 1, &uniChar);
        CGEventPost(kCGHIDEventTap, keyUp);
        CFRelease(keyUp);

        // Delay between keystrokes
        if (delay > 0) {
            usleep(delay * 1000); // Convert ms to microseconds
        }
    }

    if (source) {
        CFRelease(source);
    }
}

+ (BOOL)checkAccessibilityPermission {
    NSDictionary *options = @{(__bridge NSString *)kAXTrustedCheckOptionPrompt: @NO};
    return AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
}

+ (void)requestAccessibilityPermission {
    NSDictionary *options = @{(__bridge NSString *)kAXTrustedCheckOptionPrompt: @YES};
    AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
}

@end
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(myvoice): implement KeyboardBridge native addon (CGEvent text injection)"
```

---

## Task 7: Create N-API Addon Wrapper (Objective-C++)

**Owner:** Engineer 1
**Files:**
- Create: `MyVoice/src/native/Sources/addon.mm`

This is the glue between the Objective-C bridges and Node.js/Electron.

**Step 1: Implement addon.mm**

File: `src/native/Sources/addon.mm`

```objc
#include <napi.h>
#import "SwiftBridge.h"

// ─── Speech Recognition ────────────────────────────────────────

static Napi::ThreadSafeFunction partialTsfn;
static Napi::ThreadSafeFunction finalTsfn;
static Napi::ThreadSafeFunction levelTsfn;
static Napi::ThreadSafeFunction errorTsfn;

Napi::Value SpeechRequestAuth(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Function callback = info[0].As<Napi::Function>();

    auto tsfn = Napi::ThreadSafeFunction::New(env, callback, "AuthCallback", 0, 1);

    [SpeechBridge requestAuthorization:^(BOOL granted) {
        tsfn.BlockingCall([granted](Napi::Env env, Napi::Function jsCallback) {
            jsCallback.Call({Napi::Boolean::New(env, granted)});
        });
        tsfn.Release();
    }];

    return env.Undefined();
}

Napi::Value SpeechIsAvailable(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), [SpeechBridge isAvailable]);
}

Napi::Value SpeechStart(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::string locale = info[0].As<Napi::String>().Utf8Value();
    Napi::Function onPartial = info[1].As<Napi::Function>();
    Napi::Function onFinal = info[2].As<Napi::Function>();
    Napi::Function onLevel = info[3].As<Napi::Function>();
    Napi::Function onError = info[4].As<Napi::Function>();

    partialTsfn = Napi::ThreadSafeFunction::New(env, onPartial, "PartialResult", 0, 1);
    finalTsfn = Napi::ThreadSafeFunction::New(env, onFinal, "FinalResult", 0, 1);
    levelTsfn = Napi::ThreadSafeFunction::New(env, onLevel, "AudioLevel", 0, 1);
    errorTsfn = Napi::ThreadSafeFunction::New(env, onError, "Error", 0, 1);

    NSString *nsLocale = [NSString stringWithUTF8String:locale.c_str()];

    [SpeechBridge startRecognitionWithLocale:nsLocale
        onPartialResult:^(NSString *text) {
            std::string cppText = [text UTF8String];
            partialTsfn.NonBlockingCall([cppText](Napi::Env env, Napi::Function cb) {
                cb.Call({Napi::String::New(env, cppText)});
            });
        }
        onFinalResult:^(NSString *text) {
            std::string cppText = [text UTF8String];
            finalTsfn.NonBlockingCall([cppText](Napi::Env env, Napi::Function cb) {
                cb.Call({Napi::String::New(env, cppText)});
            });
        }
        onAudioLevel:^(float level) {
            levelTsfn.NonBlockingCall([level](Napi::Env env, Napi::Function cb) {
                cb.Call({Napi::Number::New(env, level)});
            });
        }
        onError:^(NSString *error) {
            std::string cppError = [error UTF8String];
            errorTsfn.NonBlockingCall([cppError](Napi::Env env, Napi::Function cb) {
                cb.Call({Napi::String::New(env, cppError)});
            });
        }
    ];

    return env.Undefined();
}

Napi::Value SpeechStop(const Napi::CallbackInfo& info) {
    [SpeechBridge stopRecognition];

    // Release thread-safe functions
    if (partialTsfn) partialTsfn.Release();
    if (finalTsfn) finalTsfn.Release();
    if (levelTsfn) levelTsfn.Release();
    if (errorTsfn) errorTsfn.Release();

    return info.Env().Undefined();
}

// ─── Hotkey Detection ──────────────────────────────────────────

static Napi::ThreadSafeFunction hotkeyTsfn;

Napi::Value HotkeyStart(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Function callback = info[0].As<Napi::Function>();

    hotkeyTsfn = Napi::ThreadSafeFunction::New(env, callback, "HotkeyCallback", 0, 1);

    [HotkeyBridge startMonitoringWithCallback:^{
        hotkeyTsfn.NonBlockingCall([](Napi::Env env, Napi::Function cb) {
            cb.Call({});
        });
    }];

    return env.Undefined();
}

Napi::Value HotkeyStop(const Napi::CallbackInfo& info) {
    [HotkeyBridge stopMonitoring];
    if (hotkeyTsfn) hotkeyTsfn.Release();
    return info.Env().Undefined();
}

// ─── Keyboard Simulation ───────────────────────────────────────

Napi::Value KeyboardType(const Napi::CallbackInfo& info) {
    std::string text = info[0].As<Napi::String>().Utf8Value();
    int delay = info.Length() > 1 ? info[1].As<Napi::Number>().Int32Value() : 10;

    NSString *nsText = [NSString stringWithUTF8String:text.c_str()];

    // Run on background thread to avoid blocking Node event loop
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        [KeyboardBridge typeText:nsText delayMs:delay];
    });

    return info.Env().Undefined();
}

Napi::Value KeyboardCheckPermission(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), [KeyboardBridge checkAccessibilityPermission]);
}

Napi::Value KeyboardRequestPermission(const Napi::CallbackInfo& info) {
    [KeyboardBridge requestAccessibilityPermission];
    return info.Env().Undefined();
}

// ─── Module Registration ───────────────────────────────────────

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Speech
    exports.Set("speechRequestAuth", Napi::Function::New(env, SpeechRequestAuth));
    exports.Set("speechIsAvailable", Napi::Function::New(env, SpeechIsAvailable));
    exports.Set("speechStart", Napi::Function::New(env, SpeechStart));
    exports.Set("speechStop", Napi::Function::New(env, SpeechStop));

    // Hotkey
    exports.Set("hotkeyStart", Napi::Function::New(env, HotkeyStart));
    exports.Set("hotkeyStop", Napi::Function::New(env, HotkeyStop));

    // Keyboard
    exports.Set("keyboardType", Napi::Function::New(env, KeyboardType));
    exports.Set("keyboardCheckPermission", Napi::Function::New(env, KeyboardCheckPermission));
    exports.Set("keyboardRequestPermission", Napi::Function::New(env, KeyboardRequestPermission));

    return exports;
}

NODE_API_MODULE(myvoice_native, Init)
```

**Step 2: Build native addon**

```bash
cd /Users/trey/Desktop/Apps/MyVoice/src/native
node-gyp rebuild
```

Expected: Build succeeds, produces `build/Release/myvoice_native.node`

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(myvoice): create N-API addon wrapper bridging ObjC to Node.js"
```

---

## Task 8: Create TypeScript Wrappers for Native Addon

**Owner:** Engineer 1
**Files:**
- Create: `MyVoice/src/main/native-bridge.ts`

**Step 1: Create native-bridge.ts**

File: `src/main/native-bridge.ts`

```typescript
import path from 'path';

// Load the native addon
// eslint-disable-next-line @typescript-eslint/no-var-requires
const native = require(path.join(__dirname, '../../src/native/build/Release/myvoice_native.node'));

// ─── Speech Recognition ────────────────────────────────────────

export function speechRequestAuth(): Promise<boolean> {
  return new Promise((resolve) => {
    native.speechRequestAuth((granted: boolean) => resolve(granted));
  });
}

export function speechIsAvailable(): boolean {
  return native.speechIsAvailable();
}

export function speechStart(
  locale: string,
  onPartialResult: (text: string) => void,
  onFinalResult: (text: string) => void,
  onAudioLevel: (level: number) => void,
  onError: (error: string) => void
): void {
  native.speechStart(locale, onPartialResult, onFinalResult, onAudioLevel, onError);
}

export function speechStop(): void {
  native.speechStop();
}

// ─── Hotkey Detection ──────────────────────────────────────────

export function hotkeyStart(onDoubleTapFn: () => void): void {
  native.hotkeyStart(onDoubleTapFn);
}

export function hotkeyStop(): void {
  native.hotkeyStop();
}

// ─── Keyboard Simulation ───────────────────────────────────────

export function keyboardType(text: string, delayMs?: number): void {
  native.keyboardType(text, delayMs ?? 10);
}

export function keyboardCheckPermission(): boolean {
  return native.keyboardCheckPermission();
}

export function keyboardRequestPermission(): void {
  native.keyboardRequestPermission();
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(myvoice): add TypeScript wrappers for native addon"
```

---

## Task 9: Build the Overlay UI (HTML + CSS)

**Owner:** Engineer 2
**Files:**
- Create: `MyVoice/src/renderer/index.html`
- Create: `MyVoice/src/renderer/overlay.css`

**Step 1: Create overlay HTML**

File: `src/renderer/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MyVoice</title>
  <link rel="stylesheet" href="overlay.css">
</head>
<body>
  <div id="pill" class="pill">
    <div class="waveform" id="waveform">
      <div class="bar" id="bar-0"></div>
      <div class="bar" id="bar-1"></div>
      <div class="bar" id="bar-2"></div>
      <div class="bar" id="bar-3"></div>
      <div class="bar" id="bar-4"></div>
      <div class="bar" id="bar-5"></div>
      <div class="bar" id="bar-6"></div>
      <div class="bar" id="bar-7"></div>
      <div class="bar" id="bar-8"></div>
      <div class="bar" id="bar-9"></div>
    </div>
    <div class="text-area">
      <span class="status" id="status">Listening...</span>
      <span class="transcript" id="transcript"></span>
    </div>
  </div>
  <script src="../dist/renderer/overlay.js"></script>
</body>
</html>
```

**Step 2: Create overlay CSS**

File: `src/renderer/overlay.css`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
  -webkit-font-smoothing: antialiased;
}

body {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 0;
}

.pill {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: rgba(30, 30, 30, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  min-width: 280px;
  max-width: 400px;

  /* Entry animation */
  opacity: 0;
  transform: scale(0.95);
  animation: pill-enter 150ms ease-out forwards;
}

.pill.dismissing {
  animation: pill-exit 200ms ease-in forwards;
}

@keyframes pill-enter {
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pill-exit {
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

/* ─── Waveform ───────────────────────────────── */

.waveform {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 28px;
  flex-shrink: 0;
}

.bar {
  width: 3px;
  height: 4px;
  border-radius: 1.5px;
  background: linear-gradient(180deg, #7B61FF 0%, #4A9EFF 100%);
  transition: height 80ms ease-out;
  min-height: 4px;
  max-height: 28px;
}

/* Idle breathing animation */
.pill.idle .bar {
  animation: breathe 2s ease-in-out infinite;
}

.pill.idle .bar:nth-child(odd) {
  animation-delay: 0.3s;
}

@keyframes breathe {
  0%, 100% { height: 4px; }
  50% { height: 8px; }
}

/* ─── Text Area ──────────────────────────────── */

.text-area {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.status {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.02em;
}

.transcript {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 16px;
}

.transcript:empty {
  display: none;
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(myvoice): build overlay UI with waveform visualization and pill styling"
```

---

## Task 10: Build the Overlay Renderer (TypeScript)

**Owner:** Engineer 2
**Files:**
- Create: `MyVoice/src/renderer/overlay.ts`

**Step 1: Implement overlay.ts**

File: `src/renderer/overlay.ts`

```typescript
const { ipcRenderer } = require('electron');

// DOM elements
const pill = document.getElementById('pill')!;
const bars = Array.from({ length: 10 }, (_, i) => document.getElementById(`bar-${i}`)!);
const status = document.getElementById('status')!;
const transcript = document.getElementById('transcript')!;

// Smooth audio levels (exponential moving average)
let smoothedLevels: number[] = new Array(10).fill(0);
const SMOOTHING = 0.3;

// ─── IPC Handlers ──────────────────────────────────────────────

ipcRenderer.on('dictation:start', () => {
  pill.classList.remove('dismissing');
  pill.classList.add('idle');
  status.textContent = 'Listening...';
  transcript.textContent = '';
  smoothedLevels.fill(0);
});

ipcRenderer.on('dictation:audio-level', (_event: any, level: number) => {
  pill.classList.remove('idle');
  updateWaveform(level);
});

ipcRenderer.on('dictation:partial-text', (_event: any, text: string) => {
  transcript.textContent = text;
  status.textContent = 'Listening...';
});

ipcRenderer.on('dictation:stop', (_event: any, finalText: string) => {
  status.textContent = 'Done';
  transcript.textContent = finalText;
  dismiss();
});

ipcRenderer.on('dictation:cancel', () => {
  status.textContent = 'Cancelled';
  dismiss();
});

ipcRenderer.on('dictation:error', (_event: any, message: string) => {
  status.textContent = `Error: ${message}`;
  setTimeout(dismiss, 1500);
});

// ─── Waveform ──────────────────────────────────────────────────

function updateWaveform(level: number) {
  // Distribute level across bars with some randomness for organic feel
  for (let i = 0; i < bars.length; i++) {
    const variance = 0.5 + Math.random() * 0.5; // 0.5-1.0 random multiplier
    const targetHeight = 4 + level * 24 * variance; // 4px min, 28px max

    smoothedLevels[i] = smoothedLevels[i] * (1 - SMOOTHING) + targetHeight * SMOOTHING;
    bars[i].style.height = `${Math.round(smoothedLevels[i])}px`;
  }
}

// ─── Dismiss ───────────────────────────────────────────────────

function dismiss() {
  pill.classList.add('dismissing');
  // Window will be hidden by main process after animation
  setTimeout(() => {
    ipcRenderer.send('overlay:dismissed');
  }, 200);
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(myvoice): implement overlay renderer with waveform and IPC handlers"
```

---

## Task 11: Create the Overlay Window Manager (Main Process)

**Owner:** Engineer 2
**Files:**
- Create: `MyVoice/src/main/overlay-window.ts`

**Step 1: Implement overlay-window.ts**

File: `src/main/overlay-window.ts`

```typescript
import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { OVERLAY_WIDTH, OVERLAY_HEIGHT_COMPACT, OVERLAY_TOP_OFFSET } from '../shared/constants';
import { IPC_CHANNELS } from '../shared/types';

let overlayWindow: BrowserWindow | null = null;

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT_COMPACT,
    x: Math.round((screenWidth - OVERLAY_WIDTH) / 2),
    y: OVERLAY_TOP_OFFSET,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'floating');
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));

  // Listen for overlay dismissed event
  ipcMain.on('overlay:dismissed', () => {
    hideOverlay();
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

export function showOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
  }
  overlayWindow!.show();
  overlayWindow!.webContents.send(IPC_CHANNELS.DICTATION_START);
}

export function hideOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
}

export function sendToOverlay(channel: string, data?: any): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel, data);
  }
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(myvoice): create overlay window manager with show/hide/IPC"
```

---

## Task 12: Create the Tray Menu

**Owner:** Engineer 2
**Files:**
- Create: `MyVoice/src/main/tray.ts`
- Create: `MyVoice/assets/tray-icon.png` (placeholder)

**Step 1: Create a placeholder tray icon**

We need a 16x16 template image. For now, create a simple placeholder. The real icon can be designed later.

```bash
# Create a 16x16 transparent PNG as placeholder (will replace with real icon)
# For now we'll use Electron's built-in nativeImage
```

**Step 2: Implement tray.ts**

File: `src/main/tray.ts`

```typescript
import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';

let tray: Tray | null = null;
let isRecording = false;

export function createTray(): Tray {
  // Create a simple template image for the tray
  // On macOS, template images adapt to light/dark mode automatically
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');

  // Fallback: create a simple icon if file doesn't exist
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    icon = icon.resize({ width: 16, height: 16 });
  } catch {
    // Create a minimal microphone-like icon as fallback
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('MyVoice — Double-tap fn to dictate');
  updateTrayMenu();

  return tray;
}

export function setRecordingState(recording: boolean): void {
  isRecording = recording;
  updateTrayMenu();

  if (tray) {
    tray.setToolTip(recording ? 'MyVoice — Recording...' : 'MyVoice — Double-tap fn to dictate');
  }
}

function updateTrayMenu(): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'MyVoice',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: isRecording ? 'Status: Recording...' : 'Status: Ready',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
      },
    },
    { type: 'separator' },
    {
      label: 'Quit MyVoice',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

export function getTray(): Tray | null {
  return tray;
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(myvoice): create system tray with status and settings menu"
```

---

## Task 13: Wire Up the Main Process (Dictation Controller)

**Owner:** Engineer 1
**Files:**
- Create: `MyVoice/src/main/dictation-controller.ts`

This is the state machine that coordinates everything: hotkey → speech → overlay → text injection.

**Step 1: Implement dictation-controller.ts**

File: `src/main/dictation-controller.ts`

```typescript
import { DictationState } from '../shared/types';
import { IPC_CHANNELS } from '../shared/types';
import { SILENCE_TIMEOUT_MS, SPEECH_LOCALE, KEYSTROKE_DELAY_MS } from '../shared/constants';
import { showOverlay, hideOverlay, sendToOverlay } from './overlay-window';
import { setRecordingState } from './tray';
import * as native from './native-bridge';

let state: DictationState = 'idle';
let silenceTimer: ReturnType<typeof setTimeout> | null = null;
let lastAudioAboveThreshold = 0;
const SILENCE_AUDIO_THRESHOLD = 0.02;

export function getDictationState(): DictationState {
  return state;
}

export function toggleDictation(): void {
  if (state === 'idle') {
    startDictation();
  } else if (state === 'recording') {
    stopDictation();
  }
  // Ignore if 'stopping' (debounce)
}

function startDictation(): void {
  // Check permissions first
  if (!native.keyboardCheckPermission()) {
    native.keyboardRequestPermission();
    return;
  }

  state = 'recording';
  setRecordingState(true);
  showOverlay();
  lastAudioAboveThreshold = Date.now();

  native.speechStart(
    SPEECH_LOCALE,
    // onPartialResult
    (text: string) => {
      sendToOverlay(IPC_CHANNELS.DICTATION_PARTIAL_TEXT, text);
    },
    // onFinalResult
    (text: string) => {
      finishDictation(text);
    },
    // onAudioLevel
    (level: number) => {
      sendToOverlay(IPC_CHANNELS.DICTATION_AUDIO_LEVEL, level);

      // Silence detection
      if (level > SILENCE_AUDIO_THRESHOLD) {
        lastAudioAboveThreshold = Date.now();
      }

      checkSilenceTimeout();
    },
    // onError
    (error: string) => {
      console.error('Speech recognition error:', error);
      sendToOverlay(IPC_CHANNELS.DICTATION_ERROR, error);
      resetState();
    }
  );

  // Start silence detection timer
  startSilenceTimer();
}

function stopDictation(): void {
  if (state !== 'recording') return;

  state = 'stopping';
  clearSilenceTimer();
  native.speechStop();
  // finishDictation will be called via onFinalResult callback

  // Safety timeout: if no final result in 2s, reset
  setTimeout(() => {
    if (state === 'stopping') {
      resetState();
    }
  }, 2000);
}

function finishDictation(transcript: string): void {
  clearSilenceTimer();

  sendToOverlay(IPC_CHANNELS.DICTATION_STOP, transcript);

  // Wait for overlay to start dismissing, then type
  setTimeout(() => {
    if (transcript.trim().length > 0) {
      native.keyboardType(transcript, KEYSTROKE_DELAY_MS);
    }
    resetState();
  }, 100);
}

function resetState(): void {
  state = 'idle';
  setRecordingState(false);
  clearSilenceTimer();

  // Hide overlay after fade animation
  setTimeout(() => {
    hideOverlay();
  }, 250);
}

// ─── Silence Detection ─────────────────────────────────────────

function startSilenceTimer(): void {
  clearSilenceTimer();
  silenceTimer = setInterval(() => {
    checkSilenceTimeout();
  }, 100);
}

function clearSilenceTimer(): void {
  if (silenceTimer) {
    clearInterval(silenceTimer);
    silenceTimer = null;
  }
}

function checkSilenceTimeout(): void {
  if (state !== 'recording') return;

  const silenceDuration = Date.now() - lastAudioAboveThreshold;
  if (silenceDuration >= SILENCE_TIMEOUT_MS) {
    stopDictation();
  }
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(myvoice): implement dictation controller state machine"
```

---

## Task 14: Create the App Entry Point (Electron Main)

**Owner:** Engineer 1
**Files:**
- Create: `MyVoice/src/main/index.ts`

**Step 1: Implement index.ts**

File: `src/main/index.ts`

```typescript
import { app } from 'electron';
import { createOverlayWindow } from './overlay-window';
import { createTray } from './tray';
import { toggleDictation } from './dictation-controller';
import { hotkeyStart, hotkeyStop } from './native-bridge';

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Hide dock icon (menu bar app only)
app.dock?.hide();

app.whenReady().then(() => {
  // Create tray icon
  createTray();

  // Pre-create overlay window (hidden)
  createOverlayWindow();

  // Start listening for fn double-tap
  hotkeyStart(() => {
    toggleDictation();
  });

  console.log('MyVoice is running. Double-tap fn to dictate.');
});

app.on('will-quit', () => {
  hotkeyStop();
});

// Keep app running when all windows are closed (menu bar app)
app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/trey/Desktop/Apps/MyVoice
npm run build:ts
```

Expected: TypeScript compiles to `dist/` without errors.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(myvoice): create app entry point with tray, overlay, and hotkey setup"
```

---

## Task 15: End-to-End Integration and First Run

**Owner:** Engineer 1
**Files:**
- Modify: `MyVoice/package.json` (verify all scripts work)

**Step 1: Build the full project**

```bash
cd /Users/trey/Desktop/Apps/MyVoice
npm run build
```

Expected: Both native addon and TypeScript compile successfully.

**Step 2: Run the app in dev mode**

```bash
npm run dev
```

Expected:
- No dock icon appears
- Tray icon appears in menu bar
- Double-tap fn → floating pill appears with "Listening..."
- Speaking → waveform bars modulate
- Partial text appears in pill
- Silence for 1.5s → pill dismisses, text typed into last focused field
- Double-tap fn again while recording → stops immediately

**Step 3: Test in multiple apps**

Open each of these and dictate text:
- Safari URL bar
- VS Code editor
- Notes app
- Terminal (iTerm or Terminal.app)
- Slack message input

**Step 4: Fix any issues found during testing**

Common issues to check:
- Permission dialogs appearing correctly
- Audio levels registering (waveform moving)
- Text actually appearing in target fields
- Overlay positioning correct on different screen sizes

**Step 5: Commit working state**

```bash
git add -A
git commit -m "feat(myvoice): complete end-to-end integration, first working version"
```

---

## Task 16: UX Review and Acceptance Testing

**Owner:** CPO
**Files:** None (review only)

**Step 1: Test against success criteria from design doc**

Run through each criterion:
- [ ] Double-tap fn activates dictation in < 200ms
- [ ] Floating pill appears with working waveform visualization
- [ ] Speech transcribed accurately on-device (no network calls)
- [ ] Transcribed text appears in the focused text field
- [ ] Works in Safari, Chrome, VS Code, Slack, Notes, Terminal, iMessage
- [ ] Auto-stops after 1.5s silence
- [ ] Menu bar tray icon with quit and settings
- [ ] Zero cloud dependencies — works fully offline

**Step 2: UX feedback**

Review and document:
- Is the pill visible enough without being intrusive?
- Is the waveform responsive and satisfying?
- Is the silence timeout (1.5s) comfortable or too short/long?
- Does text injection feel natural or robotic?
- Any edge cases: what happens if you double-tap fn rapidly 3+ times?

**Step 3: Create issues for any problems found**

Document issues as tasks for engineers to fix.

---

## Task 17: Marketing Positioning and README

**Owner:** CMO
**Files:**
- Create/modify: `MyVoice/README.md`

**Step 1: Write competitive positioning**

Document how MyVoice compares to:
- Wispr ($10/mo, cloud-based)
- Superwhisper ($8/mo, cloud option)
- macOS built-in dictation (unreliable, Apple cloud)

Key messages:
- **Free forever** — no subscriptions
- **Private by design** — voice never leaves your Mac
- **Works everywhere** — any text field, any app
- **Instant** — double-tap fn, start talking

**Step 2: Write README.md**

```markdown
# MyVoice

Free, privacy-first voice dictation for macOS. Your voice never leaves your Mac.

## How It Works

1. Double-tap `fn` to start dictating
2. Speak naturally — see your words appear in real-time
3. Pause speaking and your words are typed into the active text field

## Install

1. Download the latest `.dmg` from Releases
2. Drag MyVoice to Applications
3. Launch MyVoice — it runs in your menu bar
4. Grant Microphone, Speech Recognition, and Accessibility permissions when prompted

## Privacy

MyVoice uses Apple's on-device speech recognition. Your audio is processed entirely on your Mac. No data is sent to any server. No accounts, no telemetry, no cloud.

## Comparison

| Feature | MyVoice | Wispr | Superwhisper | macOS Dictation |
|---------|---------|-------|-------------|-----------------|
| Price | Free | $10/mo | $8/mo | Free |
| On-device | Always | No | Optional | Optional |
| Works everywhere | Yes | Yes | Yes | Yes |
| Waveform UI | Yes | Yes | Yes | No |
| Open source | Yes | No | No | No |

## Requirements

- macOS 13 (Ventura) or later
- Apple Silicon or Intel Mac

## License

MIT
```

**Step 3: Commit**

```bash
git add -A
git commit -m "docs(myvoice): add README with privacy positioning and competitive comparison"
```

---

## Task 18: Project Documentation (CLAUDE.md, timeline)

**Owner:** Tech Writer
**Files:**
- Create: `MyVoice/CLAUDE.md`
- Create: `MyVoice/timeline.md`

**Step 1: Write CLAUDE.md**

File: `MyVoice/CLAUDE.md`

```markdown
# MyVoice — CLAUDE.md

## Overview

Privacy-first macOS dictation app. Double-tap fn to activate, speak, and text is typed into the focused field. All speech recognition happens on-device via Apple's Speech framework.

## Stack

- **Runtime:** Electron 33+
- **Language:** TypeScript 5.9
- **Native Addon:** Objective-C/Objective-C++ via node-addon-api
- **macOS APIs:** SFSpeechRecognizer, AVAudioEngine, CGEvent, NSEvent
- **Build:** electron-builder, node-gyp, electron-rebuild

## Key Commands

\`\`\`bash
npm run build:native    # Compile Objective-C native addon
npm run build:ts        # Compile TypeScript to dist/
npm run build           # Build everything
npm run dev             # Run in dev mode
npm start               # Run compiled app
npm run package         # Create .dmg
npm test                # Run tests
\`\`\`

## Architecture

### Directory Layout

- `src/main/` — Electron main process (TypeScript)
  - `index.ts` — App entry, tray setup, lifecycle
  - `dictation-controller.ts` — State machine: idle → recording → stopping
  - `overlay-window.ts` — Floating pill BrowserWindow management
  - `tray.ts` — Menu bar icon and context menu
  - `native-bridge.ts` — TypeScript wrappers for native addon
- `src/renderer/` — Overlay UI
  - `index.html` — Pill HTML structure
  - `overlay.css` — Styling, animations, waveform
  - `overlay.ts` — Waveform rendering, IPC event handlers
- `src/native/` — Objective-C/C++ native addon
  - `Sources/addon.mm` — N-API bindings (ObjC++ → JS)
  - `Sources/SpeechBridgeImpl.m` — SFSpeechRecognizer + AVAudioEngine
  - `Sources/HotkeyBridgeImpl.m` — fn double-tap detection via NSEvent
  - `Sources/KeyboardBridgeImpl.m` — CGEvent keystroke simulation
  - `include/SwiftBridge.h` — Objective-C interface declarations
  - `binding.gyp` — Native build configuration
- `src/shared/` — Shared types and constants
- `assets/` — Tray icons

### State Machine

\`\`\`
IDLE → (fn double-tap) → RECORDING → (silence/fn double-tap) → STOPPING → (text typed) → IDLE
\`\`\`

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| dictation:start | Main → Renderer | Show overlay |
| dictation:stop | Main → Renderer | Dismiss overlay |
| dictation:audio-level | Main → Renderer | Update waveform |
| dictation:partial-text | Main → Renderer | Show live transcript |
| dictation:cancel | Main → Renderer | Cancel without typing |
| dictation:error | Main → Renderer | Show error in overlay |
| overlay:dismissed | Renderer → Main | Overlay animation complete |

## Git Workflow

- Branch naming: `feature/`, `fix/`, `docs/`
- Commit format: Conventional Commits (`feat:`, `fix:`, `docs:`)
- Squash merge to `main`

## Important Notes

- **Permissions:** App requires Microphone, Speech Recognition, and Accessibility permissions
- **On-device only:** `requiresOnDeviceRecognition = YES` — never sends audio to cloud
- **Menu bar app:** No dock icon, runs as tray-only app
- **Native rebuild:** After `npm install` or Electron upgrade, run `npm run rebuild`
\`\`\`

**Step 2: Create timeline.md**

File: `MyVoice/timeline.md`

```markdown
# MyVoice — Timeline

## 2026-02-13 — Project Created

- Designed architecture: Electron + TypeScript + ObjC native addon
- Implemented native bridges: SpeechBridge, HotkeyBridge, KeyboardBridge
- Built overlay UI with waveform visualization
- Created dictation controller state machine
- Integrated all components for end-to-end flow
- Added README, CLAUDE.md, project documentation
```

**Step 3: Commit**

```bash
git add -A
git commit -m "docs(myvoice): add CLAUDE.md and timeline tracking"
```

---

## Task 19: Code Review and Packaging

**Owner:** CTO
**Files:**
- Create: `MyVoice/electron-builder.json`

**Step 1: Create electron-builder config**

File: `MyVoice/electron-builder.json`

```json
{
  "appId": "com.trey.myvoice",
  "productName": "MyVoice",
  "mac": {
    "category": "public.app-category.productivity",
    "target": ["dmg"],
    "icon": "assets/icon.icns",
    "hardenedRuntime": true,
    "entitlements": "entitlements.plist",
    "entitlementsInherit": "entitlements.plist",
    "extendInfo": {
      "NSMicrophoneUsageDescription": "MyVoice needs microphone access to transcribe your speech.",
      "NSSpeechRecognitionUsageDescription": "MyVoice uses on-device speech recognition to convert your voice to text."
    }
  },
  "files": [
    "dist/**/*",
    "src/renderer/**/*",
    "src/native/build/**/*.node",
    "assets/**/*"
  ]
}
```

**Step 2: Create entitlements.plist**

File: `MyVoice/entitlements.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
</dict>
</plist>
```

**Step 3: Run code review**

Review all files for:
- Memory leaks in native addon (proper CFRelease calls)
- Thread safety in callback handling
- Error handling coverage
- No hardcoded paths
- Consistent code style

**Step 4: Build .dmg**

```bash
cd /Users/trey/Desktop/Apps/MyVoice
npm run package
```

Expected: `dist/MyVoice-0.1.0.dmg` created successfully.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(myvoice): add electron-builder config and entitlements for packaging"
```

---

## Dependency Graph

```
Task 1 (Scaffold) ─┬─→ Task 2 (binding.gyp) ─→ Task 4 (SpeechBridge) ─┐
                    │                           Task 5 (HotkeyBridge)  ─┤
                    │                           Task 6 (KeyboardBridge)─┤
                    │                                                    ↓
                    ├─→ Task 3 (Types) ─────────→ Task 7 (N-API wrapper)─→ Task 8 (TS wrappers) ─┐
                    │                                                                               │
                    ├─→ Task 9 (Overlay HTML/CSS) ─→ Task 10 (Overlay TS) ─→ Task 11 (Window mgr) ─┤
                    │                                                                               │
                    └─→ Task 12 (Tray) ────────────────────────────────────────────────────────────┤
                                                                                                    ↓
                                                                    Task 13 (Controller) ─→ Task 14 (Entry) ─→ Task 15 (Integration)
                                                                                                                        │
                                                                                          ┌────────────────────────────┤
                                                                                          ↓            ↓               ↓
                                                                                    Task 16 (CPO)  Task 17 (CMO)  Task 18 (Writer)
                                                                                          │            │               │
                                                                                          └────────────┴───────────────┘
                                                                                                       ↓
                                                                                                 Task 19 (CTO Review)
```

## Parallel Tracks

These can be developed simultaneously:

- **Track A (Tasks 4-8):** Native addon — Engineer 1
- **Track B (Tasks 9-12):** Overlay UI + Tray — Engineer 2
- **Track C (Task 17-18):** Documentation — CMO + Tech Writer

After tracks A and B converge at Task 13, integration begins.
