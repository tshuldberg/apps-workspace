import JSZip from 'jszip';

export const SUPPORTED_READER_EXTENSIONS = [
  'txt',
  'md',
  'markdown',
  'html',
  'htm',
  'json',
  'csv',
  'rtf',
  'epub',
  'pdf',
  'mobi',
  'azw',
  'azw3',
] as const;

export type SupportedReaderExtension = (typeof SUPPORTED_READER_EXTENSIONS)[number];

const BINARY_READER_EXTENSIONS = new Set(['epub', 'pdf', 'mobi', 'azw', 'azw3']);
const BINARY_READER_MIME_HINTS = new Set([
  'application/epub+zip',
  'application/pdf',
  'application/x-mobipocket-ebook',
  'application/vnd.amazon.ebook',
]);

export interface ReaderUploadInput {
  fileName: string;
  mimeType?: string | null;
  textContent?: string;
  base64Content?: string;
  title?: string | null;
  author?: string | null;
}

export interface ParsedReaderUpload {
  title: string;
  author: string | null;
  mimeType: string | null;
  fileName: string;
  fileExtension: string;
  textContent: string;
  totalChars: number;
  totalWords: number;
}

interface ParsedEpubContent {
  title: string | null;
  author: string | null;
  textContent: string;
}

function basename(input: string): string {
  const withoutPath = input.split('/').pop()?.split('\\').pop() ?? input;
  return withoutPath.replace(/\.[^.]+$/, '');
}

function extractExtension(fileName: string): string {
  const match = /\.([^.]+)$/.exec(fileName.toLowerCase());
  return match ? match[1] : 'txt';
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _;
    });
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtml(content: string): string {
  const withoutScripts = content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const withBreaks = withoutScripts
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote)>/gi, '\n');

  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ' '));
}

function stripRtf(content: string): string {
  return content
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-z]+-?\d* ?/g, ' ')
    .replace(/[{}]/g, ' ');
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function joinZipPath(basePath: string, href: string): string {
  const segments = basePath
    .split('/')
    .filter(Boolean);

  for (const segment of href.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
    } else {
      segments.push(segment);
    }
  }

  return segments.join('/');
}

function getAttr(tag: string, attribute: string): string | null {
  const match = new RegExp(`${attribute}\\s*=\\s*"([^"]+)"`, 'i').exec(tag)
    ?? new RegExp(`${attribute}\\s*=\\s*'([^']+)'`, 'i').exec(tag);
  return match ? match[1] : null;
}

function readDcTag(opfContent: string, tagName: string): string | null {
  const regex = new RegExp(`<dc:${tagName}[^>]*>([\\s\\S]*?)<\\/dc:${tagName}>`, 'i');
  const match = regex.exec(opfContent);
  if (!match) return null;
  return normalizeText(decodeHtmlEntities(match[1]));
}

function decodeBase64ToBytes(base64Content: string): Uint8Array {
  if (typeof atob === 'function') {
    const raw = atob(base64Content);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
      bytes[i] = raw.charCodeAt(i);
    }
    return bytes;
  }

  const globalValue = globalThis as unknown as {
    Buffer?: { from(input: string, encoding: string): Uint8Array };
  };

  if (globalValue.Buffer) {
    return Uint8Array.from(globalValue.Buffer.from(base64Content, 'base64'));
  }

  throw new Error('Base64 decoding is not supported in this environment.');
}

function bytesToLatin1(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 1) {
    output += String.fromCharCode(bytes[i]);
  }
  return output;
}

function bytesToUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
  return bytesToLatin1(bytes);
}

function decodePdfEscapedString(value: string): string {
  let output = '';
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char !== '\\') {
      output += char;
      continue;
    }

    const next = value[i + 1];
    if (!next) break;
    i += 1;

    if (next === 'n') output += '\n';
    else if (next === 'r') output += '\r';
    else if (next === 't') output += '\t';
    else if (next === 'b') output += '\b';
    else if (next === 'f') output += '\f';
    else if (next === '(' || next === ')' || next === '\\') output += next;
    else if (/[0-7]/.test(next)) {
      let octal = next;
      for (let j = 0; j < 2; j += 1) {
        const lookAhead = value[i + 1];
        if (lookAhead && /[0-7]/.test(lookAhead)) {
          octal += lookAhead;
          i += 1;
        } else {
          break;
        }
      }
      output += String.fromCharCode(Number.parseInt(octal, 8));
    } else {
      output += next;
    }
  }
  return output;
}

