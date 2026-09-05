import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

/** Favicon: obsidian rounded square with the MyLife accent monogram. */
export default function Icon() {
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
          borderRadius: 14,
          color: '#FFB877',
          fontSize: 40,
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
