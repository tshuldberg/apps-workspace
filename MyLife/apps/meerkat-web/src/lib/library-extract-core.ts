// Plan 38 Phase 4 (Track B): pure, dependency-free LOCAL metadata extraction on
// the curator device. This is the WEB twin of apps/meerkat/app/(root)/data/
// library-extract-core.ts (the mobile source of truth); the two are
// byte-identical below this header, parity-locked by scripts/check-meerkat-parity.mjs.
//
// Everything here is local-only and offline: filename parsers, a BOUNDED,
// XXE-hardened NFO sidecar reader (no DTD/entities, hand-rolled tag extraction of
// ONLY title/year/plot/genre/runtime from <movie>/<episodedetails>), a JPEG EXIF
// reader (capture date, dimensions, GPS presence + coordinates) and a GPS-strip
// that REWRITES the JPEG bytes so the output carries no EXIF GPS IFD. NONE of
// this ever contacts the network (design decision 5: local extraction works with
// zero setup; only the SEPARATE library-enrich-core, behind an injected fetch +
// curator key, may reach a provider). extractLocalMetadata ALWAYS returns
// something usable -- worst case a filename-derived title -- so ingest works with
// zero configuration.
//
// A JPEG/EXIF/NFO payload is attacker-controlled community data: every parser is
// bounds-checked, size-capped, and fail-safe (returns null / defaults, never
// throws, never expands an entity, never follows an external reference).

import type { KnownMediaType } from './library-metadata-core';

// ---------------------------------------------------------------------------
// Shared helpers.
// ---------------------------------------------------------------------------

/** Strip a leading directory path (POSIX or Windows) to a bare file name. */
function baseName(fileName: string): string {
  const cut = fileName.split(/[\\/]/).pop();
  return (cut ?? fileName).trim();
}

/** Remove a trailing extension (up to 5 alphanumerics after a final dot). */
function stripExtension(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,5}$/, '');
}

/** Turn scene separators (dots/underscores) into spaces and collapse runs. */
function humanizeSeparators(value: string): string {
  return value.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Scene-release quality/source tokens that are never part of a title. */
const SCENE_STOP_TOKENS = new Set([
  '480p', '576p', '720p', '1080p', '1440p', '2160p', '4k', '8k', 'uhd', 'hd', 'sd',
  'bluray', 'blu-ray', 'brrip', 'bdrip', 'webrip', 'web-dl', 'webdl', 'hdrip',
  'dvdrip', 'dvd', 'hdtv', 'pdtv', 'cam', 'ts', 'tc', 'remux', 'proper', 'repack',
  'x264', 'x265', 'h264', 'h265', 'hevc', 'avc', 'xvid', 'divx', 'aac', 'ac3',
  'dts', 'dd5', 'dd', 'truehd', 'atmos', 'flac', 'mp3', '10bit', '8bit', 'hdr',
  'sdr', 'dv', 'imax', 'extended', 'unrated', 'internal', 'limited', 'multi',
]);

/** Drop everything at and after the first pure scene token in a word list. */
function dropSceneTail(words: readonly string[]): string[] {
  const kept: string[] = [];
  for (const word of words) {
    if (SCENE_STOP_TOKENS.has(word.toLowerCase())) break;
    kept.push(word);
  }
  return kept.length > 0 ? kept : [...words];
}

function titleCaseTrim(value: string, maxChars = 512): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

/** A four-digit year in a plausible range, or null. */
function plausibleYear(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1870 || n > 3000) return null;
  return n;
}

// ---------------------------------------------------------------------------
// Filename parsers -> per-media-type candidates.
// ---------------------------------------------------------------------------

export interface FilenameCandidate {
  title: string;
  sortTitle: string | null;
  year: number | null;
  /** Media-type-specific fields destined for metadata_json (schema-validated later). */
  metadata: Record<string, unknown>;
}

