import { describe, expect, it, vi } from 'vitest';
import {
  ISBN_BARCODE_TYPES,
  isValidISBN,
  requestCameraPermission,
} from '../scanner';

const requestCameraPermissionsAsyncMock = vi.fn();

vi.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: (...args: unknown[]) =>
      requestCameraPermissionsAsyncMock(...args),
  },
}));

describe('mobile scanner helpers', () => {
  it('requests camera permission and returns granted status', async () => {
    requestCameraPermissionsAsyncMock.mockResolvedValueOnce({ status: 'granted' });
    await expect(requestCameraPermission()).resolves.toBe(true);

    requestCameraPermissionsAsyncMock.mockResolvedValueOnce({ status: 'denied' });
    await expect(requestCameraPermission()).resolves.toBe(false);
  });

  it('exposes expected ISBN barcode type hints', () => {
    expect(ISBN_BARCODE_TYPES).toEqual(['ean13', 'ean8']);
  });

  it('validates ISBN-10 and ISBN-13 formats', () => {
    expect(isValidISBN('9780132350884')).toBe(true);
    expect(isValidISBN('9791234567890')).toBe(true);
    expect(isValidISBN('0132350882')).toBe(true);
    expect(isValidISBN('123456789X')).toBe(true);

    expect(isValidISBN('12345')).toBe(false);
    expect(isValidISBN('9770132350884')).toBe(false);
    expect(isValidISBN('ABCDEFGHIJ')).toBe(false);
  });
});
