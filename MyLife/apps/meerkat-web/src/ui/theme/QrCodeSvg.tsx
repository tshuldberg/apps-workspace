import {
  encodeQrMatrix,
  qrCanEncode,
  qrMatrixToSvgPath,
} from '@mylife/meerkat-theme';

// A QR symbol rendered as inline SVG from the bundled pure-TS encoder (shared
// qrMatrixToSvgPath, same as mobile's react-native-svg path). Black-on-white
// regardless of theme so it stays scannable. Returns null when the blob is too
// long to encode (the caller shows a copy/link fallback).
export function QrCodeSvg({
  value,
  size = 196,
}: {
  value: string;
  size?: number;
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
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${dimension} ${dimension}`}
      role="img"
      aria-label="Theme QR code"
      shapeRendering="crispEdges"
    >
      <rect x={0} y={0} width={dimension} height={dimension} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
