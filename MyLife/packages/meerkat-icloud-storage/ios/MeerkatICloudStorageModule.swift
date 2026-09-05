// UNVERIFIED until a signed dev build and the physical-device matrix compile and exercise this
// source. This is the real owned Expo module behind the fail-closed TypeScript bridge.

import ExpoModulesCore
import Foundation

private enum ICloudStorageError: String {
  case invalidArgument = "ERR_INVALID_ARGUMENT"
  case noAccount = "ERR_NO_ACCOUNT"
  case containerUnavailable = "ERR_CONTAINER_UNAVAILABLE"
  case notFound = "ERR_NOT_FOUND"
  case permissionDenied = "ERR_PERMISSION_DENIED"
  case staleBookmark = "ERR_STALE_BOOKMARK"
  case conflict = "ERR_CONFLICT"
  case io = "ERR_IO"
}

private final class CodedICloudStorageException: Exception {
  init(_ code: ICloudStorageError) {
    super.init(
      name: "MeerkatICloudStorageException",
      description: "Meerkat iCloud storage error: \(code.rawValue)",
      code: code.rawValue
    )
  }
}

private struct ICloudStorageInput: Record {
  @Field var containerIdentifier: String?
  @Field var relativePath: String?
  @Field var bytes: Data?
  @Field var directoryUrl: String?
  @Field var bookmarkId: String?
}

public final class MeerkatICloudStorageModule: Module {
  private lazy var service = ICloudStorageService(owner: self)

  public func definition() -> ModuleDefinition {
    Name("MeerkatICloudStorage")
    Events("accountChanged")

    OnCreate { self.service.start() }
    OnDestroy { self.service.stop() }

    AsyncFunction("getContainerState") { (input: ICloudStorageInput) in
      try self.service.containerState(identifier: optionalString(input.containerIdentifier))
    }
    AsyncFunction("coordinatedWriteICloudFile") { (input: ICloudStorageInput) in
      try self.service.writeICloud(
        identifier: optionalString(input.containerIdentifier),
        relativePath: try requiredString(input.relativePath),
        bytes: try requiredBytes(input.bytes)
      )
    }
    AsyncFunction("coordinatedReadICloudFile") { (input: ICloudStorageInput) in
      try self.service.readICloud(
        identifier: optionalString(input.containerIdentifier),
        relativePath: try requiredString(input.relativePath)
      )
    }
    AsyncFunction("queryICloudFileStatus") { (input: ICloudStorageInput) in
      try self.service.iCloudStatus(
        identifier: optionalString(input.containerIdentifier),
        relativePath: try requiredString(input.relativePath)
      )
    }
    AsyncFunction("startICloudDownload") { (input: ICloudStorageInput) in
      try self.service.startDownload(
        identifier: optionalString(input.containerIdentifier),
        relativePath: try requiredString(input.relativePath)
      )
    }
    AsyncFunction("stopICloudDownload") { (input: ICloudStorageInput) in
      try self.service.stopDownload(
        identifier: optionalString(input.containerIdentifier),
        relativePath: try requiredString(input.relativePath)
      )
    }
    AsyncFunction("listICloudConflictVersions") { (input: ICloudStorageInput) in
      try self.service.conflicts(
        identifier: optionalString(input.containerIdentifier),
        relativePath: try requiredString(input.relativePath)
      )
    }
    AsyncFunction("listICloudFiles") { (input: ICloudStorageInput) in
      try self.service.listICloud(
        identifier: optionalString(input.containerIdentifier),
        relativePath: try requiredString(input.relativePath)
      )
    }
    AsyncFunction("deleteICloudFile") { (input: ICloudStorageInput) in
      try self.service.deleteICloud(
        identifier: optionalString(input.containerIdentifier),
        relativePath: try requiredString(input.relativePath)
      )
    }
    AsyncFunction("persistBookmark") { (input: ICloudStorageInput) in
      try self.service.persistBookmark(
        directoryUrl: try requiredString(input.directoryUrl),
        bookmarkId: optionalString(input.bookmarkId)
      )
    }
    AsyncFunction("resolveBookmark") { (input: ICloudStorageInput) in
      self.service.resolveBookmark(bookmarkId: try requiredString(input.bookmarkId))
    }
    AsyncFunction("removeBookmark") { (input: ICloudStorageInput) in
      self.service.removeBookmark(bookmarkId: try requiredString(input.bookmarkId))
    }
    AsyncFunction("coordinatedWriteBookmarkFile") { (input: ICloudStorageInput) in
      try self.service.writeBookmark(
        bookmarkId: try requiredString(input.bookmarkId),
        relativePath: try requiredString(input.relativePath),
        bytes: try requiredBytes(input.bytes)
      )
    }
    AsyncFunction("coordinatedReadBookmarkFile") { (input: ICloudStorageInput) in
      try self.service.readBookmark(
        bookmarkId: try requiredString(input.bookmarkId),
        relativePath: try requiredString(input.relativePath)
      )
    }
    AsyncFunction("listBookmarkFiles") { (input: ICloudStorageInput) in
      try self.service.listBookmark(
        bookmarkId: try requiredString(input.bookmarkId),
        relativePath: try requiredString(input.relativePath)
      )
    }
    AsyncFunction("deleteBookmarkFile") { (input: ICloudStorageInput) in
      try self.service.deleteBookmark(
        bookmarkId: try requiredString(input.bookmarkId),
        relativePath: try requiredString(input.relativePath)
      )
    }
  }
}

