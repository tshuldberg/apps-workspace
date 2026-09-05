import type { MetadataRoute } from 'next';

/**
 * Web app manifest so the hub installs as an app from the browser
 * (Add to Home Screen on iOS, Install on Android/desktop Chrome).
 * iOS ignores manifest icons and uses the apple-icon route instead.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MyLife',
    short_name: 'MyLife',
    description: 'Your private life hub',
    start_url: '/',
    display: 'standalone',
    background_color: '#131318',
    theme_color: '#131318',
    icons: [
      {
        src: '/icons/mylife-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/mylife-icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
