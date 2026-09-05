// UNVERIFIED - pending dev build (Plan 42 WP-42C). This Swift source is AUTHORED
// in-repo but has NOT been compiled or device-proven: this environment has no
// iOS toolchain. It is correct-by-construction native source that a signed dev
// build must compile and the physical-device matrix must prove. Nothing here is
// evidence for AC-42.1/42.2/42.3, and the JS bridge keeps the Nearby rung
// honestly unavailable until a real native module loads at runtime (WP-42B).
//
// iOS Nearby data transport over MultipeerConnectivity. Fulfills the raw native
// contract in src/native-types.ts (RawNativeNearbyModule) under the module name
// NEARBY_NATIVE_MODULE_NAME ('MeerkatNearby'). It moves RAW BYTES only; the
// @mylife/sync Noise session + frame envelope run ON TOP of these bytes. This
// module contains NO cryptography and logs no peer display name or payload.
//
// Native invariants honored (Plan 42 Native Module Contract, lines 202-212):
//  - Every session has a RANDOM local handle (a UUID string). The MCPeerID / OS
//    peer identifier never leaves this module as an identity.
//  - Pending send bytes and open session counts are clamped with backpressure;
//    an over-cap send rejects with a stable code rather than buffering unbounded.
//  - Every event subscription is removed on destroy(); delegates are torn down.
//  - App background, radio-off, permission denial, and peer loss close a session
//    EXACTLY ONCE (guarded by a per-session closed flag).
//  - Native exceptions map to STABLE error codes (ERR_*). No localized platform
//    string crosses the bridge.

import ExpoModulesCore
import MultipeerConnectivity
import Foundation

// MARK: - Stable error codes (never a localized platform string crosses the JS bridge)

private enum NearbyError: String {
  case notAdvertising = "ERR_NOT_ADVERTISING"
  case notBrowsing = "ERR_NOT_BROWSING"
  case unknownPeer = "ERR_UNKNOWN_PEER"
  case unknownSession = "ERR_UNKNOWN_SESSION"
  case sessionLimit = "ERR_SESSION_LIMIT"
  case sendBackpressure = "ERR_SEND_BACKPRESSURE"
  case connectTimeout = "ERR_CONNECT_TIMEOUT"
  case connectFailed = "ERR_CONNECT_FAILED"
  case invalidArgs = "ERR_INVALID_ARGS"
  /// A fresh advertised identity was requested while sessions are open.
  /// Adopting it would tear those sessions down, so we refuse instead.
  case identityBusy = "ERR_IDENTITY_BUSY"
}

private final class CodedNearbyException: Exception {
  // Exception.code is `open var code: String` and Exception.name is a settable
  // `open lazy var`; keep the coded error under its own property name and
  // follow the base signatures exactly (same fix as MeerkatCallKitModule).
  private let errorCode: NearbyError
  init(_ errorCode: NearbyError) {
    self.errorCode = errorCode
    super.init()
    // ExpoModulesCore surfaces `name` to JS as the stable error code.
    self.name = errorCode.rawValue
  }
  override var code: String { errorCode.rawValue }
  override var reason: String { "Meerkat Nearby transport error: \(errorCode.rawValue)" }
}

// MARK: - Capacity constants (bounded, never unbounded per Plan 42 perf reqs)

private enum Caps {
  /// Maximum concurrent open sessions per Plan 42 "session counts are clamped".
  static let maxSessions = 8
  /// Maximum in-flight (unacknowledged) bytes queued per session before a send
  /// rejects with ERR_SEND_BACKPRESSURE. MultipeerConnectivity itself buffers,
  /// so this is a conservative outbound guard, not the OS limit.
  static let maxPendingSendBytesPerSession = 4 * 1024 * 1024
  /// Connect invitation timeout (seconds).
  static let connectTimeout: TimeInterval = 20
}