private func optionalString(_ value: String?) -> String? {
  guard let value else { return nil }
  let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
  return trimmed.isEmpty ? nil : trimmed
}

private func requiredString(_ value: String?) throws -> String {
  guard let value = optionalString(value) else {
    throw CodedICloudStorageException(.invalidArgument)
  }
  return value
}

private func requiredBytes(_ value: Data?) throws -> Data {
  guard let value else { throw CodedICloudStorageException(.invalidArgument) }
  return value
}

private final class ICloudStorageService {
  private static let bookmarkPrefix = "meerkat.icloud.bookmark.v1."
  private static let maxRelativePathBytes = 2_048
  private weak var owner: MeerkatICloudStorageModule?
  private let fileManager: FileManager
  private let defaults: UserDefaults
  private let coordinator = NSFileCoordinator(filePresenter: nil)
  private var identityObserver: NSObjectProtocol?
  private var identityToken: String?

  init(
    owner: MeerkatICloudStorageModule,
    fileManager: FileManager = .default,
    defaults: UserDefaults = .standard
  ) {
    self.owner = owner
    self.fileManager = fileManager
    self.defaults = defaults
  }

  func start() {
    identityToken = currentIdentityToken()
    identityObserver = NotificationCenter.default.addObserver(
      forName: NSNotification.Name.NSUbiquityIdentityDidChange,
      object: nil,
      queue: nil
    ) { [weak self] _ in self?.identityDidChange() }
  }

  func stop() {
    if let identityObserver { NotificationCenter.default.removeObserver(identityObserver) }
    identityObserver = nil
  }

  func containerState(identifier: String?) throws -> [String: Any] {
    guard let token = currentIdentityToken() else {
      return [
        "status": "no_account", "containerUrl": NSNull(), "identityToken": NSNull(),
        "reachable": false,
      ]
    }
    guard let url = fileManager.url(forUbiquityContainerIdentifier: identifier) else {
      return [
        "status": "container_unavailable", "containerUrl": NSNull(), "identityToken": token,
        "reachable": false,
      ]
    }
    return [
      "status": "available", "containerUrl": url.absoluteString, "identityToken": token,
      "reachable": fileManager.isReadableFile(atPath: url.path),
    ]
  }

  func writeICloud(identifier: String?, relativePath: String, bytes: Data) throws -> [String: Any] {
    let root = try containerRoot(identifier: identifier)
    let target = try childURL(root: root, relativePath: relativePath)
    try coordinatedWrite(target: target, bytes: bytes, securityRoot: nil)
    return ["relativePath": relativePath, "bytesWritten": bytes.count, "state": "local_container_write"]
  }

  func readICloud(identifier: String?, relativePath: String) throws -> [String: Any] {
    let root = try containerRoot(identifier: identifier)
    return try readResult(target: childURL(root: root, relativePath: relativePath), securityRoot: nil)
  }

