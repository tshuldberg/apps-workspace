/**
 * Web DocumentManager (SYNC-REAL).
 *
 * The default document-manager.ts imports Automerge's WASM web bundle. The hub
 * Next.js web app (apps/web) cannot bundle that WASM without per-file aliasing,
 * and it does not need Automerge: the web node speaks the SAME plain-JSON
 * last-write-wins wire format the native Meerkat app uses (which resolves
 * document-manager.native.ts). Next's resolver is configured to prefer `.web.*`
 * source variants ahead of `.ts` (see apps/web/next.config.ts resolveExtensions
 * / turbopack.resolveExtensions), so a bare `import '../crdt/document-manager'`
 * inside sync-engine.native.ts resolves THIS file in the web build and the
 * Automerge import never reaches the bundle.
 *
 * Mobile (Metro) keeps resolving document-manager.native.ts; Node tests keep
 * resolving document-manager.ts. This file only changes the web build, so it is
 * a web-safe entry, not a change to shared logic.
 */

export type { ModuleDocument, DocumentChange } from './lww-document-manager';
export { LwwDocumentManager as DocumentManager } from './lww-document-manager';
