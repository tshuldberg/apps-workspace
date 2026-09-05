import Constants from 'expo-constants';
import {
  createHostedAuthBearer,
  OAuthBrokerClient,
  type DeviceIdentity,
} from '@mylife/sync';
import { createMobileHttpTransport } from './credential-store';

export interface MobileStorageAccountRemote {
  deleteBrokerVault(vaultId: string): Promise<void>;
  deleteHostedAccount(): Promise<void>;
}

export function createMobileStorageAccountRemote(
  identity: DeviceIdentity,
): MobileStorageAccountRemote {
  const authorization = `Bearer ${createHostedAuthBearer(identity)}`;
  const transport = createMobileHttpTransport();
  return {
    async deleteBrokerVault(vaultId) {
      const client = new OAuthBrokerClient({
        baseUrl: readHostedApiUrl(),
        transport,
        getAuthorizationHeader: () => authorization,
      });
      await client.revoke(vaultId);
    },
    async deleteHostedAccount() {
      const baseUrl = readHostedApiUrl();
      const response = await transport({
        method: 'POST',
        url: hostedAccountDeleteUrl(baseUrl),
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

function readHostedApiUrl(): string {
  const raw = (Constants.expoConfig?.extra as { hostedApiUrl?: unknown } | undefined)?.hostedApiUrl;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error('The hosted storage service is not configured in this build.');
  }
  return raw.trim();
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
