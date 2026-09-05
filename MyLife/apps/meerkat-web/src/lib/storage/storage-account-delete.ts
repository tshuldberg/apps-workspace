import {
  createHostedAuthBearer,
  OAuthBrokerClient,
  type DeviceIdentity,
} from '@mylife/sync';
import { HOSTED_API_URL } from '../hosted-access';
import { createBrowserHttpTransport } from './google-drive-session';

export interface WebStorageAccountRemote {
  deleteBrokerVault(vaultId: string): Promise<void>;
  deleteHostedAccount(): Promise<void>;
}

export function createWebStorageAccountRemote(
  identity: DeviceIdentity,
): WebStorageAccountRemote {
  const authorization = `Bearer ${createHostedAuthBearer(identity)}`;
  const transport = createBrowserHttpTransport();
  return {
    async deleteBrokerVault(vaultId) {
      const client = new OAuthBrokerClient({
        baseUrl: requireHostedApiUrl(),
        transport,
        getAuthorizationHeader: () => authorization,
      });
      await client.revoke(vaultId);
    },
    async deleteHostedAccount() {
      const response = await transport({
        method: 'POST',
        url: hostedAccountDeleteUrl(requireHostedApiUrl()),
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: new TextEncoder().encode('{}'),
      });
      if (response.status !== 200 || !hasDeletedReport(response.body)) {
        throw new Error(`hosted_storage_delete_failed:${response.status}`);
      }
    },
  };
}

function requireHostedApiUrl(): string {
  if (!HOSTED_API_URL.trim()) {
    throw new Error('The hosted storage service is not configured in this build.');
  }
  return HOSTED_API_URL.trim();
}

function hostedAccountDeleteUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('The hosted storage service URL is invalid.');
  }
  url.pathname = `${url.pathname.replace(/\/+$/u, '')}/api/storage/v1/account/delete`;
  return url.href;
}

function hasDeletedReport(bytes: Uint8Array): boolean {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      && typeof (parsed as Record<string, unknown>).deleted === 'object'
      && (parsed as Record<string, unknown>).deleted !== null;
  } catch {
    return false;
  }
}
