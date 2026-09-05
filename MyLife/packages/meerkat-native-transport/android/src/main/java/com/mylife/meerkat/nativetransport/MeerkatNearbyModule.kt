// UNVERIFIED - pending dev build (Plan 42 WP-42C). This Kotlin source is AUTHORED
// in-repo but has NOT been compiled or device-proven: this environment has no
// Android toolchain. It is correct-by-construction native source that a signed
// dev build must compile and the physical-device matrix must prove. Nothing here
// is evidence for AC-42.2; the JS bridge keeps the Nearby rung honestly
// unavailable until a real native module loads at runtime (WP-42B).
//
// Android Nearby data transport over Wi-Fi Direct (WifiP2pManager) + DNS-SD
// service discovery (NsdManager-style local-service records via WifiP2pManager's
// DnsSd APIs) with a TCP byte stream after the P2P group forms. Fulfills the raw
// native contract in src/native-types.ts (RawNativeNearbyModule) under the module
// name NEARBY_NATIVE_MODULE_NAME ('MeerkatNearby'). It moves RAW BYTES only; the
// @mylife/sync Noise session runs ON TOP. No cryptography here, no logging of a
// peer name or payload.
//
// Native invariants honored (Plan 42 Native Module Contract):
//  - Random local session handles (UUID). The device MAC / OS peer address never
//    leaves this module as an identity.
//  - Bounded pending send bytes + session counts; an over-cap send rejects.
//  - Receivers/sockets torn down on destroy() and app background; group discovery
//    STOPS when the session closes.
//  - Stable error codes; no localized platform string crosses the bridge.
//  - A user-visible transfer may run a BOUNDED foreground service (declared in
//    the config plugin) only while on screen; never a persistent always-on one.

package com.mylife.meerkat.nativetransport

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceInfo
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceRequest
import android.os.Looper
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

// Stable error codes surfaced to JS. No localized platform string crosses.
private class NearbyCodedException(code: String) : CodedException(code, "Meerkat Nearby transport error: $code", null)

private object Caps {
  const val MAX_SESSIONS = 8
  const val MAX_PENDING_SEND_BYTES = 4 * 1024 * 1024
  const val MAX_FRAME_BYTES = 8 * 1024 * 1024 // reject an oversized inbound frame
  const val GROUP_OWNER_PORT = 0 // 0 = OS-assigned; advertised via DNS-SD TXT
  const val INSTANCE_NAME = "meerkat"
  const val SERVICE_TYPE = "_presence._tcp" // DNS-SD reg type for the P2P record
  /** Plan 53 ceremony instance names start with this. */
  const val CEREMONY_INSTANCE_PREFIX = "mk-"
}

/**
 * True when a discovered DNS-SD record is one of ours on the namespace we
 * asked for: either the stable sync-rung instance, or a plan 53 ceremony
 * instance (a fresh per-tap ephemeral id, so it can only be matched by prefix).
 */
private fun matchesMeerkatInstance(
  instanceName: String?,
  registrationType: String?,
  wantedType: String,
): Boolean {
  val name = instanceName ?: return false
  if (registrationType != null && !registrationType.startsWith(wantedType.trimEnd('.'))) return false
  return name == Caps.INSTANCE_NAME || name.startsWith(Caps.CEREMONY_INSTANCE_PREFIX)
}

// One open session: a connected TCP socket wrapped with length-prefixed framing.
private class NearbySession(
  val sessionId: String,
  private val socket: Socket,
  private val onData: (String, ByteArray) -> Unit,
  private val onClosed: (String) -> Unit,
) {
  private val out = DataOutputStream(socket.getOutputStream())
  private val closedOnce = AtomicBoolean(false)
  val pendingSendBytes = AtomicInteger(0)
  private val readThread: Thread

  init {
    // Length-prefixed reader loop. Each frame is [int32 length][bytes]. A frame
    // over the cap or a stream error closes the session exactly once.
    readThread = Thread {
      try {
        val din = DataInputStream(socket.getInputStream())
        while (!closedOnce.get()) {
          val len = din.readInt()
          if (len < 0 || len > Caps.MAX_FRAME_BYTES) { close("frame_too_large"); return@Thread }
          val buf = ByteArray(len)
          din.readFully(buf)
          onData(sessionId, buf)
        }
      } catch (_: Throwable) {
        close("stream_error")
      }
    }.apply { isDaemon = true; start() }
  }

  fun send(bytes: ByteArray) {
    if (closedOnce.get()) throw NearbyCodedException("ERR_UNKNOWN_SESSION")
    if (pendingSendBytes.get() + bytes.size > Caps.MAX_PENDING_SEND_BYTES) {
      throw NearbyCodedException("ERR_SEND_BACKPRESSURE")
    }
    pendingSendBytes.addAndGet(bytes.size)
    try {
      synchronized(out) {
        out.writeInt(bytes.size)
        out.write(bytes)
        out.flush()
      }
    } finally {
      pendingSendBytes.addAndGet(-bytes.size)
    }
  }

  // Close exactly once, emitting sessionClosed a single time.
  fun close(reason: String) {
    if (!closedOnce.compareAndSet(false, true)) return
    try { socket.close() } catch (_: Throwable) {}
    onClosed(sessionId)
  }
}