/** The universal fallback: a readable title from any file name. Never empty. */
export function deriveTitleFromFilename(fileName: string): string {
  const cleaned = titleCaseTrim(humanizeSeparators(stripExtension(baseName(fileName))));
  return cleaned || 'Untitled';
}

/** 'The Movie (2009).mkv' or 'The.Movie.2009.1080p.BluRay.x264.mkv'. */
export function parseMovieFilename(fileName: string): FilenameCandidate {
  const raw = stripExtension(baseName(fileName));
  // Paren-year form first: 'Title (2009)'.
  const paren = raw.match(/^(.*?)[\s._]*\((\d{4})\)/);
  if (paren && plausibleYear(paren[2]!) !== null) {
    const title = titleCaseTrim(humanizeSeparators(paren[1]!));
    return { title: title || deriveTitleFromFilename(fileName), sortTitle: null, year: plausibleYear(paren[2]!), metadata: {} };
  }
  // Bare-year form: 'Title.2009.<scene tail>'.
  const bare = raw.match(/^(.*?)[\s._]+(\d{4})(?:[\s._]|$)/);
  if (bare && plausibleYear(bare[2]!) !== null) {
    const title = titleCaseTrim(humanizeSeparators(bare[1]!));
    return { title: title || deriveTitleFromFilename(fileName), sortTitle: null, year: plausibleYear(bare[2]!), metadata: {} };
  }
  // No year: drop the scene tail, keep the leading words as the title.
  const words = dropSceneTail(humanizeSeparators(raw).split(' ').filter(Boolean));
  const title = titleCaseTrim(words.join(' '));
  return { title: title || deriveTitleFromFilename(fileName), sortTitle: null, year: null, metadata: {} };
}

/** 'Series S01E02', 'Series.S01E02.Title', 'Series - 1x02 - Title'. */
export function parseShowFilename(fileName: string): FilenameCandidate {
  const raw = stripExtension(baseName(fileName));
  const se = raw.match(/^(.*?)[\s._-]*[Ss](\d{1,2})[\s._-]*[Ee](\d{1,3})(.*)$/)
    ?? raw.match(/^(.*?)[\s._-]+(\d{1,2})x(\d{2,3})(.*)$/);
  const series = titleCaseTrim(humanizeSeparators(se ? se[1]! : dropSceneTail(humanizeSeparators(raw).split(' ').filter(Boolean)).join(' ')));
  const seriesName = series || deriveTitleFromFilename(fileName);
  if (!se) {
    return { title: seriesName, sortTitle: null, year: null, metadata: { series: seriesName } };
  }
  const season = parseInt(se[2]!, 10);
  const episode = parseInt(se[3]!, 10);
  const epTitle = titleCaseTrim(humanizeSeparators(dropSceneTail(humanizeSeparators(se[4] ?? '').split(' ').filter(Boolean)).join(' ')));
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const label = `S${pad(season)}E${pad(episode)}`;
  const title = epTitle ? `${label} - ${epTitle}` : label;
  const metadata: Record<string, unknown> = { series: seriesName };
  if (Number.isInteger(season)) metadata.season = season;
  if (Number.isInteger(episode)) metadata.episode = episode;
  return { title, sortTitle: null, year: null, metadata };
}

