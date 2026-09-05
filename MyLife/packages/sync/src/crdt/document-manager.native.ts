/**
 * Native DocumentManager (MK-004).
 *
 * The default document-manager.ts imports Automerge's WASM web bundle, which
 * Hermes cannot parse. On the native path Metro resolves this file instead, so
 * it exposes the plain-JSON last-write-wins manager under the DocumentManager
 * name. No '@automerge/automerge' import ever reaches the native bundle.
 */

export type { ModuleDocument, DocumentChange } from './lww-document-manager';
export { LwwDocumentManager as DocumentManager } from './lww-document-manager';
