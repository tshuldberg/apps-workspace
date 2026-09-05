// UNVERIFIED - pending dev build (Plan 42 WP-42C). This Swift source is AUTHORED
// in-repo but has NOT been compiled or device-proven: this environment has no
// iOS toolchain. Nothing here is evidence for AC-42.3; the JS bridge keeps the
// BLE-wake rung honestly unavailable until a real native module loads (WP-42B).
//
// iOS BLE WAKE-ONLY module over CoreBluetooth. Fulfills the raw native contract
// in src/native-types.ts (RawNativeBleWakeModule) under BLE_WAKE_NATIVE_MODULE_
// NAME ('MeerkatBleWake').
//
// NC-42.6 (the load-bearing invariant): BLE carries the bounded wake payload and
// NOTHING ELSE. There is no readable/writable data characteristic, no GATT data
// channel, no L2CAP stream. The peripheral role publishes ONE notify-only
// characteristic whose value is the opaque wake bytes; the central role scans,
// connects only long enough to read that single characteristic, surfaces its
// bytes as a 'wake' event, and disconnects. Any advertisement/characteristic
// value over the size cap is DROPPED before a 'wake' event is emitted.

import ExpoModulesCore
import CoreBluetooth
import Foundation

// MARK: - Owned Meerkat BLE UUIDs (Plan 42 Phase 1: "UUIDs owned by Meerkat")

private enum MeerkatBle {
  // A random, Meerkat-owned 128-bit service UUID. Advertised by the peripheral
  // and filtered for by the central so only Meerkat wake beacons are surfaced.
  static let serviceUUID = CBUUID(string: "6D796C69-6665-7761-6B65-000000000042")
  // The single notify-only wake characteristic. Its value is the opaque wake
  // payload bytes; there is NO other characteristic on this service.
  static let wakeCharacteristicUUID = CBUUID(string: "6D796C69-6665-7761-6B65-000000000043")
  /// Hard upper bound on wake payload bytes (NC-42.6 size gate). The app-side
  /// codec (ble-backend.ts) encodes three tiny fields; anything larger is hostile
  /// or malformed and is dropped before any event.
  static let maxWakePayloadBytes = 512
}

// MARK: - Stable error codes

private enum BleError: String {
  case invalidArgs = "ERR_INVALID_ARGS"
  case payloadTooLarge = "ERR_PAYLOAD_TOO_LARGE"
  case bluetoothUnavailable = "ERR_BLUETOOTH_UNAVAILABLE"
}

private final class CodedBleException: Exception {
  // Exception.code is `open var code: String` and Exception.name is a settable
  // `open lazy var`; keep the coded error under its own property name and
  // follow the base signatures exactly (same fix as MeerkatCallKitModule).
  private let errorCode: BleError
  init(_ errorCode: BleError) {
    self.errorCode = errorCode
    super.init()
    self.name = errorCode.rawValue
  }
  override var code: String { errorCode.rawValue }
  override var reason: String { "Meerkat BLE wake error: \(errorCode.rawValue)" }
}

// MARK: - Module

public final class MeerkatBleWakeModule: Module {

  private let queue = DispatchQueue(label: "com.mylife.meerkat.ble")

  private var peripheralShim: BlePeripheralShim?
  private var centralShim: BleCentralShim?

  public func definition() -> ModuleDefinition {
    Name("MeerkatBleWake")

    Events("wake")

    OnDestroy { self.teardown() }

    OnAppEntersBackground {
      // Background scanning/advertising is intentionally NOT sustained here; the
      // wake role is foreground-driven. Tear down radios cleanly.
      self.teardown()
    }

    AsyncFunction("advertise") { (input: [String: Any]) in
      guard let payload = input["payload"] as? Data else {
        throw CodedBleException(.invalidArgs)
      }
      // NC-42.6 size gate: reject an oversized wake payload up front.
      guard payload.count <= MeerkatBle.maxWakePayloadBytes else {
        throw CodedBleException(.payloadTooLarge)
      }
      self.startAdvertising(payload: payload)
    }

    AsyncFunction("stopAdvertising") {
      self.queue.sync { self.peripheralShim?.stop() }
    }

    AsyncFunction("scan") {
      self.startScanning()
    }

    AsyncFunction("stopScanning") {
      self.queue.sync { self.centralShim?.stop() }
    }

    AsyncFunction("destroy") { self.teardown() }
  }

  private func startAdvertising(payload: Data) {
    queue.sync {
      let shim = peripheralShim ?? BlePeripheralShim(queue: queue)
      peripheralShim = shim
      shim.advertise(payload: payload)
    }
  }

  private func startScanning() {
    queue.sync {
      let shim = centralShim ?? BleCentralShim(queue: queue) { [weak self] bytes in
        // Deliver ONLY the wake payload bytes; no data channel, no other value.
        self?.sendEvent("wake", ["payload": bytes])
      }
      centralShim = shim
      shim.scan()
    }
  }