/** 'Artist - Album - 01 Track', 'Artist - Track', '01 - Track', '01 Track'. */
export function parseMusicFilename(fileName: string): FilenameCandidate {
  const raw = humanizeSeparators(stripExtension(baseName(fileName)));
  const parts = raw.split(/\s-\s/).map((p) => p.trim()).filter(Boolean);
  const takeTrackNumber = (value: string): { trackNumber: number | null; rest: string } => {
    const m = value.match(/^(\d{1,3})[\s.-]+(.+)$/);
    if (m) {
      const n = parseInt(m[1]!, 10);
      return { trackNumber: Number.isInteger(n) && n > 0 && n < 1000 ? n : null, rest: m[2]!.trim() };
    }
    return { trackNumber: null, rest: value };
  };
  if (parts.length >= 3) {
    const artist = titleCaseTrim(parts[0]!);
    const album = titleCaseTrim(parts[1]!);
    const { trackNumber, rest } = takeTrackNumber(parts.slice(2).join(' - '));
    const title = titleCaseTrim(rest) || deriveTitleFromFilename(fileName);
    const metadata: Record<string, unknown> = { artist: artist || 'Unknown Artist' };
    if (album) metadata.album = album;
    if (trackNumber !== null) metadata.trackNumber = trackNumber;
    return { title, sortTitle: null, year: null, metadata };
  }
  if (parts.length === 2) {
    const artist = titleCaseTrim(parts[0]!);
    const { trackNumber, rest } = takeTrackNumber(parts[1]!);
    const title = titleCaseTrim(rest) || deriveTitleFromFilename(fileName);
    const metadata: Record<string, unknown> = { artist: artist || 'Unknown Artist' };
    if (trackNumber !== null) metadata.trackNumber = trackNumber;
    return { title, sortTitle: null, year: null, metadata };
  }
  const { trackNumber, rest } = takeTrackNumber(raw);
  const title = titleCaseTrim(rest) || deriveTitleFromFilename(fileName);
  const metadata: Record<string, unknown> = { artist: 'Unknown Artist' };
  if (trackNumber !== null) metadata.trackNumber = trackNumber;
  return { title, sortTitle: null, year: null, metadata };
}

/** 'Author - Title', 'Title (Author)', or a bare title. */
export function parseEbookFilename(fileName: string): FilenameCandidate {
  const raw = humanizeSeparators(stripExtension(baseName(fileName)));
  const dash = raw.split(/\s-\s/).map((p) => p.trim()).filter(Boolean);
  if (dash.length >= 2) {
    // Calibre convention is 'Author - Title'.
    const author = titleCaseTrim(dash[0]!);
    const title = titleCaseTrim(dash.slice(1).join(' - ')) || deriveTitleFromFilename(fileName);
    return { title, sortTitle: null, year: null, metadata: author ? { authors: [author] } : {} };
  }
  const paren = raw.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (paren) {
    const title = titleCaseTrim(paren[1]!) || deriveTitleFromFilename(fileName);
    const author = titleCaseTrim(paren[2]!);
    return { title, sortTitle: null, year: null, metadata: author ? { authors: [author] } : {} };
  }
  return { title: titleCaseTrim(raw) || deriveTitleFromFilename(fileName), sortTitle: null, year: null, metadata: {} };
}

/** Route to the right filename parser for a media type. Always returns a title. */
export function parseFilenameForType(mediaType: string, fileName: string): FilenameCandidate {
  switch (mediaType) {
    case 'movie': return parseMovieFilename(fileName);
    case 'show': return parseShowFilename(fileName);
    case 'music': return parseMusicFilename(fileName);
    case 'book': return parseEbookFilename(fileName);
    default:
      return { title: deriveTitleFromFilename(fileName), sortTitle: null, year: null, metadata: {} };
  }
}

// ---------------------------------------------------------------------------
// NFO sidecar parser: BOUNDED + XXE-hardened. Hand-rolled (no XML engine), so
// there is no DTD processing, no entity table, and no external-reference path.
// ---------------------------------------------------------------------------

/** Hard cap on an NFO sidecar (raw UTF-8 bytes). Larger inputs return null. */
export const NFO_MAX_BYTES = 512 * 1024;

const NFO_MAX_PLOT_CHARS = 4000;
const NFO_MAX_GENRES = 24;
const NFO_MAX_TITLE_CHARS = 512;

export interface NfoMetadata {
  title: string | null;
  year: number | null;
  plot: string | null;
  genres: string[];
  runtimeMinutes: number | null;
}

