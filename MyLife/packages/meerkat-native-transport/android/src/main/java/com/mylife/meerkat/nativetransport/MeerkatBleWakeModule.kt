// UNVERIFIED - pending dev build (Plan 42 WP-42C). This Kotlin source is AUTHORED
// in-repo but has NOT been compiled or device-proven: this environment has no
// Android toolchain. Nothing here is evidence for AC-42.3; the JS bridge keeps
// the BLE-wake rung honestly unavailable until a real native module loads (WP-42B).
//
// Android BLE WAKE-ONLY module over android.bluetooth: a BluetoothLeAdvertiser +
// a GATT server exposing a single notify/read wake characteristic, and a
// BluetoothLeScanner + GATT client that reads only that characteristic. Fulfills
// the raw native contract in src/native-types.ts (RawNativeBleWakeModule) under
// BLE_WAKE_NATIVE_MODULE_NAME ('MeerkatBleWake').
//
// NC-42.6 (load-bearing): BLE carries the bounded wake payload and NOTHING ELSE.
// The GATT server publishes ONE read/notify-only characteristic; there is no
// writable/data characteristic. The scanner connects only long enough to read
// that one characteristic, surfaces its bytes as a 'wake' event, and disconnects.
// A value over the size cap is DROPPED before any 'wake' event is emitted.

package com.mylife.meerkat.nativetransport

import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.ParcelUuid
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

private class BleCodedException(code: String) : CodedException(code, "Meerkat BLE wake error: $code", null)

private object MeerkatBle {
  // Owned Meerkat BLE UUIDs (mirror the iOS module's constants).
  val SERVICE_UUID: UUID = UUID.fromString("6d796c69-6665-7761-6b65-000000000042")
  val WAKE_CHARACTERISTIC_UUID: UUID = UUID.fromString("6d796c69-6665-7761-6b65-000000000043")
  // NC-42.6 size gate; the app-side codec encodes three tiny fields.
  const val MAX_WAKE_PAYLOAD_BYTES = 512
}

class MeerkatBleWakeModule : Module() {

  private val context: Context
    get() = appContext.reactContext ?: throw BleCodedException("ERR_NO_CONTEXT")

  private val bluetoothManager: BluetoothManager
    get() = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
      ?: throw BleCodedException("ERR_BLUETOOTH_UNAVAILABLE")

  // Peripheral (advertiser + GATT server) state.
  private var advertiser: BluetoothLeAdvertiser? = null
  private var gattServer: BluetoothGattServer? = null
  private var wakeCharacteristic: BluetoothGattCharacteristic? = null
  @Volatile private var currentPayload: ByteArray? = null
  private var advertiseCallback: AdvertiseCallback? = null

  // Central (scanner + GATT client) state.
  private var scanner: BluetoothLeScanner? = null
  private var scanCallback: ScanCallback? = null

  override fun definition() = ModuleDefinition {
    Name("MeerkatBleWake")

    Events("wake")

    OnDestroy { teardown() }
    OnActivityEntersBackground { teardown() }

    AsyncFunction("advertise") { input: Map<String, Any?> ->
      val payload = input["payload"] as? ByteArray ?: throw BleCodedException("ERR_INVALID_ARGS")
      // NC-42.6 size gate up front.
      if (payload.size > MeerkatBle.MAX_WAKE_PAYLOAD_BYTES) throw BleCodedException("ERR_PAYLOAD_TOO_LARGE")
      startAdvertising(payload)
    }

    AsyncFunction("stopAdvertising") { stopAdvertising() }
    AsyncFunction("scan") { startScanning() }
    AsyncFunction("stopScanning") { stopScanning() }
    AsyncFunction("destroy") { teardown() }
  }

  // MARK: - Peripheral: GATT server with ONE read/notify wake characteristic

