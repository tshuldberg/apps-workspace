import type { WebhookEvent, NormalizedEvent, PosProvider } from './types';
import { createHmac } from 'crypto';

export function verifyHmacSignature(payload: string, signature: string, secret: string, algorithm: string = 'sha256'): boolean {
  const computed = createHmac(algorithm, secret).update(payload).digest('hex');
  return computed === signature || `sha256=${computed}` === signature;
}

export type EventNormalizer = (event: WebhookEvent) => NormalizedEvent | null;

const normalizers: Partial<Record<PosProvider, EventNormalizer>> = {};

export function registerNormalizer(provider: PosProvider, normalizer: EventNormalizer): void {
  normalizers[provider] = normalizer;
}

export function normalizeEvent(event: WebhookEvent): NormalizedEvent | null {
  const normalizer = normalizers[event.provider];
  if (!normalizer) return null;
  return normalizer(event);
}

export function isValidWebhook(payload: string, signature: string, secret: string, provider: PosProvider): boolean {
  switch (provider) {
    case 'square':
      return verifyHmacSignature(payload, signature, secret, 'sha256');
    case 'toast':
      return verifyHmacSignature(payload, signature, secret, 'sha256');
    case 'lightspeed_k':
    case 'lightspeed_u':
      return verifyHmacSignature(payload, signature, secret, 'sha256');
    case 'clover':
      return verifyHmacSignature(payload, signature, secret, 'sha256');
    default:
      return false;
  }
}
