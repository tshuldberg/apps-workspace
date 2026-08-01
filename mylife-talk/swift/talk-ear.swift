// talk-ear: on-device streaming speech-to-text helper for MyTalk.
// Emits JSONL events on stdout: ready | partial | final | ptt | status | error.
// Reads commands on stdin: mute | unmute. Exits on stdin EOF.
import AVFoundation
import CoreGraphics
import Foundation
import Speech

let out = FileHandle.standardOutput
let outQueue = DispatchQueue(label: "talk-ear.out")

func emit(_ obj: [String: Any]) {
    outQueue.sync {
        guard let data = try? JSONSerialization.data(withJSONObject: obj),
              let line = String(data: data, encoding: .utf8) else { return }
        print(line)
        fflush(stdout)
    }
}

func emitError(_ message: String) { emit(["type": "error", "message": message]) }
func emitStatus(_ message: String) { emit(["type": "status", "message": message]) }

// MARK: - Arguments

struct Args {
    var silenceMs: Int = 1500
    var locale: String = "en-US"
    var pttKey: String? = nil
    var fixture: String? = nil
}

func parseArgs() -> Args {
    var args = Args()
    var it = CommandLine.arguments.dropFirst().makeIterator()
    while let flag = it.next() {
        switch flag {
        case "--silence-ms": if let v = it.next(), let n = Int(v) { args.silenceMs = n }
        case "--locale": if let v = it.next() { args.locale = v }
        case "--ptt-key": if let v = it.next() { args.pttKey = v }
        case "--fixture": if let v = it.next() { args.fixture = v }
        default: emitStatus("ignoring unknown flag \(flag)")
        }
    }
    return args
}

let args = parseArgs()

// MARK: - Fixture mode (CI: no mic, no permissions)

if let fixturePath = args.fixture {
    DispatchQueue.global().async {
        guard let content = try? String(contentsOfFile: fixturePath, encoding: .utf8) else {
            emitError("fixture file unreadable: \(fixturePath)")
            exit(1)
        }
        emit(["type": "ready"])
        for rawLine in content.split(separator: "\n", omittingEmptySubsequences: true) {
            let line = String(rawLine)
            if line.hasPrefix("partial:") {
                emit(["type": "partial", "text": String(line.dropFirst("partial:".count))])
            } else if line.hasPrefix("final:") {
                emit(["type": "final", "text": String(line.dropFirst("final:".count))])
            } else if line.hasPrefix("sleep:"), let ms = Int(line.dropFirst("sleep:".count)) {
                usleep(useconds_t(ms * 1000))
            } else if line.hasPrefix("ptt:") {
                emit(["type": "ptt", "state": String(line.dropFirst("ptt:".count))])
            }
        }
        emitStatus("fixture complete")
    }
    DispatchQueue.global().async {
        while readLine(strippingNewline: true) != nil {}
        exit(0)
    }
    RunLoop.main.run()
    exit(0)
}

// MARK: - Live speech engine

final class EarEngine {
    private let audioEngine = AVAudioEngine()
    private let recognizer: SFSpeechRecognizer
    private let silenceMs: Int
    private let pttMode: Bool

    private let state = DispatchQueue(label: "talk-ear.state")
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var currentText: String = ""
    private var lastEmittedText: String = ""
    private var lastChangeAt: Date = .distantPast
    private var muted: Bool
    private var restarting = false

    init?(locale: String, silenceMs: Int, pttMode: Bool) {
        guard let rec = SFSpeechRecognizer(locale: Locale(identifier: locale)) else {
            emitError("no speech recognizer for locale \(locale)")
            return nil
        }
        self.recognizer = rec
        self.silenceMs = silenceMs
        self.pttMode = pttMode
        self.muted = pttMode // push-to-talk starts idle until the key goes down
    }

