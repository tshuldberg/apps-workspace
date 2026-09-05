// Turn a QR boolean matrix into an SVG path string, shared by both surfaces:
// mobile renders it with react-native-svg <Path>, web renders it as an inline
// SVG <path>. Pure: no react, no DOM. The path is one move-per-dark-module so a
// single <Path> draws the whole symbol (far cheaper than one node per module).

import type { QrMatrix } from './qr';

export interface QrSvgPath {
  /** SVG path `d` string: one 1x1 square per dark module. */
  path: string;
  /** Total side length in module units, including the quiet zone on both sides. */
  dimension: number;
}

/**
 * Build the SVG path for a QR matrix. `quietZone` is the mandatory light border
 * (>= 4 modules per the QR spec) that lets a scanner lock onto the symbol; it is
 * included in `dimension` and offsets every module.
 */
export function qrMatrixToSvgPath(
  matrix: boolean[][],
  quietZone = 4,
): QrSvgPath {
  const size = matrix.length;
  let path = '';
  for (let row = 0; row < size; row++) {
    const cells = matrix[row];
    for (let col = 0; col < cells.length; col++) {
      if (cells[col]) {
        path += `M${col + quietZone} ${row + quietZone}h1v1h-1z`;
      }
    }
  }
  return { path, dimension: size + quietZone * 2 };
}

/** Convenience overload taking the full {@link QrMatrix}. */
export function qrToSvgPath(qr: QrMatrix, quietZone = 4): QrSvgPath {
  return qrMatrixToSvgPath(qr.matrix, quietZone);
}
