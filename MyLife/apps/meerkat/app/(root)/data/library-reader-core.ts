// Plan 38 Phase 6 (MOBILE): pure helpers for the sealed in-app epub/cbz readers.
// Structural twin of apps/meerkat-web/src/lib/library-reader-core.ts -- the pure
// logic is shared so a fix lands once. (The surfaces differ only in how the
// sandboxed chapter document is mounted: a network-blocked WebView here, a
// sandboxed iframe on web.)
//
// epub/cbz bytes are ATTACKER-CONTROLLED community data. Everything here is pure
// and side-effect free so it is unit-testable in Node, and the EPUB path is
// XXE-proof BY CONSTRUCTION: we never use a DOM/XML parser or expand entities --
// we extract only the specific attributes we need with bounded regexes, and we
// render chapter HTML inside a fully sandboxed, network-blocked surface. Active
// content (scripts, event handlers, javascript: URLs) is stripped and every
// external URL is neutralized; only in-archive assets inlined as `data:` URIs
// survive.

// ---------------------------------------------------------------------------
// CBZ: image entry selection + natural order.
// ---------------------------------------------------------------------------

const IMAGE_ENTRY_RE = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;

/** Is this archive entry a comic page image (and not a hidden/system file)? */
export function isImageEntry(name: string): boolean {
  const base = name.split('/').pop() ?? name;
  if (base.startsWith('.') || base.startsWith('__MACOSX')) return false;
  if (name.includes('__MACOSX/')) return false;
  return IMAGE_ENTRY_RE.test(base);
}

/** Natural (human) order so "page2" sorts before "page10". */
export function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const as = a.toLowerCase().match(re) ?? [];
  const bs = b.toLowerCase().match(re) ?? [];
  const n = Math.min(as.length, bs.length);
  for (let i = 0; i < n; i += 1) {
    const x = as[i]!;
    const y = bs[i]!;
    const xn = /^\d/.test(x);
    const yn = /^\d/.test(y);
    if (xn && yn) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return as.length - bs.length;
}

/** Image entries in natural page order. */
export function sortImageEntries(names: string[]): string[] {
  return names.filter(isImageEntry).sort(naturalCompare);
}

/** Data-URI mime for a comic page by extension (raster only; SVG excluded). */
export function imageMimeForEntry(name: string): string {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'avif': return 'image/avif';
    case 'bmp': return 'image/bmp';
    default: return 'application/octet-stream';
  }
}

// ---------------------------------------------------------------------------
// EPUB: OPF/spine extraction (no XML parser -> no XXE surface).
// ---------------------------------------------------------------------------

export const EPUB_CONTAINER_PATH = 'META-INF/container.xml';

function stripDoctype(xml: string): string {
  // We never process a DOCTYPE (no entity expansion, ever): drop it outright.
  return xml.replace(/<!DOCTYPE[^>]*(\[[\s\S]*?\])?[^>]*>/gi, '');
}

/** Extract the OPF package path from META-INF/container.xml. */
export function parseContainerRootfile(xml: string): string | null {
  const clean = stripDoctype(xml);
  const m = /<rootfile\b[^>]*\bfull-path\s*=\s*("|')(.*?)\1/i.exec(clean);
  if (!m) return null;
  const path = decodeXmlAttr(m[2]!).trim();
  return path || null;
}

export interface EpubSpine {
  /** Directory the OPF lives in (spine hrefs resolve against this). */
  opfDir: string;
  /** Chapter archive paths, in spine order. */
  hrefs: string[];
}

/** Parse the OPF manifest+spine into an ordered list of chapter archive paths. */
export function parseOpfSpine(opfPath: string, opfXml: string): EpubSpine {
  const clean = stripDoctype(opfXml);
  const opfDir = dirOf(opfPath);

  // manifest: id -> href
  const idToHref = new Map<string, string>();
  const itemRe = /<item\b[^>]*>/gi;
  let im: RegExpExecArray | null;
  while ((im = itemRe.exec(clean)) !== null) {
    const tag = im[0]!;
    const id = attr(tag, 'id');
    const href = attr(tag, 'href');
    if (id && href) idToHref.set(id, decodeXmlAttr(href));
  }

  // spine: ordered idrefs
  const hrefs: string[] = [];
  const spineMatch = /<spine\b[^>]*>([\s\S]*?)<\/spine>/i.exec(clean);
  const spineBody = spineMatch ? spineMatch[1]! : '';
  const refRe = /<itemref\b[^>]*>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = refRe.exec(spineBody)) !== null) {
    const idref = attr(rm[0]!, 'idref');
    if (!idref) continue;
    const href = idToHref.get(idref);
    if (href) hrefs.push(joinArchivePath(opfDir, href));
  }
  return { opfDir, hrefs };
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*("|')(.*?)\\1`, 'i').exec(tag);
  return m ? m[2]! : null;
}