  func iCloudStatus(identifier: String?, relativePath: String) throws -> [String: Any] {
    let root = try containerRoot(identifier: identifier)
    let target = try childURL(root: root, relativePath: relativePath)
    guard fileManager.fileExists(atPath: target.path) else { return missingStatus() }
    do {
      let keys: Set<URLResourceKey> = [
        .isUbiquitousItemKey, .ubiquitousItemIsUploadedKey, .ubiquitousItemIsUploadingKey,
        .ubiquitousItemDownloadingStatusKey, .contentModificationDateKey,
      ]
      let values = try target.resourceValues(forKeys: keys)
      let conflicts = NSFileVersion.unresolvedConflictVersionsOfItem(at: target) ?? []
      let downloadingStatus: String
      switch values.ubiquitousItemDownloadingStatus {
      case URLUbiquitousItemDownloadingStatus.current: downloadingStatus = "current"
      case URLUbiquitousItemDownloadingStatus.downloaded: downloadingStatus = "downloaded"
      case URLUbiquitousItemDownloadingStatus.notDownloaded: downloadingStatus = "not_downloaded"
      default: downloadingStatus = "unknown"
      }
      return [
        "exists": true,
        "isUbiquitous": values.isUbiquitousItem ?? false,
        "isUploaded": values.ubiquitousItemIsUploaded ?? false,
        "isUploading": values.ubiquitousItemIsUploading ?? false,
        "downloadingStatus": downloadingStatus,
        "hasUnresolvedConflicts": !conflicts.isEmpty,
        "modificationTime": iso(values.contentModificationDate),
      ]
    } catch {
      throw CodedICloudStorageException(.io)
    }
  }

  func startDownload(identifier: String?, relativePath: String) throws {
    let target = try childURL(root: containerRoot(identifier: identifier), relativePath: relativePath)
    guard fileManager.fileExists(atPath: target.path) else {
      throw CodedICloudStorageException(.notFound)
    }
    do { try fileManager.startDownloadingUbiquitousItem(at: target) }
    catch { throw CodedICloudStorageException(.io) }
  }

  func stopDownload(identifier: String?, relativePath: String) throws {
    let target = try childURL(root: containerRoot(identifier: identifier), relativePath: relativePath)
    guard fileManager.fileExists(atPath: target.path) else {
      throw CodedICloudStorageException(.notFound)
    }
    do { try fileManager.evictUbiquitousItem(at: target) }
    catch { throw CodedICloudStorageException(.io) }
  }

  func conflicts(identifier: String?, relativePath: String) throws -> [[String: Any]] {
    let target = try childURL(root: containerRoot(identifier: identifier), relativePath: relativePath)
    guard fileManager.fileExists(atPath: target.path) else { return [] }
    let versions = NSFileVersion.unresolvedConflictVersionsOfItem(at: target) ?? []
    return versions.map { version in
      [
        "versionIdentifier": String(describing: version.persistentIdentifier),
        "modificationTime": iso(version.modificationDate),
        "localizedName": version.localizedName ?? NSNull(),
        "resolved": version.isResolved,
      ]
    }
  }

  func listICloud(identifier: String?, relativePath: String) throws -> [[String: Any]] {
    let root = try containerRoot(identifier: identifier)
    let directory = try childURL(root: root, relativePath: relativePath, allowEmpty: true)
    return try list(directory: directory, relativeTo: root, securityRoot: nil)
  }

  func deleteICloud(identifier: String?, relativePath: String) throws -> [String: Any] {
    let root = try containerRoot(identifier: identifier)
    return [
      "deleted": try coordinatedDelete(
        target: childURL(root: root, relativePath: relativePath), securityRoot: nil
      ),
    ]
  }

  func persistBookmark(directoryUrl: String, bookmarkId: String?) throws -> [String: Any] {
    guard let url = URL(string: directoryUrl), url.isFileURL else {
      throw CodedICloudStorageException(.invalidArgument)
    }
    let id = try safeBookmarkId(bookmarkId ?? UUID().uuidString.lowercased())
    let accessed = url.startAccessingSecurityScopedResource()
    guard accessed else { throw CodedICloudStorageException(.permissionDenied) }
    defer { url.stopAccessingSecurityScopedResource() }
    do {
      guard try url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory == true else {
        throw CodedICloudStorageException(.invalidArgument)
      }
      let data = try url.bookmarkData(
        options: [.minimalBookmark], includingResourceValuesForKeys: nil, relativeTo: nil
      )
      defaults.set(data, forKey: Self.bookmarkPrefix + id)
      return ["bookmarkId": id]
    } catch let error as CodedICloudStorageException {
      throw error
    } catch {
      throw CodedICloudStorageException(.permissionDenied)
    }
  }

  func resolveBookmark(bookmarkId: String) -> [String: Any] {
    guard let id = try? safeBookmarkId(bookmarkId),
          let data = defaults.data(forKey: Self.bookmarkPrefix + id) else {
      return ["status": "missing", "bookmarkId": bookmarkId, "directoryUrl": NSNull()]
    }
    var stale = false
    do {
      let url = try URL(
        resolvingBookmarkData: data,
        options: [.withoutUI],
        relativeTo: nil,
        bookmarkDataIsStale: &stale
      )
      if stale {
        return ["status": "stale", "bookmarkId": id, "directoryUrl": NSNull()]
      }
      let accessed = url.startAccessingSecurityScopedResource()
      if accessed { url.stopAccessingSecurityScopedResource() }
      return [
        "status": accessed ? "resolved" : "permission_denied",
        "bookmarkId": id,
        "directoryUrl": accessed ? url.absoluteString : NSNull(),
      ]
    } catch {
      return ["status": "permission_denied", "bookmarkId": id, "directoryUrl": NSNull()]
    }
  }

