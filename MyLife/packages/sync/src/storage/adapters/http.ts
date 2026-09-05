import { StorageAdapterError } from '../types';

export interface HttpTransportRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: Uint8Array;
}

export interface HttpTransportResponse {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
}

export type HttpTransport = (request: HttpTransportRequest) => Promise<HttpTransportResponse>;

export type StorageCredentialOperation = 'health' | 'quota' | 'read' | 'write' | 'list' | 'delete';

export interface CredentialProvider<Credentials> {
  get(operation?: StorageCredentialOperation): Promise<Credentials | null>;
}

export interface RedirectedHttpResponse {
  response: HttpTransportResponse;
  finalUrl: string;
}

const SAFE_OBJECT_ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;
const REDIRECT_STATUS_PATTERN = /^30[0-9]$/;
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function assertSafeObjectId(objectId: string): void {
  if (
    !SAFE_OBJECT_ID_PATTERN.test(objectId)
    || objectId === '.'
    || objectId === '..'
  ) {
    throw new StorageAdapterError('provider_error', 'object id is not a path-safe opaque id', false);
  }
}

export function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) length += part.length;
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function bytesToHex(bytes: Uint8Array): string {
  let output = '';
  for (const byte of bytes) output += byte.toString(16).padStart(2, '0');
  return output;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset] ?? 0;
    const second = bytes[offset + 1] ?? 0;
    const third = bytes[offset + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;
    output += BASE64_ALPHABET[(combined >>> 18) & 0x3f];
    output += BASE64_ALPHABET[(combined >>> 12) & 0x3f];
    output += offset + 1 < bytes.length ? BASE64_ALPHABET[(combined >>> 6) & 0x3f] : '=';
    output += offset + 2 < bytes.length ? BASE64_ALPHABET[combined & 0x3f] : '=';
  }
  return output;
}

export function responseHeader(
  headers: Readonly<Record<string, string>>,
  name: string,
): string | null {
  const target = name.toLowerCase();
  for (const [headerName, value] of Object.entries(headers)) {
    if (headerName.toLowerCase() === target) return value;
  }
  return null;
}

export async function callHttpTransport(
  transport: HttpTransport,
  request: HttpTransportRequest,
): Promise<HttpTransportResponse> {
  try {
    const response = await transport(request);
    if (
      response === null
      || typeof response !== 'object'
      || !Number.isSafeInteger(response.status)
      || response.status < 100
      || response.status > 599
      || !isStringRecord(response.headers)
      || !(response.body instanceof Uint8Array)
    ) {
      throw new StorageAdapterError('provider_error', 'provider returned a malformed response', false);
    }
    return response;
  } catch (error) {
    if (error instanceof StorageAdapterError) throw error;
    throw new StorageAdapterError('unreachable', 'provider transport is unreachable', true);
  }
}

export async function requestWithSingleOriginRedirect(
  transport: HttpTransport,
  initialUrl: string,
  requestForUrl: (url: string) => HttpTransportRequest | Promise<HttpTransportRequest>,
): Promise<RedirectedHttpResponse> {
  const initial = new URL(initialUrl);
  const firstResponse = await callHttpTransport(transport, await requestForUrl(initial.href));
  if (!isRedirectStatus(firstResponse.status)) {
    return { response: firstResponse, finalUrl: initial.href };
  }

  const location = responseHeader(firstResponse.headers, 'location');
  if (location === null) {
    throw new StorageAdapterError('unsafe_redirect', 'provider returned an unusable redirect', false);
  }
  let redirected: URL;
  try {
    redirected = new URL(location, initial);
  } catch {
    throw new StorageAdapterError('unsafe_redirect', 'provider returned an unusable redirect', false);
  }
  if (redirected.origin !== initial.origin || redirected.username !== '' || redirected.password !== '') {
    throw new StorageAdapterError('unsafe_redirect', 'cross-origin credential forwarding was refused', false);
  }

  const secondResponse = await callHttpTransport(transport, await requestForUrl(redirected.href));
  if (isRedirectStatus(secondResponse.status)) {
    throw new StorageAdapterError('unsafe_redirect', 'provider redirect limit was exceeded', false);
  }
  return { response: secondResponse, finalUrl: redirected.href };
}