  private func teardown() {
    queue.sync {
      peripheralShim?.stop()
      peripheralShim = nil
      centralShim?.stop()
      centralShim = nil
    }
  }
}

// MARK: - Peripheral shim (advertises the wake service + notify characteristic)

private final class BlePeripheralShim: NSObject, CBPeripheralManagerDelegate {
  private let queue: DispatchQueue
  private var manager: CBPeripheralManager?
  private var wakeCharacteristic: CBMutableCharacteristic?
  private var pendingPayload: Data?
  private var serviceAdded = false

  init(queue: DispatchQueue) {
    self.queue = queue
    super.init()
    manager = CBPeripheralManager(delegate: self, queue: queue)
  }

  func advertise(payload: Data) {
    pendingPayload = payload
    if manager?.state == .poweredOn { publish() }
  }

  private func publish() {
    guard let manager = manager, let payload = pendingPayload else { return }
    // Rebuild the single notify-only characteristic with the current payload as
    // its stored value. There is NO writable/data characteristic on this service.
    let characteristic = CBMutableCharacteristic(
      type: MeerkatBle.wakeCharacteristicUUID,
      properties: [.read, .notify],
      value: nil, // dynamic value supplied on read
      permissions: [.readable]
    )
    wakeCharacteristic = characteristic
    let service = CBMutableService(type: MeerkatBle.serviceUUID, primary: true)
    service.characteristics = [characteristic]
    if !serviceAdded {
      manager.removeAllServices()
      manager.add(service)
      serviceAdded = true
    }
    manager.startAdvertising([
      CBAdvertisementDataServiceUUIDsKey: [MeerkatBle.serviceUUID]
    ])
  }

  func stop() {
    manager?.stopAdvertising()
    manager?.removeAllServices()
    serviceAdded = false
    pendingPayload = nil
    wakeCharacteristic = nil
  }

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    if peripheral.state == .poweredOn { publish() }
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
    // Serve ONLY the bounded wake payload; nothing else is exposed.
    guard request.characteristic.uuid == MeerkatBle.wakeCharacteristicUUID,
          let payload = pendingPayload else {
      peripheral.respond(to: request, withResult: .attributeNotFound)
      return
    }
    if request.offset > payload.count {
      peripheral.respond(to: request, withResult: .invalidOffset)
      return
    }
    request.value = payload.subdata(in: request.offset..<payload.count)
    peripheral.respond(to: request, withResult: .success)
  }

  // Explicitly REFUSE writes: this is wake-only, there is no inbound data path.
  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
    for request in requests {
      peripheral.respond(to: request, withResult: .writeNotPermitted)
    }
  }
}

// MARK: - Central shim (scans, reads the single wake characteristic, disconnects)

private final class BleCentralShim: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
  private let queue: DispatchQueue
  private let onWake: (Data) -> Void
  private var manager: CBCentralManager?
  private var connecting: Set<CBPeripheral> = []

  init(queue: DispatchQueue, onWake: @escaping (Data) -> Void) {
    self.queue = queue
    self.onWake = onWake
    super.init()
    manager = CBCentralManager(delegate: self, queue: queue)
  }

  func scan() {
    guard manager?.state == .poweredOn else { return } // starts on didUpdateState
    manager?.scanForPeripherals(
      withServices: [MeerkatBle.serviceUUID],
      options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
    )
  }

  func stop() {
    manager?.stopScan()
    for p in connecting { manager?.cancelPeripheralConnection(p) }
    connecting.removeAll()
  }

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    if central.state == .poweredOn { scan() }
  }

  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
    // Connect just long enough to read the single wake characteristic.
    connecting.insert(peripheral)
    peripheral.delegate = self
    central.connect(peripheral, options: nil)
  }

  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    peripheral.discoverServices([MeerkatBle.serviceUUID])
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    guard error == nil, let services = peripheral.services else {
      manager?.cancelPeripheralConnection(peripheral); return
    }
    for service in services where service.uuid == MeerkatBle.serviceUUID {
      peripheral.discoverCharacteristics([MeerkatBle.wakeCharacteristicUUID], for: service)
    }
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    guard error == nil, let chars = service.characteristics else {
      manager?.cancelPeripheralConnection(peripheral); return
    }
    for c in chars where c.uuid == MeerkatBle.wakeCharacteristicUUID {
      peripheral.readValue(for: c) // read-only; never write
    }
  }

  func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    defer { manager?.cancelPeripheralConnection(peripheral) }
    guard error == nil,
          characteristic.uuid == MeerkatBle.wakeCharacteristicUUID,
          let value = characteristic.value else { return }
    // NC-42.6 size gate on the read path too: drop oversized/malformed values
    // before surfacing a wake event.
    guard value.count <= MeerkatBle.maxWakePayloadBytes else { return }
    onWake(value)
  }

  func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    connecting.remove(peripheral)
  }

  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    connecting.remove(peripheral)
  }
}