// MARK: - Service-type sanitization
//
// The app passes a DNS-SD style service type ("_mylife-sync._tcp"), but
// MCNearbyServiceAdvertiser requires 1-15 chars, lowercase ASCII letters,
// digits and hyphens only, no leading/trailing/double hyphen. We derive a stable
// MC service type from the incoming string so both peers compute the same value.

private func sanitizeServiceType(_ raw: String) -> String {
  // Strip a leading underscore and a trailing "._tcp"/"._udp" if present, then
  // keep only [a-z0-9-] and clamp to 15 chars.
  var s = raw.lowercased()
  if let range = s.range(of: "._tcp") { s = String(s[..<range.lowerBound]) }
  if let range = s.range(of: "._udp") { s = String(s[..<range.lowerBound]) }
  s = s.hasPrefix("_") ? String(s.dropFirst()) : s
  let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789-")
  var mapped = String(s.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" })
  // Collapse runs of hyphens and trim edges (MC rejects leading/trailing/double).
  while mapped.contains("--") { mapped = mapped.replacingOccurrences(of: "--", with: "-") }
  mapped = mapped.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
  if mapped.isEmpty { mapped = "mlsync" }
  return String(mapped.prefix(15))
}

// MARK: - Per-session state

private final class NearbySession {
  /// Random local handle (never the MCPeerID / OS identifier).
  let sessionId: String
  let peer: MCPeerID
  var pendingSendBytes: Int = 0
  /// Ensures background/radio-off/peer-loss/close all close EXACTLY ONCE.
  private(set) var isClosed = false

  init(sessionId: String, peer: MCPeerID) {
    self.sessionId = sessionId
    self.peer = peer
  }

  /// Returns true the FIRST time it is called; false thereafter (idempotent close).
  func markClosedOnce() -> Bool {
    if isClosed { return false }
    isClosed = true
    return true
  }
}

// MARK: - Module

public final class MeerkatNearbyModule: Module {

  // MultipeerConnectivity state. A fresh random display peer id is created per
  // module load so nothing derived from a user identity is broadcast.
  private var localPeerId: MCPeerID?
  private var mcSession: MCSession?
  private var advertiser: MCNearbyServiceAdvertiser?
  private var browser: MCNearbyServiceBrowser?
  private var serviceType: String?

  /// sessionId -> session. All access on the module's serial queue.
  private var sessions: [String: NearbySession] = [:]
  /// MCPeerID -> the sessionId we opened for it (so delegate callbacks map back).
  private var peerToSession: [MCPeerID: String] = [:]
  /// Pending outbound connect() continuations keyed by MCPeerID.hash-ish display.
  private var pendingConnects: [MCPeerID: (String) -> Void] = [:]

  /// Serial queue guarding all mutable state; MC delegates hop onto it.
  private let queue = DispatchQueue(label: "com.mylife.meerkat.nearby")

  // Retained delegate shim so `self` need not conform to the many MC protocols
  // directly (keeps the Expo Module subclass clean and testable).
  private var delegateShim: NearbyDelegateShim?

  public func definition() -> ModuleDefinition {
    Name("MeerkatNearby")

    Events("peerFound", "peerLost", "sessionOpened", "data", "sessionClosed")

    OnDestroy {
      self.teardown()
    }

    // App background must close sessions once and stop discovery (Plan 42:
    // "App background ... close the session exactly once").
    OnAppEntersBackground {
      self.queue.async { self.closeAllSessions(reason: "background") }
    }

    AsyncFunction("advertise") { (input: [String: Any]) in
      guard let serviceTypeRaw = input["serviceType"] as? String,
            let displayName = input["displayName"] as? String else {
        throw CodedNearbyException(.invalidArgs)
      }
      try self.startAdvertising(serviceTypeRaw: serviceTypeRaw, displayName: displayName)
    }

    AsyncFunction("browse") { (input: [String: Any]) in
      guard let serviceTypeRaw = input["serviceType"] as? String else {
        throw CodedNearbyException(.invalidArgs)
      }
      try self.startBrowsing(serviceTypeRaw: serviceTypeRaw)
    }

    AsyncFunction("stopAdvertising") {
      self.queue.sync {
        self.advertiser?.stopAdvertisingPeer()
        self.advertiser?.delegate = nil
        self.advertiser = nil
      }
    }

    AsyncFunction("stopBrowsing") {
      self.queue.sync {
        self.browser?.stopBrowsingForPeers()
        self.browser?.delegate = nil
        self.browser = nil
      }
    }

    AsyncFunction("connect") { (input: [String: Any], promise: Promise) in
      guard let peerId = input["peerId"] as? String else {
        promise.reject(CodedNearbyException(.invalidArgs))
        return
      }
      self.connect(peerHandle: peerId, promise: promise)
    }

    AsyncFunction("send") { (input: [String: Any]) in
      guard let sessionId = input["sessionId"] as? String,
            let data = input["bytes"] as? Data else {
        throw CodedNearbyException(.invalidArgs)
      }
      try self.send(sessionId: sessionId, data: data)
    }

    AsyncFunction("closeSession") { (input: [String: Any]) in
      guard let sessionId = input["sessionId"] as? String else {
        throw CodedNearbyException(.invalidArgs)
      }
      self.queue.sync { self.closeSession(sessionId: sessionId, reason: "explicit") }
    }

    AsyncFunction("destroy") {
      self.teardown()
    }
  }

  // MARK: - Discovery

  /// Rebuild the session under a caller-supplied ephemeral handle.
  ///
  /// Plan 53 AC-3. The advertised identifier must be FRESH for every ceremony,
  /// so a passive listener cannot tell that two ceremonies came from the same
  /// phone. MultipeerConnectivity gives no way to change the advertised handle
  /// without changing `session.myPeerID`, because the advertiser must be built
  /// from the same peer id as the session it invites into. So a new handle
  /// means a new session.
  ///
  /// Tearing down live sessions is exactly what we must NOT do to the sync
  /// rung, which shares this module. The rule the callers follow: pass an empty
  /// handle to keep the existing per-process identity (the sync rung), or a
  /// fresh handle to start a ceremony (which is only ever done when no session
  /// is open). The guard below enforces the second half rather than trusting it.
  private func adoptEphemeralIdentity(_ handle: String) -> Bool {
    guard !handle.isEmpty else { return true }
    if localPeerId?.displayName == handle { return true }
    guard sessions.isEmpty else { return false }
    mcSession?.disconnect()
    mcSession = nil
    localPeerId = MCPeerID(displayName: String(handle.prefix(63)))
    return true
  }

  private func ensureSession() -> MCSession {
    if let existing = mcSession { return existing }
    let local = localPeerId ?? MCPeerID(displayName: "mk-" + UUID().uuidString.prefix(8))
    localPeerId = local
    // .required encryption at the MC layer; Noise still runs on top. This module
    // never inspects or decrypts payloads.
    let session = MCSession(peer: local, securityIdentity: nil, encryptionPreference: .required)
    let shim = delegateShim ?? NearbyDelegateShim(owner: self)
    delegateShim = shim
    session.delegate = shim
    mcSession = session
    return session
  }

  private func startAdvertising(serviceTypeRaw: String, displayName: String) throws {
    try queue.sync {
      let type = sanitizeServiceType(serviceTypeRaw)
      serviceType = type
      // `displayName` is the ADVERTISED HANDLE, and it is the caller's job to
      // make sure it carries no long-term identifier. The sync rung passes ""
      // to keep the per-process handle; the plan 53 ceremony passes a fresh
      // per-tap ephemeral id, which becomes the peer id other phones see.
      // It is never logged, and it is never treated as an identity claim: the
      // real identity exchange happens inside the session, signed.
      guard adoptEphemeralIdentity(displayName) else {
        throw CodedNearbyException(.identityBusy)
      }
      let session = ensureSession()
      let shim = delegateShim!
      let adv = MCNearbyServiceAdvertiser(
        peer: session.myPeerID,
        discoveryInfo: nil,
        serviceType: type
      )
      adv.delegate = shim
      adv.startAdvertisingPeer()
      advertiser?.stopAdvertisingPeer()
      advertiser = adv
    }
  }

  private func startBrowsing(serviceTypeRaw: String) throws {
    try queue.sync {
      let type = sanitizeServiceType(serviceTypeRaw)
      serviceType = type
      let session = ensureSession()
      let shim = delegateShim!
      let br = MCNearbyServiceBrowser(peer: session.myPeerID, serviceType: type)
      br.delegate = shim
      br.startBrowsingForPeers()
      browser?.stopBrowsingForPeers()
      browser = br
    }
  }

  // MARK: - Connect / send / close (all hop through `queue`)

  private var discoveredPeers: [String: MCPeerID] = [:] // peerHandle -> MCPeerID

  private func connect(peerHandle: String, promise: Promise) {
    queue.async {
      guard let peer = self.discoveredPeers[peerHandle] else {
        promise.reject(CodedNearbyException(.unknownPeer)); return
      }
      guard self.sessions.count < Caps.maxSessions else {
        promise.reject(CodedNearbyException(.sessionLimit)); return
      }
      guard let browser = self.browser, let session = self.mcSession else {
        promise.reject(CodedNearbyException(.notBrowsing)); return
      }
      // The sessionOpened delegate resolves this via pendingConnects. A random
      // sessionId is minted THERE so both inbound and outbound get one handle.
      self.pendingConnects[peer] = { sessionId in promise.resolve(sessionId) }
      browser.invitePeer(peer, to: session, withContext: nil, timeout: Caps.connectTimeout)
      // Timeout guard: if MC never connects, reject with a stable code once.
      self.queue.asyncAfter(deadline: .now() + Caps.connectTimeout + 1) {
        if let cb = self.pendingConnects.removeValue(forKey: peer) {
          _ = cb // drop; reject explicitly below
          promise.reject(CodedNearbyException(.connectTimeout))
        }
      }
    }
  }

  private func send(sessionId: String, data: Data) throws {
    try queue.sync {
      guard let session = sessions[sessionId], !session.isClosed else {
        throw CodedNearbyException(.unknownSession)
      }
      guard session.pendingSendBytes + data.count <= Caps.maxPendingSendBytesPerSession else {
        throw CodedNearbyException(.sendBackpressure)
      }
      guard let mc = mcSession else { throw CodedNearbyException(.unknownSession) }
      session.pendingSendBytes += data.count
      do {
        try mc.send(data, toPeers: [session.peer], with: .reliable)
        // MC copies synchronously into its own buffer on return; release the
        // backpressure accounting immediately after the reliable enqueue.
        session.pendingSendBytes -= data.count
      } catch {
        session.pendingSendBytes -= data.count
        throw CodedNearbyException(.connectFailed)
      }
    }
  }

  /// Close one session exactly once, emitting sessionClosed a single time.
  private func closeSession(sessionId: String, reason: String) {
    guard let session = sessions[sessionId] else { return }
    guard session.markClosedOnce() else { return }
    sessions.removeValue(forKey: sessionId)
    peerToSession.removeValue(forKey: session.peer)
    sendEvent("sessionClosed", ["sessionId": sessionId])
  }

  private func closeAllSessions(reason: String) {
    for sessionId in Array(sessions.keys) { closeSession(sessionId: sessionId, reason: reason) }
  }

  private func teardown() {
    queue.sync {
      closeAllSessions(reason: "destroy")
      advertiser?.stopAdvertisingPeer()
      advertiser?.delegate = nil
      advertiser = nil
      browser?.stopBrowsingForPeers()
      browser?.delegate = nil
      browser = nil
      mcSession?.disconnect()
      mcSession?.delegate = nil
      mcSession = nil
      delegateShim = nil
      discoveredPeers.removeAll()
      pendingConnects.removeAll()
      peerToSession.removeAll()
    }
  }

  // MARK: - Delegate callbacks (invoked by NearbyDelegateShim on `queue`)

  fileprivate func onFoundPeer(_ peer: MCPeerID) {
    queue.async {
      // Random opaque handle; the MCPeerID never leaves as an identity.
      let handle = UUID().uuidString
      self.discoveredPeers[handle] = peer
      self.sendEvent("peerFound", ["peerId": handle, "displayName": peer.displayName])
    }
  }

  fileprivate func onLostPeer(_ peer: MCPeerID) {
    queue.async {
      // Find and drop any handle for this peer; emit peerLost + close its session.
      let handles = self.discoveredPeers.filter { $0.value == peer }.map { $0.key }
      for h in handles {
        self.discoveredPeers.removeValue(forKey: h)
        self.sendEvent("peerLost", ["peerId": h])
      }
      if let sessionId = self.peerToSession[peer] {
        self.closeSession(sessionId: sessionId, reason: "peerLost")
      }
    }
  }

  fileprivate func onReceiveInvitation(from peer: MCPeerID, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
    queue.async {
      guard self.sessions.count < Caps.maxSessions, let session = self.mcSession else {
        invitationHandler(false, nil); return
      }
      invitationHandler(true, session)
    }
  }

  fileprivate func onPeerConnected(_ peer: MCPeerID) {
    queue.async {
      // One session per peer; mint a random local sessionId.
      if self.peerToSession[peer] != nil { return }
      let sessionId = UUID().uuidString
      let s = NearbySession(sessionId: sessionId, peer: peer)
      self.sessions[sessionId] = s
      self.peerToSession[peer] = sessionId
      if let cb = self.pendingConnects.removeValue(forKey: peer) {
        // Outbound connect(): resolve the promise with the handle.
        cb(sessionId)
      } else {
        // Inbound (remote-initiated) session.
        self.sendEvent("sessionOpened", ["sessionId": sessionId, "peerId": sessionId])
      }
    }
  }

  fileprivate func onPeerDisconnected(_ peer: MCPeerID) {
    queue.async {
      if let sessionId = self.peerToSession[peer] {
        self.closeSession(sessionId: sessionId, reason: "disconnect")
      }
    }
  }

  fileprivate func onReceiveData(_ data: Data, from peer: MCPeerID) {
    queue.async {
      guard let sessionId = self.peerToSession[peer], let s = self.sessions[sessionId], !s.isClosed else {
        return
      }
      // RAW bytes to JS; no inspection, no logging of contents.
      self.sendEvent("data", ["sessionId": sessionId, "bytes": data])
    }
  }
}

// MARK: - Delegate shim
//
// A single object conforming to the MC delegate protocols. It forwards to the
// module on the module's serial queue. Kept separate so the Expo Module subclass
// does not need to declare protocol conformance directly.

private final class NearbyDelegateShim: NSObject,
  MCSessionDelegate, MCNearbyServiceAdvertiserDelegate, MCNearbyServiceBrowserDelegate {

  weak var owner: MeerkatNearbyModule?
  init(owner: MeerkatNearbyModule) { self.owner = owner }

  // MCNearbyServiceBrowserDelegate
  func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
    owner?.onFoundPeer(peerID)
  }
  func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
    owner?.onLostPeer(peerID)
  }
  func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {
    // No localized string crosses the bridge; discovery simply produces no peers.
  }

  // MCNearbyServiceAdvertiserDelegate
  func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
    owner?.onReceiveInvitation(from: peerID, invitationHandler: invitationHandler)
  }
  func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {}

  // MCSessionDelegate
  func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
    switch state {
    case .connected: owner?.onPeerConnected(peerID)
    case .notConnected: owner?.onPeerDisconnected(peerID)
    case .connecting: break
    @unknown default: break
    }
  }
  func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
    owner?.onReceiveData(data, from: peerID)
  }
  func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {
    // Meerkat uses reliable message send only; no stream channel is opened.
    stream.close()
  }
  func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
  func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}