  private fun startAdvertising(payload: ByteArray) {
    currentPayload = payload
    val adapter = bluetoothManager.adapter ?: throw BleCodedException("ERR_BLUETOOTH_UNAVAILABLE")
    val adv = adapter.bluetoothLeAdvertiser ?: throw BleCodedException("ERR_BLUETOOTH_UNAVAILABLE")
    advertiser = adv

    // Bring up the GATT server exposing exactly one read/notify characteristic.
    if (gattServer == null) {
      val server = bluetoothManager.openGattServer(context, serverCallback)
      val service = BluetoothGattService(MeerkatBle.SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)
      val characteristic = BluetoothGattCharacteristic(
        MeerkatBle.WAKE_CHARACTERISTIC_UUID,
        BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
        BluetoothGattCharacteristic.PERMISSION_READ, // read-only; no write permission
      )
      service.addCharacteristic(characteristic)
      server.addService(service)
      gattServer = server
      wakeCharacteristic = characteristic
    }

    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
      .setConnectable(true)
      .setTimeout(0)
      .build()
    // Advertise the service UUID only; the payload is served over the GATT read,
    // keeping the advertisement itself within the 31-byte legacy budget.
    val data = AdvertiseData.Builder()
      .addServiceUuid(ParcelUuid(MeerkatBle.SERVICE_UUID))
      .build()
    val cb = object : AdvertiseCallback() {}
    advertiseCallback = cb
    adv.startAdvertising(settings, data, cb)
  }

  private fun stopAdvertising() {
    advertiseCallback?.let { advertiser?.stopAdvertising(it) }
    advertiseCallback = null
    gattServer?.close()
    gattServer = null
    wakeCharacteristic = null
    currentPayload = null
  }

  private val serverCallback = object : BluetoothGattServerCallback() {
    override fun onCharacteristicReadRequest(
      device: android.bluetooth.BluetoothDevice?,
      requestId: Int,
      offset: Int,
      characteristic: BluetoothGattCharacteristic?,
    ) {
      val payload = currentPayload
      if (characteristic?.uuid == MeerkatBle.WAKE_CHARACTERISTIC_UUID && payload != null) {
        val value = if (offset in 0..payload.size) payload.copyOfRange(offset, payload.size) else ByteArray(0)
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
      } else {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_FAILURE, offset, null)
      }
    }

    // Explicitly REFUSE writes: wake-only, no inbound data path (NC-42.6).
    override fun onCharacteristicWriteRequest(
      device: android.bluetooth.BluetoothDevice?,
      requestId: Int,
      characteristic: BluetoothGattCharacteristic?,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray?,
    ) {
      if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
      }
    }
  }

  // MARK: - Central: scan for the service, read the one characteristic, disconnect

  private fun startScanning() {
    val adapter = bluetoothManager.adapter ?: throw BleCodedException("ERR_BLUETOOTH_UNAVAILABLE")
    val s = adapter.bluetoothLeScanner ?: throw BleCodedException("ERR_BLUETOOTH_UNAVAILABLE")
    scanner = s
    val filters = listOf(
      ScanFilter.Builder().setServiceUuid(ParcelUuid(MeerkatBle.SERVICE_UUID)).build()
    )
    val settings = ScanSettings.Builder()
      .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
      .build()
    val cb = object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult?) {
        val device = result?.device ?: return
        // Connect only to read the wake characteristic, then disconnect.
        device.connectGatt(context, false, gattClientCallback)
      }
    }
    scanCallback = cb
    s.startScan(filters, settings, cb)
  }

  private fun stopScanning() {
    scanCallback?.let { scanner?.stopScan(it) }
    scanCallback = null
  }

  private val gattClientCallback = object : BluetoothGattCallback() {
    override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
      if (newState == BluetoothProfile.STATE_CONNECTED) {
        gatt?.discoverServices()
      } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        gatt?.close()
      }
    }

    override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
      val characteristic = gatt?.getService(MeerkatBle.SERVICE_UUID)
        ?.getCharacteristic(MeerkatBle.WAKE_CHARACTERISTIC_UUID)
      if (characteristic != null) {
        gatt.readCharacteristic(characteristic) // read-only; never write
      } else {
        gatt?.disconnect()
      }
    }

    override fun onCharacteristicRead(
      gatt: BluetoothGatt?,
      characteristic: BluetoothGattCharacteristic?,
      value: ByteArray,
      status: Int,
    ) {
      if (status == BluetoothGatt.GATT_SUCCESS &&
        characteristic?.uuid == MeerkatBle.WAKE_CHARACTERISTIC_UUID &&
        value.size <= MeerkatBle.MAX_WAKE_PAYLOAD_BYTES // NC-42.6 size gate on read
      ) {
        sendEvent("wake", mapOf("payload" to value))
      }
      gatt?.disconnect()
    }
  }

  private fun teardown() {
    stopAdvertising()
    stopScanning()
  }
}