function decodeXmlAttr(s: string): string {
  // Decode ONLY the five predefined XML entities. Numeric/custom entities are
  // left literal (never expanded), so this cannot be an entity-expansion vector.
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

/** Resolve a relative archive path against a base directory (handles ./ and ../). */
export function joinArchivePath(baseDir: string, rel: string): string {
  const relPath = rel.split('#')[0]!.split('?')[0]!;
  if (!relPath) return '';
  const parts = (baseDir ? baseDir.split('/') : []).filter(Boolean);
  for (const seg of relPath.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

// ---------------------------------------------------------------------------
// EPUB: chapter sanitation + sandbox document.
// ---------------------------------------------------------------------------

/**
 * Strip active content: <script>/<iframe>/<object>/<embed> elements, inline
 * `on*` event-handler attributes, and `javascript:`/`vbscript:` URLs. Defense in
 * depth on top of the sandbox+CSP (either alone already blocks script).
 */
export function stripActiveContent(html: string): string {
  let out = html;
  out = out.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '');
  out = out.replace(/<script\b[^>]*\/>/gi, '');
  out = out.replace(/<(iframe|object|embed|link)\b[\s\S]*?<\/\1\s*>/gi, '');
  out = out.replace(/<(iframe|object|embed|link)\b[^>]*\/?>/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/(href|src|xlink:href|poster)\s*=\s*("|')\s*(javascript|vbscript|data:text\/html)[^"']*\2/gi, '$1=$2$2');
  return out;
}

const URL_ATTR_RE = /\b(src|href|xlink:href|poster)\s*=\s*("|')(.*?)\2/gi;
const CSS_URL_RE = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;

/** True for anything that would reach off-device (any scheme, protocol-relative, root-absolute). */
function isExternalUrl(u: string): boolean {
  const v = u.trim();
  if (!v) return false;
  if (v.startsWith('data:')) return false;
  if (v.startsWith('#')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return true; // has a scheme (http:, file:, ...)
  if (v.startsWith('//')) return true;             // protocol-relative
  if (v.startsWith('/')) return true;              // root-absolute (no archive anchor)
  return false;
}

/**
 * Rewrite chapter resource URLs: keep `data:`, resolve in-archive relative paths
 * to `data:` URIs via `resolve`, and NEUTRALIZE everything external (no network
 * ever leaves the sandbox). `resolve` returns a data URI for an archive path, or
 * null if it is missing/over-cap.
 */
export function inlineResourceUrls(
  html: string,
  chapterPath: string,
  resolve: (archivePath: string) => string | null,
): string {
  const baseDir = dirOf(chapterPath);
  const transform = (raw: string): string => {
    const v = raw.trim();
    if (!v || v.startsWith('#')) return '';
    if (v.startsWith('data:')) return v;
    if (isExternalUrl(v)) return '';
    const archivePath = joinArchivePath(baseDir, v);
    return resolve(archivePath) ?? '';
  };
  let out = html.replace(URL_ATTR_RE, (_m, name: string, q: string, val: string) =>
    `${name}=${q}${transform(val)}${q}`);
  out = out.replace(CSS_URL_RE, (_m, _q: string, val: string) =>
    `url("${transform(val)}")`);
  return out;
}

/**
 * CSP for the chapter document: block ALL network (default-src 'none'); allow
 * only inlined `data:` assets and inline styles (epub CSS). No script-src, so
 * scripts cannot run even if the sandbox were ever loosened.
 */
export const EPUB_CHAPTER_CSP =
  "default-src 'none'; img-src data:; media-src data:; style-src data: 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'";

// ---------------------------------------------------------------------------
// Resume position <-> cm_library_progress.positionMs (single int column).
// ---------------------------------------------------------------------------

export type ReaderKind = 'cbz' | 'epub';

const EPUB_FRACTION_SCALE = 10000;

/**
 * Pack a reader position into the single `position_ms` integer. CBZ stores the
 * page index directly; EPUB packs spine index + scroll fraction (0..1).
 */
export function encodeReaderPosition(
  kind: ReaderKind,
  pos: { index: number; fraction?: number },
): number {
  const index = Math.max(0, Math.floor(pos.index));
  if (kind === 'cbz') return index;
  const frac = Math.min(EPUB_FRACTION_SCALE - 1, Math.max(0, Math.round((pos.fraction ?? 0) * EPUB_FRACTION_SCALE)));
  return index * EPUB_FRACTION_SCALE + frac;
}

/** Unpack a `position_ms` integer back into a reader position. */
export function decodeReaderPosition(kind: ReaderKind, positionMs: number): { index: number; fraction: number } {
  const v = Math.max(0, Math.floor(positionMs || 0));
  if (kind === 'cbz') return { index: v, fraction: 0 };
  return { index: Math.floor(v / EPUB_FRACTION_SCALE), fraction: (v % EPUB_FRACTION_SCALE) / EPUB_FRACTION_SCALE };
}

/** Classify a library item as a sealed reader target from its mime/title. */
export function readerKindFor(mimeType: string | null, title: string | null): ReaderKind | null {
  const type = (mimeType ?? '').toLowerCase().split(';')[0]!.trim();
  const name = (title ?? '').toLowerCase();
  if (type === 'application/epub+zip' || name.endsWith('.epub')) return 'epub';
  if (
    type === 'application/vnd.comicbook+zip' ||
    type === 'application/x-cbz' ||
    name.endsWith('.cbz')
  ) return 'cbz';
  return null;
}

// --- platform mount seam (sanctioned divergence; excluded from the twin lock) ---
// The surfaces differ ONLY in how the sandboxed chapter document is mounted: a
// network-blocked WebView here (source={{ html }}), a fully sandboxed iframe
// (srcdoc + sandbox="") on web. Everything above this marker is byte-identical
// with the web twin (CORE_TWINS bounded lock).

export interface SandboxDocument {
  /** Full HTML document to feed the network-blocked WebView via `source={{ html }}`. */
  html: string;
  /** The CSP embedded in the document (exposed for assertions/tests). */
  csp: string;
}

/** Wrap sanitized chapter body HTML in a self-contained, network-blocked document. */
export function buildSandboxedChapter(bodyHtml: string): SandboxDocument {
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<meta http-equiv="Content-Security-Policy" content="${EPUB_CHAPTER_CSP}">` +
    '<style>body{margin:0;padding:1.25rem 1.4rem;font:1rem/1.6 system-ui,serif;' +
    'color:#20302b;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}</style>' +
    `</head><body>${bodyHtml}</body></html>`;
  return { html, csp: EPUB_CHAPTER_CSP };
}
