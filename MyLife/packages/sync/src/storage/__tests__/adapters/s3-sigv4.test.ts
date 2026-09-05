import { describe, expect, it } from 'vitest';
import { hmacSha256 } from '../../../encryption/sha256';
import { bytesToBase64 } from '../../adapters/http';
import { signS3Request, type S3Credentials } from '../../adapters/s3';

const credentials: S3Credentials = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
};
const now = new Date('2013-05-24T00:00:00.000Z');
const encoder = new TextEncoder();

describe('S3 Signature Version 4 known-answer vectors', () => {
  it('matches the AWS GET Object range example', () => {
    const signed = signS3Request({
      method: 'GET',
      url: 'https://examplebucket.s3.amazonaws.com/test.txt',
      headers: { Range: 'bytes=0-9' },
    }, { credentials, region: 'us-east-1', now });

    expect(signed.signature).toBe('f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
    expect(signed.signedHeaders).toBe('host;range;x-amz-content-sha256;x-amz-date');
  });

  it('matches the AWS PUT Object example', () => {
    const signed = signS3Request({
      method: 'PUT',
      url: 'https://examplebucket.s3.amazonaws.com/test$file.text',
      headers: {
        Date: 'Fri, 24 May 2013 00:00:00 GMT',
        'x-amz-storage-class': 'REDUCED_REDUNDANCY',
      },
      body: encoder.encode('Welcome to Amazon S3.'),
    }, { credentials, region: 'us-east-1', now });

    expect(signed.payloadHash).toBe('44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072');
    expect(signed.signature).toBe('98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd');
  });

  it('matches the AWS GET Bucket lifecycle example', () => {
    const signed = signS3Request({
      method: 'GET',
      url: 'https://examplebucket.s3.amazonaws.com/?lifecycle',
    }, { credentials, region: 'us-east-1', now });

    expect(signed.signature).toBe('fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543');
  });

  it('matches the AWS List Objects query-order example', () => {
    const signed = signS3Request({
      method: 'GET',
      url: 'https://examplebucket.s3.amazonaws.com/?prefix=J&max-keys=2',
    }, { credentials, region: 'us-east-1', now });

    expect(signed.signature).toBe('34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7');
    expect(signed.canonicalRequest).toContain('\nmax-keys=2&prefix=J\n');
  });
});

describe('hmacSha256 RFC 4231 vectors', () => {
  it('matches test case 1', () => {
    const digest = hmacSha256(new Uint8Array(20).fill(0x0b), encoder.encode('Hi There'));
    expect(toHex(digest)).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  });

  it('matches test case 2', () => {
    const digest = hmacSha256(encoder.encode('Jefe'), encoder.encode('what do ya want for nothing?'));
    expect(toHex(digest)).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });
});

describe('RN-safe base64 encoding', () => {
  it('matches the RFC 4648 padding vectors used by S3 checksum headers', () => {
    expect(bytesToBase64(encoder.encode(''))).toBe('');
    expect(bytesToBase64(encoder.encode('f'))).toBe('Zg==');
    expect(bytesToBase64(encoder.encode('fo'))).toBe('Zm8=');
    expect(bytesToBase64(encoder.encode('foo'))).toBe('Zm9v');
  });
});

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