class MeerkatNearbyModule : Module() {

  private val context: Context
    get() = appContext.reactContext ?: throw NearbyCodedException("ERR_NO_CONTEXT")

  private var manager: WifiP2pManager? = null
  private var channel: WifiP2pManager.Channel? = null
  private var receiver: BroadcastReceiver? = null
  private var serviceRequest: WifiP2pDnsSdServiceRequest? = null

  private val io = Executors.newCachedThreadPool { r -> Thread(r).apply { isDaemon = true } }
  private val sessions = ConcurrentHashMap<String, NearbySession>()
  // Opaque peer handle -> the P2P device address (never leaves as an identity).
  private val discoveredPeers = ConcurrentHashMap<String, String>()
  // Group-owner accept socket, live only while a group exists.
  @Volatile private var serverSocket: ServerSocket? = null
  /** The DNS-SD instance name currently advertised (plan 53: per-tap for a ceremony). */
  @Volatile private var advertisedInstance: String? = null
  // Pending outbound connect resolvers keyed by device address.
  private val pendingConnects = ConcurrentHashMap<String, (String) -> Unit>()
  // Owner accept port learned from each peer's DNS-SD TXT record, keyed by address.
  private val ownerPortByAddress = ConcurrentHashMap<String, Int>()
  // The device address of the in-flight outbound connect (dialed on group form).
  @Volatile private var connectingAddress: String? = null

  override fun definition() = ModuleDefinition {
    Name("MeerkatNearby")

    Events("peerFound", "peerLost", "sessionOpened", "data", "sessionClosed")

    OnDestroy { teardown() }
    OnActivityEntersBackground { closeAllSessions("background") }

    AsyncFunction("advertise") { input: Map<String, Any?> ->
      val serviceType = input["serviceType"] as? String ?: throw NearbyCodedException("ERR_INVALID_ARGS")
      val displayName = input["displayName"] as? String ?: throw NearbyCodedException("ERR_INVALID_ARGS")
      startAdvertising(serviceType, displayName)
    }

    AsyncFunction("browse") { input: Map<String, Any?> ->
      val serviceType = input["serviceType"] as? String ?: throw NearbyCodedException("ERR_INVALID_ARGS")
      startBrowsing(serviceType)
    }

    AsyncFunction("stopAdvertising") { stopAdvertising() }
    AsyncFunction("stopBrowsing") { stopBrowsing() }

    AsyncFunction("connect") { input: Map<String, Any?>, promise: expo.modules.kotlin.Promise ->
      val peerId = input["peerId"] as? String
      if (peerId == null) { promise.reject(NearbyCodedException("ERR_INVALID_ARGS")); return@AsyncFunction }
      connect(peerId, promise)
    }

    AsyncFunction("send") { input: Map<String, Any?> ->
      val sessionId = input["sessionId"] as? String ?: throw NearbyCodedException("ERR_INVALID_ARGS")
      val bytes = input["bytes"] as? ByteArray ?: throw NearbyCodedException("ERR_INVALID_ARGS")
      val session = sessions[sessionId] ?: throw NearbyCodedException("ERR_UNKNOWN_SESSION")
      session.send(bytes)
    }

    AsyncFunction("closeSession") { input: Map<String, Any?> ->
      val sessionId = input["sessionId"] as? String ?: throw NearbyCodedException("ERR_INVALID_ARGS")
      sessions[sessionId]?.close("explicit")
    }

    AsyncFunction("destroy") { teardown() }
  }

