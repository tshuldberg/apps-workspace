import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * apple-touch-icon: what iOS shows on the home screen after Add to Home
 * Screen. iOS requires a PNG (SVG manifest icons are ignored), so this route
 * pre-renders one. iOS squares the corners itself; no radius here.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#131318',
          color: '#FFB877',
          fontSize: 110,
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        M
      </div>
    ),
    size,
  );
}