/** Decode ONLY the five predefined XML entities + bounded numeric refs. No custom entities exist (DTD is rejected), so this cannot expand. */
function decodeXmlText(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (whole, body: string) => {
    switch (body) {
      case 'amp': return '&';
      case 'lt': return '<';
      case 'gt': return '>';
      case 'quot': return '"';
      case 'apos': return "'";
      default: {
        const isHex = body[1] === 'x' || body[1] === 'X';
        const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return whole;
        try {
          return String.fromCodePoint(code);
        } catch {
          return whole;
        }
      }
    }
  });
}

/** First tag body inside a scoped block, decoded + trimmed, or null. */
function firstTag(block: string, tag: string, maxChars: number): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!m) return null;
  const text = decodeXmlText(m[1]!).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, maxChars) : null;
}

function allTags(block: string, tag: string, maxChars: number): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const text = decodeXmlText(m[1]!).replace(/\s+/g, ' ').trim();
    if (text) out.push(text.slice(0, maxChars));
    if (out.length >= NFO_MAX_GENRES) break;
  }
  return out;
}

/**
 * Parse a Kodi-style .nfo sidecar. Returns metadata ONLY for a <movie> or
 * <episodedetails> root; a URL-stub NFO (just an address, no recognized root)
 * returns null. Any DTD / ENTITY declaration is rejected outright (fail-closed
 * against entity expansion + XXE). Only title/year/plot/genre/runtime are read.
 */
export function parseNfoSidecar(text: string): NfoMetadata | null {
  if (typeof text !== 'string') return null;
  // Size cap on the raw UTF-8 length (the on-disk size an attacker controls).
  let byteLength: number;
  try {
    byteLength = new TextEncoder().encode(text).length;
  } catch {
    return null;
  }
  if (byteLength === 0 || byteLength > NFO_MAX_BYTES) return null;
  // Fail-closed on any doctype/entity/processing constructs: no XML engine runs,
  // so a defined entity could never expand, but we reject them to be explicit.
  if (/<!DOCTYPE/i.test(text) || /<!ENTITY/i.test(text) || /<\?xml-stitch/i.test(text)) return null;

  const rootMatch = text.match(/<(movie|episodedetails)\b[\s\S]*?<\/\1>/i);
  if (!rootMatch) return null;
  const block = rootMatch[0];

  const title = firstTag(block, 'title', NFO_MAX_TITLE_CHARS)
    ?? firstTag(block, 'originaltitle', NFO_MAX_TITLE_CHARS);
  const year = plausibleYear(firstTag(block, 'year', 8))
    ?? plausibleYear((firstTag(block, 'premiered', 16) ?? '').slice(0, 4));
  const plot = firstTag(block, 'plot', NFO_MAX_PLOT_CHARS)
    ?? firstTag(block, 'outline', NFO_MAX_PLOT_CHARS);
  const genres = allTags(block, 'genre', 64);
  const runtimeRaw = firstTag(block, 'runtime', 8) ?? firstTag(block, 'durationinseconds', 12);
  let runtimeMinutes: number | null = null;
  if (runtimeRaw) {
    const n = parseInt(runtimeRaw, 10);
    if (Number.isInteger(n) && n > 0 && n < 100000) runtimeMinutes = n;
  }
  if (!title && year === null && !plot && genres.length === 0 && runtimeMinutes === null) return null;
  return { title, year, plot, genres, runtimeMinutes };
}

// ---------------------------------------------------------------------------
// JPEG EXIF reader + GPS strip. Pure byte manipulation, no native dependency.
// ---------------------------------------------------------------------------

const TIFF_TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function u16(bytes: Uint8Array, off: number, little: boolean): number {
  return little ? bytes[off]! | (bytes[off + 1]! << 8) : (bytes[off]! << 8) | bytes[off + 1]!;
}

