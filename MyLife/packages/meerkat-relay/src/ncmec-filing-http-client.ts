/** HTTPS client for a founder-provisioned CyberTipline filing gateway. */
import type { NcmecFilingClient, NcmecFilingOutcome, NcmecReportRecord } from './ncmec-queue';

const MAX_RESPONSE_BYTES = 64 * 1024;
const SAFE_PROVIDER_REF = /^[A-Za-z0-9_.:@/-]{1,256}$/u;
const SAFE_ERROR_CODE = /^[A-Za-z0-9_.:-]{1,128}$/u;

export interface HttpNcmecFilingClientOptions {
  endpoint: string;
  apiToken: string;
  timeoutMs?: number;
  allowInsecureHttp?: boolean;
  fetchImpl?: typeof fetch;
}

export class HttpNcmecFilingClient implements NcmecFilingClient {
  readonly state = 'configured' as const;
  private readonly endpoint: string;
  private readonly apiToken: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpNcmecFilingClientOptions) {
    let endpoint: URL;
    try {
      endpoint = new URL(options.endpoint);
    } catch {
      throw new TypeError('NCMEC filing endpoint is invalid');
    }
    if (endpoint.protocol !== 'https:'
      && !(options.allowInsecureHttp === true && endpoint.protocol === 'http:')) {
      throw new TypeError('NCMEC filing endpoint must use HTTPS');
    }
    if (!options.apiToken.trim() || /[\r\n\0]/u.test(options.apiToken)) {
      throw new TypeError('NCMEC filing API token is invalid');
    }
    this.endpoint = endpoint.toString();
    this.apiToken = options.apiToken.trim();
    this.timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new TypeError('NCMEC filing timeout is invalid');
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Gateway readiness is proven before the worker claims a queued report. */
  async verifyReady(): Promise<void> {
    const response = await this.request('GET');
    if (!response.ok) throw new Error('ncmec_gateway_unavailable');
  }

  async file(record: NcmecReportRecord): Promise<NcmecFilingOutcome> {
    let response: Response;
    try {
      response = await this.request('POST', record);
    } catch {
      return { ok: false, classification: 'transient', reason: 'gateway_unavailable' };
    }
    let body: Record<string, unknown> | null;
    try {
      body = await this.readBody(response);
    } catch {
      return { ok: false, classification: 'transient', reason: 'gateway_unavailable' };
    }
    if (response.ok) {
      const providerRef = typeof body?.providerRef === 'string' ? body.providerRef.trim() : '';
      return SAFE_PROVIDER_REF.test(providerRef)
        ? { ok: true, providerRef }
        : { ok: false, classification: 'transient', reason: 'invalid_confirmation' };
    }
    const reason = typeof body?.error === 'string' && SAFE_ERROR_CODE.test(body.error)
      ? body.error
      : 'provider_rejected';
    if (response.status === 400 || response.status === 404 || response.status === 422) {
      return { ok: false, classification: 'permanent', reason };
    }
    return { ok: false, classification: 'transient', reason };
  }

  private request(method: 'GET' | 'POST', record?: NcmecReportRecord): Promise<Response> {
    return this.fetchImpl(this.endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        Accept: 'application/json',
        ...(record
          ? { 'Content-Type': 'application/json', 'Idempotency-Key': record.id }
          : {}),
      },
      ...(record ? { body: JSON.stringify(record) } : {}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  private async readBody(response: Response): Promise<Record<string, unknown> | null> {
    const declaredHeader = response.headers.get('content-length');
    if (declaredHeader !== null) {
      const declared = Number(declaredHeader);
      if (!Number.isSafeInteger(declared) || declared < 0 || declared > MAX_RESPONSE_BYTES) {
        void response.body?.cancel('ncmec_response_size_invalid').catch(() => undefined);
        return null;
      }
    }
    const reader = response.body?.getReader();
    if (reader === undefined) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    let finished = false;
    try {
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) {
          finished = true;
          continue;
        }
        total += value.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          void reader.cancel('ncmec_response_too_large').catch(() => undefined);
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
}