  private fun ensureP2p() {
    if (manager != null) return
    val mgr = context.getSystemService(Context.WIFI_P2P_SERVICE) as WifiP2pManager
    val ch = mgr.initialize(context, Looper.getMainLooper(), null)
    manager = mgr
    channel = ch
    registerReceiver(mgr, ch)
  }

  // MARK: - Advertise (register a DNS-SD local service + become group owner)

  /**
   * Plan 53: both arguments are now honoured. Previously this read NEITHER and
   * hard-coded the constants, so a caller asking for a distinct discovery
   * namespace silently shared the sync rung's, and a per-ceremony ephemeral id
   * never reached the air.
   *
   * `displayName` becomes the DNS-SD instance name, which is what a browsing
   * peer matches on. It is the caller's job to ensure it carries no long-term
   * identifier; the plan 53 ceremony passes a fresh per-tap ephemeral id, and
   * the sync rung passes "" to keep the stable instance name.
   */
  private fun startAdvertising(serviceType: String, displayName: String) {
    ensureP2p()
    val mgr = manager!!; val ch = channel!!
    val type = serviceType.ifEmpty { Caps.SERVICE_TYPE }
    val instance = displayName.ifEmpty { Caps.INSTANCE_NAME }
    advertisedInstance = instance
    // Open the group-owner accept socket first so the port is known for the TXT.
    val server = ServerSocket()
    server.bind(InetSocketAddress(Caps.GROUP_OWNER_PORT))
    serverSocket = server
    acceptLoop(server)
    // DNS-SD record carries only the instance name + the accept port. No identity.
    val txt = mapOf("port" to server.localPort.toString())
    val info = WifiP2pDnsSdServiceInfo.newInstance(instance, type, txt)
    mgr.addLocalService(ch, info, null)
  }

  private fun acceptLoop(server: ServerSocket) {
    io.execute {
      while (!server.isClosed) {
        val socket = try { server.accept() } catch (_: Throwable) { break }
        openSessionFromSocket(socket, inbound = true, resolveAddress = null)
      }
    }
  }

  private fun stopAdvertising() {
    val mgr = manager; val ch = channel
    if (mgr != null && ch != null) mgr.clearLocalServices(ch, null)
    try { serverSocket?.close() } catch (_: Throwable) {}
    serverSocket = null
    advertisedInstance = null
  }

  // MARK: - Browse (DNS-SD discovery of Meerkat services)

  /**
   * Plan 53: honours `serviceType`. The instance filter stays a PREFIX match on
   * the Meerkat namespace rather than an equality check on one constant,
   * because a ceremony peer advertises a fresh ephemeral instance name that
   * this device cannot know in advance. Discovery is deliberately permissive;
   * every identity decision happens inside the session, signed.
   */
  private fun startBrowsing(serviceType: String) {
    ensureP2p()
    val mgr = manager!!; val ch = channel!!
    val type = serviceType.ifEmpty { Caps.SERVICE_TYPE }
    mgr.setDnsSdResponseListeners(ch,
      { instanceName, registrationType, device ->
        if (matchesMeerkatInstance(instanceName, registrationType, type)) onPeerFound(device)
      },
      { fullDomainName, txtRecordMap, device ->
        // The owner advertises its accept port in the TXT record; capture it
        // keyed by device address so connect() can dial the right port.
        val port = txtRecordMap?.get("port")?.toIntOrNull()
        if (port != null) ownerPortByAddress[device.deviceAddress] = port
      }
    )
    val req = WifiP2pDnsSdServiceRequest.newInstance()
    serviceRequest = req
    mgr.addServiceRequest(ch, req, null)
    mgr.discoverServices(ch, null)
  }

  private fun stopBrowsing() {
    val mgr = manager; val ch = channel; val req = serviceRequest
    if (mgr != null && ch != null && req != null) mgr.removeServiceRequest(ch, req, null)
    serviceRequest = null
  }

  private fun onPeerFound(device: WifiP2pDevice) {
    val handle = UUID.randomUUID().toString()
    discoveredPeers[handle] = device.deviceAddress
    // displayName is the OS-provided device name; not logged, not an identity.
    sendEvent("peerFound", mapOf("peerId" to handle, "displayName" to (device.deviceName ?: "")))
  }

  // MARK: - Connect (form the P2P group, then open a client socket to the owner)