    func start() {
        let input = audioEngine.inputNode
        do {
            try input.setVoiceProcessingEnabled(true)
        } catch {
            emitStatus("echo cancellation unavailable; TTS may be picked up by the mic")
        }
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0 else {
            emitError("no usable microphone input (sample rate 0); check Microphone permission for your terminal app")
            return
        }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            guard let self else { return }
            self.state.sync {
                guard !self.muted, let req = self.request else { return }
                req.append(buffer)
            }
        }
        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            emitError("audio engine failed to start: \(error.localizedDescription); check Microphone permission for your terminal app")
            return
        }
        beginRecognition()
        Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            self?.checkSilence()
        }
        emit(["type": "ready"])
    }

    private func beginRecognition() {
        state.sync {
            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = true
            if recognizer.supportsOnDeviceRecognition {
                req.requiresOnDeviceRecognition = true
            } else {
                emitStatus("on-device recognition unsupported for this locale; using system default path")
            }
            request = req
            currentText = ""
            lastEmittedText = ""
            lastChangeAt = .distantPast
            restarting = false
            task = recognizer.recognitionTask(with: req) { [weak self] result, error in
                guard let self else { return }
                if let result {
                    let text = result.bestTranscription.formattedString
                    self.state.sync {
                        if text != self.currentText {
                            self.currentText = text
                            self.lastChangeAt = Date()
                        }
                    }
                    if !text.isEmpty, text != self.lastEmittedText {
                        self.lastEmittedText = text
                        emit(["type": "partial", "text": text])
                    }
                }
                if let error {
                    let benign = self.state.sync { self.restarting || self.muted }
                    if !benign {
                        let ns = error as NSError
                        // kAFAssistantErrorDomain 216/1110 = routine cancellation/no-speech noise
                        if !(ns.code == 216 || ns.code == 1110 || ns.code == 301) {
                            emitStatus("recognition hiccup (\(ns.code)); restarting")
                        }
                        self.restart()
                    }
                }
            }
        }
    }

    private func checkSilence() {
        var toFinalize: String? = nil
        state.sync {
            guard !muted, !currentText.isEmpty, lastChangeAt != .distantPast else { return }
            if Date().timeIntervalSince(lastChangeAt) * 1000.0 >= Double(silenceMs) {
                toFinalize = currentText
            }
        }
        if let text = toFinalize { finalizeNow(text) }
    }

    private func finalizeNow(_ text: String) {
        emit(["type": "final", "text": text])
        restart()
    }

    func restart() {
        state.sync {
            restarting = true
            request?.endAudio()
            task?.cancel()
            request = nil
            task = nil
            currentText = ""
        }
        // brief pause lets the cancelled task drain before a fresh request
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
            self?.beginRecognition()
        }
    }

    func setMuted(_ value: Bool) {
        let flushText: String? = state.sync {
            let pending = (!value || currentText.isEmpty) ? nil : currentText
            muted = value
            return pending
        }
        if value {
            // muting mid-utterance in PTT mode should not finalize; plain mute discards
            _ = flushText
            state.sync { currentText = ""; lastEmittedText = "" }
        }
        emitStatus(value ? "muted" : "listening")
    }

    // PTT: key down starts a fresh capture window; key up finalizes whatever was heard.
    func pttDown() {
        emit(["type": "ptt", "state": "down"])
        state.sync { muted = false }
        restart()
    }

    func pttUp() {
        let text = state.sync { currentText }
        state.sync { muted = true }
        if !text.isEmpty {
            emit(["type": "final", "text": text])
        }
        emit(["type": "ptt", "state": "up"])
        state.sync { currentText = ""; lastEmittedText = "" }
    }
}

// MARK: - PTT event tap

func pttKeyMatch(_ name: String) -> (keyCode: Int64, isModifier: Bool, flag: CGEventFlags)? {
    switch name {
    case "rightOption": return (61, true, .maskAlternate)
    case "rightCommand": return (54, true, .maskCommand)
    case "f13": return (105, false, [])
    default: return nil
    }
}

var pttIsDown = false

func installPttTap(_ keyName: String, engine: EarEngine) {
    guard let spec = pttKeyMatch(keyName) else {
        emitError("unknown ptt key \(keyName)")
        return
    }
    let mask: CGEventMask =
        (1 << CGEventType.flagsChanged.rawValue) |
        (1 << CGEventType.keyDown.rawValue) |
        (1 << CGEventType.keyUp.rawValue)
    let refcon = Unmanaged.passRetained(engine).toOpaque()
    let callback: CGEventTapCallBack = { _, type, event, refcon in
        guard let refcon else { return Unmanaged.passUnretained(event) }
        let engine = Unmanaged<EarEngine>.fromOpaque(refcon).takeUnretainedValue()
        let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
        // spec captured via global because C callbacks cannot capture context
        guard let spec = pttSpec, keyCode == spec.keyCode else { return Unmanaged.passUnretained(event) }
        if spec.isModifier {
            if type == .flagsChanged {
                let down = event.flags.contains(spec.flag)
                if down != pttIsDown {
                    pttIsDown = down
                    down ? engine.pttDown() : engine.pttUp()
                }
            }
        } else {
            if type == .keyDown, !pttIsDown { pttIsDown = true; engine.pttDown() }
            if type == .keyUp, pttIsDown { pttIsDown = false; engine.pttUp() }
        }
        return Unmanaged.passUnretained(event)
    }
    pttSpec = spec
    guard let tap = CGEvent.tapCreate(
        tap: .cgSessionEventTap,
        place: .headInsertEventTap,
        options: .listenOnly,
        eventsOfInterest: mask,
        callback: callback,
        userInfo: refcon
    ) else {
        emitError("cannot listen for the push-to-talk key; grant Accessibility (or Input Monitoring) to your terminal app in System Settings > Privacy & Security")
        return
    }
    let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
    CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
    CGEvent.tapEnable(tap: tap, enable: true)
    emitStatus("push-to-talk armed on \(keyName)")
}

var pttSpec: (keyCode: Int64, isModifier: Bool, flag: CGEventFlags)? = nil

// MARK: - Startup

func requestPermissions(_ done: @escaping (Bool) -> Void) {
    SFSpeechRecognizer.requestAuthorization { auth in
        guard auth == .authorized else {
            emitError("speech recognition not authorized (status \(auth.rawValue)); grant Speech Recognition to your terminal app in System Settings > Privacy & Security")
            done(false)
            return
        }
        AVCaptureDevice.requestAccess(for: .audio) { granted in
            if !granted {
                emitError("microphone access denied; grant Microphone to your terminal app in System Settings > Privacy & Security")
            }
            done(granted)
        }
    }
}

guard let engine = EarEngine(locale: args.locale, silenceMs: args.silenceMs, pttMode: args.pttKey != nil) else {
    exit(1)
}

requestPermissions { ok in
    guard ok else { exit(1) }
    DispatchQueue.main.async {
        engine.start()
        if let key = args.pttKey { installPttTap(key, engine: engine) }
    }
}

DispatchQueue.global().async {
    while let line = readLine(strippingNewline: true) {
        switch line.trimmingCharacters(in: .whitespaces) {
        case "mute": engine.setMuted(true)
        case "unmute": engine.setMuted(false)
        case "restart": engine.restart()
        default: break
        }
    }
    exit(0) // parent closed stdin
}

RunLoop.main.run()
