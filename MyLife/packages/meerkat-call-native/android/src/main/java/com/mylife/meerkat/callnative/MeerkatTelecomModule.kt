// UNVERIFIED - pending dev build (Plan 25 WP-25F). This Kotlin source is AUTHORED
// in-repo but has NOT been compiled or device-proven: this environment has no
// signed Android dev build. A signed build must compile it and the physical-device
// matrix must prove it. Nothing here is evidence for AC-25.3, and the JS bridge
// stays honestly unavailable until this native module loads at runtime.
//
// Android calls use AndroidX Core Telecom's self-managed CallsManager. Every
// capability and command path fails closed on unsupported APIs, missing
// MANAGE_OWN_CALLS permission, invalid Telecom builds, and OEM failures.

package com.mylife.meerkat.callnative

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.telecom.DisconnectCause
import androidx.core.content.ContextCompat
import androidx.core.telecom.CallAttributesCompat
import androidx.core.telecom.CallControlResult
import androidx.core.telecom.CallControlScope
import androidx.core.telecom.CallEndpointCompat
import androidx.core.telecom.CallsManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

private class TelecomCodedException(code: String) :
  CodedException(code, "Meerkat native Telecom error: $code", null)

private data class SupportStatus(val available: Boolean, val reason: String)

private enum class NativeEndReason(val wireValue: String) {
  FAILED("failed"),
  REMOTE_ENDED("remoteEnded"),
  UNANSWERED("unanswered"),
  ANSWERED_ELSEWHERE("answeredElsewhere"),
  DECLINED_ELSEWHERE("declinedElsewhere"),
  LOCAL_ENDED("localEnded"),
  REJECTED("rejected"),
  MISSED("missed"),
  BUSY("busy"),
  CANCELLED("cancelled"),
  RESET("reset"),
  UNKNOWN("unknown");

  companion object {
    fun fromWireValue(value: String): NativeEndReason? = entries.firstOrNull {
      it.wireValue == value
    }
  }
}

private class ManagedCall(
  val callId: String,
  @Volatile var hasVideo: Boolean,
  val direction: Int,
  val addPromise: Promise,
) {
  @Volatile var control: CallControlScope? = null
  @Volatile var currentEndpoint: CallEndpointCompat? = null
  @Volatile var availableEndpoints: List<CallEndpointCompat> = emptyList()
  @Volatile var job: Job? = null
  val ended = AtomicBoolean(false)
  val answeredEventSent = AtomicBoolean(false)
  val addPromiseSettled = AtomicBoolean(false)
}

class MeerkatTelecomModule : Module() {
  private val moduleJob = SupervisorJob()
  private val moduleScope = CoroutineScope(moduleJob + Dispatchers.Main.immediate)
  private val registrationLock = Any()
  private val calls = ConcurrentHashMap<String, ManagedCall>()

  @Volatile private var callsManager: CallsManager? = null
  @Volatile private var registered = false

