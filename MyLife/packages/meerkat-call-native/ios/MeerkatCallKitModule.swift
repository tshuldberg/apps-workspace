// UNVERIFIED - pending dev build (Plan 25 WP-25F). This Swift source is AUTHORED
// in-repo but has NOT been compiled or device-proven: this environment has no
// signed iOS dev build. A signed build must compile it and the physical-device
// matrix must prove it. Nothing here is evidence for AC-25.3, and the JS bridge
// stays honestly unavailable until this native module loads at runtime.
//
// The App Store invariant is load-bearing: every VoIP push invokes
// reportNewIncomingCall before its PushKit completion handler runs. Malformed
// and duplicate pushes use a random surrogate UUID, are reported, then fail.

import AVFoundation
import CallKit
import ExpoModulesCore
import Foundation
import PushKit

private enum CallNativeError: String {
  case invalidArguments = "ERR_INVALID_ARGS"
  case duplicateCall = "ERR_DUPLICATE_CALL"
  case callCapacity = "ERR_CALL_CAPACITY"
  case callNotFound = "ERR_CALL_NOT_FOUND"
  case transactionFailed = "ERR_CALLKIT_TRANSACTION_FAILED"
}

private final class CodedCallNativeException: Exception {
  // Exception.code is `open var code: String` and Exception.name is a settable
  // `open lazy var`, so the coded error lives under its own property name and
  // the base overrides follow the base signatures exactly.
  private let errorCode: CallNativeError

  init(_ errorCode: CallNativeError) {
    self.errorCode = errorCode
    super.init()
    self.name = errorCode.rawValue
  }

  override var code: String { errorCode.rawValue }
  override var reason: String { "Meerkat native call error: \(errorCode.rawValue)" }
}

private enum CallEndReason: String {
  case failed
  case remoteEnded
  case unanswered
  case answeredElsewhere
  case declinedElsewhere
  case localEnded
  case rejected
  case missed
  case busy
  case cancelled
  case reset
  case unknown
}

private struct CallRecord {
  let callId: String
  let isIncoming: Bool
  var hasVideo: Bool
  var answeredEventSent: Bool
}

private struct IncomingCallReport {
  let uuid: UUID
  let callId: String
  let hasVideo: Bool
  let malformed: Bool
  let duplicate: Bool
  let shouldEndImmediately: Bool
}

public final class MeerkatCallKitModule: Module {
  private lazy var coordinator = CallKitCoordinator(owner: self)

  public func definition() -> ModuleDefinition {
    Name("MeerkatCallKit")

    Events(
      "incomingCallReported",
      "callAnswered",
      "callEnded",
      "muteChanged",
      "audioSessionChanged",
      "voipTokenChanged",
      "telecomStateChanged"
    )

    OnCreate { _ = self.coordinator }
    OnDestroy { self.coordinator.destroy() }

    AsyncFunction("isSupported") {
      ["platform": "ios", "available": true, "reason": "available"] as [String: Any]
    }

    AsyncFunction("registerVoipPushToken") {
      self.coordinator.registerForVoipPushes()
    }

    AsyncFunction("startOutgoingCall") { (input: [String: Any], promise: Promise) in
      guard let callId = input["callUUID"] as? String,
            let uuid = UUID(uuidString: callId),
            let hasVideo = input["hasVideo"] as? Bool else {
        promise.reject(CodedCallNativeException(.invalidArguments))
        return
      }
      self.coordinator.startOutgoingCall(
        callId: uuid.uuidString.lowercased(),
        uuid: uuid,
        hasVideo: hasVideo,
        promise: promise
      )
    }

    AsyncFunction("reportOutgoingCallConnected") { (input: [String: Any]) in
      guard let callId = input["callUUID"] as? String,
            let uuid = UUID(uuidString: callId) else {
        throw CodedCallNativeException(.invalidArguments)
      }
      try self.coordinator.reportOutgoingCallConnected(uuid: uuid)
    }

    AsyncFunction("reportCallEnded") { (input: [String: Any]) in
      guard let callId = input["callUUID"] as? String,
            let uuid = UUID(uuidString: callId),
            let rawReason = input["reason"] as? String,
            let reason = CallEndReason(rawValue: rawReason) else {
        throw CodedCallNativeException(.invalidArguments)
      }
      try self.coordinator.reportCallEnded(uuid: uuid, reason: reason)
    }

    AsyncFunction("updateCall") { (input: [String: Any]) in
      guard let callId = input["callUUID"] as? String,
            let uuid = UUID(uuidString: callId),
            let hasVideo = input["hasVideo"] as? Bool else {
        throw CodedCallNativeException(.invalidArguments)
      }
      if let suppliedName = input["locallyVerifiedCallerName"], !(suppliedName is String) {
        throw CodedCallNativeException(.invalidArguments)
      }
      try self.coordinator.updateCall(
        uuid: uuid,
        hasVideo: hasVideo,
        locallyVerifiedCallerName: input["locallyVerifiedCallerName"] as? String
      )
    }
  }
}

