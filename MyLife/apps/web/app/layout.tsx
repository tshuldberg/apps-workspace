import type { Metadata, Viewport } from 'next';
import { Sidebar } from '@/components/Sidebar';
import { Providers } from '@/components/Providers';
import { CommandPalette } from '@/components/CommandPalette';
import { RemindersProvider } from '@/components/RemindersProvider';
import { runAutoBackupScheduler } from '@/lib/backup-scheduler';
import { getEnabledModuleIds } from './actions';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyLife',
  description: 'Your private life hub',
  appleWebApp: {
    capable: true,
    title: 'MyLife',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#131318',
};

/**
 * Every page reads the user's live local SQLite database, so build-time
 * static prerendering is never correct: `next build` was baking snapshots of
 * the builder's database into 422 routes (e.g. `/` permanently redirected to
 * onboarding because onboarding was incomplete at build time). Render
 * everything per request; there is no cross-user cache to win here.
 */
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enabledIds = await getEnabledModuleIds();
  // Fire-and-forget daily auto-backup check. Internally debounced to at most
  // once per 24h via hub_preferences; never throws.
  void runAutoBackupScheduler();

  return (
    <html lang="en">
      <body>
        <Providers initialEnabledIds={enabledIds}>
          <CommandPalette />
          <RemindersProvider>
            <div style={{ display: 'flex', minHeight: '100vh' }}>
              <Sidebar />
              <main
                data-main
                style={{
                  flex: 1,
                  marginLeft: 'var(--sidebar-width)',
                  padding: '32px',
                }}
              >
                {children}
              </main>
            </div>
          </RemindersProvider>
        </Providers>
      </body>
    </html>
  );
}