function u32(bytes: Uint8Array, off: number, little: boolean): number {
  return little
    ? (bytes[off]! | (bytes[off + 1]! << 8) | (bytes[off + 2]! << 16) | (bytes[off + 3]! << 24)) >>> 0
    : ((bytes[off]! << 24) | (bytes[off + 1]! << 16) | (bytes[off + 2]! << 8) | bytes[off + 3]!) >>> 0;
}

interface JpegSegment {
  marker: number;
  /** Absolute byte offset of the 0xFF marker prefix. */
  start: number;
  /** Absolute byte offset just past this segment. */
  end: number;
  /** Absolute offset where the segment payload (after the 2-byte length) begins. */
  dataStart: number;
  dataLength: number;
}

/** Walk the JPEG marker segments up to (not into) the scan data. Fail-safe: stops on any malformed length. */
function scanJpegSegments(bytes: Uint8Array): JpegSegment[] {
  const segments: JpegSegment[] = [];
  if (!isJpeg(bytes)) return segments;
  let pos = 2; // past SOI (FFD8)
  const len = bytes.length;
  while (pos + 4 <= len) {
    if (bytes[pos] !== 0xff) break;
    let marker = bytes[pos + 1]!;
    // Skip fill bytes (0xFF padding).
    let markerPos = pos + 1;
    while (marker === 0xff && markerPos + 1 < len) {
      markerPos += 1;
      marker = bytes[markerPos]!;
    }
    // Standalone markers (no length): RSTn, SOI, EOI, TEM.
    if (marker === 0xd9 || marker === 0xda) break; // EOI or start-of-scan: stop.
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      pos = markerPos + 1;
      continue;
    }
    const lenPos = markerPos + 1;
    if (lenPos + 2 > len) break;
    const segLen = u16(bytes, lenPos, false);
    if (segLen < 2) break;
    const dataStart = lenPos + 2;
    const end = lenPos + segLen;
    if (end > len) break;
    segments.push({ marker, start: pos, end, dataStart, dataLength: segLen - 2 });
    pos = end;
  }
  return segments;
}

/** The APP1 EXIF segment (payload starts with "Exif\0\0"), or null. */
function findExifSegment(bytes: Uint8Array, segments: readonly JpegSegment[]): JpegSegment | null {
  for (const seg of segments) {
    if (seg.marker !== 0xe1 || seg.dataLength < 6) continue;
    const d = seg.dataStart;
    if (bytes[d] === 0x45 && bytes[d + 1] === 0x78 && bytes[d + 2] === 0x69 && bytes[d + 3] === 0x66
      && bytes[d + 4] === 0x00 && bytes[d + 5] === 0x00) {
      return seg;
    }
  }
  return null;
}

interface TiffContext {
  bytes: Uint8Array;
  /** Absolute offset of the TIFF header (byte-order marker). */
  base: number;
  /** Absolute end of the EXIF payload. */
  end: number;
  little: boolean;
}

/** Establish TIFF context from an EXIF segment, or null if the header is invalid. */
function tiffContext(bytes: Uint8Array, seg: JpegSegment): TiffContext | null {
  const base = seg.dataStart + 6; // past "Exif\0\0"
  const end = seg.end;
  if (base + 8 > end) return null;
  const order = u16(bytes, base, false);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) return null;
  if (u16(bytes, base + 2, little) !== 0x002a) return null;
  return { bytes, base, end, little };
}

interface TiffEntry { tag: number; type: number; count: number; valueOffset: number; }