  override fun definition() = ModuleDefinition {
    Name("MeerkatTelecom")

    Events(
      "incomingCallReported",
      "callAnswered",
      "callEnded",
      "muteChanged",
      "audioSessionChanged",
      "voipTokenChanged",
      "telecomStateChanged",
    )

    OnDestroy { teardown() }

    AsyncFunction("isSupported") {
      val status = supportStatus(register = true)
      mapOf(
        "platform" to "android",
        "available" to status.available,
        "reason" to status.reason,
      )
    }

    AsyncFunction("registerPhoneAccount") {
      requireRegistered()
    }

    AsyncFunction("addIncomingCall") { input: Map<String, Any?>, promise: Promise ->
      addCall(input, CallAttributesCompat.DIRECTION_INCOMING, promise)
    }

    AsyncFunction("addOutgoingCall") { input: Map<String, Any?>, promise: Promise ->
      addCall(input, CallAttributesCompat.DIRECTION_OUTGOING, promise)
    }

    AsyncFunction("answerCall") { input: Map<String, Any?>, promise: Promise ->
      val callId = parseCallIdOrReject(input, promise) ?: return@AsyncFunction
      val hasVideo = input["hasVideo"] as? Boolean
      if (hasVideo == null) {
        promise.reject(TelecomCodedException("ERR_INVALID_ARGS"))
        return@AsyncFunction
      }
      runControlCommand(callId, promise) { call, control ->
        val callType = callType(hasVideo)
        requireSuccess(control.answer(callType))
        call.hasVideo = hasVideo
        emitAnsweredOnce(call)
        emitTelecomState(call, "active")
      }
    }

    AsyncFunction("setCallActive") { input: Map<String, Any?>, promise: Promise ->
      val callId = parseCallIdOrReject(input, promise) ?: return@AsyncFunction
      val active = input["active"] as? Boolean
      if (active == null) {
        promise.reject(TelecomCodedException("ERR_INVALID_ARGS"))
        return@AsyncFunction
      }
      runControlCommand(callId, promise) { call, control ->
        val result = if (active) control.setActive() else control.setInactive()
        requireSuccess(result)
        emitTelecomState(call, if (active) "active" else "inactive")
      }
    }

    AsyncFunction("setMuted") { input: Map<String, Any?> ->
      val callId = parseCallId(input)
      if (input["muted"] !is Boolean || calls[callId] == null) {
        throw TelecomCodedException(
          if (calls[callId] == null) "ERR_CALL_NOT_FOUND" else "ERR_INVALID_ARGS"
        )
      }
      throw TelecomCodedException("ERR_MUTE_CONTROL_SYSTEM_OWNED")
    }

    AsyncFunction("disconnect") { input: Map<String, Any?>, promise: Promise ->
      val callId = parseCallIdOrReject(input, promise) ?: return@AsyncFunction
      val rawReason = input["reason"] as? String
      val reason = rawReason?.let(NativeEndReason::fromWireValue)
      if (reason == null) {
        promise.reject(TelecomCodedException("ERR_INVALID_ARGS"))
        return@AsyncFunction
      }
      runControlCommand(callId, promise) { call, control ->
        requireSuccess(control.disconnect(disconnectCause(reason)))
        finishCall(call, reason)
      }
    }

    AsyncFunction("setAudioRoute") { input: Map<String, Any?>, promise: Promise ->
      val callId = parseCallIdOrReject(input, promise) ?: return@AsyncFunction
      val route = input["route"] as? String
      val endpointIdValue = input["endpointId"]
      if (route == null || (endpointIdValue != null && endpointIdValue !is String)) {
        promise.reject(TelecomCodedException("ERR_INVALID_ARGS"))
        return@AsyncFunction
      }
      val endpointId = endpointIdValue as? String

      runControlCommand(callId, promise) { call, control ->
        val endpoint = call.availableEndpoints.firstOrNull {
          endpointRoute(it) == route &&
            (endpointId == null || it.identifier.toString() == endpointId)
        } ?: throw TelecomCodedException("ERR_AUDIO_ENDPOINT_NOT_AVAILABLE")
        requireSuccess(control.requestEndpointChange(endpoint))
        call.currentEndpoint = endpoint
        emitTelecomState(call, "audio-endpoint-changed")
      }
    }
  }

  private fun contextOrNull(): Context? = appContext.reactContext?.applicationContext

  private fun supportStatus(register: Boolean): SupportStatus {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return SupportStatus(false, "android-api-below-26")
    }