private final class CallKitCoordinator: NSObject, CXProviderDelegate, PKPushRegistryDelegate {
  private static let maxActiveCalls = 32
  private static let maxRecentlyEndedCalls = 128
  private static let genericCallerName = NSLocalizedString(
    "Meerkat Call",
    comment: "Generic caller name used before local identity verification"
  )

  private weak var owner: MeerkatCallKitModule?
  private let provider: CXProvider
  private let callController = CXCallController()
  private let delegateQueue = DispatchQueue(label: "com.mylife.meerkat.callkit.delegate")
  private let stateQueue = DispatchQueue(label: "com.mylife.meerkat.callkit.state")

  private var pushRegistry: PKPushRegistry?
  private var routeObserver: NSObjectProtocol?
  private var activeCalls: [UUID: CallRecord] = [:]
  private var recentlyEnded: [UUID] = []
  private var recentlyEndedSet: Set<UUID> = []
  private var audioSessionActive = false

  init(owner: MeerkatCallKitModule) {
    self.owner = owner

    let configuration = CXProviderConfiguration()
    configuration.includesCallsInRecents = false
    configuration.maximumCallGroups = 1
    configuration.maximumCallsPerCallGroup = 1
    configuration.supportedHandleTypes = [.generic]
    configuration.supportsVideo = true
    self.provider = CXProvider(configuration: configuration)

    super.init()

    provider.setDelegate(self, queue: delegateQueue)
    routeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: nil,
      queue: nil
    ) { [weak self] _ in
      self?.emitRouteChangeIfActive()
    }
  }

  func registerForVoipPushes() {
    DispatchQueue.main.async {
      let registry = self.pushRegistry ?? PKPushRegistry(queue: .main)
      self.pushRegistry = registry
      registry.delegate = self
      registry.desiredPushTypes = [.voIP]
    }
  }

  func startOutgoingCall(
    callId: String,
    uuid: UUID,
    hasVideo: Bool,
    promise: Promise
  ) {
    switch insertCall(
      uuid: uuid,
      callId: callId,
      hasVideo: hasVideo,
      isIncoming: false
    ) {
    case .duplicate:
      promise.reject(CodedCallNativeException(.duplicateCall))
      return
    case .capacity:
      promise.reject(CodedCallNativeException(.callCapacity))
      return
    case .inserted:
      break
    }

    let handle = CXHandle(type: .generic, value: "meerkat-call")
    let action = CXStartCallAction(call: uuid, handle: handle)
    action.isVideo = hasVideo

    callController.request(CXTransaction(action: action)) { error in
      if error != nil {
        self.discardActiveCall(uuid: uuid)
        promise.reject(CodedCallNativeException(.transactionFailed))
        return
      }
      promise.resolve(nil)
    }
  }

  func reportOutgoingCallConnected(uuid: UUID) throws {
    guard hasActiveCall(uuid: uuid) else {
      throw CodedCallNativeException(.callNotFound)
    }
    provider.reportOutgoingCall(with: uuid, connectedAt: Date())
  }

  func reportCallEnded(uuid: UUID, reason: CallEndReason) throws {
    if isRecentlyEnded(uuid: uuid) {
      return
    }
    guard hasActiveCall(uuid: uuid) else {
      throw CodedCallNativeException(.callNotFound)
    }
    provider.reportCall(with: uuid, endedAt: Date(), reason: callKitEndReason(reason))
    finishCall(uuid: uuid, reason: reason, allowUnknown: false)
  }

  func updateCall(
    uuid: UUID,
    hasVideo: Bool,
    locallyVerifiedCallerName: String?
  ) throws {
    guard updateVideo(uuid: uuid, hasVideo: hasVideo) else {
      throw CodedCallNativeException(.callNotFound)
    }

    let update = callUpdate(
      hasVideo: hasVideo,
      locallyVerifiedCallerName: locallyVerifiedCallerName
    )
    provider.reportCall(with: uuid, updated: update)
  }

  func destroy() {
    if let routeObserver {
      NotificationCenter.default.removeObserver(routeObserver)
      self.routeObserver = nil
    }
    DispatchQueue.main.async {
      self.pushRegistry?.delegate = nil
      self.pushRegistry = nil
    }
    provider.invalidate()
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didUpdate pushCredentials: PKPushCredentials,
    for type: PKPushType
  ) {
    guard type == .voIP else { return }
    let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
    owner?.sendEvent("voipTokenChanged", ["token": token, "invalidated": false])
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    guard type == .voIP else { return }
    owner?.sendEvent("voipTokenChanged", ["token": nil, "invalidated": true])
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    guard type == .voIP else {
      completion()
      return
    }

    let report = makeIncomingReport(payload.dictionaryPayload)
    let update = callUpdate(hasVideo: report.hasVideo, locallyVerifiedCallerName: nil)

    // This invocation must remain before completion(). Moving it breaks Apple's
    // VoIP push requirement and can terminate the app or jeopardize review.
    provider.reportNewIncomingCall(with: report.uuid, update: update) { error in
      if error == nil {
        self.owner?.sendEvent("incomingCallReported", [
          "callUUID": report.callId,
          "hasVideo": report.hasVideo,
          "malformed": report.malformed,
          "duplicate": report.duplicate,
        ])
      }

      if error != nil || report.shouldEndImmediately {
        self.provider.reportCall(with: report.uuid, endedAt: Date(), reason: .failed)
        self.finishCall(uuid: report.uuid, reason: .failed, allowUnknown: true)
      }
    }

    completion()
  }

  func providerDidReset(_ provider: CXProvider) {
    setAudioSessionActive(false)
    finishAllActiveCalls(reason: .reset)
  }

  func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
    guard let record = record(for: action.callUUID) else {
      action.fail()
      return
    }

    provider.reportOutgoingCall(with: action.callUUID, startedConnectingAt: Date())
    provider.reportCall(
      with: action.callUUID,
      updated: callUpdate(hasVideo: record.hasVideo, locallyVerifiedCallerName: nil)
    )
    emitTelecomState(callId: record.callId, state: "outgoing-started")
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    guard let callId = markAnswered(uuid: action.callUUID) else {
      action.fail()
      return
    }
    owner?.sendEvent("callAnswered", ["callId": callId, "platform": "ios"])
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    if let record = record(for: action.callUUID) {
      let reason: CallEndReason
      if record.answeredEventSent {
        reason = .localEnded
      } else {
        reason = record.isIncoming ? .rejected : .cancelled
      }
      finishCall(uuid: action.callUUID, reason: reason, allowUnknown: false)
      action.fulfill()
      return
    }
    if isRecentlyEnded(uuid: action.callUUID) {
      action.fulfill()
      return
    }
    action.fail()
  }

  func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
    guard let record = record(for: action.callUUID) else {
      action.fail()
      return
    }
    owner?.sendEvent("muteChanged", [
      "callId": record.callId,
      "muted": action.isMuted,
      "platform": "ios",
    ])
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
    guard let record = record(for: action.callUUID) else {
      action.fail()
      return
    }
    emitTelecomState(
      callId: record.callId,
      state: action.isOnHold ? "inactive" : "active"
    )
    action.fulfill()
  }

  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    setAudioSessionActive(true)
    emitAudioSessionChanged(active: true)
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    setAudioSessionActive(false)
    emitAudioSessionChanged(active: false)
  }

  private enum InsertResult: Equatable {
    case inserted
    case duplicate
    case capacity
  }

  private func insertCall(
    uuid: UUID,
    callId: String,
    hasVideo: Bool,
    isIncoming: Bool
  ) -> InsertResult {
    stateQueue.sync {
      if activeCalls[uuid] != nil || recentlyEndedSet.contains(uuid) {
        return .duplicate
      }
      guard activeCalls.count < Self.maxActiveCalls else {
        return .capacity
      }
      activeCalls[uuid] = CallRecord(
        callId: callId,
        isIncoming: isIncoming,
        hasVideo: hasVideo,
        answeredEventSent: false
      )
      return .inserted
    }
  }

  private func makeIncomingReport(_ payload: [AnyHashable: Any]) -> IncomingCallReport {
    let rawCallId = payload["callUUID"] as? String
    let parsedUUID = rawCallId.flatMap { UUID(uuidString: $0) }
    let parsedVideo = payload["hasVideo"] as? Bool
    let malformed = parsedUUID == nil || parsedVideo == nil
    let duplicate = parsedUUID.map(isKnownCall) ?? false
    let reportUUID = malformed || duplicate ? UUID() : parsedUUID!
    let callId = reportUUID.uuidString.lowercased()
    let hasVideo = parsedVideo ?? false
    let inserted = insertCall(
      uuid: reportUUID,
      callId: callId,
      hasVideo: hasVideo,
      isIncoming: true
    )

    return IncomingCallReport(
      uuid: reportUUID,
      callId: callId,
      hasVideo: hasVideo,
      malformed: malformed,
      duplicate: duplicate,
      shouldEndImmediately: malformed || duplicate || inserted != .inserted
    )
  }

  private func isKnownCall(_ uuid: UUID) -> Bool {
    stateQueue.sync { activeCalls[uuid] != nil || recentlyEndedSet.contains(uuid) }
  }

  private func hasActiveCall(uuid: UUID) -> Bool {
    stateQueue.sync { activeCalls[uuid] != nil }
  }

  private func isRecentlyEnded(uuid: UUID) -> Bool {
    stateQueue.sync { recentlyEndedSet.contains(uuid) }
  }

  private func record(for uuid: UUID) -> CallRecord? {
    stateQueue.sync { activeCalls[uuid] }
  }

  private func discardActiveCall(uuid: UUID) {
    stateQueue.sync { _ = activeCalls.removeValue(forKey: uuid) }
  }

  private func updateVideo(uuid: UUID, hasVideo: Bool) -> Bool {
    stateQueue.sync {
      guard var record = activeCalls[uuid] else { return false }
      record.hasVideo = hasVideo
      activeCalls[uuid] = record
      return true
    }
  }

  private func markAnswered(uuid: UUID) -> String? {
    stateQueue.sync {
      guard var record = activeCalls[uuid], !record.answeredEventSent else {
        return nil
      }
      record.answeredEventSent = true
      activeCalls[uuid] = record
      return record.callId
    }
  }

  private func finishCall(uuid: UUID, reason: CallEndReason, allowUnknown: Bool) {
    var callId: String?
    stateQueue.sync {
      if recentlyEndedSet.contains(uuid) { return }
      if let record = activeCalls.removeValue(forKey: uuid) {
        callId = record.callId
      } else if allowUnknown {
        callId = uuid.uuidString.lowercased()
      }
      guard callId != nil else { return }
      appendRecentlyEndedLocked(uuid)
    }

    if let callId {
      owner?.sendEvent("callEnded", [
        "callId": callId,
        "platform": "ios",
        "reason": reason.rawValue,
      ])
    }
  }

  private func finishAllActiveCalls(reason: CallEndReason) {
    let ended: [(UUID, String)] = stateQueue.sync {
      let values = activeCalls.map { ($0.key, $0.value.callId) }
      activeCalls.removeAll()
      for (uuid, _) in values {
        appendRecentlyEndedLocked(uuid)
      }
      return values
    }

    for (_, callId) in ended {
      owner?.sendEvent("callEnded", [
        "callId": callId,
        "platform": "ios",
        "reason": reason.rawValue,
      ])
    }
  }

  private func appendRecentlyEndedLocked(_ uuid: UUID) {
    recentlyEnded.append(uuid)
    recentlyEndedSet.insert(uuid)
    while recentlyEnded.count > Self.maxRecentlyEndedCalls {
      recentlyEndedSet.remove(recentlyEnded.removeFirst())
    }
  }

  private func callUpdate(
    hasVideo: Bool,
    locallyVerifiedCallerName: String?
  ) -> CXCallUpdate {
    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: "meerkat-call")
    update.hasVideo = hasVideo
    update.supportsDTMF = false
    update.supportsGrouping = false
    update.supportsHolding = true
    update.supportsUngrouping = false

    let verifiedName = locallyVerifiedCallerName?
      .trimmingCharacters(in: .whitespacesAndNewlines)
    if let verifiedName, !verifiedName.isEmpty {
      update.localizedCallerName = String(verifiedName.prefix(128))
    } else {
      update.localizedCallerName = Self.genericCallerName
    }
    return update
  }

  private func callKitEndReason(_ reason: CallEndReason) -> CXCallEndedReason {
    switch reason {
    case .failed, .reset, .unknown:
      return .failed
    case .unanswered, .missed, .busy:
      return .unanswered
    case .answeredElsewhere:
      return .answeredElsewhere
    case .declinedElsewhere, .rejected:
      return .declinedElsewhere
    case .remoteEnded, .localEnded, .cancelled:
      return .remoteEnded
    }
  }

  private func emitTelecomState(callId: String?, state: String) {
    var body: [String: Any] = ["platform": "ios", "state": state]
    if let callId { body["callId"] = callId }
    owner?.sendEvent("telecomStateChanged", body)
  }

  private func setAudioSessionActive(_ active: Bool) {
    stateQueue.sync { audioSessionActive = active }
  }

  private func currentCallId() -> String? {
    stateQueue.sync { activeCalls.values.map(\.callId).sorted().first }
  }

  private func emitAudioSessionChanged(active: Bool) {
    var body: [String: Any] = [
      "active": active,
      "platform": "ios",
      "route": currentAudioRoute(),
    ]
    if let callId = currentCallId() { body["callId"] = callId }
    owner?.sendEvent("audioSessionChanged", body)
  }

  private func emitRouteChangeIfActive() {
    let active = stateQueue.sync { audioSessionActive }
    if active { emitAudioSessionChanged(active: true) }
  }

  private func currentAudioRoute() -> String {
    let portTypes = AVAudioSession.sharedInstance().currentRoute.outputs.map(\.portType)
    if portTypes.contains(.builtInSpeaker) { return "speaker" }
    if portTypes.contains(.bluetoothA2DP)
      || portTypes.contains(.bluetoothHFP)
      || portTypes.contains(.bluetoothLE) { return "bluetooth" }
    if portTypes.contains(.headphones)
      || portTypes.contains(.headsetMic)
      || portTypes.contains(.lineOut)
      || portTypes.contains(.usbAudio) { return "wiredHeadset" }
    if portTypes.contains(.airPlay)
      || portTypes.contains(.carAudio)
      || portTypes.contains(.HDMI) { return "streaming" }
    if portTypes.contains(.builtInReceiver) { return "earpiece" }
    return "unknown"
  }
}
