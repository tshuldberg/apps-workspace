import type { SupabaseClient } from '@supabase/supabase-js';

export type BestChefAuthLinkAction =
  | 'ignored'
  | 'code_exchange'
  | 'session_set'
  | 'token_verified';

export type BestChefAuthOtpType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email';

export interface BestChefAuthLinkParams {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  type: BestChefAuthOtpType | null;
  error: string | null;
  errorDescription: string | null;
}

export interface BestChefAuthLinkResult {
  handled: boolean;
  action: BestChefAuthLinkAction;
  isRecovery: boolean;
}

const OTP_TYPES = new Set<BestChefAuthOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);
interface RawBestChefAuthLinkParams {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  type: string | null;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}

function normalizeOtpType(value: string | null): BestChefAuthOtpType | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return OTP_TYPES.has(normalized as BestChefAuthOtpType)
    ? normalized as BestChefAuthOtpType
    : null;
}

function decodeQueryValue(value: string): string {
  if (!value.includes('%') && !value.includes('+')) return value;
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function queryValue(url: string, equals: number, pairEnd: number): string {
  return equals < pairEnd ? decodeQueryValue(url.slice(equals + 1, pairEnd)) : '';
}

function readParamSegment(url: string, start: number, end: number, params: RawBestChefAuthLinkParams): void {
  let cursor = start;
  while (cursor < end) {
    let pairEnd = url.indexOf('&', cursor);
    if (pairEnd === -1 || pairEnd > end) pairEnd = end;

    if (pairEnd > cursor) {
      let equals = url.indexOf('=', cursor);
      if (equals === -1 || equals > pairEnd) equals = pairEnd;

      const key = url.slice(cursor, equals);
      switch (key) {
        case 'code':
          if (params.code === null) params.code = queryValue(url, equals, pairEnd);
          break;
        case 'access_token':
          if (params.accessToken === null) params.accessToken = queryValue(url, equals, pairEnd);
          break;
        case 'refresh_token':
          if (params.refreshToken === null) params.refreshToken = queryValue(url, equals, pairEnd);
          break;
        case 'token_hash':
          if (params.tokenHash === null) params.tokenHash = queryValue(url, equals, pairEnd);
          break;
        case 'type':
          if (params.type === null) params.type = queryValue(url, equals, pairEnd);
          break;
        case 'error':
          if (params.error === null) params.error = queryValue(url, equals, pairEnd);
          break;
        case 'error_code':
          if (params.errorCode === null) params.errorCode = queryValue(url, equals, pairEnd);
          break;
        case 'error_description':
          if (params.errorDescription === null) params.errorDescription = queryValue(url, equals, pairEnd);
          break;
      }
    }

    cursor = pairEnd + 1;
  }
}

function collectUrlParams(url: string): RawBestChefAuthLinkParams {
  const params: RawBestChefAuthLinkParams = {
    code: null,
    accessToken: null,
    refreshToken: null,
    tokenHash: null,
    type: null,
    error: null,
    errorCode: null,
    errorDescription: null,
  };
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  if (queryIndex !== -1 && (hashIndex === -1 || queryIndex < hashIndex)) {
    readParamSegment(url, queryIndex + 1, hashIndex === -1 ? url.length : hashIndex, params);
  }

  if (hashIndex !== -1 && hashIndex + 1 < url.length) {
    const hashQueryIndex = url.indexOf('?', hashIndex + 1);
    const start = hashQueryIndex === -1 ? hashIndex + 1 : hashQueryIndex + 1;
    readParamSegment(url, start, url.length, params);
  }

  return params;
}

export function parseBestChefAuthLink(url: string): BestChefAuthLinkParams | null {
  const params = collectUrlParams(url);
  const code = params.code;
  const accessToken = params.accessToken;
  const refreshToken = params.refreshToken;
  const tokenHash = params.tokenHash;
  const error = params.error ?? params.errorCode;
  const errorDescription = params.errorDescription;
  const type = normalizeOtpType(params.type);

  const hasAuthSignal = Boolean(
    code
      || (accessToken && refreshToken)
      || tokenHash
      || error
      || errorDescription,
  );

  if (!hasAuthSignal) return null;

  return {
    code,
    accessToken,
    refreshToken,
    tokenHash,
    type,
    error,
    errorDescription,
  };
}

export async function completeBestChefAuthLink(
  supabase: SupabaseClient,
  url: string,
): Promise<BestChefAuthLinkResult> {
  const parsed = parseBestChefAuthLink(url);
  if (!parsed) {
    return { handled: false, action: 'ignored', isRecovery: false };
  }

  if (parsed.error || parsed.errorDescription) {
    throw new Error(parsed.errorDescription ?? parsed.error ?? 'BestChef auth link failed.');
  }

  if (parsed.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
    if (error) throw new Error(error.message);
    return { handled: true, action: 'code_exchange', isRecovery: parsed.type === 'recovery' };
  }

  if (parsed.accessToken && parsed.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    });
    if (error) throw new Error(error.message);
    return { handled: true, action: 'session_set', isRecovery: parsed.type === 'recovery' };
  }

  if (parsed.tokenHash) {
    if (!parsed.type) {
      throw new Error('BestChef auth link is missing a supported verification type.');
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: parsed.tokenHash,
      type: parsed.type,
    });
    if (error) throw new Error(error.message);
    return { handled: true, action: 'token_verified', isRecovery: parsed.type === 'recovery' };
  }

  return { handled: false, action: 'ignored', isRecovery: false };
}
