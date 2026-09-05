/**
 * Local file byte access via expo-file-system. Shared by the live
 * reviewed-vote flow and the background proof-draft sweep so both read
 * proof bytes the exact same way (plan 33 Phase 3.3).
 */

import * as FileSystem from 'expo-file-system/legacy';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, '');
  const output: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(output);
}

export async function readFileBytes(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToBytes(base64);
}

/** True only when the file verifiably does not exist (not on read errors). */
export async function fileIsMissing(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return !info.exists;
  } catch {
    return false;
  }
}