/** Read the entries of the IFD at an absolute offset. Bounds-checked; returns [] on any overrun. */
function readIfd(ctx: TiffContext, ifdAbs: number): { entries: TiffEntry[]; nextIfdRel: number } {
  const { bytes, end, little } = ctx;
  if (ifdAbs + 2 > end) return { entries: [], nextIfdRel: 0 };
  const count = u16(bytes, ifdAbs, little);
  const entriesEnd = ifdAbs + 2 + count * 12;
  if (count < 0 || count > 4096 || entriesEnd + 4 > end) return { entries: [], nextIfdRel: 0 };
  const entries: TiffEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    const eOff = ifdAbs + 2 + i * 12;
    entries.push({
      tag: u16(bytes, eOff, little),
      type: u16(bytes, eOff + 2, little),
      count: u32(bytes, eOff + 4, little),
      valueOffset: eOff + 8,
    });
  }
  const nextIfdRel = u32(bytes, entriesEnd, little);
  return { entries, nextIfdRel };
}

/** Absolute offset of an entry's value bytes (inline when it fits in 4 bytes, else base + offset). */
function entryValueAbs(ctx: TiffContext, entry: TiffEntry): number {
  const size = (TIFF_TYPE_SIZES[entry.type] ?? 1) * entry.count;
  if (size <= 4) return entry.valueOffset;
  return ctx.base + u32(ctx.bytes, entry.valueOffset, ctx.little);
}