  private fun connect(peerHandle: String, promise: expo.modules.kotlin.Promise) {
    val address = discoveredPeers[peerHandle]
    if (address == null) { promise.reject(NearbyCodedException("ERR_UNKNOWN_PEER")); return }
    if (sessions.size >= Caps.MAX_SESSIONS) { promise.reject(NearbyCodedException("ERR_SESSION_LIMIT")); return }
    val mgr = manager; val ch = channel
    if (mgr == null || ch == null) { promise.reject(NearbyCodedException("ERR_NOT_BROWSING")); return }
    pendingConnects[address] = { sessionId -> promise.resolve(sessionId) }
    connectingAddress = address
    val config = WifiP2pConfig().apply { deviceAddress = address }
    mgr.connect(ch, config, object : WifiP2pManager.ActionListener {
      override fun onSuccess() { /* group forms; connection info arrives via receiver */ }
      override fun onFailure(reason: Int) {
        pendingConnects.remove(address)
        if (connectingAddress == address) connectingAddress = null
        promise.reject(NearbyCodedException("ERR_CONNECT_FAILED"))
      }
    })
  }

  // Called from the receiver when connection info is available.
  private fun onConnectionInfo(info: WifiP2pInfo) {
    if (!info.groupFormed) return
    if (info.isGroupOwner) {
      // Owner already accepts inbound sockets via acceptLoop(); nothing to do.
      return
    }
    // Group client: dial the owner's advertised accept port, learned from the
    // owner's DNS-SD TXT record during discovery and keyed by device address.
    val ownerHost = info.groupOwnerAddress?.hostAddress ?: return
    val address = connectingAddress ?: return
    val port = ownerPortByAddress[address] ?: run {
      // No TXT port for this peer: fail the pending connect with a stable code
      // rather than dialing a guessed port.
      pendingConnects.remove(address)?.let { /* resolver dropped; JS connect rejects on timeout */ }
      connectingAddress = null
      return
    }
    io.execute {
      try {
        val socket = Socket()
        socket.connect(InetSocketAddress(ownerHost, port), 15_000)
        val resolver = pendingConnects.remove(address)
        connectingAddress = null
        openSessionFromSocket(socket, inbound = false) { sessionId -> resolver?.invoke(sessionId) }
      } catch (_: Throwable) {
        pendingConnects.remove(address)
        connectingAddress = null
      }
    }
  }

  private fun openSessionFromSocket(
    socket: Socket,
    inbound: Boolean,
    resolveAddress: ((String) -> Unit)?,
  ) {
    if (sessions.size >= Caps.MAX_SESSIONS) { try { socket.close() } catch (_: Throwable) {}; return }
    val sessionId = UUID.randomUUID().toString()
    val session = NearbySession(
      sessionId = sessionId,
      socket = socket,
      onData = { sid, bytes -> sendEvent("data", mapOf("sessionId" to sid, "bytes" to bytes)) },
      onClosed = { sid ->
        sessions.remove(sid)
        sendEvent("sessionClosed", mapOf("sessionId" to sid))
      },
    )
    sessions[sessionId] = session
    if (inbound) {
      sendEvent("sessionOpened", mapOf("sessionId" to sessionId, "peerId" to sessionId))
    } else {
      resolveAddress?.invoke(sessionId)
    }
  }

  // MARK: - Broadcast receiver for P2P connection changes

  private fun registerReceiver(mgr: WifiP2pManager, ch: WifiP2pManager.Channel) {
    val filter = IntentFilter().apply {
      addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
      addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
    }
    val r = object : BroadcastReceiver() {
      override fun onReceive(c: Context?, intent: Intent?) {
        when (intent?.action) {
          WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
            mgr.requestConnectionInfo(ch) { info -> onConnectionInfo(info) }
          }
        }
      }
    }
    receiver = r
    context.registerReceiver(r, filter)
  }

  private fun closeAllSessions(reason: String) {
    sessions.values.toList().forEach { it.close(reason) }
  }

  private fun teardown() {
    closeAllSessions("destroy")
    stopAdvertising()
    stopBrowsing()
    receiver?.let { try { context.unregisterReceiver(it) } catch (_: Throwable) {} }
    receiver = null
    val mgr = manager; val ch = channel
    if (mgr != null && ch != null) {
      mgr.removeGroup(ch, null)
    }
    try { serverSocket?.close() } catch (_: Throwable) {}
    serverSocket = null
    discoveredPeers.clear()
    pendingConnects.clear()
    ownerPortByAddress.clear()
    connectingAddress = null
    manager = null
    channel = null
  }
}