    val context = contextOrNull()
      ?: return SupportStatus(false, "native-context-unavailable")
    if (!context.packageManager.hasSystemFeature("android.software.telecom")) {
      return SupportStatus(false, "telecom-feature-missing")
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.MANAGE_OWN_CALLS)
      != PackageManager.PERMISSION_GRANTED
    ) {
      return SupportStatus(false, "manage-own-calls-permission-missing")
    }

    return synchronized(registrationLock) {
      try {
        val manager = callsManager ?: CallsManager(context).also { callsManager = it }
        if (register && !registered) {
          manager.registerAppWithTelecom(
            CallsManager.CAPABILITY_BASELINE or
              CallsManager.CAPABILITY_SUPPORTS_VIDEO_CALLING
          )
          registered = true
        }
        SupportStatus(true, "available")
      } catch (_: SecurityException) {
        registered = false
        SupportStatus(false, "manage-own-calls-permission-missing")
      } catch (_: UnsupportedOperationException) {
        registered = false
        SupportStatus(false, "telecom-build-unsupported")
      } catch (_: Throwable) {
        registered = false
        SupportStatus(false, "telecom-registration-failed")
      }
    }
  }

  private fun requireRegistered(): CallsManager {
    val status = supportStatus(register = true)
    if (!status.available) {
      val code = when (status.reason) {
        "android-api-below-26" -> "ERR_UNSUPPORTED_API"
        "manage-own-calls-permission-missing" -> "ERR_MANAGE_OWN_CALLS_PERMISSION"
        "telecom-build-unsupported" -> "ERR_TELECOM_INVALID_BUILD"
        "native-context-unavailable" -> "ERR_NO_CONTEXT"
        else -> "ERR_TELECOM_UNAVAILABLE"
      }
      throw TelecomCodedException(code)
    }
    return callsManager ?: throw TelecomCodedException("ERR_TELECOM_UNAVAILABLE")
  }

  private fun addCall(input: Map<String, Any?>, direction: Int, promise: Promise) {
    val callId = parseCallIdOrReject(input, promise) ?: return
    val hasVideo = input["hasVideo"] as? Boolean
    if (hasVideo == null) {
      promise.reject(TelecomCodedException("ERR_INVALID_ARGS"))
      return
    }

    val manager = try {
      requireRegistered()
    } catch (error: TelecomCodedException) {
      promise.reject(error)
      return
    }

    val call = ManagedCall(callId, hasVideo, direction, promise)
    if (calls.putIfAbsent(callId, call) != null) {
      promise.reject(TelecomCodedException("ERR_DUPLICATE_CALL"))
      return
    }

    val attributes = CallAttributesCompat(
      displayName = "Meerkat Call",
      address = Uri.parse("sip:${UUID.randomUUID()}@meerkat.invalid"),
      direction = direction,
      callType = callType(hasVideo),
      callCapabilities = CallAttributesCompat.SUPPORTS_SET_INACTIVE,
      preferredStartingCallEndpoint = null,
      isLogExcluded = true,
    )

    call.job = moduleScope.launch {
      try {
        manager.addCall(
          callAttributes = attributes,
          onAnswer = { requestedType ->
            call.hasVideo = requestedType == CallAttributesCompat.CALL_TYPE_VIDEO_CALL
            emitAnsweredOnce(call)
            emitTelecomState(call, "active")
          },
          onDisconnect = { cause ->
            finishCall(call, endReason(cause))
          },
          onSetActive = {
            emitTelecomState(call, "active")
          },
          onSetInactive = {
            emitTelecomState(call, "inactive")
          },
        ) {
          call.control = this
          observeAudioState(call, this)
          emitTelecomState(
            call,
            if (direction == CallAttributesCompat.DIRECTION_INCOMING) "ringing" else "dialing"
          )
          resolveAddPromise(call)
        }

        if (!call.ended.get()) {
          finishCall(call, NativeEndReason.UNKNOWN)
        }
      } catch (_: CancellationException) {
        rejectAddPromise(call, TelecomCodedException("ERR_MODULE_DESTROYED"))
      } catch (_: Throwable) {
        rejectAddPromise(call, TelecomCodedException("ERR_TELECOM_ADD_CALL_FAILED"))
        finishCall(call, NativeEndReason.FAILED)
      }
    }
  }

  private fun observeAudioState(call: ManagedCall, control: CallControlScope) {
    control.launch {
      control.currentCallEndpoint.collect { endpoint ->
        call.currentEndpoint = endpoint
        emitTelecomState(call, "audio-endpoint-changed")
      }
    }
    control.launch {
      control.availableEndpoints.collect { endpoints ->
        call.availableEndpoints = endpoints
        emitTelecomState(call, "available-audio-routes-changed")
      }
    }
    control.launch {
      control.isMuted.collect { muted ->
        sendEvent(
          "muteChanged",
          mapOf("callId" to call.callId, "muted" to muted, "platform" to "android")
        )
      }
    }
  }

  private fun runControlCommand(
    callId: String,
    promise: Promise,
    command: suspend (ManagedCall, CallControlScope) -> Unit,
  ) {
    val call = calls[callId]
    if (call == null || call.ended.get()) {
      promise.reject(TelecomCodedException("ERR_CALL_NOT_FOUND"))
      return
    }
    val control = call.control
    if (control == null) {
      promise.reject(TelecomCodedException("ERR_CALL_NOT_READY"))
      return
    }

    moduleScope.launch {
      try {
        command(call, control)
        promise.resolve(null)
      } catch (error: TelecomCodedException) {
        promise.reject(error)
      } catch (_: CancellationException) {
        promise.reject(TelecomCodedException("ERR_MODULE_DESTROYED"))
      } catch (_: Throwable) {
        promise.reject(TelecomCodedException("ERR_TELECOM_COMMAND_FAILED"))
      }
    }
  }

  private fun resolveAddPromise(call: ManagedCall) {
    if (call.addPromiseSettled.compareAndSet(false, true)) {
      call.addPromise.resolve(null)
    }
  }

  private fun rejectAddPromise(call: ManagedCall, error: TelecomCodedException) {
    if (call.addPromiseSettled.compareAndSet(false, true)) {
      calls.remove(call.callId, call)
      call.addPromise.reject(error)
    }
  }

  private fun emitAnsweredOnce(call: ManagedCall) {
    if (!call.answeredEventSent.compareAndSet(false, true)) return
    sendEvent(
      "callAnswered",
      mapOf("callId" to call.callId, "platform" to "android")
    )
  }

  private fun finishCall(call: ManagedCall, reason: NativeEndReason) {
    if (!call.ended.compareAndSet(false, true)) return
    calls.remove(call.callId, call)
    sendEvent(
      "callEnded",
      mapOf(
        "callId" to call.callId,
        "platform" to "android",
        "reason" to reason.wireValue,
      )
    )
  }

  private fun emitTelecomState(call: ManagedCall, state: String) {
    val body = mutableMapOf<String, Any?>(
      "callId" to call.callId,
      "platform" to "android",
      "state" to state,
      "availableRoutes" to call.availableEndpoints.map(::endpointDescriptor),
    )
    call.currentEndpoint?.let { body["audioRoute"] = endpointRoute(it) }
    sendEvent("telecomStateChanged", body)
  }

  private fun endpointDescriptor(endpoint: CallEndpointCompat): Map<String, String> = mapOf(
    "id" to endpoint.identifier.toString(),
    "type" to endpointRoute(endpoint),
  )

  private fun endpointRoute(endpoint: CallEndpointCompat): String = when (endpoint.type) {
    CallEndpointCompat.TYPE_EARPIECE -> "earpiece"
    CallEndpointCompat.TYPE_SPEAKER -> "speaker"
    CallEndpointCompat.TYPE_BLUETOOTH -> "bluetooth"
    CallEndpointCompat.TYPE_WIRED_HEADSET -> "wiredHeadset"
    CallEndpointCompat.TYPE_STREAMING -> "streaming"
    else -> "unknown"
  }

  private fun requireSuccess(result: CallControlResult) {
    if (result is CallControlResult.Error) {
      throw TelecomCodedException("ERR_TELECOM_COMMAND_FAILED")
    }
  }

  private fun callType(hasVideo: Boolean): Int = if (hasVideo) {
    CallAttributesCompat.CALL_TYPE_VIDEO_CALL
  } else {
    CallAttributesCompat.CALL_TYPE_AUDIO_CALL
  }

  private fun parseCallIdOrReject(input: Map<String, Any?>, promise: Promise): String? = try {
    parseCallId(input)
  } catch (error: TelecomCodedException) {
    promise.reject(error)
    null
  }

  private fun parseCallId(input: Map<String, Any?>): String {
    val raw = input["callId"] as? String ?: throw TelecomCodedException("ERR_INVALID_ARGS")
    return try {
      UUID.fromString(raw).toString()
    } catch (_: IllegalArgumentException) {
      throw TelecomCodedException("ERR_INVALID_ARGS")
    }
  }

  private fun endReason(cause: DisconnectCause): NativeEndReason = when (cause.code) {
    DisconnectCause.LOCAL -> NativeEndReason.LOCAL_ENDED
    DisconnectCause.REMOTE -> NativeEndReason.REMOTE_ENDED
    DisconnectCause.REJECTED -> NativeEndReason.REJECTED
    DisconnectCause.MISSED -> NativeEndReason.MISSED
    DisconnectCause.BUSY -> NativeEndReason.BUSY
    DisconnectCause.CANCELED -> NativeEndReason.CANCELLED
    DisconnectCause.ERROR -> NativeEndReason.FAILED
    else -> NativeEndReason.UNKNOWN
  }

  private fun disconnectCause(reason: NativeEndReason): DisconnectCause = DisconnectCause(
    when (reason) {
      NativeEndReason.REMOTE_ENDED -> DisconnectCause.REMOTE
      NativeEndReason.UNANSWERED, NativeEndReason.MISSED -> DisconnectCause.MISSED
      NativeEndReason.DECLINED_ELSEWHERE, NativeEndReason.REJECTED -> DisconnectCause.REJECTED
      NativeEndReason.BUSY -> DisconnectCause.BUSY
      NativeEndReason.CANCELLED -> DisconnectCause.CANCELED
      NativeEndReason.FAILED, NativeEndReason.RESET, NativeEndReason.UNKNOWN -> DisconnectCause.ERROR
      NativeEndReason.ANSWERED_ELSEWHERE, NativeEndReason.LOCAL_ENDED -> DisconnectCause.LOCAL
    }
  )

  private fun teardown() {
    for (call in calls.values) {
      rejectAddPromise(call, TelecomCodedException("ERR_MODULE_DESTROYED"))
      call.job?.cancel()
    }
    calls.clear()
    moduleScope.cancel()
  }
}