function decodePdfHexString(value: string): string {
  const normalized = value.replace(/\s+/g, '');
  if (normalized.length === 0) return '';

  const safe = normalized.length % 2 === 0 ? normalized : `${normalized}0`;
  const bytes = new Uint8Array(safe.length / 2);
  for (let i = 0; i < safe.length; i += 2) {
    const byte = Number.parseInt(safe.slice(i, i + 2), 16);
    bytes[i / 2] = Number.isFinite(byte) ? byte : 0;
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let utf16 = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      utf16 += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return utf16;
  }

  return bytesToUtf8(bytes);
}

function extractPrintableText(raw: string): string {
  const compact = raw.replace(/[^\x20-\x7E\n]+/g, ' ');
  const matches = compact.match(/[A-Za-z0-9][A-Za-z0-9 ,.;:'"!?()[\]\\/_-]{24,}/g) ?? [];
  return normalizeText(matches.join('\n\n'));
}

function parsePdfFromBytes(bytes: Uint8Array): string {
  const raw = bytesToLatin1(bytes);
  const chunks: string[] = [];

  const textOperandRegex = /\((?:\\.|[^\\()])*\)\s*Tj/g;
  for (const match of raw.matchAll(textOperandRegex)) {
    const token = match[0];
    const content = token.slice(0, token.lastIndexOf(')'));
    chunks.push(decodePdfEscapedString(content.slice(1)));
  }

  const textArrayRegex = /\[(.*?)\]\s*TJ/gs;
  for (const match of raw.matchAll(textArrayRegex)) {
    const arrayBody = match[1];
    const inner = arrayBody.match(/\((?:\\.|[^\\()])*\)/g) ?? [];
    for (const token of inner) {
      chunks.push(decodePdfEscapedString(token.slice(1, -1)));
    }
  }

  const hexTextRegex = /<([0-9A-Fa-f\s]+)>\s*Tj/g;
  for (const match of raw.matchAll(hexTextRegex)) {
    chunks.push(decodePdfHexString(match[1]));
  }

  const directText = normalizeText(chunks.join('\n\n'));
  if (directText.length >= 20) {
    return directText;
  }

  const fallback = extractPrintableText(raw);
  if (fallback.length > 0) {
    return fallback;
  }

  throw new Error('Could not extract readable text from PDF.');
}

function parseMobiLikeFromBytes(bytes: Uint8Array): string {
  const latin = bytesToLatin1(bytes);
  const markerCandidates = ['<html', '<HTML', '<body', '<?xml'];
  let markerIndex = -1;
  for (const marker of markerCandidates) {
    const found = latin.indexOf(marker);
    if (found >= 0 && (markerIndex < 0 || found < markerIndex)) {
      markerIndex = found;
    }
  }

  if (markerIndex >= 0) {
    const htmlText = normalizeText(stripHtml(latin.slice(markerIndex)));
    if (htmlText.length >= 20) return htmlText;
  }

  const utf8Fallback = extractPrintableText(bytesToUtf8(bytes));
  if (utf8Fallback.length >= 20) {
    return utf8Fallback;
  }

  const latinFallback = extractPrintableText(latin);
  if (latinFallback.length >= 20) {
    return latinFallback;
  }

  throw new Error('Could not extract readable text from MOBI/AZW file.');
}

async function parseEpub(base64Content: string): Promise<ParsedEpubContent> {
  const zip = await JSZip.loadAsync(base64Content, { base64: true });

  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  let opfPath = containerXml
    ? getAttr(containerXml, 'full-path')
    : null;
  if (!opfPath) {
    const fallback = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith('.opf'));
    opfPath = fallback ?? null;
  }
  if (!opfPath) {
    throw new Error('EPUB manifest not found.');
  }

  const opfContent = await zip.file(opfPath)?.async('string');
  if (!opfContent) {
    throw new Error('EPUB package file could not be read.');
  }

  const basePath = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';

  const manifest = new Map<string, string>();
  const itemTags = opfContent.match(/<item\b[^>]*>/gi) ?? [];
  for (const tag of itemTags) {
    const id = getAttr(tag, 'id');
    const href = getAttr(tag, 'href');
    if (id && href) {
      manifest.set(id, href);
    }
  }

  const spineOrder = (opfContent.match(/<itemref\b[^>]*>/gi) ?? [])
    .map((tag) => getAttr(tag, 'idref'))
    .filter((value): value is string => Boolean(value));

  const chunks: string[] = [];
  for (const idref of spineOrder) {
    const href = manifest.get(idref);
    if (!href) continue;
    const chapterPath = joinZipPath(basePath, href);
    const chapter = await zip.file(chapterPath)?.async('string');
    if (!chapter) continue;
    const text = normalizeText(stripHtml(chapter));
    if (text.length > 0) {
      chunks.push(text);
    }
  }

  if (chunks.length === 0) {
    const fallbackEntries = Object.keys(zip.files).filter((name) =>
      /\.(xhtml|html|htm)$/i.test(name),
    );
    for (const entry of fallbackEntries) {
      const chapter = await zip.file(entry)?.async('string');
      if (!chapter) continue;
      const text = normalizeText(stripHtml(chapter));
      if (text.length > 0) chunks.push(text);
    }
  }

  if (chunks.length === 0) {
    throw new Error('No readable text content found in EPUB.');
  }

  return {
    title: readDcTag(opfContent, 'title'),
    author: readDcTag(opfContent, 'creator'),
    textContent: chunks.join('\n\n'),
  };
}

function parseTextByExtension(extension: string, rawText: string): string {
  if (extension === 'html' || extension === 'htm') {
    return normalizeText(stripHtml(rawText));
  }
  if (extension === 'json') {
    try {
      const parsed = JSON.parse(rawText);
      return normalizeText(JSON.stringify(parsed, null, 2));
    } catch {
      return normalizeText(rawText);
    }
  }
  if (extension === 'rtf') {
    return normalizeText(stripRtf(rawText));
  }
  return normalizeText(rawText);
}

export async function parseReaderUpload(
  input: ReaderUploadInput,
): Promise<ParsedReaderUpload> {
  const fileExtension = extractExtension(input.fileName);
  const mimeType = input.mimeType?.trim() || null;
  const sourceTitle = input.title?.trim() || null;
  const sourceAuthor = input.author?.trim() || null;
  const isBinary = BINARY_READER_EXTENSIONS.has(fileExtension)
    || (mimeType ? BINARY_READER_MIME_HINTS.has(mimeType) : false);

  let parsedTitle: string | null = sourceTitle;
  let parsedAuthor: string | null = sourceAuthor;
  let textContent = '';

  if (isBinary) {
    if (!input.base64Content) {
      throw new Error('Binary ebook uploads require base64 file content.');
    }

    if (fileExtension === 'epub' || mimeType === 'application/epub+zip') {
      const parsed = await parseEpub(input.base64Content);
      parsedTitle = parsedTitle ?? parsed.title;
      parsedAuthor = parsedAuthor ?? parsed.author;
      textContent = normalizeText(parsed.textContent);
    } else if (fileExtension === 'pdf' || mimeType === 'application/pdf') {
      const bytes = decodeBase64ToBytes(input.base64Content);
      textContent = normalizeText(parsePdfFromBytes(bytes));
    } else if (fileExtension === 'mobi' || fileExtension === 'azw' || fileExtension === 'azw3') {
      const bytes = decodeBase64ToBytes(input.base64Content);
      textContent = normalizeText(parseMobiLikeFromBytes(bytes));
    } else {
      throw new Error(`Unsupported binary reader format: ${fileExtension}`);
    }
  } else {
    if (typeof input.textContent !== 'string') {
      throw new Error('Text content is required for this file type.');
    }
    textContent = parseTextByExtension(fileExtension, input.textContent);
  }

  if (!textContent) {
    throw new Error('Uploaded file did not contain readable text.');
  }

  const finalTitle = parsedTitle ?? basename(input.fileName) ?? 'Untitled Document';

  return {
    title: finalTitle,
    author: parsedAuthor,
    mimeType,
    fileName: input.fileName,
    fileExtension,
    textContent,
    totalChars: textContent.length,
    totalWords: countWords(textContent),
  };
}
