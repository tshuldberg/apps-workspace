import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  encodeQrMatrix,
  qrCanEncode,
  qrMatrixToSvgPath,
} from '@mylife/meerkat-theme';

// A QR symbol rendered from the bundled pure-TS encoder via react-native-svg.
// Deliberately black-on-white regardless of the active theme: a QR needs high
// contrast to scan, so theming the modules would break scannability. Returns
// null when the blob is too long to encode (the caller shows a copy/link
// fallback). One <Path> draws the whole symbol. accessibilityLabel defaults to
// the theme-code copy; callers in other flows (e.g. the friend code) pass their
// own so the screen reader announces the right thing.
export function QrCode({
  value,
  size = 220,
  accessibilityLabel = 'Theme QR code',
}: {
  value: string;
  size?: number;
  accessibilityLabel?: string;
}): React.ReactElement | null {
  if (!qrCanEncode(value)) return null;

  let matrix: boolean[][];
  try {
    matrix = encodeQrMatrix(value).matrix;
  } catch {
    return null;
  }

  const { path, dimension } = qrMatrixToSvgPath(matrix);
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${dimension} ${dimension}`}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Rect x={0} y={0} width={dimension} height={dimension} fill="#FFFFFF" />
      <Path d={path} fill="#000000" />
    </Svg>
  );
}
