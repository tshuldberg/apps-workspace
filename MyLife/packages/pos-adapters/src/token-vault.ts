import type { PosConnection } from './types';

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export type TokenRefresher = (connection: PosConnection) => Promise<TokenRefreshResult>;

const refreshers: Partial<Record<string, TokenRefresher>> = {};

export function registerTokenRefresher(provider: string, refresher: TokenRefresher): void {
  refreshers[provider] = refresher;
}

export function isTokenExpired(expiresAt: string, bufferMinutes: number = 5): boolean {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  const buffer = bufferMinutes * 60 * 1000;
  return now >= expiry - buffer;
}

export function isTokenExpiringSoon(expiresAt: string, thresholdMinutes: number = 30): boolean {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  const threshold = thresholdMinutes * 60 * 1000;
  return now >= expiry - threshold;
}

export async function refreshToken(connection: PosConnection): Promise<TokenRefreshResult> {
  const refresher = refreshers[connection.provider];
  if (!refresher) throw new Error(`No token refresher registered for ${connection.provider}`);
  return refresher(connection);
}

export function getTokenStatus(connection: PosConnection): 'valid' | 'expiring_soon' | 'expired' {
  if (isTokenExpired(connection.tokenExpiresAt)) return 'expired';
  if (isTokenExpiringSoon(connection.tokenExpiresAt)) return 'expiring_soon';
  return 'valid';
}
