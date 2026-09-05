import {
  OAuthBrokerClient,
  OAuthBrokerClientError,
  type AccessTokenOperation,
  type AccessTokenProvider,
  type HttpTransport,
  type HttpTransportRequest,
  type HttpTransportResponse,
} from '@mylife/sync';

export const ONEDRIVE_BROKER_TRUST_DISCLOSURE =
  'The selected broker can access the provider token and encrypted Meerkat objects. You can select a self-hosted broker.';

export interface OneDriveBrokerSessionClient {
  session(input: {
    vaultId: string;
    operation: AccessTokenOperation;
    destinationId: string;
  }): Promise<{ accessToken: string }>;
  revoke(vaultId: string): Promise<unknown>;
}

export interface OneDriveBrokerSessionSource extends AccessTokenProvider {
  readonly credentialRef: string;
  revoke(): Promise<void>;
}

export interface OneDriveBrokerSessionSourceOptions {
  client: OneDriveBrokerSessionClient;
  vaultId: string;
  destinationId: string;
}

export interface OneDriveWebSessionOptions {
  brokerBaseUrl: string;
  vaultId: string;
  destinationId: string;
  getHostedAuthBearer: () => string | null | Promise<string | null>;
  transport?: HttpTransport;
  fetchImpl?: typeof fetch;
}

const SAFE_ID = /^[A-Za-z0-9._:-]{1,200}$/u;
const MAX_BROKER_RESPONSE_BYTES = 128 * 1024;

export function createOneDriveBrokerSessionSource(
  options: OneDriveBrokerSessionSourceOptions,
): OneDriveBrokerSessionSource {
  const vaultId = requireSafeId(options.vaultId, 'vaultId');
  const destinationId = requireSafeId(options.destinationId, 'destinationId');
  return {
    credentialRef: `broker://oauth/${vaultId}`,
    async getAccessToken(operation) {
      try {
        const session = await options.client.session({ vaultId, destinationId, operation });
        return safeAccessToken(session.accessToken);
      } catch (error) {
        if (error instanceof OAuthBrokerClientError
          && (error.code === 'auth_required' || error.code === 'vault_not_found')) return null;
        throw error;
      }
    },
    async revoke() {
      await options.client.revoke(vaultId);
    },
  };
}

export function createOneDriveWebSessionSource(
  options: OneDriveWebSessionOptions,
): OneDriveBrokerSessionSource {
  const client = new OAuthBrokerClient({
    baseUrl: options.brokerBaseUrl,
    transport: options.transport ?? createOneDriveBrowserHttpTransport(options.fetchImpl),
    getAuthorizationHeader: async () => {
      const bearer = await options.getHostedAuthBearer();
      return safeHostedBearer(bearer) ? `Bearer ${bearer}` : null;
    },
    maximumResponseBytes: MAX_BROKER_RESPONSE_BYTES,
  });
  return createOneDriveBrokerSessionSource({
    client,
    vaultId: options.vaultId,
    destinationId: options.destinationId,
  });
}

export function createOneDriveBrowserHttpTransport(fetchImpl: typeof fetch = fetch): HttpTransport {
  return async (request: HttpTransportRequest): Promise<HttpTransportResponse> => {
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ? request.body.slice() : undefined,
      credentials: 'omit',
      redirect: 'error',
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => { headers[name] = value; });
    return {
      status: response.status,
      headers,
      body: new Uint8Array(await response.arrayBuffer()),
    };
  };
}

function requireSafeId(value: string, label: string): string {
  const normalized = value.trim();
  if (!SAFE_ID.test(normalized)) throw new Error(`OneDrive ${label} is invalid.`);
  return normalized;
}

function safeAccessToken(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 65_536 && !/[\r\n\0]/u.test(value)
    ? value
    : null;
}

function safeHostedBearer(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 8_192
    && !/[\s\r\n\0]/u.test(value);
}
