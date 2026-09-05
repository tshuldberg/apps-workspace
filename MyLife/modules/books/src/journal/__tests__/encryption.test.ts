import { describe, it, expect } from 'vitest';
import { encryptContent, decryptContent } from '../encryption';

describe('encryption round-trip', () => {
  it('encrypts and decrypts back to original', async () => {
    const original = 'This is my private journal entry about life.';
    const passphrase = 'my-strong-passphrase';

    const { encrypted, salt, iv } = await encryptContent(original, passphrase);

    expect(encrypted).not.toBe(original);
    expect(salt).toBeTruthy();
    expect(iv).toBeTruthy();

    const decrypted = await decryptContent(encrypted, passphrase, salt, iv);
    expect(decrypted).toBe(original);
  });

  it('handles empty content', async () => {
    const original = '';
    const { encrypted, salt, iv } = await encryptContent(original, 'pass');
    const decrypted = await decryptContent(encrypted, 'pass', salt, iv);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertexts for same content (random salt/iv)', async () => {
    const content = 'Same content twice';
    const passphrase = 'same-passphrase';

    const result1 = await encryptContent(content, passphrase);
    const result2 = await encryptContent(content, passphrase);

    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.salt).not.toBe(result2.salt);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it('fails to decrypt with wrong passphrase', async () => {
    const { encrypted, salt, iv } = await encryptContent('secret', 'correct');
    await expect(
      decryptContent(encrypted, 'wrong', salt, iv),
    ).rejects.toThrow();
  });

  it('handles unicode content', async () => {
    const original = 'Journal: cafe, resume, naive -- special chars & symbols';
    const { encrypted, salt, iv } = await encryptContent(original, 'pass123');
    const decrypted = await decryptContent(encrypted, 'pass123', salt, iv);
    expect(decrypted).toBe(original);
  });

  it('handles long content', async () => {
    const original = 'A'.repeat(10_000);
    const { encrypted, salt, iv } = await encryptContent(original, 'pass');
    const decrypted = await decryptContent(encrypted, 'pass', salt, iv);
    expect(decrypted).toBe(original);
  });
});
