export type YearnAuthLinkAction =
  | 'ignored'
  | 'code_exchange'
  | 'token_verified';

export type YearnAuthOtpType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email';

export interface YearnAuthLinkParams {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  type: YearnAuthOtpType | null;
  error: string | null;
  errorDescription: string | null;
}

export interface YearnAuthLinkResult {
  handled: boolean;
  action: YearnAuthLinkAction;
  isRecovery: boolean;
}

interface YearnAuthLinkClient {
  auth: {
    exchangeCodeForSession: (code: string) => Promise<{
      error: { message: string } | null;
    }>;
    verifyOtp: (params: {
      token_hash: string;
      type: YearnAuthOtpType;
    }) => Promise<{
      error: { message: string } | null;
    }>;
  };
}

interface RawYearnAuthLinkParams {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  type: string | null;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}

const OTP_TYPES = new Set<YearnAuthOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

function normalizeOtpType(value: string | null): YearnAuthOtpType | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return OTP_TYPES.has(normalized as YearnAuthOtpType)
    ? normalized as YearnAuthOtpType
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

function readParamSegment(
  url: string,
  start: number,
  end: number,
  params: RawYearnAuthLinkParams,
): void {
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
        if (params.errorDescription === null) {
          params.errorDescription = queryValue(url, equals, pairEnd);
        }
        break;
      }
    }

    cursor = pairEnd + 1;
  }
}

function collectUrlParams(url: string): RawYearnAuthLinkParams {
  const params: RawYearnAuthLinkParams = {
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

export function parseYearnAuthLink(url: string): YearnAuthLinkParams | null {
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
      || accessToken
      || refreshToken
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

export async function completeYearnAuthLink(
  client: YearnAuthLinkClient,
  url: string,
): Promise<YearnAuthLinkResult> {
  const parsed = parseYearnAuthLink(url);
  if (!parsed) {
    return { handled: false, action: 'ignored', isRecovery: false };
  }

  if (parsed.error || parsed.errorDescription) {
    throw new Error(parsed.errorDescription ?? parsed.error ?? 'Yearn auth link failed.');
  }

  if (parsed.code) {
    const { error } = await client.auth.exchangeCodeForSession(parsed.code);
    if (error) throw new Error(error.message);
    return { handled: true, action: 'code_exchange', isRecovery: parsed.type === 'recovery' };
  }

  if (parsed.accessToken || parsed.refreshToken) {
    // Raw session tokens in a deep link are a session-fixation vector: any
    // page or QR code can mint a yearn:// URL that silently signs the victim
    // into an attacker-controlled account. Only the PKCE code exchange and
    // token_hash verification flows are accepted.
    throw new Error('This sign-in link format is not supported. Request a new sign-in link and try again.');
  }

  if (parsed.tokenHash) {
    if (!parsed.type) {
      throw new Error('Yearn auth link is missing a supported verification type.');
    }

    const { error } = await client.auth.verifyOtp({
      token_hash: parsed.tokenHash,
      type: parsed.type,
    });
    if (error) throw new Error(error.message);
    return { handled: true, action: 'token_verified', isRecovery: parsed.type === 'recovery' };
  }

  return { handled: false, action: 'ignored', isRecovery: false };
}