  func removeBookmark(bookmarkId: String) -> [String: Any] {
    guard let id = try? safeBookmarkId(bookmarkId) else { return ["removed": false] }
    let key = Self.bookmarkPrefix + id
    let existed = defaults.object(forKey: key) != nil
    defaults.removeObject(forKey: key)
    return ["removed": existed]
  }

  func writeBookmark(bookmarkId: String, relativePath: String, bytes: Data) throws -> [String: Any] {
    let root = try bookmarkRoot(bookmarkId: bookmarkId)
    try coordinatedWrite(
      target: childURL(root: root, relativePath: relativePath), bytes: bytes, securityRoot: root
    )
    return ["relativePath": relativePath, "bytesWritten": bytes.count]
  }

  func readBookmark(bookmarkId: String, relativePath: String) throws -> [String: Any] {
    let root = try bookmarkRoot(bookmarkId: bookmarkId)
    return try readResult(
      target: childURL(root: root, relativePath: relativePath), securityRoot: root
    )
  }

  func listBookmark(bookmarkId: String, relativePath: String) throws -> [[String: Any]] {
    let root = try bookmarkRoot(bookmarkId: bookmarkId)
    let directory = try childURL(root: root, relativePath: relativePath, allowEmpty: true)
    return try list(directory: directory, relativeTo: root, securityRoot: root)
  }

  func deleteBookmark(bookmarkId: String, relativePath: String) throws -> [String: Any] {
    let root = try bookmarkRoot(bookmarkId: bookmarkId)
    return [
      "deleted": try coordinatedDelete(
        target: childURL(root: root, relativePath: relativePath), securityRoot: root
      ),
    ]
  }

  private func identityDidChange() {
    let previous = identityToken
    let current = currentIdentityToken()
    identityToken = current
    owner?.sendEvent("accountChanged", [
      "previousIdentityToken": previous ?? NSNull(),
      "currentIdentityToken": current ?? NSNull(),
    ])
  }

  private func currentIdentityToken() -> String? {
    guard let token = fileManager.ubiquityIdentityToken else { return nil }
    do {
      return try NSKeyedArchiver.archivedData(
        withRootObject: token, requiringSecureCoding: false
      ).base64EncodedString()
    } catch { return String(describing: token) }
  }

  private func containerRoot(identifier: String?) throws -> URL {
    guard currentIdentityToken() != nil else { throw CodedICloudStorageException(.noAccount) }
    guard let root = fileManager.url(forUbiquityContainerIdentifier: identifier) else {
      throw CodedICloudStorageException(.containerUnavailable)
    }
    return root.standardizedFileURL
  }

  private func safeBookmarkId(_ value: String) throws -> String {
    let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.:-")
    guard !value.isEmpty, value.count <= 128,
          value.unicodeScalars.allSatisfy({ allowed.contains($0) }) else {
      throw CodedICloudStorageException(.invalidArgument)
    }
    return value
  }

  private func bookmarkRoot(bookmarkId: String) throws -> URL {
    let id = try safeBookmarkId(bookmarkId)
    guard let data = defaults.data(forKey: Self.bookmarkPrefix + id) else {
      throw CodedICloudStorageException(.notFound)
    }
    var stale = false
    do {
      let url = try URL(
        resolvingBookmarkData: data,
        options: [.withoutUI],
        relativeTo: nil,
        bookmarkDataIsStale: &stale
      )
      if stale { throw CodedICloudStorageException(.staleBookmark) }
      return url.standardizedFileURL
    } catch let error as CodedICloudStorageException { throw error }
    catch { throw CodedICloudStorageException(.permissionDenied) }
  }

