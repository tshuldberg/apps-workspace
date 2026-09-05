import {
  OAuthBrokerClient,
  type HttpTransport,
  type OAuthBrokerConnectCompleteResult,
} from '@mylife/sync';
import { createBrowserHttpTransport } from './google-drive-session';

const PKCE_VERIFIER_BYTES = 48;

export interface ReconnectBrokerVaultInput {
  brokerBaseUrl: string;
  provider: 'google' | 'dropbox' | 'onedrive' | 'box';
  destinationLabel: string;
  getHostedAuthBearer(): string | null | Promise<string | null>;
  openPopup?: (url: string) => Window | null;
  now?: () => number;
  runtime?: BrokerReconnectRuntime;
}

export interface BrokerReconnectRuntime {
  randomBytes(length: number): Uint8Array;
  sha256(bytes: Uint8Array): Promise<Uint8Array>;
  randomUUID(): string;
  locationHref(): string;
  transport: HttpTransport;
  delay(milliseconds: number): Promise<void>;
}

const DEFAULT_RUNTIME: BrokerReconnectRuntime = {
  randomBytes: (length) => globalThis.crypto.getRandomValues(new Uint8Array(length)),
  sha256: async (bytes) => {
    const digestInput = Uint8Array.from(bytes);
    return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', digestInput));
  },
  randomUUID: () => globalThis.crypto.randomUUID(),
  locationHref: () => globalThis.location.href,
  transport: createBrowserHttpTransport(),
  delay: (milliseconds) => new Promise((resolve) => { globalThis.setTimeout(resolve, milliseconds); }),
};

export async function reconnectBrokerVault(
  input: ReconnectBrokerVaultInput,
): Promise<OAuthBrokerConnectCompleteResult> {
  const now = input.now ?? Date.now;
  const runtime = input.runtime ?? DEFAULT_RUNTIME;
  const verifier = base64Url(runtime.randomBytes(PKCE_VERIFIER_BYTES));
  const challenge = base64Url(await runtime.sha256(new TextEncoder().encode(verifier)));
  const state = runtime.randomUUID();
  const redirect = new URL(runtime.locationHref());
  redirect.search = '';
  redirect.hash = '';
  redirect.searchParams.set('meerkat_storage_oauth', '1');
  const client = new OAuthBrokerClient({
    baseUrl: input.brokerBaseUrl,
    transport: runtime.transport,
    getAuthorizationHeader: async () => {
      const bearer = await input.getHostedAuthBearer();
      return bearer ? `Bearer ${bearer}` : null;
    },
    now,
  });
  const started = await client.connectStart({
    provider: input.provider,
    destinationLabel: input.destinationLabel,
    redirectUri: redirect.href,
    codeChallenge: challenge,
    state,
  });
  const popup = (input.openPopup ?? ((url) => globalThis.open(url, 'meerkat-storage-oauth', 'popup,width=520,height=720')))(
    started.authorizationUrl,
  );
  if (popup === null) throw new Error('The provider sign-in window was blocked.');
  let callback: { code: string };
  try {
    callback = await waitForCallback(
      popup, redirect.origin, state, Date.parse(started.expiresAt), now, runtime.delay,
    );
  } finally {
    popup.close();
  }
  return client.connectComplete({ state, code: callback.code, codeVerifier: verifier });
}

async function waitForCallback(
  popup: Window,
  expectedOrigin: string,
  expectedState: string,
  expiresAt: number,
  now: () => number,
  delayFn: (milliseconds: number) => Promise<void>,
): Promise<{ code: string }> {
  while (now() < expiresAt) {
    if (popup.closed) throw new Error('Provider sign-in was closed before it completed.');
    try {
      const url = new URL(popup.location.href);
      if (url.origin === expectedOrigin && url.searchParams.get('meerkat_storage_oauth') === '1') {
        const state = url.searchParams.get('state');
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        if (error) throw new Error(`Provider sign-in failed: ${error}.`);
        if (state !== expectedState || !code) throw new Error('Provider sign-in callback was invalid.');
        return { code };
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Provider sign-in')) throw error;
    }
    await delayFn(250);
  }
  throw new Error('Provider sign-in expired.');
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
