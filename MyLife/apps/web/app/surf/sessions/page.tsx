import { ModuleWebFallback } from '@/components/module-web-fallback';

export default function SurfSessionsFallbackPage() {
  return (
    <ModuleWebFallback
      moduleName="MySurf"
      summary="Session logging on web is still in beta migration from the standalone MySurf app."
      accentColor="var(--accent-surf, #3B82F6)"
      primaryHref="/surf"
      primaryLabel="Open Surf Dashboard"
      links={[
        { href: '/surf/regions', label: 'Browse Zones' },
        { href: '/surf/feed', label: 'Open Feed' },
      ]}
    />
  );
}