  private func childURL(root: URL, relativePath: String, allowEmpty: Bool = false) throws -> URL {
    let path = relativePath.trimmingCharacters(in: .whitespacesAndNewlines)
    guard path.utf8.count <= Self.maxRelativePathBytes,
          (allowEmpty || !path.isEmpty), !path.hasPrefix("/"), !path.contains("\0") else {
      throw CodedICloudStorageException(.invalidArgument)
    }
    let components = path.split(separator: "/", omittingEmptySubsequences: true)
    guard components.allSatisfy({ $0 != "." && $0 != ".." }) else {
      throw CodedICloudStorageException(.invalidArgument)
    }
    let normalizedRoot = root.standardizedFileURL.resolvingSymlinksInPath()
    var target = normalizedRoot
    for component in components { target.appendPathComponent(String(component), isDirectory: false) }
    target = target.standardizedFileURL.resolvingSymlinksInPath()
    let rootPath = normalizedRoot.path.hasSuffix("/")
      ? normalizedRoot.path : normalizedRoot.path + "/"
    guard target.path == normalizedRoot.path || target.path.hasPrefix(rootPath) else {
      throw CodedICloudStorageException(.invalidArgument)
    }
    return target
  }

  private func withSecurityScope<T>(_ root: URL?, operation: () throws -> T) throws -> T {
    guard let root else { return try operation() }
    guard root.startAccessingSecurityScopedResource() else {
      throw CodedICloudStorageException(.permissionDenied)
    }
    defer { root.stopAccessingSecurityScopedResource() }
    return try operation()
  }

  private func coordinatedWrite(target: URL, bytes: Data, securityRoot: URL?) throws {
    try withSecurityScope(securityRoot) {
      do { try fileManager.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true) }
      catch { throw CodedICloudStorageException(.io) }
      var coordinationError: NSError?
      var operationError: Error?
      coordinator.coordinate(writingItemAt: target, options: [], error: &coordinationError) { url in
        do { try bytes.write(to: url, options: [.atomic]) }
        catch { operationError = error }
      }
      if coordinationError != nil || operationError != nil { throw CodedICloudStorageException(.io) }
    }
  }

  private func readResult(target: URL, securityRoot: URL?) throws -> [String: Any] {
    try withSecurityScope(securityRoot) {
      guard fileManager.fileExists(atPath: target.path) else {
        return ["found": false, "bytes": NSNull()]
      }
      var coordinationError: NSError?
      var operationError: Error?
      var data: Data?
      coordinator.coordinate(readingItemAt: target, options: [], error: &coordinationError) { url in
        do { data = try Data(contentsOf: url, options: [.mappedIfSafe]) }
        catch { operationError = error }
      }
      if coordinationError != nil || operationError != nil { throw CodedICloudStorageException(.io) }
      guard let data else { throw CodedICloudStorageException(.io) }
      return ["found": true, "bytes": data]
    }
  }

  private func list(directory: URL, relativeTo root: URL, securityRoot: URL?) throws -> [[String: Any]] {
    try withSecurityScope(securityRoot) {
      guard fileManager.fileExists(atPath: directory.path) else { return [] }
      do {
        return try fileManager.contentsOfDirectory(
          at: directory,
          includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey],
          options: [.skipsHiddenFiles]
        ).compactMap { url in
          let values = try url.resourceValues(forKeys: [
            .isRegularFileKey, .fileSizeKey, .contentModificationDateKey,
          ])
          guard values.isRegularFile == true else { return nil }
          let rootPath = root.standardizedFileURL.path + "/"
          guard url.standardizedFileURL.path.hasPrefix(rootPath) else { return nil }
          return [
            "relativePath": String(url.standardizedFileURL.path.dropFirst(rootPath.count)),
            "size": values.fileSize ?? 0,
            "modificationTime": iso(values.contentModificationDate),
          ]
        }.sorted { left, right in
          (left["relativePath"] as? String ?? "") < (right["relativePath"] as? String ?? "")
        }
      } catch { throw CodedICloudStorageException(.io) }
    }
  }

  private func coordinatedDelete(target: URL, securityRoot: URL?) throws -> Bool {
    try withSecurityScope(securityRoot) {
      guard fileManager.fileExists(atPath: target.path) else { return false }
      var coordinationError: NSError?
      var operationError: Error?
      coordinator.coordinate(writingItemAt: target, options: .forDeleting, error: &coordinationError) { url in
        do { try fileManager.removeItem(at: url) }
        catch { operationError = error }
      }
      if coordinationError != nil || operationError != nil { throw CodedICloudStorageException(.io) }
      return true
    }
  }

  private func missingStatus() -> [String: Any] {
    [
      "exists": false, "isUbiquitous": false, "isUploaded": false, "isUploading": false,
      "downloadingStatus": "unknown", "hasUnresolvedConflicts": false,
      "modificationTime": NSNull(),
    ]
  }

  private func iso(_ date: Date?) -> Any {
    guard let date else { return NSNull() }
    return ISO8601DateFormatter().string(from: date)
  }
}
