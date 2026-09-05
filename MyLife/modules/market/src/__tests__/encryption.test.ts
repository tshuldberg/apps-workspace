import { describe, expect, it } from 'vitest';
import {
  decryptMarketMessageBody,
  encryptMarketMessageBody,
} from '../encryption';

describe('market message encryption', () => {
  it('round-trips encrypted market messages', async () => {
    const encrypted = await encryptMarketMessageBody(
      'Meet me in the app to discuss pickup.',
      'shared-secret',
    );

    expect(encrypted.contentType).toBe('application/e2ee+ciphertext');
    expect(encrypted.ciphertext).toBeTruthy();

    const decrypted = await decryptMarketMessageBody(encrypted, 'shared-secret');
    expect(decrypted).toBe('Meet me in the app to discuss pickup.');
  });
});