/** Read an ASCII entry value as a trimmed string (bounds-checked), or null. */
function readAscii(ctx: TiffContext, entry: TiffEntry, maxChars: number): string | null {
  if (entry.type !== 2) return null;
  const start = entryValueAbs(ctx, entry);
  const size = Math.min(entry.count, maxChars);
  if (start < 0 || start + size > ctx.end) return null;
  let out = '';
  for (let i = 0; i < size; i += 1) {
    const c = ctx.bytes[start + i]!;
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out.trim() || null;
}

/** Read one unsigned rational (num/den) at an absolute offset. */
function readRational(ctx: TiffContext, abs: number): number | null {
  if (abs + 8 > ctx.end) return null;
  const num = u32(ctx.bytes, abs, ctx.little);
  const den = u32(ctx.bytes, abs + 4, ctx.little);
  if (den === 0) return null;
  return num / den;
}

/** Convert 'YYYY:MM:DD HH:MM:SS' EXIF datetime to 'YYYY-MM-DDTHH:MM:SS', or null. */
function exifDateToIso(value: string | null): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

export interface JpegExif {
  capturedAt: string | null;
  width: number | null;
  height: number | null;
  hasGps: boolean;
  latitude: number | null;
  longitude: number | null;
}

/** Dimensions from the SOFn frame header (the real decoded size), or nulls. */
function sofDimensions(bytes: Uint8Array, segments: readonly JpegSegment[]): { width: number | null; height: number | null } {
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  for (const seg of segments) {
    if (!sofMarkers.has(seg.marker) || seg.dataLength < 5) continue;
    const d = seg.dataStart; // precision(1), height(2), width(2)
    return { height: u16(bytes, d + 1, false), width: u16(bytes, d + 3, false) };
  }
  return { width: null, height: null };
}

/**
 * Read EXIF from a JPEG: capture date (DateTimeOriginal, else DateTime),
 * dimensions (from the SOF frame), and GPS presence + decimal coordinates.
 * Fail-safe: any malformed structure yields nulls / hasGps false, never a throw.
 */
export function readJpegExif(bytes: Uint8Array): JpegExif {
  const empty: JpegExif = { capturedAt: null, width: null, height: null, hasGps: false, latitude: null, longitude: null };
  try {
    const segments = scanJpegSegments(bytes);
    const dims = sofDimensions(bytes, segments);
    const seg = findExifSegment(bytes, segments);
    if (!seg) return { ...empty, width: dims.width, height: dims.height };
    const ctx = tiffContext(bytes, seg);
    if (!ctx) return { ...empty, width: dims.width, height: dims.height };
    const ifd0Rel = u32(bytes, ctx.base + 4, ctx.little);
    const ifd0 = readIfd(ctx, ctx.base + ifd0Rel);

    let dateTime: string | null = null;
    let dateTimeOriginal: string | null = null;
    let hasGps = false;
    let gpsIfdAbs = 0;
    let exifIfdAbs = 0;
    for (const entry of ifd0.entries) {
      if (entry.tag === 0x0132) dateTime = readAscii(ctx, entry, 32);
      else if (entry.tag === 0x8769) exifIfdAbs = ctx.base + u32(ctx.bytes, entry.valueOffset, ctx.little);
      else if (entry.tag === 0x8825) { hasGps = true; gpsIfdAbs = ctx.base + u32(ctx.bytes, entry.valueOffset, ctx.little); }
    }
    if (exifIfdAbs > ctx.base && exifIfdAbs < ctx.end) {
      const exifIfd = readIfd(ctx, exifIfdAbs);
      for (const entry of exifIfd.entries) {
        if (entry.tag === 0x9003) dateTimeOriginal = readAscii(ctx, entry, 32);
      }
    }

    let latitude: number | null = null;
    let longitude: number | null = null;
    if (hasGps && gpsIfdAbs > ctx.base && gpsIfdAbs < ctx.end) {
      const gpsIfd = readIfd(ctx, gpsIfdAbs);
      let latRef = 'N'; let lonRef = 'E';
      let latVals: number[] | null = null; let lonVals: number[] | null = null;
      const readTriple = (entry: TiffEntry): number[] | null => {
        if (entry.type !== 5 || entry.count < 3) return null;
        const start = entryValueAbs(ctx, entry);
        const a = readRational(ctx, start); const b = readRational(ctx, start + 8); const c = readRational(ctx, start + 16);
        return a === null || b === null || c === null ? null : [a, b, c];
      };
      for (const entry of gpsIfd.entries) {
        if (entry.tag === 0x0001) latRef = readAscii(ctx, entry, 2) ?? 'N';
        else if (entry.tag === 0x0002) latVals = readTriple(entry);
        else if (entry.tag === 0x0003) lonRef = readAscii(ctx, entry, 2) ?? 'E';
        else if (entry.tag === 0x0004) lonVals = readTriple(entry);
      }
      const toDecimal = (vals: number[] | null, ref: string, negRef: string): number | null => {
        if (!vals) return null;
        const dec = vals[0]! + vals[1]! / 60 + vals[2]! / 3600;
        const signed = ref.toUpperCase().startsWith(negRef) ? -dec : dec;
        return Number.isFinite(signed) ? signed : null;
      };
      latitude = toDecimal(latVals, latRef, 'S');
      longitude = toDecimal(lonVals, lonRef, 'W');
    }

    return {
      capturedAt: exifDateToIso(dateTimeOriginal) ?? exifDateToIso(dateTime),
      width: dims.width,
      height: dims.height,
      hasGps,
      latitude,
      longitude,
    };
  } catch {
    return empty;
  }
}

/**
 * Strip EXIF GPS by rewriting the JPEG bytes. Fail-CLOSED for privacy: if the
 * EXIF block carries a GPS IFD pointer, the ENTIRE APP1 "Exif" segment is
 * removed, so the output provably contains no GPS IFD (verified on output bytes
 * in tests). A JPEG with no EXIF GPS is returned untouched (stripped: false), so
 * the common case keeps orientation and other tags. capturedAt/dimensions are
 * read into signed metadata BEFORE this call, so removing the segment does not
 * lose them from the item.
 */
export function stripJpegGps(bytes: Uint8Array): { bytes: Uint8Array; stripped: boolean } {
  try {
    const segments = scanJpegSegments(bytes);
    const seg = findExifSegment(bytes, segments);
    if (!seg) return { bytes, stripped: false };
    const ctx = tiffContext(bytes, seg);
    if (!ctx) return { bytes, stripped: false };
    const ifd0Rel = u32(bytes, ctx.base + 4, ctx.little);
    const ifd0 = readIfd(ctx, ctx.base + ifd0Rel);
    const hasGps = ifd0.entries.some((e) => e.tag === 0x8825);
    if (!hasGps) return { bytes, stripped: false };
    // Splice the whole APP1 Exif segment out (bytes [seg.start, seg.end)).
    const out = new Uint8Array(bytes.length - (seg.end - seg.start));
    out.set(bytes.subarray(0, seg.start), 0);
    out.set(bytes.subarray(seg.end), seg.start);
    return { bytes: out, stripped: true };
  } catch {
    return { bytes, stripped: false };
  }
}

// ---------------------------------------------------------------------------
// Entry point: compose filename + NFO + EXIF into usable local metadata.
// ---------------------------------------------------------------------------

export interface ExtractLocalMetadataInput {
  fileName: string;
  bytes?: Uint8Array | null;
  mediaType: KnownMediaType | string;
  /** Per-contributor consent (D.7). Default false -> strip GPS by rewriting bytes. */
  preserveLocation?: boolean;
  /** Optional sidecar (folder-convention bulk import, C.5); only used for movie/show. */
  nfoText?: string | null;
}

export interface LocalMetadata {
  title: string;
  sortTitle: string | null;
  year: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
  /** New bytes to seal when a GPS strip rewrote the image; null means seal the original bytes. */
  rewrittenBytes: Uint8Array | null;
  gpsStripped: boolean;
  metadataSource: 'local';
}

/**
 * The zero-setup local extraction entry point. Composes the filename parse (which
 * always yields a title), an optional NFO overlay (movie/show), and JPEG EXIF for
 * photos (capture date + dimensions always; GPS coordinates only with consent,
 * otherwise the bytes are rewritten to strip GPS). NEVER contacts the network and
 * ALWAYS returns a usable result.
 */
export function extractLocalMetadata(input: ExtractLocalMetadataInput): LocalMetadata {
  const fileName = typeof input.fileName === 'string' ? input.fileName : '';
  const base = parseFilenameForType(String(input.mediaType), fileName);
  const metadata: Record<string, unknown> = { ...base.metadata };
  let title = base.title;
  let year = base.year;
  let durationMs: number | null = null;
  let rewrittenBytes: Uint8Array | null = null;
  let gpsStripped = false;

  // NFO overlay (curator-local sidecar) wins for the fields it provides.
  if ((input.mediaType === 'movie' || input.mediaType === 'show') && input.nfoText) {
    const nfo = parseNfoSidecar(input.nfoText);
    if (nfo) {
      if (nfo.title) title = nfo.title;
      if (nfo.year !== null) year = nfo.year;
      if (nfo.plot) metadata.plot = nfo.plot;
      if (nfo.genres.length > 0) metadata.genres = nfo.genres;
      if (nfo.runtimeMinutes !== null) {
        durationMs = nfo.runtimeMinutes * 60000;
        if (input.mediaType === 'movie') metadata.runtimeMs = durationMs;
      }
    }
  }

  // Photo EXIF: capture date + dimensions always; GPS gated on consent.
  if (input.mediaType === 'photo' && input.bytes && isJpeg(input.bytes)) {
    const exif = readJpegExif(input.bytes);
    if (exif.capturedAt) metadata.capturedAt = exif.capturedAt;
    if (exif.width !== null) metadata.width = exif.width;
    if (exif.height !== null) metadata.height = exif.height;
    if (exif.hasGps) {
      if (input.preserveLocation) {
        if (exif.latitude !== null) metadata.latitude = exif.latitude;
        if (exif.longitude !== null) metadata.longitude = exif.longitude;
      } else {
        const strip = stripJpegGps(input.bytes);
        if (strip.stripped) {
          rewrittenBytes = strip.bytes;
          gpsStripped = true;
        }
      }
    }
  }

  return {
    title: title || deriveTitleFromFilename(fileName),
    sortTitle: base.sortTitle,
    year,
    durationMs,
    metadata,
    rewrittenBytes,
    gpsStripped,
    metadataSource: 'local',
  };
}