export function throwForHttpStatus(status: number, provider: string): never {
  if (status === 401) {
    throw new StorageAdapterError('auth_required', `${provider} authorization is required`, false);
  }
  if (status === 403) {
    throw new StorageAdapterError('revoked', `${provider} authorization was refused`, false);
  }
  if (status === 404) {
    throw new StorageAdapterError('not_found', `${provider} object was not found`, false);
  }
  if (status === 408 || status === 425) {
    throw new StorageAdapterError('unreachable', `${provider} request could not complete`, true);
  }
  if (status === 409 || status === 412) {
    throw new StorageAdapterError('conflict', `${provider} object changed concurrently`, false);
  }
  if (status === 413 || status === 507) {
    throw new StorageAdapterError('quota_exceeded', `${provider} storage capacity was exceeded`, false);
  }
  if (status === 429) {
    throw new StorageAdapterError('rate_limited', `${provider} rate limit was reached`, true);
  }
  if (status >= 500) {
    throw new StorageAdapterError('provider_error', `${provider} returned a server error`, true);
  }
  throw new StorageAdapterError('provider_error', `${provider} returned an unexpected status`, false);
}

export function decodeXmlEntities(value: string): string {
  return value.replace(
    /&(?:#(\d+)|#x([0-9a-fA-F]+)|amp|lt|gt|quot|apos);/g,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      if (decimal !== undefined) return safeCodePoint(decimal, 10);
      if (hexadecimal !== undefined) return safeCodePoint(hexadecimal, 16);
      if (entity === '&amp;') return '&';
      if (entity === '&lt;') return '<';
      if (entity === '&gt;') return '>';
      if (entity === '&quot;') return '"';
      return "'";
    },
  );
}

export function xmlElementText(xml: string, localName: string): string | null {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(localName)) return null;
  const prefix = '(?:[A-Za-z_][A-Za-z0-9_.-]*:)?';
  const expression = new RegExp(
    `<${prefix}${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${prefix}${localName}\\s*>`,
    'i',
  );
  const match = expression.exec(xml);
  if (match?.[1] === undefined) return null;
  return decodeXmlEntities(match[1].replace(/<[^>]*>/g, '').trim());
}

export function xmlElementBlocks(xml: string, localName: string): string[] {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(localName)) return [];
  const prefix = '(?:[A-Za-z_][A-Za-z0-9_.-]*:)?';
  const expression = new RegExp(
    `<${prefix}${localName}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${prefix}${localName}\\s*>`,
    'gi',
  );
  return xml.match(expression) ?? [];
}

export function decodeBoundedText(body: Uint8Array, maximumBytes: number): string {
  if (body.length > maximumBytes) {
    throw new StorageAdapterError('provider_error', 'provider response exceeded the safety limit', false);
  }
  return new TextDecoder().decode(body);
}

export function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host === '::1') return true;
  if (/^(?:fc|fd)[0-9a-f]{2}:/i.test(host)) return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (match === null) return false;
  const octets = match.slice(1).map((part) => Number.parseInt(part, 10));
  if (octets.some((part) => part < 0 || part > 255)) return false;
  const [first, second] = octets;
  return first === 10
    || first === 127
    || (first === 172 && second !== undefined && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}

export function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function isRedirectStatus(status: number): boolean {
  return REDIRECT_STATUS_PATTERN.test(String(status));
}

function safeCodePoint(value: string, radix: number): string {
  const codePoint = Number.parseInt(value, radix);
  if (
    !Number.isSafeInteger(codePoint)
    || codePoint < 0
    || codePoint > 0x10ffff
    || (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    return '\ufffd';
  }
  return String.fromCodePoint(codePoint);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.entries(value).every(([name, headerValue]) => (
      name.length > 0 && typeof headerValue === 'string'
    ));
}
