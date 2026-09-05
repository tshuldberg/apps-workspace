/**
 * Camera permission and barcode scanning utilities.
 */

import { Camera } from 'expo-camera';

/**
 * Request camera permission for barcode scanning.
 * Returns true if granted, false otherwise.
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await Camera.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Barcode types that encode ISBNs.
 * EAN-13 is the standard for ISBN-13 barcodes on books.
 */
export const ISBN_BARCODE_TYPES = ['ean13', 'ean8'] as const;

/**
 * Validate that a scanned string looks like a valid ISBN.
 * ISBN-13: 13 digits starting with 978 or 979
 * ISBN-10: 10 characters (digits, last may be X)
 */
export function isValidISBN(code: string): boolean {
  if (/^\d{13}$/.test(code) && (code.startsWith('978') || code.startsWith('979'))) {
    return true;
  }
  if (/^\d{9}[\dXx]$/.test(code)) {
    return true;
  }
  return false;
}
