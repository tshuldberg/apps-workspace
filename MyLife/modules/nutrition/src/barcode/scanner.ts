/**
 * Barcode scanner hook for Expo/React Native.
 *
 * Uses expo-camera BarCodeScanner to scan barcodes and look up foods.
 * Checks local cache first, then falls back to Open Food Facts API.
 *
 * This file defines the hook interface and types. The actual React hook
 * implementation requires the mobile app context (expo-camera dependency).
 * This module provides the lookup logic that the hook calls.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { BarcodeResult } from '../api/types';
import { lookupBarcode } from '../api';

export interface BarcodeScanResult {
  barcode: string;
  type: string;
  result: BarcodeResult;
}

/**
 * Handle a barcode scan event.
 * Checks cache, then APIs, returns the lookup result.
 */
export async function handleBarcodeScan(
  db: DatabaseAdapter,
  barcode: string,
): Promise<BarcodeScanResult> {
  const result = await lookupBarcode(db, barcode);
  return {
    barcode,
    type: 'EAN13',
    result,
  };
}
